"""
Precompute artifacts for week 2 that take longer than ~5 minutes in Google Colab.

Everything else in the seminar notebook is trained live (with a fixed seed).
The rule for what lives here is the same as in week 1:

    > 5 min in Colab  -> artifact, committed to week02_language_modelling/artifacts/
    < 5 min in Colab  -> trained live in the notebook

Run:
    python precompute.py --data-dir data --out artifacts
    python precompute.py --data-dir data --out artifacts --only tokenizers lm
    python precompute.py --data-dir data --out artifacts --only seq2seq sweep

Steps (and what they write):
    tokenizers  bpe_jokes_8k.json, bpe_de_8k.json, bpe_en_8k.json
    lm          lm_rnn.pt, lm_lstm.pt, lm_gru.pt, lm_curves.json
    seq2seq     seq2seq_lstm.pt, seq2seq_curves.json
    sweep       seq2seq_hidden_sweep.json, seq2seq_lstm_h64.pt, seq2seq_lstm_h128.pt
                (bottleneck width 64 / 128, plus the 256 run from `seq2seq`)

On a 2-core CPU the LM step is the slow one (~10 min per epoch per cell on 40k
jokes); pass --lm-jokes 40000 --lm-epochs 5 there. On an M-series Mac or a GPU
drop the flag and train on all ~117k jokes.

Nothing here is required to *read* the notebook: every artifact has the code
that produced it sitting a few lines above the load, behind RECOMPUTE. The model
classes below are copied verbatim into the notebook — if you change one, change
both.
"""

import argparse
import json
import math
import os
import random
import time

import numpy as np
import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence, pack_padded_sequence, pad_packed_sequence
from tokenizers import Tokenizer, models, pre_tokenizers, decoders, trainers

SEED = 42
PAD, UNK, BOS, EOS = 0, 1, 2, 3
SPECIALS = ["[PAD]", "[UNK]", "[BOS]", "[EOS]"]

N_TEST_JOKES = 5_000     # held-out jokes for perplexity, never trained on
N_VAL_JOKES = 2_000      # early-stopping / curves


def log(msg):
    print(f"[precompute] {msg}", flush=True)


