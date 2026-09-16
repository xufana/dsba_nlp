"""
Precompute artifacts for week 3 that take longer than ~5 minutes in Google Colab.

Everything else in the seminar notebook is trained live (with a fixed seed).
The rule is the same as in weeks 1 and 2:

    > 5 min in Colab  -> artifact, committed to week03_attention_transformer/artifacts/
    < 5 min in Colab  -> trained live in the notebook

Data and the BPE tokenizers are NOT duplicated here: Multi30k, bpe_de_8k.json,
bpe_en_8k.json and the week-2 baseline seq2seq_lstm.pt are read from
../week02_language_modelling/. The only data of our own is data/cmudict.dict
(downloaded by the `g2p` step if missing).

Run (on an M-series Mac or a GPU; ~5 h total on an M4, one night):
    python precompute.py
    python precompute.py --only attn_lstm
    python precompute.py --only transformer ablations
    python precompute.py --only g2p

Steps (and what they write):
    attn_lstm    attn_lstm_additive.pt, attn_lstm_general.pt, attn_lstm_scaled_dot.pt,
                 attn_lstm_curves.json                       (6 epochs each, like the week-2 baseline)
    transformer  transformer_l1.pt, transformer_l3.pt, transformer_l6.pt,
                 transformer_curves.json                     (15 epochs each)
    ablations    transformer_no_ca.pt, transformer_no_pe.pt, ablation_curves.json
                 (the l6 configuration with cross-attention over one mean-pooled vector /
                  without positional encoding)
    g2p          data/cmudict.dict, g2p_vocab.json, g2p_transformer.pt, g2p_curves.json

--smoke runs every step on a toy configuration in a couple of minutes on a 2-core
CPU, so the notebook can be executed end-to-end before the real run. Smoke
artifacts are written to --out (default artifacts_smoke/ in smoke mode); never
commit them.

Weights are saved in fp16 (half the size on GitHub); the notebook's load_weights()
casts them back. The model classes below are copied verbatim into the notebook by
build_notebook.py — if you change one, rebuild the notebook.
"""

import argparse
import json
import math
import os
import random
import re
import time
import urllib.request

import numpy as np
import torch
from torch import nn
from torch.nn.utils.rnn import pad_sequence, pack_padded_sequence, pad_packed_sequence
from tokenizers import Tokenizer

SEED = 42
PAD, UNK, BOS, EOS = 0, 1, 2, 3
SPECIALS = ["[PAD]", "[UNK]", "[BOS]", "[EOS]"]

W2 = "../week02_language_modelling"
CMUDICT_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"


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


def save_weights(model, path):
    # fp16 on disk: half the bytes on GitHub, no measurable change in BLEU.
    sd = {k: (v.half() if v.is_floating_point() else v) for k, v in model.state_dict().items()}
    torch.save(sd, path)


def load_weights(model, path, device="cpu"):
    sd = torch.load(path, map_location=device)
    model.load_state_dict({k: (v.float() if v.is_floating_point() else v) for k, v in sd.items()})
    return model.to(device).eval()


# --------------------------------------------------------------------------
# data: Multi30k de->en, week-2 tokenizers  (identical helpers to week 2)
# --------------------------------------------------------------------------

def load_multi30k(data_dir, split):
    with open(os.path.join(data_dir, f"{split}.de"), encoding="utf-8") as f:
        de = [l.strip() for l in f]
    with open(os.path.join(data_dir, f"{split}.en"), encoding="utf-8") as f:
        en = [l.strip() for l in f]
    assert len(de) == len(en)
    return de, en


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
        out = model.greedy(s, s_len)
        ids = out[0] if isinstance(out, tuple) else out
        hyps.extend(ids_to_text(tok_trg, ids))
    return sacrebleu.corpus_bleu(hyps, [refs]).score, hyps


def bleu_by_src_len(hyps, refs, src):
    """BLEU per source-length bucket (in BPE tokens) — the bottleneck plot from week 2."""
    import sacrebleu
    lens = [len(s) for s in src]
    out = {}
    for lo, hi in [(0, 10), (10, 15), (15, 20), (20, 25), (25, 100)]:
        idx = [i for i, l in enumerate(lens) if lo <= l < hi]
        if len(idx) >= 20:
            out[f"{lo}-{hi}"] = round(sacrebleu.corpus_bleu([hyps[i] for i in idx], [[refs[i] for i in idx]]).score, 2)
    return out


