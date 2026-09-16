"""Export everything the week-3 interactive demo needs into one JSON bundle.

Run from week03_attention_transformer/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).

Every number the page shows is produced here by the notebook's own code: the
definition cells of week03_attention_transformer.ipynb are executed as they are
(found by a marker string, so cell order does not matter), then the notebook's
experiments are re-run on the notebook's data and artifacts. The two tiny
transformers of section 6 (dates, reversal) are trained here exactly as in the
notebook and exported as float16 weights, so the page can run them in the browser.
"""
import base64
import json
import math
import os
import sys
import time
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, ".."))                      # the notebook's working directory
sys.path.insert(0, os.getcwd())

import numpy as np
import torch
from torch import nn
import sacrebleu

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = os.path.join(HERE, "demo_data.json")
NB = "week03_attention_transformer.ipynb"


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def f16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float16).tobytes()).decode()


def r3(a, nd=3):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# ------------------------------------------------------------ notebook cells
nb = json.load(open(NB, encoding="utf-8"))
CODE = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]
ns = {"__name__": "__nb__"}


def run_cell(marker, cut=None):
    """Execute the unique code cell containing `marker`, truncated before `cut` if given."""
    hits = [s for s in CODE if marker in s]
    assert len(hits) == 1, (marker, len(hits))
    src = hits[0]
    if cut:
        assert cut in src, (marker, cut)
        src = src[: src.index(cut)]
    exec(compile(src, f"<cell {marker[:30]}>", "exec"), ns)


run_cell("RECOMPUTE = False")                             # imports, device, seed_all, n_params, check
run_cell("def load_multi30k")
run_cell("tok_de = Tokenizer.from_file")                  # data, tokenizers, encoded splits
run_cell("def epoch_seconds")                             # results table
run_cell("def s2s_bleu")
run_cell("class Seq2SeqLSTM")
run_cell("SHOW = [i for i", cut="show_translations(hyps0)")
run_cell("class Attention(nn.Module)")
run_cell("def train_seq2seq")
run_cell("def lstm_alignment", cut="VIZ = [")
run_cell("def attention(q, k, v")
run_cell("class MultiHeadAttention")
run_cell("class PositionalEncoding")
run_cell("class DecoderLayer")
run_cell("class Transformer(nn.Module)")
run_cell("def lr_scale")
run_cell("def tf_attention_maps", cut="maps, s_tok, t_tok = ")
run_cell("MONTHS = [")                                    # the date task: generator, CharVocab, exact_match, data
run_cell("def task_alignment", cut="fig, axes")
run_cell("def reverse_pairs", cut="rev_models, rev_exact, rev_char")

g = ns
device, seed_all, n_params = g["device"], g["seed_all"], g["n_params"]
tok_de, tok_en, V_DE, V_EN = g["tok_de"], g["tok_en"], g["V_DE"], g["V_EN"]
tr_src, tr_trg, va_src, va_trg, te_src, te_trg = g["tr_src"], g["tr_trg"], g["va_src"], g["va_trg"], g["te_src"], g["te_trg"]
te_de, te_en, va_en = g["te_de"], g["te_en"], g["va_en"]
PAD, BOS, EOS = g["PAD"], g["BOS"], g["EOS"]
W2_ART, ART_DIR = g["W2_ART"], g["ART_DIR"]
s2s_bleu, bleu_by_src_len, load_weights = g["s2s_bleu"], g["bleu_by_src_len"], g["load_weights"]
record, epoch_seconds = g["record"], g["epoch_seconds"]
Seq2SeqLSTM, AttnSeq2Seq, Transformer = g["Seq2SeqLSTM"], g["AttnSeq2Seq"], g["Transformer"]
attention, MultiHeadAttention, PositionalEncoding, EncoderLayer = g["attention"], g["MultiHeadAttention"], g["PositionalEncoding"], g["EncoderLayer"]
train_seq2seq, train_transformer, lr_scale = g["train_seq2seq"], g["train_transformer"], g["lr_scale"]
lstm_alignment, tf_attention_maps, task_alignment = g["lstm_alignment"], g["tf_attention_maps"], g["task_alignment"]
SHOW = g["SHOW"]
VIZ = [i for i in range(len(te_src)) if 9 <= len(te_src[i]) <= 13][:4]
log(f"notebook cells executed on {device}; train {len(tr_src)} val {len(va_src)} test {len(te_src)}")

