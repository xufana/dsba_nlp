"""Export everything the interactive HTML demo needs into one JSON bundle.

Run from week02_language_modelling/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).

Every number the page shows is produced here, with the notebook's own code
(copied verbatim: NGramLM, RNNLM, Seq2SeqLSTM, the decoding steps), on the
notebook's split (seed 42, 5 000 test / 2 000 val). The LSTM itself is
exported as quantised weights so the page can run it in the browser.
"""
import base64
import json
import math
import os
import random
import re
import time
import warnings
from collections import Counter, defaultdict

import numpy as np
import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence, pack_padded_sequence
from tokenizers import Tokenizer, models, pre_tokenizers, decoders, trainers

warnings.filterwarnings("ignore")

SEED = 42
DATA_DIR = "../data"
ART_DIR = "../artifacts"
NB_PATH = "../week02_language_modelling.ipynb"
PAD, UNK, BOS, EOS = 0, 1, 2, 3
SPECIALS = ["[PAD]", "[UNK]", "[BOS]", "[EOS]"]
BOS_TOK, EOS_TOK, UNK_TOK = "[BOS]", "[EOS]", "[UNK]"
N_SHIP = 8_000          # train jokes shipped to the page for the in-browser BPE / n-gram demos

T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def seed_all(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


device = torch.device("cuda" if torch.cuda.is_available()
                      else "mps" if torch.backends.mps.is_available() else "cpu")
log(f"device: {device}")

D = {}


def f16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float16).tobytes()).decode()


def i8(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.int8).tobytes()).decode()


# ================================================================== 0. data
with open(f"{DATA_DIR}/anek.txt", encoding="utf-8") as f:
    raw = f.read()
jokes = [j.strip() for j in raw.strip().replace("<|startoftext|>", "").split("\n\n")]
jokes = [j for j in jokes if len(j) >= 20]
N_TEST, N_VAL = 5_000, 2_000
idx = np.random.RandomState(SEED).permutation(len(jokes))
test = [jokes[i] for i in idx[:N_TEST]]
val = [jokes[i] for i in idx[N_TEST:N_TEST + N_VAL]]
train = [jokes[i] for i in idx[N_TEST + N_VAL:]]

lens = np.array([len(j) for j in train])
hist, edges = np.histogram(lens, bins=80, range=(0, 600))


def tokenize_words(text):
    return re.findall(r"\w+", text.lower())


word_counts = Counter(w for j in train for w in tokenize_words(j))
n_tokens = sum(word_counts.values())
hapax = sum(1 for c in word_counts.values() if c == 1)
freqs = np.array(sorted(word_counts.values(), reverse=True))
ranks = np.unique(np.round(np.logspace(0, math.log10(len(freqs)), 220)).astype(int))
ranks = ranks[ranks <= len(freqs)]

D["corpus"] = {
    "nTrain": len(train), "nVal": len(val), "nTest": len(test),
    "charsTrain": int(lens.sum()),
    "examples": train[:3],
    "lenHist": {"counts": hist.tolist(), "edges": edges.tolist()},
    "median": float(np.median(lens)), "p95": float(np.percentile(lens, 95)),
    "nTokens": n_tokens, "nTypes": len(word_counts), "hapax": hapax,
    "topWords": [w for w, _ in word_counts.most_common(12)],
    "zipf": [[int(r), int(freqs[r - 1])] for r in ranks],
}
D["jokesSample"] = train[:N_SHIP]
log(f"corpus: train {len(train):,}, types {len(word_counts):,}, hapax {hapax:,}")

# =================================================================== 1. BPE


