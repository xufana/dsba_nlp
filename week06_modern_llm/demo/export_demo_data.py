"""Export everything the week-6 interactive demo needs into one JSON bundle.

Run from week06_modern_llm/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).

Every number the page shows is produced here by the notebook's own code: the definition
cells of week06_modern_llm.ipynb are executed as they are (found by a marker string, so cell
order does not matter), the live cells are re-run on the notebook's data, and the artifacts
precompute.py wrote are copied through. What the page computes in the browser — 6ND, the
power-law fit, `decoder_params`, `kv_cache_bytes`, the two norms, SiLU/GELU, the rotation
matrix, the MoE arithmetic, the linear-attention state — is checked against the Python
results exported here, and the check is shown on the page.
"""
import contextlib
import io
import json
import os
import sys
import time
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, ".."))                      # the notebook's working directory
sys.path.insert(0, os.getcwd())

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = os.path.join(HERE, "demo_data.json")
NB = "week06_modern_llm.ipynb"
ART = "artifacts"


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def r4(a, nd=4):
    if isinstance(a, torch.Tensor):
        a = a.detach().cpu()
    return np.round(np.asarray(a, dtype=float), nd).tolist()


def clean(x):
    """JSON-safe: numpy scalars to Python, NaN to None."""
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        return None if np.isnan(x) else float(x)
    if isinstance(x, torch.Tensor):
        return clean(x.tolist())
    return x


# ------------------------------------------------------------ notebook cells
nb = json.load(open(NB, encoding="utf-8"))
CODE = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]
ns = {"__name__": "__nb__", "display": lambda *a, **k: None}


def run_cell(marker, cut=None, sub=None, capture=False):
    """Execute the unique code cell containing `marker`, truncated before `cut`, with the (old, new) pairs of `sub`
    applied first. With capture=True, return what the cell printed."""
    hits = [s for s in CODE if marker in s]
    assert len(hits) == 1, (marker, len(hits))
    src = hits[0]
    if cut:
        assert cut in src, (marker, cut)
        src = src[: src.index(cut)]
    for a, b in (sub or []):
        assert a in src, (marker, a)
        src = src.replace(a, b, 1)
    src = "\n".join((l[: len(l) - len(l.lstrip())] + "pass") if l.lstrip().startswith(("!", "%")) else l for l in src.split("\n"))   # no shell / magics
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf) if capture else contextlib.nullcontext():
        exec(compile(src, f"<cell {marker[:30]}>", "exec"), ns)
    if capture:
        out = buf.getvalue()
        print(out, end="")
        return out


def art(name):
    return json.load(open(f"{ART}/{name}.json"))


D = {"meta": {"exported": time.strftime("%Y-%m-%d %H:%M")}}

# ============================================================ 0. setup + data
run_cell('MODEL_OLD = "gpt2"')
run_cell("def n_params(module)")
run_cell("def target_text(text)")
run_cell('ds = load_dataset("fancyzhx/ag_news")')
run_cell("bill = {}")
g = ns
device = g["device"]
D["meta"]["device"] = str(device)
D["meta"]["torch"] = torch.__version__
demo_texts, gold, CLASS_NAMES, CLASS_WORDS = g["demo_texts"], g["gold"], g["CLASS_NAMES"], g["CLASS_WORDS"]
log(f"notebook setup on {device}; {len(demo_texts)} demo texts")
D["data"] = {"nTest": len(g["ag_test"]), "nDemo": g["N_DEMO"], "classes": CLASS_NAMES, "words": CLASS_WORDS,
             "example": {"text": demo_texts[0], "label": int(gold[0])}}

# ============================================================ 1. the bill for training
run_cell('charge("GPT-2 small (2019)", N=124_439_808')
run_cell("def bits_per_byte(model, tokenizer, texts")
run_cell('scaling = json.load(open(f"{ART_DIR}/scaling.json"))', cut="fig, ax")
scaling = g["scaling"]
by_size = pd.DataFrame(scaling["by_size"])
# fits the page reproduces: on all sizes and on the first k, in log-log, with and without embeddings
fits = {}
for k in range(3, len(by_size) + 1):
    for key in ["params_non_embedding", "params"]:
        a, b = np.polyfit(np.log(by_size[key][:k]), np.log(by_size.bits_per_byte[:k]), 1)
        fits[f"{key}:{k}"] = {"slope": float(-a), "intercept": float(b),
                              "predicted": r4(np.exp(b) * by_size[key] ** a)}