D = {"meta": {"device": str(device), "exported": time.strftime("%Y-%m-%d %H:%M")}}
D["data"] = {
    "nTrain": len(tr_src), "nVal": len(va_src), "nTest": len(te_src), "vDe": V_DE, "vEn": V_EN,
    "example": {"de": te_de[0], "deTokens": tok_de.encode(te_de[0]).tokens, "en": te_en[0], "enTokens": tok_en.encode(te_en[0]).tokens},
    "srcLens": [len(s) for s in te_src],
}


def sent_bleu(hyps):
    return [round(sacrebleu.sentence_bleu(h, [r]).score, 1) for h, r in zip(hyps, te_en)]


# ======================================================== 0. where we stopped
lstm0 = load_weights(Seq2SeqLSTM(V_DE, V_EN, emb=256, hidden=256), f"{W2_ART}/seq2seq_lstm.pt", device)
w2_curves = json.load(open(f"{W2_ART}/seq2seq_curves.json"))
t = time.time()
bleu0, hyps0 = s2s_bleu(lstm0, tok_en, te_src, te_trg, te_en, device)
bylen0 = bleu_by_src_len(hyps0, te_en, te_src)
record("LSTM, no attention (week 2)", w2_curves["n_params"], bleu0, bylen0,
       s_per_epoch=epoch_seconds(w2_curves["seconds"]), note="one vector between the halves")
D["baseline"] = {"testBleu": bleu0, "byLen": bylen0, "curves": w2_curves, "translateSeconds": time.time() - t,
                 "show": [{"de": te_de[i], "ref": te_en[i], "hyp": hyps0[i]} for i in SHOW], "showIdx": SHOW}
log(f"baseline BLEU {bleu0:.2f} {bylen0}")

# ================================================ 1. attention in seq2seq
LIVE_PAIRS, LIVE_EPOCHS = 5_000, 1
seed_all()
attn_live = AttnSeq2Seq(V_DE, V_EN, emb=256, hidden=256, score="additive").to(device)
t = time.time()
live_curves = train_seq2seq(attn_live, ((tr_src[:LIVE_PAIRS], tr_trg[:LIVE_PAIRS]), (va_src, va_trg, va_en)), tok_en, device, epochs=LIVE_EPOCHS)
D["attnLive"] = {"params": n_params(attn_live), "w2Params": w2_curves["n_params"], "pairs": LIVE_PAIRS, "epochs": LIVE_EPOCHS,
                 "curves": live_curves, "seconds": time.time() - t,
                 "parts": {"k_proj": n_params(attn_live.k_proj), "attn": n_params(attn_live.attn), "comb": n_params(attn_live.comb),
                           "decoderExtra": n_params(attn_live.decoder) - n_params(lstm0.decoder)}}
log(f"live attention LSTM: {D['attnLive']['params'] / 1e6:.2f}M params, val BLEU {live_curves['val_bleu']}, {D['attnLive']['seconds']:.0f}s")
del attn_live

attn_curves = json.load(open(f"{ART_DIR}/attn_lstm_curves.json"))
attn_models, attn_bleu, attn_bylen, attn_hyps = {}, {}, {}, {}
for kind in ["additive", "general", "scaled_dot"]:
    cfg = attn_curves[kind]["config"]
    m = load_weights(AttnSeq2Seq(V_DE, V_EN, emb=cfg["emb"], hidden=cfg["hidden"], score=kind), f"{ART_DIR}/attn_lstm_{kind}.pt", device)
    b, h = s2s_bleu(m, tok_en, te_src, te_trg, te_en, device)
    attn_models[kind], attn_bleu[kind], attn_hyps[kind] = m, b, h
    attn_bylen[kind] = bleu_by_src_len(h, te_en, te_src)
    log(f"{kind:11s} test BLEU {b:5.2f}   by length {attn_bylen[kind]}")