def bpe_train(texts, num_merges, verbose=0):
    word_freq = Counter()
    for text in texts:
        for w in tokenize_words(text):
            word_freq[tuple(w) + ("</w>",)] += 1
    merges, counts = [], []
    for i in range(num_merges):
        pairs = Counter()
        for word, freq in word_freq.items():
            for a, b in zip(word, word[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = max(pairs, key=pairs.get)
        new_word_freq = Counter()
        for word, freq in word_freq.items():
            out, j = [], 0
            while j < len(word):
                if j < len(word) - 1 and (word[j], word[j + 1]) == best:
                    out.append(word[j] + word[j + 1]); j += 2
                else:
                    out.append(word[j]); j += 1
            new_word_freq[tuple(out)] += freq
        word_freq = new_word_freq
        merges.append(best); counts.append(pairs[best])
    return merges, counts


def bpe_encode(word, merges):
    pieces = list(word) + ["</w>"]
    for a, b in merges:
        j = 0
        while j < len(pieces) - 1:
            if pieces[j] == a and pieces[j + 1] == b:
                pieces[j:j + 2] = [a + b]
            else:
                j += 1
    return pieces


t = time.time()
merges300, counts300 = bpe_train(train[:3_000], num_merges=300)
log(f"toy BPE: 300 merges on 3 000 jokes in {time.time() - t:.1f}s; first = {merges300[0]}")
D["bpeToy"] = {
    "nJokes": 3_000, "merges": [list(m) for m in merges300], "counts": counts300,
    "seconds": round(time.time() - t, 1),
    "words": [{"w": w, "pieces": bpe_encode(w, merges300)}
              for w in ["мужик", "мужика", "мужиками", "штирлиц", "программист", "инквизиция"]],
}


def train_bpe(texts, vocab_size):
    tok = Tokenizer(models.BPE(unk_token="[UNK]"))
    tok.pre_tokenizer = pre_tokenizers.Sequence([pre_tokenizers.Metaspace(), pre_tokenizers.Punctuation()])
    tok.decoder = decoders.Metaspace()
    trainer = trainers.BpeTrainer(vocab_size=vocab_size, special_tokens=SPECIALS, show_progress=False)
    tok.train_from_iterator(texts, trainer)
    return tok


t = time.time()
tok_live = train_bpe(train, vocab_size=8_000)
live_s = time.time() - t
tok = Tokenizer.from_file(f"{ART_DIR}/bpe_jokes_8k.json")
V = tok.get_vocab_size()
assert tok.get_vocab() == tok_live.get_vocab(), "live BPE differs from the saved tokenizer"
enc7 = tok.encode(train[7])
D["bpeLib"] = {"seconds": round(live_s, 1), "text": train[7], "tokens": enc7.tokens,
               "roundTrip": tok.decode(enc7.ids) == train[7]}

# the vocabulary dial (block 1.3), exactly as in the notebook
probe = test[:2_000]
n_words = sum(len(tokenize_words(j)) for j in probe)
n_chars = sum(len(j) for j in probe)
dial = []
for Vd in [500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000]:
    t = time.time()
    tk = train_bpe(train, Vd)
    fit_s = time.time() - t
    n_tok = sum(len(e.ids) for e in tk.encode_batch(probe))
    dial.append({"vocab": Vd, "tokPerJoke": n_tok / len(probe), "tokPerWord": n_tok / n_words,
                 "charsPerTok": n_chars / n_tok, "fitS": round(fit_s, 1)})
test_words_flat = [w for j in probe for w in tokenize_words(j)]
oov = sum(1 for w in test_words_flat if w not in word_counts) / len(test_words_flat)
D["dial"] = {"rows": dial, "charsPerJoke": n_chars / len(probe), "wordsPerJoke": n_words / len(probe),
             "charsPerWord": n_chars / n_words, "nWordTypes": len(word_counts), "oovWords": oov}
log("vocabulary dial done")

# the tokenizer itself, for the browser
tj = json.load(open(f"{ART_DIR}/bpe_jokes_8k.json"))
vocab_by_id = [None] * V
for tkn, i in tj["model"]["vocab"].items():
    vocab_by_id[i] = tkn
D["tokenizer"] = {"vocab": vocab_by_id, "merges": [list(m) for m in tj["model"]["merges"]]}
CHECK_STRINGS = [train[7], train[0], "Заходит мужик в бар", "Штирлиц выстрелил в упор.",
                 "- Вы, если бы Путин?- Да... «нет»!", "Hello, world 3.5%", "Однажды", "а  б\nв"] + test[:40]
D["tokCheck"] = [{"text": s, "ids": tok.encode(s).ids, "decoded": tok.decode(tok.encode(s).ids)} for s in CHECK_STRINGS]


def tokenize_bpe(text):
    return tok.encode(text).tokens


# =============================================================== 2. n-grams


def count_ngrams(corpus_tokens, n):
    counts = defaultdict(Counter)
    for tokens in corpus_tokens:
        padded = [BOS_TOK] * (n - 1) + tokens + [EOS_TOK]
        for i in range(n - 1, len(padded)):
            counts[tuple(padded[i - n + 1:i])][padded[i]] += 1
    return counts


class NGramLM:
    def __init__(self, corpus_tokens, max_n=3):
        self.max_n = max_n
        self.counts = {k: count_ngrams(corpus_tokens, k) for k in range(1, max_n + 1)}
        self.totals = {k: {p: sum(c.values()) for p, c in self.counts[k].items()} for k in self.counts}
        self.vocab = set(self.counts[1][()]) | {UNK_TOK}
        self.V = len(self.vocab)

    def _p(self, k, prefix, token, delta):
        pre = prefix[len(prefix) - (k - 1):] if k > 1 else ()
        total = self.totals[k].get(pre, 0)
        if total == 0 and delta == 0:
            return 0.0
        cnt = self.counts[k][pre].get(token, 0) if total else 0
        return (cnt + delta) / (total + delta * self.V)

    def prob(self, token, prefix, n, delta=0.0, interpolate=False):
        prefix = tuple(([BOS_TOK] * (n - 1) + list(prefix))[-(n - 1):]) if n > 1 else ()
        if not interpolate:
            return self._p(n, prefix, token, delta)
        weights = np.array([0.5 ** i for i in range(n)]); weights /= weights.sum()
        return sum(w * self._p(k, prefix, token, delta) for w, k in zip(weights, range(n, 0, -1)))

    def next_distribution(self, prefix, n, delta=0.0, interpolate=False):
        prefix_t = tuple(([BOS_TOK] * (n - 1) + list(prefix))[-(n - 1):]) if n > 1 else ()
        if delta == 0 and not interpolate:
            cand = self.counts[n].get(prefix_t, {})
            total = self.totals[n].get(prefix_t, 0)
            return {t: c / total for t, c in cand.items()} if total else {}
        return {t: self.prob(t, prefix, n, delta, interpolate) for t in self.vocab}


def generate_ngram(lm, prefix="", n=3, delta=0.0, interpolate=False, max_len=60, seed=None, tokenize=tokenize_words):
    rng = np.random.RandomState(seed)
    tokens = tokenize(prefix) if prefix else []
    for _ in range(max_len):
        dist = lm.next_distribution(tokens, n, delta, interpolate)
        if not dist:
            tokens.append("⟂"); break
        cand, p = zip(*dist.items())
        nxt = rng.choice(cand, p=np.array(p) / sum(p))
        if nxt == EOS_TOK:
            break
        tokens.append(nxt)
    return " ".join(tokens)


def evaluate_ngram(lm, texts, tokenize, n, delta=0.0, interpolate=False):
    nll, n_tok, n_chars = 0.0, 0, 0
    for text in texts:
        tokens = [t if t in lm.vocab else UNK_TOK for t in tokenize(text)] + [EOS_TOK]
        for i, tok_ in enumerate(tokens):
            p = lm.prob(tok_, tokens[:i], n, delta, interpolate)
            nll -= math.log(p) if p > 0 else float("-inf")
        n_tok += len(tokens)
        n_chars += len(text)
    return math.exp(nll / n_tok), nll / n_chars / math.log(2)


def unseen_share(train_tok, test_tok, n):
    seen = set()
    for toks in train_tok:
        padded = [BOS_TOK] * (n - 1) + toks + [EOS_TOK]
        seen.update(zip(*[padded[i:] for i in range(n)]))
    total = unseen = 0
    for toks in test_tok:
        padded = [BOS_TOK] * (n - 1) + toks + [EOS_TOK]
        for g in zip(*[padded[i:] for i in range(n)]):
            total += 1
            unseen += g not in seen
    return unseen / total


NGRAM_JOKES = 40_000
train_words = [tokenize_words(j) for j in train]
test_words = [tokenize_words(j) for j in test]
t = time.time()
lm_words5 = NGramLM(train_words[:NGRAM_JOKES], max_n=5)
log(f"n-grams over {sum(len(x) for x in train_words[:NGRAM_JOKES]):,} words in {time.time() - t:.0f}s")

toy = [tokenize_words(j) for j in train[:5]]
toy_counts = count_ngrams(toy, n=3)
some_prefix = next(p for p in toy_counts if BOS_TOK not in p)
D["ngramToy"] = {"joke": train[0], "afterBos": dict(toy_counts[(BOS_TOK, BOS_TOK)]),
                 "prefix": list(some_prefix), "afterPrefix": dict(toy_counts[some_prefix])}

train_joined = "\n".join(" ".join(tokenize_words(j)) for j in train)


def copied_from_train(text, n=8):
    toks = text.split()
    windows = {" ".join(toks[i:i + n]) for i in range(len(toks) - n + 1)}
    return any(w in train_joined for w in windows)


samples = {}
copied = {}
for n in [3, 5]:
    samples[n] = [generate_ngram(lm_words5, n=n, seed=s) for s in range(3)]
    copied[n] = float(np.mean([copied_from_train(generate_ngram(lm_words5, n=n, seed=s, max_len=40)) for s in range(30)]))
ppl_raw, _ = evaluate_ngram(lm_words5, test, tokenize_words, n=3)
D["ngramFirst"] = {
    "nJokes": NGRAM_JOKES,
    "bigramPrefixes": len(lm_words5.counts[2]), "trigramPrefixes": len(lm_words5.counts[3]),
    "samples3": samples[3], "samples5": samples[5],
    "copied3": copied[3], "copied5": copied[5],
    "rawTrigramPpl": "inf" if ppl_raw == float("inf") else ppl_raw,
}
log(f"samples done; raw trigram ppl = {ppl_raw}; copied 3/5 = {copied[3]:.2f}/{copied[5]:.2f}")

train_bpe_tok = [tokenize_bpe(j) for j in train]
test_bpe_tok = [tokenize_bpe(j) for j in test]
ns = [1, 2, 3, 4, 5]
D["sparsity"] = {"n": ns,
                 "words": [unseen_share(train_words, test_words, n) for n in ns],
                 "bpe": [unseen_share(train_bpe_tok, test_bpe_tok, n) for n in ns]}
log("sparsity done")

configs = [
    ("1-gram", 1, 0.01, False),
    ("2-gram, add-1", 2, 1.0, False),
    ("2-gram, add-0.01", 2, 0.01, False),
    ("3-gram, add-1", 3, 1.0, False),
    ("3-gram, add-0.01", 3, 0.01, False),
    ("2-gram, interpolated", 2, 0.01, True),
    ("3-gram, interpolated", 3, 0.01, True),
    ("5-gram, interpolated", 5, 0.01, True),
]
smooth_words = []
for name, n, delta, interp in configs:
    t = time.time()
    ppl, bpc = evaluate_ngram(lm_words5, test, tokenize_words, n, delta, interp)
    smooth_words.append({"model": name, "n": n, "delta": delta, "interp": interp,
                         "ppl": ppl, "bpc": bpc, "evalS": round(time.time() - t, 1)})
n_counts_words3 = sum(len(c) for c in lm_words5.counts[3].values())
del lm_words5, train_joined
import gc; gc.collect()

t = time.time()
lm_bpe = NGramLM(train_bpe_tok[:NGRAM_JOKES], max_n=5)
smooth_bpe = []
for name, n, delta, interp in [("2-gram, interpolated", 2, 0.01, True),
                               ("3-gram, interpolated", 3, 0.01, True),
                               ("5-gram, interpolated", 5, 0.01, True)]:
    ppl, bpc = evaluate_ngram(lm_bpe, test, tokenize_bpe, n, delta, interp)
    smooth_bpe.append({"model": name, "n": n, "ppl": ppl, "bpc": bpc})
n_counts_bpe3 = sum(len(c) for c in lm_bpe.counts[3].values())
D["smoothing"] = {"words": smooth_words, "bpe": smooth_bpe,
                  "nBpeTokens": sum(len(x) for x in train_bpe_tok[:NGRAM_JOKES])}
log("smoothing tables done")
del lm_bpe, train_bpe_tok; gc.collect()

# the running results table, in the notebook's order
results = []


def record(model, tokens, test_ppl, bits_per_char, params=None, train_s=None, note=""):
    results.append({"model": model, "tokens": tokens, "ppl": round(test_ppl, 1), "bpc": round(bits_per_char, 3),
                    "params": params, "trainS": None if train_s is None else round(train_s), "note": note})


r = next(x for x in smooth_words if x["model"] == "3-gram, interpolated")
record("3-gram, interpolated", "words", r["ppl"], r["bpc"], params=f"{n_counts_words3:,} counts", note="count-based")
r = next(x for x in smooth_bpe if x["model"] == "3-gram, interpolated")
record("3-gram, interpolated", "BPE 8k", r["ppl"], r["bpc"], params=f"{n_counts_bpe3:,} counts", note="count-based")

# ============================================================== 3. RNN LMs


def encode_corpus(tok, texts):
    return [torch.tensor([BOS] + enc.ids + [EOS], dtype=torch.long) for enc in tok.encode_batch(texts)]


def lm_batches(seqs, batch_size, shuffle, device=device):
    order = np.random.permutation(len(seqs)) if shuffle else np.arange(len(seqs))
    for i in range(0, len(seqs), batch_size):
        chunk = [seqs[j] for j in order[i:i + batch_size]]
        x = pad_sequence([s[:-1] for s in chunk], batch_first=True, padding_value=PAD)
        y = pad_sequence([s[1:] for s in chunk], batch_first=True, padding_value=PAD)
        yield x.to(device), y.to(device)


train_seqs = encode_corpus(tok, train)
val_seqs = encode_corpus(tok, val)
test_seqs = encode_corpus(tok, test)
x, y = next(lm_batches(train_seqs[:3], batch_size=3, shuffle=False))
show = lambda row: [tok.id_to_token(i) for i in row.tolist()]
D["pipeline"] = {"xShape": list(x.shape), "x": show(x[2][:12]), "y": show(y[2][:12]), "joke": train[2]}


class RNNLM(nn.Module):
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
        e = self.drop(self.emb(x))
        h, state = self.rnn(e, state)
        return self.out(self.drop(h)), state


@torch.no_grad()
def lm_evaluate(model, seqs, texts, batch_size=256):
    model.eval()
    nll, n_tok = 0.0, 0
    for x, y in lm_batches(seqs, batch_size, shuffle=False):
        logits, _ = model(x)
        nll += nn.functional.cross_entropy(logits.reshape(-1, V), y.reshape(-1), ignore_index=PAD, reduction="sum").item()
        n_tok += (y != PAD).sum().item()
    return math.exp(nll / n_tok), nll / sum(len(t) for t in texts) / math.log(2)


def train_lm(model, train_seqs, val_seqs, epochs, lr=2e-3, batch_size=128, clip=1.0):
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    history = []
    for ep in range(1, epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for x, y in lm_batches(train_seqs, batch_size, shuffle=True):
            logits, _ = model(x)
            loss = nn.functional.cross_entropy(logits.reshape(-1, V), y.reshape(-1), ignore_index=PAD)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), clip)
            opt.step()
            k = (y != PAD).sum().item(); tot += loss.item() * k; n += k
        val_ppl, _ = lm_evaluate(model, val_seqs, val)
        history.append({"epoch": ep, "trainPpl": math.exp(tot / n), "valPpl": val_ppl})
        log(f"  epoch {ep}: train ppl {math.exp(tot / n):7.1f}   val ppl {val_ppl:7.1f}")
    return history


@torch.no_grad()
def sample_text(model, prompt="", max_len=60, seed=None):
    model.eval()
    g = torch.Generator(device="cpu").manual_seed(seed) if seed is not None else None
    ids = [BOS] + tok.encode(prompt).ids
    x = torch.tensor([ids], device=device)
    logits, state = model(x)
    for _ in range(max_len):
        probs = torch.softmax(logits[0, -1], dim=-1).cpu()
        nxt = torch.multinomial(probs, 1, generator=g).item()
        if nxt == EOS:
            break
        ids.append(nxt)
        logits, state = model(torch.tensor([[nxt]], device=device), state)
    return tok.decode(ids[1:])


LIVE_JOKES, LIVE_EPOCHS = 8_000, 2
seed_all()
lm_live = RNNLM(V, emb=256, hidden=256, cell="lstm").to(device)
n_params_live = sum(p.numel() for p in lm_live.parameters())
t = time.time()
log(f"training the live LSTM ({LIVE_JOKES} jokes x {LIVE_EPOCHS} epochs) ...")
hist_live = train_lm(lm_live, train_seqs[:LIVE_JOKES], val_seqs, epochs=LIVE_EPOCHS)
live_train_s = time.time() - t
ppl, bpc = lm_evaluate(lm_live, test_seqs, test)
record(f"LSTM, {LIVE_JOKES // 1000}k jokes x {LIVE_EPOCHS} ep (live)", "BPE 8k", ppl, bpc,
       params=f"{n_params_live / 1e6:.1f}M", train_s=live_train_s)
D["lmLive"] = {"nJokes": LIVE_JOKES, "epochs": LIVE_EPOCHS, "params": n_params_live, "history": hist_live,
               "seconds": live_train_s, "ppl": ppl, "bpc": bpc,
               "samples": [sample_text(lm_live, seed=s) for s in range(3)]}
log(f"live LSTM: test ppl {ppl:.1f} in {live_train_s:.0f}s")
del lm_live

with open(f"{ART_DIR}/lm_curves.json") as f:
    lm_curves = json.load(f)
cfg = lm_curves["lstm"]["config"]
lms = {}
for cell in ["rnn", "gru", "lstm"]:
    m = RNNLM(V, emb=256, hidden=256, cell=cell).to(device)
    m.load_state_dict(torch.load(f"{ART_DIR}/lm_{cell}.pt", map_location=device))
    m.eval()
    lms[cell] = m
    cv = lm_curves[cell]
    ppl, bpc = lm_evaluate(m, test_seqs, test)
    record(f"{cell.upper()}, {cfg['n_train_jokes'] // 1000}k jokes x {cfg['epochs']} ep", "BPE 8k", ppl, bpc,
           params=f"{cv['n_params'] / 1e6:.1f}M", train_s=cv["seconds"][-1], note="precomputed")
    lm_curves[cell]["testPplRecomputed"] = ppl
    lm_curves[cell]["testBpcRecomputed"] = bpc
lm = lms["lstm"]
D["lmCurves"] = lm_curves
D["lmSamples"] = [sample_text(lm, seed=s) for s in range(3)]
log("precomputed LMs evaluated")


def gradient_through_time(model, seq):
    model.eval()
    x = seq[:-1].unsqueeze(0).to(device)
    e = model.emb(x); e.retain_grad()
    h, _ = model.rnn(e)
    loss = nn.functional.cross_entropy(model.out(h)[0, -1:], seq[-1:].to(device))
    model.zero_grad(); loss.backward()
    return e.grad[0].norm(dim=-1).cpu().numpy()


L = 40
long_jokes = [s[:L + 1] for s in test_seqs if len(s) > L + 1][:50]
D["gradTime"] = {"L": L, "nJokes": len(long_jokes),
                 "cells": {cell: np.mean([gradient_through_time(lms[cell], s) for s in long_jokes], axis=0).tolist()
                           for cell in ["rnn", "gru", "lstm"]}}
log("gradient through time done")

# the LSTM, for the browser: big matrices as per-row int8, recurrent weights as float16
sd = {k: v.detach().cpu() for k, v in lm.state_dict().items()}


def q8_rows(w):
    scale = (w.abs().max(dim=1, keepdim=True).values / 127).clamp(min=1e-8)
    q = torch.round(w / scale).clamp(-127, 127)
    return q.to(torch.int8).numpy(), scale.squeeze(1).numpy()


emb_q, emb_s = q8_rows(sd["emb.weight"])
out_q, out_s = q8_rows(sd["out.weight"])
D["lstm"] = {
    "V": V, "E": 256, "H": 256,
    "emb_q": i8(emb_q), "emb_s": f16(emb_s),
    "w_ih": f16(sd["rnn.weight_ih_l0"].numpy()), "w_hh": f16(sd["rnn.weight_hh_l0"].numpy()),
    "b_ih": f16(sd["rnn.bias_ih_l0"].numpy()), "b_hh": f16(sd["rnn.bias_hh_l0"].numpy()),
    "out_q": i8(out_q), "out_s": f16(out_s), "out_b": f16(sd["out.bias"].numpy()),
    "params": int(sum(v.numel() for v in sd.values())),
}
# the quantised model the browser will actually run, for the checks below
lmq = RNNLM(V, emb=256, hidden=256, cell="lstm")
sdq = dict(sd)
sdq["emb.weight"] = torch.tensor(emb_q, dtype=torch.float32) * torch.tensor(emb_s, dtype=torch.float32)[:, None]
sdq["out.weight"] = torch.tensor(out_q, dtype=torch.float32) * torch.tensor(out_s, dtype=torch.float32)[:, None]
for k in ["rnn.weight_ih_l0", "rnn.weight_hh_l0", "rnn.bias_ih_l0", "rnn.bias_hh_l0", "out.bias"]:
    sdq[k] = sd[k].half().float()
lmq.load_state_dict(sdq); lmq.eval()
ppl_q, bpc_q = lm_evaluate(lmq.to(device), test_seqs, test)
D["lstm"]["pplQuantised"] = ppl_q
D["lstm"]["bpcQuantised"] = bpc_q
log(f"quantised LSTM: test ppl {ppl_q:.3f} (float {lm_curves['lstm']['testPplRecomputed']:.3f})")

# ============================================================== 4. decoding


@torch.no_grad()
def next_logits(model, ids):
    x = torch.tensor([ids], device=device)
    logits, _ = model(x)
    return logits[0, -1].cpu()


@torch.no_grad()
def generate(model, decode_step, prompt="", max_len=60, seed=None):
    g = torch.Generator().manual_seed(seed) if seed is not None else None
    ids = [BOS] + tok.encode(prompt).ids
    x = torch.tensor([ids], device=device)
    logits, state = model(x)
    for _ in range(max_len):
        nxt = decode_step(logits[0, -1].cpu(), g)
        if nxt == EOS:
            break
        ids.append(nxt)
        logits, state = model(torch.tensor([[nxt]], device=device), state)
    return tok.decode(ids[1:])


def greedy_step(logits, g=None):
    return int(logits.argmax())


def sample_step(logits, g=None):
    probs = torch.softmax(logits, dim=-1)
    return int(torch.multinomial(probs, 1, generator=g))


def softmax_T(logits, T):
    return torch.softmax(logits / T, dim=-1)


def temperature_step(T):
    def step(logits, g=None):
        return int(torch.multinomial(softmax_T(logits, T), 1, generator=g))
    return step


def truncated_step(method, value, T=1.0):
    def step(logits, g=None):
        logits = logits / T
        p = torch.softmax(logits, dim=-1)
        if method == "top_k":
            keep = p.topk(value).indices
        elif method == "top_p":
            sp, si = p.sort(descending=True)
            keep = si[:int((sp.cumsum(0) < value).sum()) + 1]
        elif method == "min_p":
            keep = (p >= value * p.max()).nonzero().squeeze(-1)
        m = torch.zeros_like(p); m[keep] = p[keep]
        return int(torch.multinomial(m / m.sum(), 1, generator=g))
    return step


def penalised_step(base_step, penalty=1.3, no_repeat_ngram=3):
    history = []

    def step(logits, g=None):
        logits = logits.clone()
        for t in set(history):
            logits[t] /= penalty if logits[t] > 0 else 1 / penalty
        if no_repeat_ngram and len(history) >= no_repeat_ngram - 1:
            prefix = tuple(history[-(no_repeat_ngram - 1):])
            for i in range(len(history) - no_repeat_ngram + 1):
                if tuple(history[i:i + no_repeat_ngram - 1]) == prefix:
                    logits[history[i + no_repeat_ngram - 1]] = -float("inf")
        nxt = base_step(logits, g)
        history.append(nxt)
        return nxt
    return step


@torch.no_grad()
def token_probs_of(model, ids):
    x = torch.tensor([ids[:-1]], device=device)
    logits, _ = model(x)
    p = torch.softmax(logits[0], dim=-1)
    return [p[t, ids[t + 1]].item() for t in range(len(ids) - 1)]


D["decodeSamples"] = {
    "greedy": [generate(lm, greedy_step, seed=s) for s in range(2)],
    "sampling": [generate(lm, sample_step, seed=s) for s in range(3)],
    "temperature": {str(T): generate(lm, temperature_step(T), prompt="Заходит мужик в бар", seed=0) for T in [0.3, 0.7, 1.0, 1.5]},
    "truncation": {name: generate(lm, step, prompt="Заходит мужик в бар", seed=1) for name, step in [
        ("top-k = 40", truncated_step("top_k", 40)), ("top-p = 0.9", truncated_step("top_p", 0.9)),
        ("min-p = 0.05", truncated_step("min_p", 0.05)), ("top-p = 0.9, T = 0.8", truncated_step("top_p", 0.9, T=0.8))]},
    "penalty": {"plain": generate(lm, greedy_step, prompt="Однажды", seed=0),
                "patched": generate(lm, penalised_step(greedy_step, 1.3, 3), prompt="Однажды", seed=0)},
}

# temperature panel (block 4.2) and the truncation picture (4.3): top tokens after two prompts
prompt = "Заходит мужик в бар"
logits0 = next_logits(lm, [BOS] + tok.encode(prompt).ids)
temp_panel = []
for T in [0.5, 1.0, 1.5, 2.5]:
    p = softmax_T(logits0, T)
    topp, topi = p.topk(10)
    H = -(p * torch.clamp(p, min=1e-12).log()).sum().item()
    temp_panel.append({"T": T, "tokens": [tok.id_to_token(i) for i in topi.tolist()], "p": topp.tolist(), "entropy": H})
D["temperature"] = {"prompt": prompt, "panel": temp_panel}

# the Holtzman picture on test joke 7, plus a handful of other test jokes for the page to pick from
real = test_seqs[7].tolist()


@torch.no_grad()
def greedy_ids(model, prompt_ids, n):
    ids, state = list(prompt_ids), None
    logits, state = model(torch.tensor([ids], device=device))
    for _ in range(n):
        nxt = int(logits[0, -1].argmax())
        ids.append(nxt)
        logits, state = model(torch.tensor([[nxt]], device=device), state)
    return ids


g_ids = greedy_ids(lm, real[:4], len(real) - 4)
D["holtzman"] = {"joke": test[7], "pHuman": token_probs_of(lm, real), "pGreedy": token_probs_of(lm, g_ids),
                 "greedyText": tok.decode(g_ids[1:]), "promptTokens": 3,
                 "otherJokes": [test[i] for i in [7, 3, 12, 25, 40, 61, 77, 90, 104, 128, 150, 171]]}


def repetition_rate(ids, window=20):
    rep = sum(ids[i] in ids[max(0, i - window):i] for i in range(len(ids)))
    return rep / max(1, len(ids))


def distinct2(ids):
    bg = list(zip(ids, ids[1:]))
    return len(set(bg)) / max(1, len(bg))


methods = {
    "greedy": greedy_step,
    "sampling T=1.0": temperature_step(1.0),
    "sampling T=0.7": temperature_step(0.7),
    "top-k=40": truncated_step("top_k", 40),
    "top-p=0.9": truncated_step("top_p", 0.9),
    "min-p=0.05": truncated_step("min_p", 0.05),
}
rows = []
prompts_eval = ["Заходит мужик", "Штирлиц", "Приходит муж домой", "Однажды", "Доктор говорит"]
log("decoding table ...")
for name, step in methods.items():
    reps, d2, lp = [], [], []
    for pr in prompts_eval:
        for s in range(6):
            ids = [BOS] + tok.encode(generate(lm, step, prompt=pr, seed=s)).ids
            reps.append(repetition_rate(ids)); d2.append(distinct2(ids))
            lp.append(np.mean([math.log(max(1e-9, p)) for p in token_probs_of(lm, ids)]))
    rows.append({"method": name, "repetition": float(np.mean(reps)), "distinct2": float(np.mean(d2)),
                 "logprob": float(np.mean(lp))})
D["decodeTable"] = {"rows": rows, "prompts": prompts_eval, "seeds": 6}
log("decoding table done")

# checks for the browser LSTM: greedy continuations and a next-token distribution, from the quantised model
lmq = lmq.to(device)
D["lstmCheck"] = {
    "greedy": [{"prompt": p, "ids": greedy_ids(lmq, [BOS] + tok.encode(p).ids, 60)[1:]}
               for p in ["", "Заходит мужик в бар", "Однажды", "Штирлиц", "Приходит муж домой"]],
    "top": {"prompt": prompt, "ids": next_logits(lmq, [BOS] + tok.encode(prompt).ids).topk(10).indices.tolist(),
            "probs": torch.softmax(next_logits(lmq, [BOS] + tok.encode(prompt).ids), -1).topk(10).values.tolist()},
    "pHuman": token_probs_of(lmq, real),
}

# GPT-2 outputs: read from the notebook's own run of block 4.7 (the 500 MB model is not downloaded here)
D["gpt2"] = None
try:
    nb = json.load(open(NB_PATH))
    for c in nb["cells"]:
        if c["cell_type"] == "code" and "RUN_LLM" in "".join(c["source"]) and "AutoModelForCausalLM" in "".join(c["source"]):
            txt = "".join("".join(o.get("text", "")) for o in c.get("outputs", []) if o.get("output_type") == "stream" and o.get("name") == "stdout")
            parts = re.split(r"^(greedy|top-p=0\.9, T=0\.9|top-p=0\.9 \+ rep\.penalty 1\.3):\n", txt, flags=re.M)
            outs = [{"tag": parts[i], "text": parts[i + 1].strip().replace("\xa0", " ")} for i in range(1, len(parts) - 1, 2)]
            if outs:
                D["gpt2"] = {"model": "sberbank-ai/rugpt3small_based_on_gpt2", "outputs": outs}
    log(f"gpt2 outputs from the notebook: {D['gpt2'] and len(D['gpt2']['outputs'])}")
except Exception as e:  # pragma: no cover
    log(f"gpt2 outputs unavailable: {e}")

del lms, lm, lmq; gc.collect()

# ============================================================== 5. seq2seq


def load_multi30k(split):
    with open(f"{DATA_DIR}/{split}.de", encoding="utf-8") as f:
        de = [l.strip() for l in f]
    with open(f"{DATA_DIR}/{split}.en", encoding="utf-8") as f:
        en = [l.strip() for l in f]
    return de, en


tr_de, tr_en = load_multi30k("train")
va_de, va_en = load_multi30k("val")
te_de, te_en = load_multi30k("test")
tok_de = Tokenizer.from_file(f"{ART_DIR}/bpe_de_8k.json")
tok_en = Tokenizer.from_file(f"{ART_DIR}/bpe_en_8k.json")
D["s2sData"] = {"nTrain": len(tr_de), "nVal": len(va_de), "nTest": len(te_de),
                "examples": [{"de": d, "en": e} for d, e in zip(tr_de[:3], tr_en[:3])],
                "tokExample": {"text": tr_de[0], "tokens": tok_de.encode(tr_de[0]).tokens},
                "vocabDe": tok_de.get_vocab_size(), "vocabEn": tok_en.get_vocab_size()}


class Seq2SeqLSTM(nn.Module):
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
        _, (h, c) = self.encoder(packed)
        h = torch.tanh(self.h_proj(torch.cat([h[0], h[1]], dim=-1)))
        c = torch.tanh(self.c_proj(torch.cat([c[0], c[1]], dim=-1)))
        return h.unsqueeze(0), c.unsqueeze(0)

    def decode_step(self, y_prev, state):
        e = self.drop(self.trg_emb(y_prev))
        o, state = self.decoder(e, state)
        return self.out(self.drop(o)), state

    def forward(self, src, src_len, trg_in):
        state = self.encode(src, src_len)
        e = self.drop(self.trg_emb(trg_in))
        o, _ = self.decoder(e, state)
        return self.out(self.drop(o))

    @torch.no_grad()
    def greedy(self, src, src_len, max_len=40):
        state = self.encode(src, src_len)
        y = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=src.device)
        out, done = [], torch.zeros(src.size(0), dtype=torch.bool, device=src.device)
        for _ in range(max_len):
            logits, state = self.decode_step(y, state)
            y = logits[:, -1].argmax(-1, keepdim=True).masked_fill(done.unsqueeze(1), PAD)
            out.append(y)
            done |= y.squeeze(1) == EOS
            if done.all(): break
        return torch.cat(out, dim=1)