def seed_all(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def pick_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


# --------------------------------------------------------------------------
# data
# --------------------------------------------------------------------------

def load_jokes(data_dir):
    with open(os.path.join(data_dir, "anek.txt"), encoding="utf-8") as f:
        raw = f.read()
    jokes = [j.strip() for j in raw.strip().replace("<|startoftext|>", "").split("\n\n")]
    jokes = [j for j in jokes if len(j) >= 20]
    return jokes


def split_jokes(jokes):
    # The same split as in the notebook: shuffle once with the seed, cut off the tail.
    idx = np.random.RandomState(SEED).permutation(len(jokes))
    test = [jokes[i] for i in idx[:N_TEST_JOKES]]
    val = [jokes[i] for i in idx[N_TEST_JOKES:N_TEST_JOKES + N_VAL_JOKES]]
    train = [jokes[i] for i in idx[N_TEST_JOKES + N_VAL_JOKES:]]
    return train, val, test


def load_multi30k(data_dir, split):
    with open(os.path.join(data_dir, f"{split}.de"), encoding="utf-8") as f:
        de = [l.strip() for l in f]
    with open(os.path.join(data_dir, f"{split}.en"), encoding="utf-8") as f:
        en = [l.strip() for l in f]
    assert len(de) == len(en)
    return de, en


# --------------------------------------------------------------------------
# 1. tokenizers
#    The BPE recipe from block 1 of the notebook. Training takes seconds; it is
#    saved so that the weights below are guaranteed to match the vocabulary.
# --------------------------------------------------------------------------

def train_bpe(texts, vocab_size):
    tok = Tokenizer(models.BPE(unk_token="[UNK]"))
    # Metaspace marks word starts with ▁ (reversible), Punctuation splits ",", "-", "?" off words.
    tok.pre_tokenizer = pre_tokenizers.Sequence([pre_tokenizers.Metaspace(), pre_tokenizers.Punctuation()])
    tok.decoder = decoders.Metaspace()
    trainer = trainers.BpeTrainer(vocab_size=vocab_size, special_tokens=SPECIALS, show_progress=False)
    tok.train_from_iterator(texts, trainer)
    return tok


def build_tokenizers(data_dir, out_dir):
    train, _, _ = split_jokes(load_jokes(data_dir))
    t = time.time()
    tok = train_bpe(train, 8_000)
    tok.save(os.path.join(out_dir, "bpe_jokes_8k.json"))
    log(f"bpe_jokes_8k: {tok.get_vocab_size()} tokens, {time.time() - t:.1f}s")

    de, en = load_multi30k(data_dir, "train")
    for name, texts in [("de", de), ("en", en)]:
        t = time.time()
        tok = train_bpe(texts, 8_000)
        tok.save(os.path.join(out_dir, f"bpe_{name}_8k.json"))
        log(f"bpe_{name}_8k: {tok.get_vocab_size()} tokens, {time.time() - t:.1f}s")


# --------------------------------------------------------------------------
# 2. RNN language models  (block 3 of the notebook)
# --------------------------------------------------------------------------

class RNNLM(nn.Module):
    """Embedding -> recurrent cell -> linear over the vocabulary. cell in {rnn, lstm, gru}."""

    def __init__(self, vocab_size, emb=256, hidden=256, cell="lstm", num_layers=1, dropout=0.0):
        super().__init__()
        self.cell = cell
        self.emb = nn.Embedding(vocab_size, emb, padding_idx=PAD)
        rnn_cls = {"rnn": nn.RNN, "lstm": nn.LSTM, "gru": nn.GRU}[cell]
        self.rnn = rnn_cls(emb, hidden, num_layers=num_layers, batch_first=True,
                           dropout=dropout if num_layers > 1 else 0.0)
        self.drop = nn.Dropout(dropout)
        self.out = nn.Linear(hidden, vocab_size)

    def forward(self, x, state=None):
        e = self.drop(self.emb(x))          # (B, T, E)
        h, state = self.rnn(e, state)       # (B, T, H)
        return self.out(self.drop(h)), state  # (B, T, V)


def encode_corpus(tok, texts):
    # [BOS] tokens [EOS] for every text, as a list of LongTensors
    return [torch.tensor([BOS] + enc.ids + [EOS], dtype=torch.long)
            for enc in tok.encode_batch(texts)]


def lm_batches(seqs, batch_size, shuffle, device):
    order = np.random.permutation(len(seqs)) if shuffle else np.arange(len(seqs))
    for i in range(0, len(seqs), batch_size):
        chunk = [seqs[j] for j in order[i:i + batch_size]]
        x = pad_sequence([s[:-1] for s in chunk], batch_first=True, padding_value=PAD)
        y = pad_sequence([s[1:] for s in chunk], batch_first=True, padding_value=PAD)
        yield x.to(device), y.to(device)


@torch.no_grad()
def lm_evaluate(model, seqs, device, batch_size=256):
    """Returns (token-level nll sum, number of predicted tokens)."""
    model.eval()
    nll, n_tok = 0.0, 0
    for x, y in lm_batches(seqs, batch_size, shuffle=False, device=device):
        logits, _ = model(x)
        loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1),
                                           ignore_index=PAD, reduction="sum")
        nll += loss.item()
        n_tok += (y != PAD).sum().item()
    return nll, n_tok


def train_lm(model, train_seqs, val_seqs, device, epochs, lr=2e-3, batch_size=128, clip=1.0, log_every=200):
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    curves = {"epoch": [], "train_ppl": [], "val_ppl": [], "seconds": [], "grad_norms": []}
    t0 = time.time()
    step = 0
    for ep in range(1, epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for x, y in lm_batches(train_seqs, batch_size, shuffle=True, device=device):
            logits, _ = model(x)
            loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1),
                                               ignore_index=PAD)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            gn = nn.utils.clip_grad_norm_(model.parameters(), clip).item()  # pre-clipping norm
            if step % 20 == 0:
                curves["grad_norms"].append(round(gn, 3))
            opt.step()
            k = (y != PAD).sum().item()
            tot += loss.item() * k
            n += k
            step += 1
            if step % log_every == 0:
                log(f"  step {step}  train ppl {math.exp(tot / n):.1f}  grad {gn:.2f}")
        nll, k = lm_evaluate(model, val_seqs, device)
        curves["epoch"].append(ep)
        curves["train_ppl"].append(round(math.exp(tot / n), 3))
        curves["val_ppl"].append(round(math.exp(nll / k), 3))
        curves["seconds"].append(round(time.time() - t0, 1))
        log(f"epoch {ep}: train ppl {curves['train_ppl'][-1]:.1f}  val ppl {curves['val_ppl'][-1]:.1f}  "
            f"({curves['seconds'][-1]:.0f}s)")
    return curves