cfg = attn_curves["additive"]["config"]
record("LSTM + additive attention", attn_curves["additive"]["n_params"], attn_bleu["additive"], attn_bylen["additive"],
       s_per_epoch=epoch_seconds(attn_curves["additive"]["seconds"]), note=f"{cfg['epochs']} epochs, Bahdanau 2015")
for kind in ["general", "scaled_dot"]:
    c = attn_curves[kind]
    record(f"LSTM + {kind} attention", c["n_params"], attn_bleu[kind], attn_bylen[kind],
           s_per_epoch=epoch_seconds(c["seconds"]), note="Luong 2015" if kind == "general" else "Vaswani 2017 scoring")
D["attn"] = {kind: {"curves": attn_curves[kind], "testBleu": attn_bleu[kind], "byLen": attn_bylen[kind],
                    "sPerEpoch": epoch_seconds(attn_curves[kind]["seconds"]),
                    "show": [{"de": te_de[i], "ref": te_en[i], "hyp": attn_hyps[kind][i]} for i in SHOW]} for kind in attn_curves}

# the sqrt(d_k) experiment, as in the notebook (block 2.1)
seed_all()
n_keys, trials = 30, 200
rows = []
for d in [16, 64, 256, 1024]:
    for scaled in [False, True]:
        ents, grads = [], []
        for _ in range(trials):
            q, K = torch.randn(d), torch.randn(n_keys, d)
            z = (K @ q) / (math.sqrt(d) if scaled else 1.0)
            z.requires_grad_(True)
            p = torch.softmax(z, 0)
            ents.append(-(p * (p + 1e-12).log()).sum().item())
            (p * torch.randn(n_keys)).sum().backward()
            grads.append(z.grad.norm().item())
        rows.append({"dk": d, "scaled": scaled,
                     "scoreStd": round((torch.randn(1000, d) @ torch.randn(d)).std().item() / (math.sqrt(d) if scaled else 1), 2),
                     "entropy": round(float(np.median(ents)), 2), "gradNorm": float(np.median(grads))})
D["temperature"] = {"nKeys": n_keys, "trials": trials, "maxEntropy": math.log(n_keys), "rows": rows}
log("temperature table done")