MAX_LEN = 50


def s2s_encode(src_texts, trg_texts):
    src = [torch.tensor(e.ids[:MAX_LEN], dtype=torch.long) for e in tok_de.encode_batch(src_texts)]
    trg = [torch.tensor([BOS] + e.ids[:MAX_LEN] + [EOS], dtype=torch.long) for e in tok_en.encode_batch(trg_texts)]
    return src, trg


def s2s_batches(src, trg, batch_size, shuffle):
    order = np.random.permutation(len(src)) if shuffle else np.arange(len(src))
    for i in range(0, len(src), batch_size):
        idx = order[i:i + batch_size]
        s = pad_sequence([src[j] for j in idx], batch_first=True, padding_value=PAD)
        t = pad_sequence([trg[j] for j in idx], batch_first=True, padding_value=PAD)
        s_len = torch.tensor([len(src[j]) for j in idx])
        yield s.to(device), s_len.to(device), t.to(device)


te_src, te_trg = s2s_encode(te_de, te_en)
model = Seq2SeqLSTM(tok_de.get_vocab_size(), tok_en.get_vocab_size()).to(device)
model.load_state_dict(torch.load(f"{ART_DIR}/seq2seq_lstm.pt", map_location=device))
model.eval()
s2s_curves = json.load(open(f"{ART_DIR}/seq2seq_curves.json"))
sweep = json.load(open(f"{ART_DIR}/seq2seq_hidden_sweep.json"))
D["s2sCurves"] = s2s_curves
D["s2sSweep"] = sweep