def load_s2s_data(data_dir, w2_art, n_train=None, n_eval=None):
    tok_de = Tokenizer.from_file(os.path.join(w2_art, "bpe_de_8k.json"))
    tok_en = Tokenizer.from_file(os.path.join(w2_art, "bpe_en_8k.json"))
    tr_de, tr_en = load_multi30k(data_dir, "train")
    va_de, va_en = load_multi30k(data_dir, "val")
    te_de, te_en = load_multi30k(data_dir, "test")
    if n_train:
        tr_de, tr_en = tr_de[:n_train], tr_en[:n_train]
    if n_eval:
        va_de, va_en, te_de, te_en = va_de[:n_eval], va_en[:n_eval], te_de[:n_eval], te_en[:n_eval]
    tr = s2s_encode(tok_de, tok_en, tr_de, tr_en)
    va = s2s_encode(tok_de, tok_en, va_de, va_en)
    te = s2s_encode(tok_de, tok_en, te_de, te_en)
    return tok_de, tok_en, (tr, (*va, va_en)), (*te, te_en)


# --------------------------------------------------------------------------
# 1. attention on top of the week-2 LSTM  (blocks 1-2 of the notebook)
# --------------------------------------------------------------------------

class Attention(nn.Module):
    """One formula, four score functions.
    score(q, k) -> softmax over keys -> weighted sum of values.
      additive    v^T tanh(W_q q + W_k k)    Bahdanau et al. 2015   (2 d d_a + d_a params)
      dot         q^T k                       Luong et al. 2015      (0 params)
      general     q^T W k                     Luong et al. 2015      (d^2 params)
      scaled_dot  q^T k / sqrt(d)             Vaswani et al. 2017    (0 params)
    q: (B, T, Dq)  k: (B, S, Dk)  v: (B, S, Dv)  mask: (B, S) True = real token.
    Returns context (B, T, Dv) and weights (B, T, S)."""

    def __init__(self, q_dim, k_dim, kind="additive", attn_dim=None):
        super().__init__()
        self.kind = kind
        attn_dim = attn_dim or q_dim
        if kind == "additive":
            self.W_q = nn.Linear(q_dim, attn_dim, bias=False)
            self.W_k = nn.Linear(k_dim, attn_dim, bias=False)
            self.v = nn.Linear(attn_dim, 1, bias=False)
        elif kind == "general":
            self.W = nn.Linear(k_dim, q_dim, bias=False)
        elif kind in ("dot", "scaled_dot"):
            assert q_dim == k_dim, "dot-product scores need queries and keys of one size"
        else:
            raise ValueError(kind)

    def score(self, q, k):
        if self.kind == "additive":
            # (B, T, 1, A) + (B, 1, S, A) -> (B, T, S, A) -> (B, T, S)
            return self.v(torch.tanh(self.W_q(q).unsqueeze(2) + self.W_k(k).unsqueeze(1))).squeeze(-1)
        if self.kind == "general":
            return q @ self.W(k).transpose(1, 2)
        s = q @ k.transpose(1, 2)                                  # one matmul for the whole batch
        return s / math.sqrt(q.size(-1)) if self.kind == "scaled_dot" else s

    def forward(self, q, k, v, mask=None):
        s = self.score(q, k)
        if mask is not None:
            # a large negative number, not -inf: a fully masked row would give NaN
            s = s.masked_fill(~mask.unsqueeze(1), -1e9)
        w = torch.softmax(s, dim=-1)
        return w @ v, w