# ======================================================= 4. the transformer
seed_all()
q, k, v = (torch.randn(2, 4, 7, 32) for _ in range(3))
mask = torch.rand(2, 1, 7, 7) > 0.3
mask[..., 0] = True
ours, _ = attention(q, k, v, mask)
theirs = nn.functional.scaled_dot_product_attention(q, k, v, attn_mask=mask)
mha = MultiHeadAttention(d=256, h=8).eval()
x = torch.randn(3, 10, 256)
out, w = mha(x, x, x)
seed_all()
layer = g["EncoderLayer"](d=64, h=4, ff=128, dropout=0.0).eval()
x6 = torch.randn(1, 6, 64)
perm = torch.tensor([3, 0, 5, 1, 4, 2])
y, _ = layer(x6, None)
y_perm, _ = layer(x6[:, perm], None)
enc = EncoderLayer(d=256, h=8, ff=1024)
tf_demo = Transformer(V_DE, V_EN, d=256, h=8, ff=1024, layers=6)
ref = nn.Transformer(d_model=256, nhead=8, num_encoder_layers=6, num_decoder_layers=6, dim_feedforward=1024, norm_first=True, batch_first=True)
pe64 = PositionalEncoding(d=64, max_len=60, kind="sin", dropout=0.0).pe.numpy()
D["checks"] = {
    "sdpaMatch": bool(torch.allclose(ours, theirs, atol=1e-5)), "sdpaMaxDiff": float((ours - theirs).abs().max()),
    "mhaShape": {"in": list(x.shape), "out": list(out.shape), "w": list(w.shape)}, "rowsSumToOne": bool(torch.allclose(w.sum(-1), torch.ones(3, 8, 10))),
    "mhaParams": {"total": n_params(mha), "Q": n_params(mha.W_q), "K": n_params(mha.W_k), "V": n_params(mha.W_v), "O": n_params(mha.W_o)},
    "permutation": bool(torch.allclose(y[:, perm], y_perm, atol=1e-5)), "permutationMaxDiff": float((y[:, perm] - y_perm).abs().max()),
    "layerParams": {"total": n_params(enc), "attention": n_params(enc.self_attn), "ffn": n_params(enc.ffn), "layerNorm": n_params(enc.ln1, enc.ln2)},
    "tfParams": {"total": n_params(tf_demo), "layers": n_params(tf_demo.enc_layers, tf_demo.dec_layers), "embeddings": n_params(tf_demo.src_emb, tf_demo.trg_emb)},
    "torchTransformerMatch": n_params(tf_demo.enc_layers, tf_demo.dec_layers, tf_demo.ln_enc, tf_demo.ln_dec) == n_params(ref),
    "pe64": r3(pe64, 5),
    "lr": {"peak": 7e-4, "warmup": 800, "steps": [1, 100, 400, 800, 1600, 3200, 6400], "values": [7e-4 * lr_scale(s, 800) for s in [1, 100, 400, 800, 1600, 3200, 6400]]},
}
del ref, tf_demo
log("checks done")

seed_all()
tf_live = Transformer(V_DE, V_EN, d=256, h=8, ff=1024, layers=3).to(device)
t = time.time()
tf_live_curves = train_transformer(tf_live, ((tr_src[:LIVE_PAIRS], tr_trg[:LIVE_PAIRS]), (va_src, va_trg, va_en)), device, LIVE_EPOCHS,
                                   eval_fn=lambda m: (s2s_bleu(m, tok_en, va_src, va_trg, va_en, device)[0], "BLEU"), warmup=40)
D["tfLive"] = {"params": n_params(tf_live), "curves": tf_live_curves, "seconds": time.time() - t, "pairs": LIVE_PAIRS}
log(f"live transformer: {D['tfLive']['params'] / 1e6:.2f}M params, val BLEU {tf_live_curves['val_score']}, {D['tfLive']['seconds']:.0f}s")
del tf_live

tf_curves = json.load(open(f"{ART_DIR}/transformer_curves.json"))
tf_curves.update(json.load(open(f"{ART_DIR}/ablation_curves.json")))
labels = {"l1": "Transformer, 1 layer", "l3": "Transformer, 3 layers", "l6": "Transformer, 6 layers",
          "no_ca": "Transformer, 6 layers, no cross-attention", "no_pe": "Transformer, 6 layers, no positions"}
tf_models, tf_bleu, tf_bylen, tf_hyps = {}, {}, {}, {}
D["tf"] = {}
for name in ["l1", "l3", "l6", "no_ca", "no_pe"]:
    cfg = {k: v for k, v in tf_curves[name]["config"].items() if k != "epochs"}
    m = load_weights(Transformer(V_DE, V_EN, **cfg), f"{ART_DIR}/transformer_{name}.pt", device)
    t = time.time()
    b, h = s2s_bleu(m, tok_en, te_src, te_trg, te_en, device)
    tf_models[name], tf_bleu[name], tf_hyps[name] = m, b, h
    tf_bylen[name] = bleu_by_src_len(h, te_en, te_src)
    ep = tf_curves[name]["config"]["epochs"]
    record(labels[name], tf_curves[name]["n_params"], b, tf_bylen[name], s_per_epoch=epoch_seconds(tf_curves[name]["seconds"]),
           note=f"{ep} epochs" + (", mean-pooled memory" if name == "no_ca" else ", pe=none" if name == "no_pe" else ""))
    D["tf"][name] = {"label": labels[name], "curves": tf_curves[name], "testBleu": b, "byLen": tf_bylen[name],
                     "sPerEpoch": epoch_seconds(tf_curves[name]["seconds"]), "translateSeconds": time.time() - t,
                     "show": [{"de": te_de[i], "ref": te_en[i], "hyp": h[i]} for i in SHOW]}
    log(f"{labels[name]:45s} test BLEU {b:5.2f}   by length {tf_bylen[name]}   ({time.time() - t:.0f}s)")
    if name not in ("l6",):
        del m