import sacrebleu


def ids_to_text(tokz, ids):
    out = []
    for row in ids.tolist():
        cut = row.index(EOS) if EOS in row else len(row)
        out.append(tokz.decode([i for i in row[:cut] if i not in (PAD, BOS, EOS)]))
    return out


@torch.no_grad()
def translate_all(model, src, trg, batch_size=128):
    model.eval(); hyps = []
    for s, s_len, _ in s2s_batches(src, trg, batch_size, shuffle=False):
        hyps.extend(ids_to_text(tok_en, model.greedy(s, s_len)))
    return hyps


@torch.no_grad()
def beam_search(model, src_1, src_len_1, beam_width=5, max_len=40, alpha=0.6):
    state = model.encode(src_1, src_len_1)
    h, c = state
    beams = [([BOS], 0.0, (h, c))]
    finished = []
    for _ in range(max_len):
        candidates = []
        for tokens, score, st in beams:
            if tokens[-1] == EOS:
                finished.append((tokens, score)); continue
            y = torch.tensor([[tokens[-1]]], device=device)
            logits, st2 = model.decode_step(y, st)
            logp = torch.log_softmax(logits[0, -1], dim=-1)
            top_lp, top_i = logp.topk(beam_width)
            for lp, i in zip(top_lp.tolist(), top_i.tolist()):
                candidates.append((tokens + [i], score + lp, st2))
        if not candidates: break
        candidates.sort(key=lambda x: x[1] / (len(x[0]) ** alpha), reverse=True)
        beams = candidates[:beam_width]
    finished += [(t, s) for t, s, _ in beams]
    best = max(finished, key=lambda x: x[1] / (len(x[0]) ** alpha))
    return best[0]