class AttnSeq2Seq(nn.Module):
    """The week-2 Seq2SeqLSTM plus attention: same bidirectional encoder, same decoder cell,
    but the decoder re-reads ALL encoder states at every step instead of one vector.
      keys    = k_proj(encoder states)   (2H -> H, shared by every score kind)
      values  = encoder states           (2H)
      query   = decoder hidden state h_t (H)
    The attentional vector h~_t = tanh(W_c [h_t; c_t]) feeds the output layer and, at the next
    step, the decoder input (input feeding, Luong et al. 2015)."""

    def __init__(self, src_vocab, trg_vocab, emb=256, hidden=256, dropout=0.2, score="additive"):
        super().__init__()
        self.hidden, self.score_kind = hidden, score
        self.src_emb = nn.Embedding(src_vocab, emb, padding_idx=PAD)
        self.trg_emb = nn.Embedding(trg_vocab, emb, padding_idx=PAD)
        self.encoder = nn.LSTM(emb, hidden, batch_first=True, bidirectional=True)
        self.h_proj = nn.Linear(2 * hidden, hidden)                # initial decoder state, as in week 2
        self.c_proj = nn.Linear(2 * hidden, hidden)
        self.k_proj = nn.Linear(2 * hidden, hidden)                # keys
        self.attn = Attention(hidden, hidden, kind=score)
        self.decoder = nn.LSTM(emb + hidden, hidden, batch_first=True)   # input: [y_{t-1}; h~_{t-1}]
        self.comb = nn.Linear(hidden + 2 * hidden, hidden)         # [h_t; c_t] -> h~_t
        self.out = nn.Linear(hidden, trg_vocab)
        self.drop = nn.Dropout(dropout)

    def encode(self, src, src_len):
        e = self.drop(self.src_emb(src))
        packed = pack_padded_sequence(e, src_len.cpu(), batch_first=True, enforce_sorted=False)
        out, (h, c) = self.encoder(packed)
        enc, _ = pad_packed_sequence(out, batch_first=True, total_length=src.size(1))   # (B, S, 2H)
        h = torch.tanh(self.h_proj(torch.cat([h[0], h[1]], dim=-1))).unsqueeze(0)
        c = torch.tanh(self.c_proj(torch.cat([c[0], c[1]], dim=-1))).unsqueeze(0)
        mask = src != PAD
        return enc, self.k_proj(enc), mask, (h, c)

    def decode_step(self, y_prev, state, enc, keys, mask, feed):
        e = self.drop(self.trg_emb(y_prev))                        # (B, 1, E)
        o, state = self.decoder(torch.cat([e, feed], dim=-1), state)   # (B, 1, H)
        ctx, w = self.attn(o, keys, enc, mask)                     # (B, 1, 2H), (B, 1, S)
        feed = torch.tanh(self.comb(torch.cat([o, ctx], dim=-1)))  # attentional vector h~_t
        return self.out(self.drop(feed)), state, feed, w

    def forward(self, src, src_len, trg_in):
        # teacher forcing, one step at a time (input feeding makes the steps sequential)
        enc, keys, mask, state = self.encode(src, src_len)
        feed = enc.new_zeros(src.size(0), 1, self.hidden)
        logits, weights = [], []
        for t in range(trg_in.size(1)):
            lg, state, feed, w = self.decode_step(trg_in[:, t:t + 1], state, enc, keys, mask, feed)
            logits.append(lg)
            weights.append(w)
        return torch.cat(logits, dim=1), torch.cat(weights, dim=1)   # (B, T, V), (B, T, S)

    @torch.no_grad()
    def greedy(self, src, src_len, max_len=40):
        enc, keys, mask, state = self.encode(src, src_len)
        feed = enc.new_zeros(src.size(0), 1, self.hidden)
        y = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=src.device)
        out, weights = [], []
        done = torch.zeros(src.size(0), dtype=torch.bool, device=src.device)
        for _ in range(max_len):
            logits, state, feed, w = self.decode_step(y, state, enc, keys, mask, feed)
            y = logits[:, -1].argmax(-1, keepdim=True).masked_fill(done.unsqueeze(1), PAD)
            out.append(y)
            weights.append(w)
            done |= y.squeeze(1) == EOS
            if done.all():
                break
        return torch.cat(out, dim=1), torch.cat(weights, dim=1)


def train_seq2seq(model, data, tok_en, device, epochs, lr=1e-3, batch_size=64, clip=1.0):
    """The week-2 training loop. Works for any model whose forward returns logits (or (logits, ...))."""
    (tr_src, tr_trg), (va_src, va_trg, va_refs) = data
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    curves = {"epoch": [], "train_loss": [], "val_loss": [], "val_bleu": [], "seconds": []}
    t0 = time.time()
    for ep in range(1, epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for s, s_len, t in s2s_batches(tr_src, tr_trg, batch_size, shuffle=True, device=device):
            out = model(s, s_len, t[:, :-1])
            logits = out[0] if isinstance(out, tuple) else out
            loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), t[:, 1:].reshape(-1),
                                               ignore_index=PAD)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), clip)
            opt.step()
            k = (t[:, 1:] != PAD).sum().item()
            tot += loss.item() * k
            n += k
        vloss = val_loss(model, va_src, va_trg, device)
        bleu, _ = s2s_bleu(model, tok_en, va_src, va_trg, va_refs, device)
        curves["epoch"].append(ep)
        curves["train_loss"].append(round(tot / n, 4))
        curves["val_loss"].append(round(vloss, 4))
        curves["val_bleu"].append(round(bleu, 2))
        curves["seconds"].append(round(time.time() - t0, 1))
        log(f"epoch {ep}: train loss {tot / n:.3f}  val loss {vloss:.3f}  val BLEU {bleu:.2f}  ({time.time() - t0:.0f}s)")
    return curves