D["results"] = g["results"]

# ------------------------------------------------- browse: all 1 000 test sentences
D["translations"] = [{"de": te_de[i], "ref": te_en[i], "srcLen": len(te_src[i]),
                      "h0": hyps0[i], "hA": attn_hyps["additive"][i], "hT": tf_hyps["l6"][i]} for i in range(len(te_src))]
for key, hy in [("b0", hyps0), ("bA", attn_hyps["additive"]), ("bT", tf_hyps["l6"])]:
    for row, s in zip(D["translations"], sent_bleu(hy)):
        row[key] = s
log("translations + sentence BLEU done")

# ------------------------------------------------- 1.4 / 5.1 alignments
ALIGN = VIZ + [i for i in range(len(te_src)) if 6 <= len(te_src[i]) <= 16 and i not in VIZ][:56]
aligns = []
for i in ALIGN:
    wl, s_tok, t_tok = lstm_alignment(attn_models["additive"], i)
    maps, s_tok2, t_tok2 = tf_attention_maps(tf_models["l6"], i)
    cross = maps["dec_cross"]
    nl, nh = len(cross), cross[0].shape[0]
    best = max(((l, hh, float(cross[l][hh].max(1).mean())) for l in range(nl) for hh in range(nh)), key=lambda x: x[2])
    aligns.append({"i": i, "de": te_de[i], "ref": te_en[i], "srcTok": s_tok,
                   "lstm": {"trgTok": t_tok, "w": r3(wl)},
                   "tf": {"trgTok": t_tok2, "best": [best[0], best[1]], "bestScore": round(best[2], 3), "w": r3(cross[best[0]][best[1]])}})
D["alignments"] = aligns
# the full head grid for the four VIZ sentences
grids = []
for i in VIZ:
    maps, s_tok, t_tok = tf_attention_maps(tf_models["l6"], i)
    grids.append({"i": i, "srcTok": s_tok, "trgTok": t_tok,
                  "cross": [[r3(hd, 2) for hd in layer_w] for layer_w in maps["dec_cross"]],
                  "enc": [[r3(hd, 2) for hd in layer_w] for layer_w in maps["enc"]]})
D["headGrids"] = grids
log(f"alignments for {len(ALIGN)} sentences, head grids for {len(VIZ)}")

# ============================================= 6. same class, other tasks


def export_tiny(model, vocab_itos):
    sd = model.state_dict()
    cfg = {"d": model.d, "h": model.enc_layers[0].self_attn.h, "ff": model.enc_layers[0].ffn.net[0].out_features,
           "layers": len(model.enc_layers), "pe": model.pos.kind, "maxLen": int(sd["pos.pe"].shape[0]) if "pos.pe" in sd else None}
    weights = {k: {"shape": list(v.shape), "f16": f16(v.detach().cpu().numpy())} for k, v in sd.items() if k != "out.weight"}
    return {"config": cfg, "itos": vocab_itos, "weights": weights, "params": n_params(model)}


@torch.no_grad()
def tiny_check(model, vocab_src, vocab_trg, strings, max_len):
    out = []
    for s in strings:
        w, st, tt, text = task_alignment(model, vocab_src, vocab_trg, s, max_len=max_len)
        out.append({"src": s, "out": text, "trgTok": tt, "ids": [vocab_trg.itos.index(c) for c in tt], "w": r3(w, 4)})
    return out