hyps = translate_all(model, te_src, te_trg)
bleu_greedy = sacrebleu.corpus_bleu(hyps, [te_en]).score
log(f"seq2seq greedy BLEU {bleu_greedy:.2f}; beam-5 over the test set ...")
t = time.time()
hyps_beam = []
for i in range(len(te_src)):
    s = te_src[i].unsqueeze(0).to(device); sl = torch.tensor([len(te_src[i])])
    hyps_beam.append(ids_to_text(tok_en, torch.tensor([beam_search(model, s, sl, beam_width=5)]))[0])
bleu_beam = sacrebleu.corpus_bleu(hyps_beam, [te_en]).score
log(f"beam-5 BLEU {bleu_beam:.2f} in {time.time() - t:.0f}s")
D["translations"] = [{"de": te_de[i], "ref": te_en[i], "greedy": hyps[i], "beam": hyps_beam[i], "srcLen": len(te_src[i]),
                      "bleuG": round(sacrebleu.sentence_bleu(hyps[i], [te_en[i]]).score, 1),
                      "bleuB": round(sacrebleu.sentence_bleu(hyps_beam[i], [te_en[i]]).score, 1)}
                     for i in range(len(te_de))]
D["s2sBleu"] = {"greedy": bleu_greedy, "beam5": bleu_beam, "shown": [0, 4, 11],
                "artifactTestBleu": s2s_curves["test_bleu"]}