@torch.no_grad()
def val_loss(model, va_src, va_trg, device):
    model.eval()
    vtot, vn = 0.0, 0
    for s, s_len, t in s2s_batches(va_src, va_trg, 128, shuffle=False, device=device):
        out = model(s, s_len, t[:, :-1])
        logits = out[0] if isinstance(out, tuple) else out
        loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), t[:, 1:].reshape(-1),
                                           ignore_index=PAD, reduction="sum")
        vtot += loss.item()
        vn += (t[:, 1:] != PAD).sum().item()
    return vtot / vn


def build_attn_lstm(data_dir, w2_art, out_dir, epochs, device, smoke=False):
    n_train, n_eval, hidden = (400, 100, 32) if smoke else (None, None, 256)
    tok_de, tok_en, data, (te_src, te_trg, te_refs) = load_s2s_data(data_dir, w2_art, n_train, n_eval)
    curves_all = {}
    path = os.path.join(out_dir, "attn_lstm_curves.json")
    for kind in ["additive", "general", "scaled_dot"]:
        seed_all()
        model = AttnSeq2Seq(tok_de.get_vocab_size(), tok_en.get_vocab_size(), emb=hidden, hidden=hidden,
                            score=kind).to(device)
        n_params = sum(p.numel() for p in model.parameters())
        log(f"--- AttnSeq2Seq score={kind} hidden={hidden} ({n_params / 1e6:.2f}M params), {epochs} epochs ---")
        curves = train_seq2seq(model, data, tok_en, device, epochs)
        bleu, hyps = s2s_bleu(model, tok_en, te_src, te_trg, te_refs, device)
        curves.update({"test_bleu": round(bleu, 2), "bleu_by_src_len": bleu_by_src_len(hyps, te_refs, te_src),
                       "n_params": n_params,
                       "config": {"emb": hidden, "hidden": hidden, "dropout": 0.2, "epochs": epochs, "score": kind}})
        curves_all[kind] = curves
        save_weights(model, os.path.join(out_dir, f"attn_lstm_{kind}.pt"))
        with open(path, "w") as f:
            json.dump(curves_all, f, indent=1)
        log(f"{kind}: test BLEU {bleu:.2f}  by length {curves['bleu_by_src_len']}")


# --------------------------------------------------------------------------
# 2. the transformer, from scratch  (block 4 of the notebook)
# --------------------------------------------------------------------------

def attention(q, k, v, mask=None, dropout=None):
    """Scaled dot-product attention (Vaswani et al. 2017), the whole thing.
    q: (..., T, d_k)  k: (..., S, d_k)  v: (..., S, d_v)  mask: broadcastable to (..., T, S), True = may attend."""
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.size(-1))
    if mask is not None:
        scores = scores.masked_fill(~mask, -1e9)
    w = torch.softmax(scores, dim=-1)
    if dropout is not None:
        w = dropout(w)
    return w @ v, w


class MultiHeadAttention(nn.Module):
    """h heads of size d/h, run as one batched matmul. Returns the output and the (B, h, T, S) weights."""

    def __init__(self, d, h, dropout=0.1):
        super().__init__()
        assert d % h == 0
        self.h, self.d_k = h, d // h
        self.W_q, self.W_k, self.W_v, self.W_o = (nn.Linear(d, d) for _ in range(4))
        self.drop = nn.Dropout(dropout)

    def forward(self, q_in, k_in, v_in, mask=None):
        B, T, d = q_in.shape
        S = k_in.size(1)
        q = self.W_q(q_in).view(B, T, self.h, self.d_k).transpose(1, 2)    # (B, h, T, d_k)
        k = self.W_k(k_in).view(B, S, self.h, self.d_k).transpose(1, 2)    # (B, h, S, d_k)
        v = self.W_v(v_in).view(B, S, self.h, self.d_k).transpose(1, 2)    # (B, h, S, d_k)
        out, w = attention(q, k, v, mask, self.drop)                       # (B, h, T, d_k), (B, h, T, S)
        out = out.transpose(1, 2).reshape(B, T, d)                         # heads back side by side
        return self.W_o(out), w