D["scaling"] = {**scaling, "fits": fits, "slope_N": float(g["slope_N"])}
log(f"scaling: slope {g['slope_N']:.3f} on {len(by_size)} sizes")

# ============================================================ 2. the parts
run_cell("old_tok, new_tok = AutoTokenizer.from_pretrained(MODEL_OLD)", sub=[("pd.DataFrame({", "passports = pd.DataFrame({")])
old, new, old_tok, new_tok, co, cn = g["old"], g["new"], g["old_tok"], g["new_tok"], g["co"], g["cn"]
passports = g["passports"]
D["passports"] = {"rows": list(passports.index), "cols": list(passports.columns),
                  "cells": {col: {row: clean(passports.loc[row, col]) for row in passports.index} for col in passports.columns}}
run_cell("def decoder_params(vocab, d, layers, heads, kv_heads, hidden")
run_cell("d, L = co.n_embd, co.n_layer", sub=[("pd.DataFrame({", "shares = pd.DataFrame({")])
n_params, decoder_params, kv_cache_bytes = g["n_params"], g["decoder_params"], g["kv_cache_bytes"]


def breakdown_old():
    h = old.transformer.h
    return {"embedding": n_params(old.transformer.wte), "positions": n_params(old.transformer.wpe),
            "attention": sum(n_params(b.attn) for b in h), "feed-forward": sum(n_params(b.mlp) for b in h),
            "norms": sum(n_params(b.ln_1) + n_params(b.ln_2) for b in h) + n_params(old.transformer.ln_f)}


def breakdown_new():
    ls = new.model.layers
    return {"embedding": n_params(new.model.embed_tokens), "positions": 0,
            "attention": sum(n_params(l.self_attn) for l in ls), "feed-forward": sum(n_params(l.mlp) for l in ls),
            "norms": sum(n_params(l.input_layernorm) + n_params(l.post_attention_layernorm) for l in ls) + n_params(new.model.norm)}


D["params"] = {"gpt2": {"total": n_params(old), "byHand": int(g["by_hand_old"]), "parts": breakdown_old(),
                        "config": {"vocab": co.vocab_size, "d": co.n_embd, "layers": co.n_layer, "heads": co.n_head, "positions": co.n_positions}},
               "smollm2": {"total": n_params(new), "byHand": int(g["by_hand_new"]), "parts": breakdown_new(),
                           "config": {"vocab": cn.vocab_size, "d": cn.hidden_size, "layers": cn.num_hidden_layers, "heads": cn.num_attention_heads,
                                      "kv_heads": cn.num_key_value_heads, "hidden": cn.intermediate_size, "theta": cn.rope_parameters["rope_theta"],
                                      "eps": cn.rms_norm_eps, "context": cn.max_position_embeddings}},
               "shares": {col: {row: float(g["shares"].loc[row, col]) for row in g["shares"].index} for col in g["shares"].columns},
               "decoderParamsChecks": [{"args": [cn.vocab_size, cn.hidden_size, cn.num_hidden_layers, cn.num_attention_heads, cn.num_key_value_heads, cn.intermediate_size],
                                        "value": int(decoder_params(cn.vocab_size, cn.hidden_size, cn.num_hidden_layers, cn.num_attention_heads, cn.num_key_value_heads, cn.intermediate_size))},
                                       {"args": [32000, 4096, 32, 32, 8, 14336, None, False], "value": int(decoder_params(32000, 4096, 32, 32, 8, 14336, tied=False))},
                                       {"args": [128256, 4096, 32, 32, 8, 14336, None, False], "value": int(decoder_params(128256, 4096, 32, 32, 8, 14336, tied=False))}]}
log(f"passports: {n_params(old):,} / {n_params(new):,}; by hand {g['by_hand_old']:,} / {g['by_hand_new']:,}")

# --- 2.1 the norm
run_cell("class RMSNorm(nn.Module)")
x = torch.tensor([3.0, -1.0, 2.0, 0.0])
D["norm"] = {"x": r4(x), "layernorm": r4(F.layer_norm(x, (4,), eps=0)), "rmsnorm": r4(g["RMSNorm"](4, eps=0)(x).detach()),
             "counts": {"gpt2": {"n": sum(".ln_" in n and n.endswith("weight") for n, _ in old.named_parameters()), "params": sum(p.numel() for n, p in old.named_parameters() if ".ln_" in n)},
                        "smollm2": {"n": sum("norm" in n for n, _ in new.named_parameters()), "params": sum(p.numel() for n, p in new.named_parameters() if "norm" in n)}}}