N_BEAM_EVAL = 200
beam_rows = []
for bw in [1, 3, 5]:
    t = time.time()
    hyps_bw, refs_bw = [], te_en[:N_BEAM_EVAL]
    for i in range(N_BEAM_EVAL):
        s = te_src[i].unsqueeze(0).to(device); sl = torch.tensor([len(te_src[i])])
        ids = model.greedy(s, sl)[0].tolist() if bw == 1 else beam_search(model, s, sl, beam_width=bw)
        hyps_bw.append(ids_to_text(tok_en, torch.tensor([ids]))[0])
    beam_rows.append({"beam": bw, "bleu": round(sacrebleu.corpus_bleu(hyps_bw, [refs_bw]).score, 2),
                      "seconds": round(time.time() - t, 1)})
D["beamTable"] = {"n": N_BEAM_EVAL, "rows": beam_rows}
log("beam table done")


@torch.no_grad()
def encode_vectors(model, src, trg, n=600):
    vecs, lens_ = [], []
    for s, s_len, _ in s2s_batches(src[:n], trg[:n], 128, shuffle=False):
        h, _ = model.encode(s, s_len)
        vecs.append(h[0].cpu()); lens_.extend(s_len.tolist())
    return torch.cat(vecs).numpy(), np.array(lens_)