class PositionalEncoding(nn.Module):
    """kind: 'sin' (Vaswani), 'learned' (BERT/GPT-2), 'none' (the ablation)."""

    def __init__(self, d, max_len=64, kind="sin", dropout=0.1):
        super().__init__()
        self.kind = kind
        self.drop = nn.Dropout(dropout)
        if kind == "sin":
            pos = torch.arange(max_len).unsqueeze(1).float()
            freq = torch.exp(torch.arange(0, d, 2).float() * (-math.log(10000.0) / d))
            pe = torch.zeros(max_len, d)
            pe[:, 0::2] = torch.sin(pos * freq)
            pe[:, 1::2] = torch.cos(pos * freq)
            self.register_buffer("pe", pe)
        elif kind == "learned":
            self.pe = nn.Parameter(torch.randn(max_len, d) * 0.02)
        elif kind != "none":
            raise ValueError(kind)

    def forward(self, x):
        if self.kind != "none":
            x = x + self.pe[: x.size(1)]
        return self.drop(x)


class FeedForward(nn.Module):
    """Position-wise MLP: the same two layers applied to every position independently."""

    def __init__(self, d, ff, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d, ff), nn.ReLU(), nn.Dropout(dropout), nn.Linear(ff, d))

    def forward(self, x):
        return self.net(x)


class EncoderLayer(nn.Module):
    """Pre-LN: x + SelfAttn(LN(x));  x + FFN(LN(x))."""

    def __init__(self, d, h, ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d, h, dropout)
        self.ffn = FeedForward(d, ff, dropout)
        self.ln1, self.ln2 = nn.LayerNorm(d), nn.LayerNorm(d)
        self.drop = nn.Dropout(dropout)

    def forward(self, x, mask):
        y = self.ln1(x)
        a, w = self.self_attn(y, y, y, mask)
        x = x + self.drop(a)
        x = x + self.drop(self.ffn(self.ln2(x)))
        return x, w


class DecoderLayer(nn.Module):
    """Pre-LN: causal self-attention, then cross-attention over the encoder memory, then FFN."""

    def __init__(self, d, h, ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d, h, dropout)
        self.cross_attn = MultiHeadAttention(d, h, dropout)
        self.ffn = FeedForward(d, ff, dropout)
        self.ln1, self.ln2, self.ln3 = nn.LayerNorm(d), nn.LayerNorm(d), nn.LayerNorm(d)
        self.drop = nn.Dropout(dropout)

    def forward(self, x, memory, trg_mask, mem_mask):
        y = self.ln1(x)
        a, w_self = self.self_attn(y, y, y, trg_mask)
        x = x + self.drop(a)
        a, w_cross = self.cross_attn(self.ln2(x), memory, memory, mem_mask)
        x = x + self.drop(a)
        x = x + self.drop(self.ffn(self.ln3(x)))
        return x, w_self, w_cross