def build_lms(data_dir, out_dir, epochs, device, n_train=None, batch_size=256):
    seed_all()
    tok = Tokenizer.from_file(os.path.join(out_dir, "bpe_jokes_8k.json"))
    train, val, test = split_jokes(load_jokes(data_dir))
    if n_train:                      # a CPU-sized subset; on a GPU / M-series Mac use everything
        train = train[:n_train]
    train_seqs = encode_corpus(tok, train)
    val_seqs = encode_corpus(tok, val)
    test_seqs = encode_corpus(tok, test)
    n_chars_test = sum(len(t) for t in test)
    log(f"LM data: train {len(train_seqs):,} jokes, {sum(len(s) - 1 for s in train_seqs):,} predicted tokens")

    all_curves = {}
    for cell in ["lstm", "gru", "rnn"]:
        seed_all()
        model = RNNLM(tok.get_vocab_size(), emb=256, hidden=256, cell=cell).to(device)
        n_params = sum(p.numel() for p in model.parameters())
        log(f"--- {cell.upper()}  ({n_params / 1e6:.2f}M params) ---")
        curves = train_lm(model, train_seqs, val_seqs, device, epochs, batch_size=batch_size)
        nll, k = lm_evaluate(model, test_seqs, device)
        curves["test_ppl"] = round(math.exp(nll / k), 3)
        curves["test_bits_per_char"] = round(nll / n_chars_test / math.log(2), 4)
        curves["n_params"] = n_params
        curves["config"] = {"emb": 256, "hidden": 256, "cell": cell, "epochs": epochs,
                            "n_train_jokes": len(train_seqs), "batch_size": batch_size}
        all_curves[cell] = curves
        torch.save(model.state_dict(), os.path.join(out_dir, f"lm_{cell}.pt"))
        log(f"{cell}: test ppl {curves['test_ppl']:.1f}, {curves['test_bits_per_char']:.3f} bits/char")
        with open(os.path.join(out_dir, "lm_curves.json"), "w") as f:
            json.dump(all_curves, f, indent=1)


# --------------------------------------------------------------------------
# 3. seq2seq LSTM  (block 5 of the notebook)
# --------------------------------------------------------------------------

class Seq2SeqLSTM(nn.Module):
    """Bidirectional LSTM encoder -> one vector -> LSTM decoder. No attention: the whole
    source sentence has to squeeze through (h0, c0)."""

    def __init__(self, src_vocab, trg_vocab, emb=256, hidden=256, dropout=0.2):
        super().__init__()
        self.hidden = hidden
        self.src_emb = nn.Embedding(src_vocab, emb, padding_idx=PAD)
        self.trg_emb = nn.Embedding(trg_vocab, emb, padding_idx=PAD)
        self.encoder = nn.LSTM(emb, hidden, batch_first=True, bidirectional=True)
        self.decoder = nn.LSTM(emb, hidden, batch_first=True)
        self.h_proj = nn.Linear(2 * hidden, hidden)
        self.c_proj = nn.Linear(2 * hidden, hidden)
        self.drop = nn.Dropout(dropout)
        self.out = nn.Linear(hidden, trg_vocab)

    def encode(self, src, src_len):
        e = self.drop(self.src_emb(src))
        packed = pack_padded_sequence(e, src_len.cpu(), batch_first=True, enforce_sorted=False)
        _, (h, c) = self.encoder(packed)                      # h, c: (2, B, H) — forward and backward
        h = torch.tanh(self.h_proj(torch.cat([h[0], h[1]], dim=-1)))  # (B, H)  <- the bottleneck
        c = torch.tanh(self.c_proj(torch.cat([c[0], c[1]], dim=-1)))
        return h.unsqueeze(0), c.unsqueeze(0)

    def decode_step(self, y_prev, state):
        e = self.drop(self.trg_emb(y_prev))                   # (B, 1, E)
        o, state = self.decoder(e, state)
        return self.out(self.drop(o)), state                  # (B, 1, V)

    def forward(self, src, src_len, trg_in):
        # teacher forcing: the decoder reads the gold prefix, whatever it predicted
        state = self.encode(src, src_len)
        e = self.drop(self.trg_emb(trg_in))
        o, _ = self.decoder(e, state)
        return self.out(self.drop(o))                         # (B, T, V)

    @torch.no_grad()
    def greedy(self, src, src_len, max_len=40):
        state = self.encode(src, src_len)
        y = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=src.device)
        out, done = [], torch.zeros(src.size(0), dtype=torch.bool, device=src.device)
        for _ in range(max_len):
            logits, state = self.decode_step(y, state)
            y = logits[:, -1].argmax(-1, keepdim=True)
            y = y.masked_fill(done.unsqueeze(1), PAD)
            out.append(y)
            done |= y.squeeze(1) == EOS
            if done.all():
                break
        return torch.cat(out, dim=1)