# --- 2.2 the feed-forward: the curves the page draws, checked at a few points
run_cell("class SwiGLU(nn.Module)")
xs = torch.linspace(-4, 4, 17)
D["ffn"] = {"x": r4(xs), "silu": r4(F.silu(xs)), "gelu": r4(F.gelu(xs)), "relu": r4(F.relu(xs)),
            "hidden": cn.intermediate_size, "d": cn.hidden_size, "ratio": cn.intermediate_size / cn.hidden_size,
            "swiglu_params": n_params(g["SwiGLU"](cn.hidden_size, cn.intermediate_size)), "gpt2_ffn_params": n_params(old.transformer.h[0].mlp)}

# --- 2.3 positions: the shift experiment, the slow pairs, and the rotation on real query vectors
run_cell("def rope(x, theta, first=0)")
run_cell("enc = new_tok(demo_texts[0], return_tensors=\"pt\").to(device)")
here, far, old_here, old_far, enc = g["here"], g["far"], g["old_here"], g["old_far"], g["enc"]
run_cell("wavelength = lambda theta:")
rope, wavelength = g["rope"], g["wavelength"]
D["rope"] = {"shift": {"smollm2": {"shift": 1000, "maxDiff": float((here - far).abs().max()), "logitScale": float(here.abs().max()),
                                   "changed": float((here.argmax(-1) != far.argmax(-1)).float().mean())},
                       "gpt2": {"shift": 400, "maxDiff": float((old_here - old_far).abs().max()), "logitScale": float(old_here.abs().max()),
                                "changed": float((old_here.argmax(-1) != old_far.argmax(-1)).float().mean())}},
             "slow": [{"theta": th, "context": w, "slow": int((wavelength(th) > w).sum()), "slowest": float(wavelength(th)[-1])} for th, w in [(1e4, 2048), (1e4, 8192), (1e5, 8192)]],
             "theta": cn.rope_parameters["rope_theta"], "head_dim": cn.hidden_size // cn.num_attention_heads}
# the rotation applied to unit vectors and to a real q: the JS port is checked against these
hd = cn.hidden_size // cn.num_attention_heads
eye = torch.eye(hd)[None, None]                                              # [1, 1, 64, 64]: one unit vector per "position"
D["rope"]["unitCheck"] = {"positions": [0, 1, 7], "rows": r4(torch.stack([rope(eye[:, :, j:j + 1].expand(1, 1, 8, hd), cn.rope_parameters["rope_theta"])[0, 0, p] for j, p in [(0, 1), (0, 7), (32, 1), (5, 7)]]), 6),
                          "which": [[0, 1], [0, 7], [32, 1], [5, 7]]}
mine_cfg = (cn.vocab_size, cn.hidden_size, cn.num_hidden_layers, cn.num_attention_heads, cn.num_key_value_heads, cn.intermediate_size, cn.rope_parameters["rope_theta"], cn.rms_norm_eps)
run_cell("class Attention(nn.Module)")
run_cell("gqa, mha = Attention(")
run_cell("class Block(nn.Module)")
run_cell("mine = Decoder(cn.vocab_size")
mine, theirs, ours = g["mine"], g["theirs"], g["ours"]
with torch.no_grad():
    x0 = mine.layers[0].input_layernorm(mine.embed_tokens(enc.input_ids))
    att0 = mine.layers[0].self_attn
    q0 = att0.q_proj(x0).view(1, -1, att0.heads, hd).transpose(1, 2)[:, :1]  # head 0, every position, before the rotation
    q0r = rope(q0, att0.theta)
n_show = min(8, q0.shape[2])
D["rope"]["real"] = {"tokens": new_tok.convert_ids_to_tokens(enc.input_ids[0, :n_show]), "q": r4(q0[0, 0, :n_show], 4), "rotated": r4(q0r[0, 0, :n_show], 4),
                     "note": "layer 0, query head 0 of SmolLM2-135M on test text 0, before and after rope"}
log(f"rope: SmolLM2 shift diff {D['rope']['shift']['smollm2']['maxDiff']:.1e}, GPT-2 changed {D['rope']['shift']['gpt2']['changed']:.0%}")

# --- 2.4 attention: the counts
heads, kv_heads = cn.num_attention_heads, cn.num_key_value_heads
D["gqa"] = {"heads": heads, "kv_heads": kv_heads, "head_dim": hd, "d": cn.hidden_size, "params_gqa": n_params(g["gqa"]), "params_mha": n_params(g["mha"]),
            "params_by_kv": {str(k): n_params(g["Attention"](cn.hidden_size, heads, k, 1e5)) for k in [1, 3, 9]},
            "mapping": torch.arange(kv_heads).repeat_interleave(heads // kv_heads).tolist()}

# --- 2.5 assembled
D["assemble"] = {"params": n_params(mine), "maxDiff": float((theirs - ours).abs().max()), "logitScale": float(theirs.abs().max()),
                 "prefix": new_tok.decode(enc.input_ids[0, :8]), "nextTheirs": new_tok.decode(theirs[0, 7].argmax()), "nextOurs": new_tok.decode(ours[0, 7].argmax()),
                 "sameArgmax": float((theirs.argmax(-1) == ours.argmax(-1)).float().mean())}
log(f"assembled: max logit diff {D['assemble']['maxDiff']:.1e} against {D['assemble']['logitScale']:.0f}")

# ============================================================ 3. the bill for serving
run_cell("cache_old, cache_new = old(**old_enc, use_cache=True)", sub=[("pd.DataFrame({", "cache_table = pd.DataFrame({")])
run_cell('row["weights, GiB fp16"] = row["N"] * 2 / 2 ** 30')
ct = g["cache_table"]
D["cache"] = {"table": {row: {col: float(ct.loc[row, col]) for col in ct.columns} for row in ct.index},
              "measuredBytes": int(g["measured"]), "formulaBytes": int(kv_cache_bytes(cn.num_hidden_layers, cn.num_key_value_heads, hd, int(g["T"]), 4)), "T": int(g["T"]),
              "shapes": {"gpt2": list(g["cache_old"].layers[0].keys.shape), "smollm2": list(g["cache_new"].layers[0].keys.shape)},
              "presets": {"GPT-2 small": [12, 12, 64, 124439808], "SmolLM2-135M": [30, 3, 64, 134515008], "SmolLM2-135M, ungrouped": [30, 9, 64, None],
                          "Llama-3-8B": [32, 8, 128, 8030000000], "Llama-3-8B, ungrouped": [32, 32, 128, 8030000000], "Mistral 7B": [32, 8, 128, 7240000000]},
              "checks": [{"args": [32, 8, 128, 8192, 2], "value": int(kv_cache_bytes(32, 8, 128, 8192, 2))}, {"args": [30, 3, 64, 1, 2], "value": int(kv_cache_bytes(30, 3, 64, 1, 2))}]}

# --- 3.2 prefill / decode: the artifact, and the live run on this machine
run_cell("def sync(device)")
run_cell("def greedy(model, ids, n_new, round_trip=False)")
serving = art("serving")
D["serving"] = {"artifact": serving}
lengths = [16, 64, 256, 960]
texts5 = demo_texts * 5
with torch.no_grad():
    live = {"gpt2": g["measure_serving"](old, old_tok, device, texts5, lengths), "SmolLM2-135M": g["measure_serving"](new, new_tok, device, texts5, lengths)}
D["serving"]["live"] = {"device": str(device), "models": live}
log(f"serving live: SmolLM2 at 256 -> {live['SmolLM2-135M'][2]}")

# --- 3.3 where the arithmetic happens: launch, transfer, matmul, the round trip — live and from the artifact
run_cell("a = torch.randn(4096, 4096, device=device)", sub=[('print(f"the line returned', 'existed = time.perf_counter() - t\nprint(f"the line returned')])
run_cell("def measure_transfer(device, sizes=")
transfer_live, matmul_live = g["measure_transfer"](device), g["measure_matmul"](device)
run_cell('ids = torch.tensor([new_tok(" ".join(demo_texts[:4])).input_ids[:64]], device=device)', capture=True)
D["arith"] = {"live": {"device": str(device), "launch": {"n": 4096, "returned, ms": float(g["returned"] * 1000), "existed, ms": float(g["existed"] * 1000)},
                       "transfer": transfer_live, "matmul": matmul_live,
                       "roundTrip": {"on_gpu_ms": float(g["on_gpu"]), "round_trip_ms": float(g["round_trip"]), "same": bool(g["same"])}},
              "artifact": {"device": serving["device"], "launch": serving["launch"], "transfer": serving["transfer"], "matmul": serving["matmul"],
                           "roundTrip": {name: {"on_gpu_ms": r["64 tokens, argmax on the GPU, ms"], "round_trip_ms": r["64 tokens, argmax on the CPU, ms"]} for name, r in serving["models"].items()}},
              "logitsRowKB": cn.vocab_size * 4 / 1024}
del g["a"], g["b"]
g["free"]()

# --- 3.4 experts
run_cell("class MoE(nn.Module)")
run_cell("moe = MoE(cn.hidden_size, cn.intermediate_size, n_experts=8, top_k=2)", capture=True)
run_cell('print("13. weights of the top two:"', capture=True)
moe, chosen = g["moe"], g["chosen"]
toks = new_tok.convert_ids_to_tokens(enc.input_ids[0])
D["moe"] = {"n_experts": 8, "top_k": 2, "owned": n_params(moe), "active": n_params(moe.router) + 2 * n_params(moe.experts[0]), "router": n_params(moe.router), "expert": n_params(moe.experts[0]),
            "tokens": toks, "chosen": chosen[0].tolist(), "hist": chosen.flatten().bincount(minlength=8).tolist(),
            "mistral": {"dense": float(g["mistral"]), "ffn": float(g["ffn"]), "owned8": float(g["mistral"] - g["ffn"] + 8 * g["ffn"]), "active2": float(g["mistral"] - g["ffn"] + 2 * g["ffn"])},
            "gptoss": {"total": 20.9, "active": 3.6, "E": 32, "k": 4, "expert": float(g["expert"]), "shared": float(20.9 - 32 * g["expert"])},
            "softmaxTop2": r4(torch.tensor([2.0, 1.0]).softmax(0))}
log(f"moe: owned {n_params(moe):,}, active {D['moe']['active']:,}; routing {D['moe']['hist']}")

# --- 3.5 context: the pairs and linear attention
run_cell("T, window, every = 8192, 128, 3", capture=True)
D["context"] = {"T": 8192, "window": 128, "every": 3, "full": int(g["full"]), "local": int(g["local"]), "mixed": float(g["mixed"])}
out_lin = run_cell("def linear_attention(q, k, v)", capture=True)
lin_rows = g["rows"]
out_swap = run_cell("class LinearAttention(Attention)", capture=True)
D["linear"] = {"timing": lin_rows, "state": int(g["state"]), "cachePerToken": int(g["cache_per_token"]), "crossoverT": float(g["state"] / g["cache_per_token"]),
               "bpb": {"softmax": float(g["bpb_softmax"]), "linear": float(g["bpb_linear"]), "nTexts": len(g["swap_texts"])},
               "headDim": hd, "kvHeads": kv_heads, "layers": cn.num_hidden_layers, "cellOut": out_lin + out_swap}
# a tiny check vector for the JS port of the recurrence: 3 positions, head_dim 4
torch.manual_seed(0)
qq, kk, vv = torch.randn(3, 1, 1, 3, 4).unbind(0)
D["linear"]["check"] = {"q": r4(qq[0, 0], 5), "k": r4(kk[0, 0], 5), "v": r4(vv[0, 0], 5), "out": r4(g["linear_attention"](qq, kk, vv)[0, 0], 5)}
log(f"linear: state/cache crossover {D['linear']['crossoverT']:.1f} tokens; bpb softmax {g['bpb_softmax']:.3f} -> linear {g['bpb_linear']:.3f}")

# ============================================================ 4. five years later
run_cell('rows[name] = {"parameters": n_params(model), "bits / byte"')
family = g["family"]
D["family"] = {"artifact": family, "live": {k: {kk: float(vv) for kk, vv in v.items()} for k, v in g["rows"].items()}, "liveN": len(demo_texts)}
run_cell("def score(model, tokenizer, prefixes, continuations")
g["live_pred"] = {}
run_cell('prefixes = [t + " This news is about" for t in demo_texts]', sub=[("pred = score(", "pred = live_pred[name] = score(")], capture=True)
D["zeroShot"] = {"live": {name: {"accuracy": float((p == gold).mean()), "perClass": {c: float((p[gold == k] == k).mean()) for k, c in enumerate(CLASS_NAMES) if (gold == k).any()}}
                          for name, p in g["live_pred"].items()}, "liveN": len(demo_texts)}
run_cell('encoder = json.load(open(f"{ART_DIR}/encoder.json"))', capture=True)
D["encoder"] = g["encoder"]
log(f"family live bpb: { {k: round(v['bits / byte'], 4) for k, v in g['rows'].items()} }; zero-shot live { {k: round(v['accuracy'], 3) for k, v in D['zeroShot']['live'].items()} }")

# ============================================================ the two tables
bill = pd.DataFrame(g["bill"]).T
D["bill"] = {"rows": list(bill.index), "cols": list(bill.columns), "cells": {row: {col: clean(bill.loc[row, col]) for col in bill.columns} for row in bill.index}}
D["results"] = g["results"]
D["meta"]["seconds"] = round(time.time() - T0)
json.dump(clean(D), open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
log(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)")