class Transformer(nn.Module):
    """Encoder-decoder transformer (Vaswani et al. 2017), Pre-LN variant, tied target embeddings.
      pe     'sin' | 'learned' | 'none'
      cross  'full'   — the decoder attends to every encoder state (the real thing)
             'pooled' — the decoder sees one mean-pooled encoder vector: the week-2 bottleneck, rebuilt
    forward() returns logits and keeps every layer's attention weights in self.attn for inspection."""

    def __init__(self, src_vocab, trg_vocab, d=256, h=8, ff=1024, layers=6, dropout=0.1,
                 pe="sin", cross="full", max_len=64):
        super().__init__()
        self.d, self.cross = d, cross
        self.src_emb = nn.Embedding(src_vocab, d, padding_idx=PAD)
        self.trg_emb = nn.Embedding(trg_vocab, d, padding_idx=PAD)
        self.pos = PositionalEncoding(d, max_len, pe, dropout)
        self.enc_layers = nn.ModuleList(EncoderLayer(d, h, ff, dropout) for _ in range(layers))
        self.dec_layers = nn.ModuleList(DecoderLayer(d, h, ff, dropout) for _ in range(layers))
        self.ln_enc, self.ln_dec = nn.LayerNorm(d), nn.LayerNorm(d)
        self.out = nn.Linear(d, trg_vocab, bias=False)
        self.out.weight = self.trg_emb.weight                      # weight tying (Press & Wolf 2017)
        self.attn = {}
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    @staticmethod
    def causal_mask(T, device):
        return torch.tril(torch.ones(T, T, dtype=torch.bool, device=device))     # (T, T)

    def encode(self, src):
        mask = (src != PAD)[:, None, None, :]                       # (B, 1, 1, S): keys that are real tokens
        x = self.pos(self.src_emb(src) * math.sqrt(self.d))
        ws = []
        for layer in self.enc_layers:
            x, w = layer(x, mask)
            ws.append(w)
        memory = self.ln_enc(x)
        if self.cross == "pooled":                                  # the ablation: one vector, like week 2
            m = mask[:, 0, 0, :, None].float()
            memory = (memory * m).sum(1, keepdim=True) / m.sum(1, keepdim=True)   # (B, 1, d)
            mask = torch.ones_like(mask[:, :, :, :1])
        self.attn["enc"] = ws
        return memory, mask

    def decode(self, trg_in, memory, mem_mask):
        T = trg_in.size(1)
        trg_mask = self.causal_mask(T, trg_in.device)[None, None] & (trg_in != PAD)[:, None, None, :]
        x = self.pos(self.trg_emb(trg_in) * math.sqrt(self.d))
        ws, wc = [], []
        for layer in self.dec_layers:
            x, w_self, w_cross = layer(x, memory, trg_mask, mem_mask)
            ws.append(w_self)
            wc.append(w_cross)
        self.attn["dec_self"], self.attn["dec_cross"] = ws, wc
        return self.out(self.ln_dec(x))                             # (B, T, V)

    def forward(self, src, src_len, trg_in):
        # the whole target sequence in ONE forward pass: no loop over time (that is what the causal mask buys)
        memory, mem_mask = self.encode(src)
        return self.decode(trg_in, memory, mem_mask)

    @torch.no_grad()
    def greedy(self, src, src_len, max_len=40):
        memory, mem_mask = self.encode(src)                         # the encoder runs once
        ys = torch.full((src.size(0), 1), BOS, dtype=torch.long, device=src.device)
        done = torch.zeros(src.size(0), dtype=torch.bool, device=src.device)
        for _ in range(max_len):
            logits = self.decode(ys, memory, mem_mask)              # the decoder re-reads the growing prefix
            y = logits[:, -1].argmax(-1, keepdim=True).masked_fill(done.unsqueeze(1), PAD)
            ys = torch.cat([ys, y], dim=1)
            done |= y.squeeze(1) == EOS
            if done.all():
                break
        return ys[:, 1:]


class WarmupInverseSqrt:
    """lr = peak * min(step / warmup, sqrt(warmup / step)) — the transformer schedule, with an explicit peak."""

    def __init__(self, opt, peak, warmup):
        self.opt, self.peak, self.warmup, self.step_n = opt, peak, warmup, 0

    def step(self):
        self.step_n += 1
        lr = self.peak * min(self.step_n / self.warmup, math.sqrt(self.warmup / self.step_n))
        for g in self.opt.param_groups:
            g["lr"] = lr
        return lr


def train_transformer(model, data, device, epochs, eval_fn, peak_lr=7e-4, warmup=800, batch_size=64,
                      label_smoothing=0.1, clip=1.0):
    """eval_fn(model) -> (score, name) on the validation set, e.g. BLEU or word accuracy."""
    (tr_src, tr_trg), (va_src, va_trg, _) = data
    opt = torch.optim.Adam(model.parameters(), lr=peak_lr, betas=(0.9, 0.98), eps=1e-9)
    sched = WarmupInverseSqrt(opt, peak_lr, warmup)
    curves = {"epoch": [], "train_loss": [], "val_loss": [], "val_score": [], "seconds": [], "lr": []}
    t0 = time.time()
    for ep in range(1, epochs + 1):
        model.train()
        tot, n = 0.0, 0
        for s, s_len, t in s2s_batches(tr_src, tr_trg, batch_size, shuffle=True, device=device):
            logits = model(s, s_len, t[:, :-1])
            loss = nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), t[:, 1:].reshape(-1),
                                               ignore_index=PAD, label_smoothing=label_smoothing)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), clip)
            lr = sched.step()
            opt.step()
            k = (t[:, 1:] != PAD).sum().item()
            tot += loss.item() * k
            n += k
        vloss = val_loss(model, va_src, va_trg, device)             # plain cross-entropy, no smoothing
        score, name = eval_fn(model)
        curves["epoch"].append(ep)
        curves["train_loss"].append(round(tot / n, 4))
        curves["val_loss"].append(round(vloss, 4))
        curves["val_score"].append(round(score, 2))
        curves["seconds"].append(round(time.time() - t0, 1))
        curves["lr"].append(lr)
        log(f"epoch {ep}: train loss {tot / n:.3f}  val loss {vloss:.3f}  val {name} {score:.2f}  "
            f"lr {lr:.2e}  ({time.time() - t0:.0f}s)")
    curves["score_name"] = name
    return curves