def s2s_encode(tok_src, tok_trg, src_texts, trg_texts, max_len=50):
    src = [torch.tensor(e.ids[:max_len], dtype=torch.long) for e in tok_src.encode_batch(src_texts)]
    trg = [torch.tensor([BOS] + e.ids[:max_len] + [EOS], dtype=torch.long) for e in tok_trg.encode_batch(trg_texts)]
    return src, trg


def s2s_batches(src, trg, batch_size, shuffle, device):
    order = np.random.permutation(len(src)) if shuffle else np.arange(len(src))
    for i in range(0, len(src), batch_size):
        idx = order[i:i + batch_size]
        s = pad_sequence([src[j] for j in idx], batch_first=True, padding_value=PAD)
        t = pad_sequence([trg[j] for j in idx], batch_first=True, padding_value=PAD)
        s_len = torch.tensor([len(src[j]) for j in idx])
        yield s.to(device), s_len.to(device), t.to(device)


def ids_to_text(tok, ids):
    out = []
    for row in ids.tolist():
        cut = row.index(EOS) if EOS in row else len(row)
        out.append(tok.decode([i for i in row[:cut] if i not in (PAD, BOS, EOS)]))
    return out


@torch.no_grad()
def s2s_bleu(model, tok_trg, src, trg, refs, device, batch_size=128):
    import sacrebleu
    model.eval()
    hyps = []
    for s, s_len, _ in s2s_batches(src, trg, batch_size, shuffle=False, device=device):
        hyps.extend(ids_to_text(tok_trg, model.greedy(s, s_len)))
    return sacrebleu.corpus_bleu(hyps, [refs]).score, hyps


def bleu_by_src_len(hyps, refs, src):
    """BLEU per source-length bucket: the plot that motivates attention next week."""
    import sacrebleu
    lens = [len(s) for s in src]
    out = {}
    for lo, hi in [(0, 10), (10, 15), (15, 20), (20, 25), (25, 100)]:
        idx = [i for i, l in enumerate(lens) if lo <= l < hi]
        if len(idx) >= 20:
            out[f"{lo}-{hi}"] = round(sacrebleu.corpus_bleu([hyps[i] for i in idx], [[refs[i] for i in idx]]).score, 2)
    return out


def train_seq2seq(model, data, tok_en, device, epochs, lr=1e-3, batch_size=64, clip=1.0):
    (tr_src, tr_trg), (va_src, va_trg, va_refs) = data
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    curves = {"epoch": [], "train_loss": [], "val_loss": [], "val_bleu": [], "seconds": []}
    t0 = time.time()
    for ep in range(1, epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for s, s_len, t in s2s_batches(tr_src, tr_trg, batch_size, shuffle=True, device=device):
            logits = model(s, s_len, t[:, :-1])
            loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), t[:, 1:].reshape(-1),
                                               ignore_index=PAD)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), clip)
            opt.step()
            k = (t[:, 1:] != PAD).sum().item()
            tot += loss.item() * k
            n += k
        model.eval()
        vtot, vn = 0.0, 0
        with torch.no_grad():
            for s, s_len, t in s2s_batches(va_src, va_trg, 128, shuffle=False, device=device):
                logits = model(s, s_len, t[:, :-1])
                loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), t[:, 1:].reshape(-1),
                                                   ignore_index=PAD, reduction="sum")
                vtot += loss.item()
                vn += (t[:, 1:] != PAD).sum().item()
        bleu, _ = s2s_bleu(model, tok_en, va_src, va_trg, va_refs, device)
        curves["epoch"].append(ep)
        curves["train_loss"].append(round(tot / n, 4))
        curves["val_loss"].append(round(vtot / vn, 4))
        curves["val_bleu"].append(round(bleu, 2))
        curves["seconds"].append(round(time.time() - t0, 1))
        log(f"epoch {ep}: train loss {tot / n:.3f}  val loss {vtot / vn:.3f}  val BLEU {bleu:.2f}  "
            f"({time.time() - t0:.0f}s)")
    return curves


def load_s2s_data(data_dir, out_dir):
    tok_de = Tokenizer.from_file(os.path.join(out_dir, "bpe_de_8k.json"))
    tok_en = Tokenizer.from_file(os.path.join(out_dir, "bpe_en_8k.json"))
    tr_de, tr_en = load_multi30k(data_dir, "train")
    va_de, va_en = load_multi30k(data_dir, "val")
    te_de, te_en = load_multi30k(data_dir, "test")
    tr = s2s_encode(tok_de, tok_en, tr_de, tr_en)
    va = s2s_encode(tok_de, tok_en, va_de, va_en)
    te = s2s_encode(tok_de, tok_en, te_de, te_en)
    return tok_de, tok_en, (tr, (*va, va_en)), (*te, te_en)