# 6.1 dates
date_vocab, date_train, date_val, date_pairs = g["date_vocab"], g["date_train"], g["date_val"], g["date_pairs"]
DATE_EPOCHS = 8
seed_all()
date_tf = Transformer(len(date_vocab.itos), len(date_vocab.itos), d=64, h=4, ff=128, layers=1, dropout=0.1, max_len=48).to(device)
t = time.time()
date_curves = train_transformer(date_tf, (date_train, date_val), device, DATE_EPOCHS,
                                eval_fn=lambda m: (g["exact_match"](m, *date_val[:2]), "exact match %"),
                                peak_lr=2e-3, warmup=200, batch_size=128, label_smoothing=0.0)
date_tf.eval()
# nine unseen validation pairs (the truth is known) plus three strings the generator never produces
DATE_CHECK = [(src, trg) for src, trg in date_pairs[18_000:18_009]] + \
    [("the fifth of March, 2021", None), ("31.12.1999", None), ("February 29, 2000", None)]
DATE_STRINGS = [s for s, _ in DATE_CHECK]
D["dates"] = {"epochs": DATE_EPOCHS, "curves": date_curves, "seconds": time.time() - t, "params": n_params(date_tf),
              "nChars": len(date_vocab.itos), "nTrain": len(date_train[0]), "nVal": len(date_val[0]),
              "examples": [{"src": s, "trg": tt} for s, tt in date_pairs[:8]],
              "exactMatch": date_curves["val_score"][-1],
              "model": export_tiny(date_tf, date_vocab.itos),
              "check": [dict(c, trg=t) for c, (_, t) in zip(tiny_check(date_tf, date_vocab, date_vocab, DATE_STRINGS, 16), DATE_CHECK)]}
log(f"dates: exact match {D['dates']['exactMatch']}%  {D['dates']['params']:,} params  {D['dates']['seconds']:.0f}s")

# 6.2 reversal
rev_vocab, rev_train, rev_test = g["rev_vocab"], g["rev_train"], g["rev_test"]
exact_match, char_accuracy = g["exact_match"], g["char_accuracy"]
D["reverse"] = {"trainLens": [5, 12], "nTrain": len(rev_train[0]), "testLens": sorted(rev_test), "nPerLen": len(rev_test[5][0]), "models": {}}
REV_STRINGS = ["attention", "transformer", "abc", "hse", "querykeyvalue", "positionalencoding", "abcdefghijklmnopqrst"]
for pe in ["sin", "learned"]:
    seed_all()
    m = Transformer(len(rev_vocab.itos), len(rev_vocab.itos), d=64, h=4, ff=128, layers=2, dropout=0.0, pe=pe, max_len=24).to(device)
    t = time.time()
    curves = train_transformer(m, (rev_train, rev_test[10]), device, 8, eval_fn=lambda mm: (exact_match(mm, *rev_test[10][:2], max_len=22), "exact@10"),
                               peak_lr=2e-3, warmup=100, batch_size=128, label_smoothing=0.0)
    m.eval()
    ex = {L: exact_match(m, *rev_test[L][:2], max_len=22) for L in rev_test}
    ch = {L: char_accuracy(m, *rev_test[L][:2]) for L in rev_test}
    D["reverse"]["models"][pe] = {"curves": curves, "seconds": time.time() - t, "params": n_params(m),
                                  "exact": {str(L): round(a, 2) for L, a in ex.items()}, "char": {str(L): round(a, 2) for L, a in ch.items()},
                                  "model": export_tiny(m, rev_vocab.itos),
                                  "check": tiny_check(m, rev_vocab, rev_vocab, REV_STRINGS, 22)}
    log(f"reverse pe={pe}: {time.time() - t:.0f}s  exact by length { {L: round(a) for L, a in ex.items()} }")

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(D, f, ensure_ascii=False)
log(f"wrote {OUT}  {os.path.getsize(OUT) / 1e6:.1f} MB")