def mt_config(smoke):
    return dict(d=32, h=2, ff=64, dropout=0.1) if smoke else dict(d=256, h=8, ff=1024, dropout=0.1)


def build_transformers(data_dir, w2_art, out_dir, epochs, device, smoke=False, variants=None):
    n_train, n_eval = (400, 100) if smoke else (None, None)
    tok_de, tok_en, data, (te_src, te_trg, te_refs) = load_s2s_data(data_dir, w2_art, n_train, n_eval)
    (_, _), (va_src, va_trg, va_refs) = data
    cfg = mt_config(smoke)
    if variants is None:
        variants = [("l1", dict(layers=1)), ("l3", dict(layers=3)), ("l6", dict(layers=6))]
    curves_all = {}
    for name, kw in variants:
        seed_all()
        model = Transformer(tok_de.get_vocab_size(), tok_en.get_vocab_size(), **cfg, **kw).to(device)
        n_params = sum(p.numel() for p in model.parameters())
        log(f"--- Transformer {name} {kw} ({n_params / 1e6:.2f}M params), {epochs} epochs ---")
        eval_fn = lambda m: (s2s_bleu(m, tok_en, va_src, va_trg, va_refs, device)[0], "BLEU")
        curves = train_transformer(model, data, device, epochs, eval_fn,
                                   warmup=50 if smoke else 800)
        bleu, hyps = s2s_bleu(model, tok_en, te_src, te_trg, te_refs, device)
        curves.update({"test_bleu": round(bleu, 2), "bleu_by_src_len": bleu_by_src_len(hyps, te_refs, te_src),
                       "n_params": n_params, "config": {**cfg, **kw, "epochs": epochs}})
        curves_all[name] = curves
        save_weights(model, os.path.join(out_dir, f"transformer_{name}.pt"))
        log(f"{name}: test BLEU {bleu:.2f}  by length {curves['bleu_by_src_len']}")
    return curves_all


def build_transformer_main(data_dir, w2_art, out_dir, epochs, device, smoke=False):
    curves = build_transformers(data_dir, w2_art, out_dir, epochs, device, smoke)
    with open(os.path.join(out_dir, "transformer_curves.json"), "w") as f:
        json.dump(curves, f, indent=1)


def build_ablations(data_dir, w2_art, out_dir, epochs, device, smoke=False):
    variants = [("no_ca", dict(layers=6, cross="pooled")), ("no_pe", dict(layers=6, pe="none"))]
    if smoke:
        variants = [(n, {**kw, "layers": 2}) for n, kw in variants]
    curves = build_transformers(data_dir, w2_art, out_dir, epochs, device, smoke, variants)
    with open(os.path.join(out_dir, "ablation_curves.json"), "w") as f:
        json.dump(curves, f, indent=1)


# --------------------------------------------------------------------------
# 3. grapheme-to-phoneme on CMUdict  (block 6 of the notebook: same class, another task)
# --------------------------------------------------------------------------

def load_cmudict(path):
    """word -> [phonemes]; alphabetic headwords only, first pronunciation only."""
    pairs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.split("#")[0].strip()
            if not line:
                continue
            word, *phones = line.split()
            if not re.fullmatch(r"[a-z]+", word):                   # skip variants like word(2), digits, apostrophes
                continue
            pairs.append((word, phones))
    return pairs


def g2p_vocabs(pairs):
    letters = SPECIALS + sorted({ch for w, _ in pairs for ch in w})
    phones = SPECIALS + sorted({p for _, ps in pairs for p in ps})
    return letters, phones


def g2p_encode(pairs, letters, phones):
    l2i = {c: i for i, c in enumerate(letters)}
    p2i = {p: i for i, p in enumerate(phones)}
    src = [torch.tensor([l2i[c] for c in w], dtype=torch.long) for w, _ in pairs]
    trg = [torch.tensor([BOS] + [p2i[p] for p in ps] + [EOS], dtype=torch.long) for _, ps in pairs]
    return src, trg


def g2p_split(pairs, n_test=5000, n_val=2000):
    idx = np.random.RandomState(SEED).permutation(len(pairs))
    test = [pairs[i] for i in idx[:n_test]]
    val = [pairs[i] for i in idx[n_test:n_test + n_val]]
    train = [pairs[i] for i in idx[n_test + n_val:]]
    return train, val, test


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