def build_seq2seq(data_dir, out_dir, epochs, device):
    seed_all()
    tok_de, tok_en, data, (te_src, te_trg, te_refs) = load_s2s_data(data_dir, out_dir)
    model = Seq2SeqLSTM(tok_de.get_vocab_size(), tok_en.get_vocab_size(), emb=256, hidden=256).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    log(f"--- Seq2SeqLSTM hidden=256 ({n_params / 1e6:.2f}M params), {epochs} epochs ---")
    curves = train_seq2seq(model, data, tok_en, device, epochs)
    bleu, hyps = s2s_bleu(model, tok_en, te_src, te_trg, te_refs, device)
    curves["test_bleu"] = round(bleu, 2)
    curves["bleu_by_src_len"] = bleu_by_src_len(hyps, te_refs, te_src)
    curves["n_params"] = n_params
    curves["config"] = {"emb": 256, "hidden": 256, "dropout": 0.2, "epochs": epochs}
    torch.save(model.state_dict(), os.path.join(out_dir, "seq2seq_lstm.pt"))
    with open(os.path.join(out_dir, "seq2seq_curves.json"), "w") as f:
        json.dump(curves, f, indent=1)
    log(f"seq2seq: test BLEU {bleu:.2f}")


def build_sweep(data_dir, out_dir, epochs, device):
    """How much does the bottleneck width matter? Same recipe, smaller hidden sizes;
    the 256 entry is the main model from build_seq2seq (same number of epochs)."""
    tok_de, tok_en, data, (te_src, te_trg, te_refs) = load_s2s_data(data_dir, out_dir)
    sweep = {}
    main_path = os.path.join(out_dir, "seq2seq_curves.json")
    if os.path.exists(main_path):
        main = json.load(open(main_path))
        sweep["256"] = {"curves": {k: main[k] for k in ["epoch", "train_loss", "val_loss", "val_bleu", "seconds"]},
                        "test_bleu": main["test_bleu"], "bleu_by_src_len": main["bleu_by_src_len"],
                        "n_params": main["n_params"]}
    for hidden in [64, 128]:
        seed_all()
        model = Seq2SeqLSTM(tok_de.get_vocab_size(), tok_en.get_vocab_size(), emb=hidden, hidden=hidden).to(device)
        log(f"--- sweep hidden={hidden} ({sum(p.numel() for p in model.parameters()) / 1e6:.2f}M), {epochs} epochs ---")
        curves = train_seq2seq(model, data, tok_en, device, epochs)
        bleu, hyps = s2s_bleu(model, tok_en, te_src, te_trg, te_refs, device)
        buckets = bleu_by_src_len(hyps, te_refs, te_src)
        sweep[str(hidden)] = {"curves": curves, "test_bleu": round(bleu, 2), "bleu_by_src_len": buckets,
                              "n_params": sum(p.numel() for p in model.parameters())}
        torch.save(model.state_dict(), os.path.join(out_dir, f"seq2seq_lstm_h{hidden}.pt"))
        with open(os.path.join(out_dir, "seq2seq_hidden_sweep.json"), "w") as f:
            json.dump(sweep, f, indent=1)
        log(f"hidden={hidden}: test BLEU {bleu:.2f}  by length {buckets}")


# --------------------------------------------------------------------------

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--out", default="artifacts")
    ap.add_argument("--only", nargs="*", default=["tokenizers", "lm", "seq2seq", "sweep"])
    ap.add_argument("--lm-epochs", type=int, default=6)
    ap.add_argument("--lm-jokes", type=int, default=None, help="train the LMs on the first N jokes only (CPU budget)")
    ap.add_argument("--s2s-epochs", type=int, default=10)
    ap.add_argument("--device", default=None)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    device = torch.device(args.device) if args.device else pick_device()
    log(f"device: {device}")

    if "tokenizers" in args.only:
        build_tokenizers(args.data_dir, args.out)
    if "lm" in args.only:
        build_lms(args.data_dir, args.out, args.lm_epochs, device, n_train=args.lm_jokes)
    if "seq2seq" in args.only:
        build_seq2seq(args.data_dir, args.out, args.s2s_epochs, device)
    if "sweep" in args.only:
        build_sweep(args.data_dir, args.out, args.s2s_epochs, device)
    log("done")