vecs, vlens = encode_vectors(model, te_src, te_trg)
vecs = vecs - vecs.mean(0)
U, S, Vt = np.linalg.svd(vecs, full_matrices=False)
xy = vecs @ Vt[:2].T
D["pca"] = {"xy": [[round(float(a), 3), round(float(b), 3)] for a, b in xy], "len": vlens.tolist(),
            "explained": [float(S[0] ** 2 / (S ** 2).sum()), float(S[1] ** 2 / (S ** 2).sum())]}

# the one-screen recipe from block 3 (notebook cell "The whole recipe on one screen"), run as written
RECIPE = open("recipe.py", encoding="utf-8").read()
seed_all()
t = time.time()
_ns = dict(globals()); exec(RECIPE, _ns)
D["recipe"] = {"ppl": float(_ns["math"].exp(_ns["nll"] / _ns["n"])), "seconds": time.time() - t, "device": str(device),
               "params": int(sum(p.numel() for p in _ns["model"].parameters())), "lines": len(RECIPE.strip().splitlines())}
log(f"recipe: ppl {D['recipe']['ppl']:.1f} in {D['recipe']['seconds']:.1f}s")

# the one-screen encoder–decoder recipe (demo section 07), run as written
RECIPE_S2S = open("recipe_s2s.py", encoding="utf-8").read()
seed_all()
t = time.time()
_ns = dict(globals()); exec(RECIPE_S2S, _ns)
D["recipeS2s"] = {"bleu": float(sacrebleu.corpus_bleu(_ns["hyps"], [te_en]).score), "seconds": time.time() - t, "device": str(device),
                  "params": int(sum(p.numel() for p in _ns["model"].parameters())), "lines": len(RECIPE_S2S.strip().splitlines())}
log(f"recipe s2s: BLEU {D['recipeS2s']['bleu']:.2f} in {D['recipeS2s']['seconds']:.1f}s")

D["results"] = results

# ================================================================ extras
with open("michael.png", "rb") as f:
    D["michael"] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

with open("demo_data.json", "w", encoding="utf-8") as f:
    json.dump(D, f, ensure_ascii=False)
log(f"wrote demo_data.json  {os.path.getsize('demo_data.json') / 1e6:.2f} MB")