@torch.no_grad()
def g2p_eval(model, src, trg, phones, device, batch_size=256):
    """Word accuracy (exact match) and phoneme error rate."""
    model.eval()
    correct, edits, n_ph, n = 0, 0, 0, 0
    for s, s_len, t in s2s_batches(src, trg, batch_size, shuffle=False, device=device):
        out = model.greedy(s, s_len, max_len=32)
        ids = out[0] if isinstance(out, tuple) else out
        for hyp, ref in zip(ids.tolist(), t.tolist()):
            hyp = hyp[:hyp.index(EOS)] if EOS in hyp else hyp
            ref = [x for x in ref if x not in (PAD, BOS, EOS)]
            correct += hyp == ref
            edits += edit_distance(hyp, ref)
            n_ph += len(ref)
            n += 1
    return 100.0 * correct / n, 100.0 * edits / n_ph


def build_g2p(data_dir, out_dir, epochs, device, smoke=False):
    path = os.path.join(data_dir, "cmudict.dict")
    if not os.path.exists(path):
        os.makedirs(data_dir, exist_ok=True)
        log(f"downloading {CMUDICT_URL}")
        urllib.request.urlretrieve(CMUDICT_URL, path)
    pairs = load_cmudict(path)
    letters, phones = g2p_vocabs(pairs)
    train, val, test = g2p_split(pairs)
    if smoke:
        train, val, test = train[:400], val[:100], test[:200]
    log(f"cmudict: {len(pairs):,} words, {len(letters) - 4} letters, {len(phones) - 4} phonemes; "
        f"train {len(train):,} val {len(val):,} test {len(test):,}")
    tr, va, te = (g2p_encode(x, letters, phones) for x in (train, val, test))
    cfg = dict(d=32, h=2, ff=64, layers=2, dropout=0.1) if smoke else dict(d=128, h=4, ff=512, layers=3, dropout=0.1)
    seed_all()
    model = Transformer(len(letters), len(phones), **cfg, max_len=40).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    log(f"--- g2p Transformer {cfg} ({n_params / 1e6:.2f}M params), {epochs} epochs ---")
    eval_fn = lambda m: (g2p_eval(m, *va, phones, device)[0], "word acc")
    curves = train_transformer(model, (tr, (*va, None)), device, epochs, eval_fn,
                               peak_lr=1e-3, warmup=50 if smoke else 500, batch_size=128)
    acc, per = g2p_eval(model, *te, phones, device)
    curves.update({"test_word_acc": round(acc, 2), "test_per": round(per, 2), "n_params": n_params,
                   "config": {**cfg, "epochs": epochs}, "n_train": len(train)})
    save_weights(model, os.path.join(out_dir, "g2p_transformer.pt"))
    with open(os.path.join(out_dir, "g2p_vocab.json"), "w") as f:
        json.dump({"letters": letters, "phones": phones}, f)
    with open(os.path.join(out_dir, "g2p_curves.json"), "w") as f:
        json.dump(curves, f, indent=1)
    log(f"g2p: test word accuracy {acc:.1f}%  PER {per:.2f}%")


# --------------------------------------------------------------------------

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=f"{W2}/data", help="Multi30k files (week 2)")
    ap.add_argument("--w2-art", default=f"{W2}/artifacts", help="week-2 tokenizers")
    ap.add_argument("--out", default=None, help="artifacts/ (artifacts_smoke/ with --smoke)")
    ap.add_argument("--only", nargs="*", default=["attn_lstm", "transformer", "ablations", "g2p"])
    ap.add_argument("--attn-epochs", type=int, default=6)
    ap.add_argument("--tf-epochs", type=int, default=15)
    ap.add_argument("--g2p-epochs", type=int, default=5)
    ap.add_argument("--device", default=None)
    ap.add_argument("--smoke", action="store_true", help="toy configuration, minutes on a laptop CPU")
    args = ap.parse_args()

    out = args.out or ("artifacts_smoke" if args.smoke else "artifacts")
    os.makedirs(out, exist_ok=True)
    device = torch.device(args.device) if args.device else pick_device()
    log(f"device: {device}  out: {out}  smoke: {args.smoke}")
    if args.smoke:
        args.attn_epochs, args.tf_epochs, args.g2p_epochs = 2, 2, 2

    if "attn_lstm" in args.only:
        build_attn_lstm(args.data_dir, args.w2_art, out, args.attn_epochs, device, args.smoke)
    if "transformer" in args.only:
        build_transformer_main(args.data_dir, args.w2_art, out, args.tf_epochs, device, args.smoke)
    if "ablations" in args.only:
        build_ablations(args.data_dir, args.w2_art, out, args.tf_epochs, device, args.smoke)
    if "g2p" in args.only:
        build_g2p("data", out, args.g2p_epochs, device, args.smoke)
    log("done")
