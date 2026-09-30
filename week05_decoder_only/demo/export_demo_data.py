"""Export everything the week-5 interactive demo needs into one JSON bundle.

Run from week05_decoder_only/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).

Every number the page shows is produced here by the notebook's own code: the definition
cells of week05_decoder_only.ipynb are executed as they are (found by a marker string, so
cell order does not matter), the live cells are re-run on the notebook's data, and the
artifacts precompute.py wrote are copied through. What the page runs in the browser — the
RoPE rotation, the YaRN multiplier, `word_label`, the six noise ops, the NER parsers, the
SQuAD scorer, `estimate` — is checked against the Python results exported here, and the
check is shown on the page.
"""
import base64
import contextlib
import io
import json
import os
import random
import sys
import time
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, ".."))                      # the notebook's working directory
sys.path.insert(0, os.getcwd())

import numpy as np
import torch

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = os.path.join(HERE, "demo_data.json")
NB = "week05_decoder_only.ipynb"
ART = "artifacts"


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def f16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float16).tobytes()).decode()


def r4(a, nd=4):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# ------------------------------------------------------------ notebook cells
nb = json.load(open(NB, encoding="utf-8"))
CODE = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]
MD = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "markdown"]
ns = {"__name__": "__nb__"}


def run_cell(marker, cut=None, capture=False):
    """Execute the unique code cell containing `marker`, truncated before `cut` if given.
    With capture=True, return what the cell printed."""
    hits = [s for s in CODE if marker in s]
    assert len(hits) == 1, (marker, len(hits))
    src = hits[0]
    if cut:
        assert cut in src, (marker, cut)
        src = src[: src.index(cut)]
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
run_cell("RECOMPUTE = False")
run_cell("def seed_all")
run_cell("def target_text")
run_cell("fancyzhx/ag_news")
run_cell("reference_results.csv")
run_cell("def record_cost")
g = ns
device = g["device"]
D["meta"]["device"] = str(device)
ag_train, ag_test, demo_texts = g["ag_train"], g["ag_test"], g["demo_texts"]
CLASS_NAMES, target_text, strip_text = g["CLASS_NAMES"], g["target_text"], g["strip_text"]
tfidf = g["tfidf"]
log(f"notebook setup on {device}; AG News train {len(ag_train)} test {len(ag_test)}")
D["data"] = {"nTrain": len(ag_train), "nTest": len(ag_test), "classes": CLASS_NAMES, "nDemo": g["N_DEMO"],
             "example": {"text": demo_texts[0], "stripped": strip_text(demo_texts[0]), "label": int(ag_test[0]["label"])},
             "tfidf": {"accuracy": float(tfidf.accuracy), "representation": str(tfidf.representation)}}

# ============================================================ 1. the decoder, alone
out_shapes = run_cell("tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)", capture=True)
out_params = run_cell("blocks = n_params(gpt.transformer.h)", capture=True)
out_ppl = run_cell("labels=enc.input_ids.masked_fill", capture=True)
gpt, tokenizer, bert = g["gpt"], g["tokenizer"], g["bert"]
D["shapes"] = {"bert": list(g["h_bert"].shape), "gpt": list(g["logits_gpt"].shape), "sentence": g["sentence"],
               "params": {"total": g["n_params"](gpt), "embeddings": g["embeddings"], "blocks": g["blocks"], "wte": g["n_params"](gpt.transformer.wte),
                          "wpe": g["n_params"](gpt.transformer.wpe), "layers": gpt.config.n_layer, "tied": bool(g["tied"]), "vocab": gpt.config.vocab_size,
                          "d": gpt.config.n_embd, "positions": gpt.config.n_positions, "bert": g["n_params"](bert)},
               "ppl": {"loss": float(g["loss"]), "ppl": float(g["loss"].exp()), "n": int(g["enc"].input_ids.shape[0])},
               "cellOut": out_shapes + out_params + out_ppl}
del g["bert"]
g["free"]() if "free" in g else None
log(f"shapes: {D['shapes']['bert']} / {D['shapes']['gpt']}, ppl {D['shapes']['ppl']['ppl']:.1f}")

# --- 1.2 logit lens: the artifact curves, the per-position top-5 of one text, and the notebook's live table
D["depth"] = art("depth")
D["lens"] = art("lens")
run_cell("body, n_layers = gpt.transformer, gpt.config.n_layer", cut="fig, ax")      # the notebook's live depth cell, without the plot
D["depth"]["live"] = {"n": g["N_DEMO"], "agreement": r4(g["agree"]), "perplexity": r4(g["ppl"], 2)}
out_lens = run_cell("guesses = {f\"layer {k}\"", capture=True)
D["lens"]["liveTable"] = {"pos": g["pos"], "guesses": g["guesses"], "cellOut": out_lens}
log("logit lens exported")

# --- 1.3 attention on one prompt
D["attention"] = art("attention")
log(f"attention: {D['attention']['shape']}")

# --- 1.4 positions: the numpy cell (for the JS parity check), the artifact, the YaRN multiplier
out_rot = run_cell("def rotate(x, pos, base=10_000)", capture=True)
rotate, q, k, table_ = g["rotate"], g["q"], g["k"], g["table"]
pairs = [(10, 3), (510, 503), (1000, 993), (0, 0), (1, 0), (8, 0), (700, 100)]
D["rope"] = {
    "d": g["d"], "q": r4(q, 6), "k": r4(k, 6), "tableRows": {str(i): r4(table_[i], 6) for i in sorted({m for m, n in pairs} | {n for m, n in pairs})},
    "check": [{"m": m, "n": n, "learned": float((q + table_[m]) @ (k + table_[n])), "rope": float(rotate(q, m) @ rotate(k, n))} for m, n in pairs],
    "cellOut": out_rot, "artifact": art("rope"),
}
run_cell("theta = 10_000 ** (-2 * np.arange(d // 2) / d)", cut="fig, ax")
out_yarn = run_cell("def yarn_multiplier", cut="fig, ax", capture=True)
run_cell("def yarn_multiplier", cut="fig, ax")
yarn_multiplier, wavelength = g["yarn_multiplier"], g["wavelength"]
D["rope"]["wavelength"] = r4(wavelength, 4)
D["rope"]["yarnCheck"] = {str(s): r4(yarn_multiplier(wavelength, 2048, s), 6) for s in [1.5, 4, 8, 16]}
D["rope"]["pythia"] = {"rotary_pct": 0.25, "layers": 12, "d": 768, "window": 2048}
log("rope exported")

# --- 1.5 the toolkit: generate / score are definitions only
run_cell("def gpu_gb()")

# ============================================================ 2. one pass, or T
out_one = run_cell("one_pass = time.time() - t", capture=True)
out_kv = run_cell("use_cache=cache", capture=True)
kv = g["kv"]
D["kv"] = {"promptTokens": int(g["enc"].input_ids.shape[1]), "onePassMs": g["one_pass"] * 1000, "sixtyFourMs": g["sixty_four"] * 1000,
           "table": [{"n": int(n), "noCache": float(kv.loc[n, False]), "cache": float(kv.loc[n, True]), "ratio": float(kv.loc[n, "ratio"])} for n in kv.index],
           "device": str(device), "cellOut": out_one + out_kv}
log(f"kv cache: {D['kv']['table']}")

# ============================================================ 3. design first
run_cell("class Design")
Design, estimate = g["Design"], g["estimate"]
D["cards"] = {"estimateCheck": []}
for body, use, passes in [("encoder", "head", "1"), ("decoder", "scorer", "candidates"), ("decoder", "generator", "T_out")]:
    for items, tin, tout in [(1_000_000, 60, 60), (10_000_000, 40, 0), (100_000 * 60 * 24, 8, 8)]:
        e = estimate(Design(task="t", body=body, use=use, output="", enumerable=True, guaranteed="", passes=passes), items, tin, tout)
        D["cards"]["estimateCheck"].append({"passes": passes, "items": items, "tin": tin, "tout": tout, "out": {k: int(v) for k, v in e.items()}})

# --- 3.0 zero-shot: the live cell on N_DEMO texts, the artifact, the pool
out_zs_live = run_cell('class_words = [" " + c for c in CLASS_NAMES]', capture=True)
zs_live = {"n": g["N_DEMO"], "accuracy": float((g["pred"] == g["gold"]).mean()), "predictedAs": {CLASS_NAMES[k]: int(v) for k, v in zip(*np.unique(g["pred"], return_counts=True))},
           "tokensPerName": {c: len(tokenizer(" " + c).input_ids) for c in CLASS_NAMES}, "cellOut": out_zs_live}
run_cell("zero_shot_gpt2.json")
run_cell('record("zero-shot scorer, GPT-2, class names as written"')
zs = g["zs"]
pool = art("zero_shot_pool")
sums = np.asarray(pool["sum_logprob"], dtype=np.float32)                   # [N, W]
gold = np.asarray(pool["gold"])
n_tok = np.asarray(pool["tokens_per_word"])


def pool_eval(words, per_token=False):
    ix = [pool["words"].index(w) for w in words]
    s = sums[:, ix] / (n_tok[ix] if per_token else 1)
    pred = s.argmax(1)
    return {"words": words, "accuracy": round(float((pred == gold).mean()), 4), "perClass": [round(float((pred[gold == c] == c).mean()), 4) for c in range(4)],
            "predictedAs": [int((pred == c).sum()) for c in range(4)]}


D["zeroShot"] = {"live": zs_live, "artifact": zs, "pool": {"words": pool["words"], "tokensPerWord": pool["tokens_per_word"], "n": pool["n"], "gold": pool["gold"],
                                                          "sums": f16(sums), "device": pool["device"], "seconds": pool["seconds"]},
                 "poolCheck": {"classNamesSum": pool_eval(CLASS_NAMES and [" World", " Sports", " Business", " Sci/Tech"]),
                               "classNamesPerToken": pool_eval([" World", " Sports", " Business", " Sci/Tech"], per_token=True),
                               "oneTokenEach": pool_eval([" world", " sports", " business", " technology"]),
                               "politics": pool_eval([" politics", " sports", " business", " technology"])}}
assert abs(D["zeroShot"]["poolCheck"]["oneTokenEach"]["accuracy"] - zs["results"]["one token each, sum"]["accuracy"]) < 2e-3, "pool disagrees with the artifact"
log(f"zero-shot: live {zs_live['accuracy']:.3f}, artifact {zs['results']['one token each, sum']['accuracy']}, pool {D['zeroShot']['poolCheck']['oneTokenEach']['accuracy']}")

# --- 3.1 punctuation: the label set, the 20 pairs, word_label checks
run_cell("def word_label(word)")
word_label, apply_label, PUNCT_LABELS = g["word_label"], g["apply_label"], g["PUNCT_LABELS"]
out_ceiling = run_cell("labels = [word_label(w) for t in demo_texts for w in t.split()]", capture=True)
CHECK_WORDS = ["pension", "Unions", "NASA", "U.S.", "iPhone", "3.5", "(Reuters)", "Wal-Mart", "talks,", "Mogul.", "McDonald's", "eBay", "why?", "STOP!", "18-year-old", "'disappointed'", "T", "N", "firm's", "A"]
D["punct"] = {"labels": PUNCT_LABELS, "cases": g["CASES"], "puncts": g["PUNCTS"],
              "labelCheck": [{"word": w, "label": word_label(w), "rebuilt": apply_label(strip_text(w), word_label(w))} for w in CHECK_WORDS],
              "liveCeiling": {"n": g["N_DEMO"], "nWords": len(g["labels"]), "unexpressible": float(np.mean(["other" in l for l in g["labels"]])), "cellOut": out_ceiling},
              "artifact": art("punct")}
from precompute import align_words, parse_inline, parse_list, squad_scores      # scoring helpers the notebook does not define
for d in D["punct"]["artifact"]["demo"]:
    gw = d["gold"].split()
    d["words"] = [{"stripped": s, "gold": w, "label": word_label(w), "encoder": e, "decoder": r}
                  for s, w, e, r in zip(d["input"].split(), gw, align_words(d["encoder"], d["gold"], key=strip_text), align_words(d["decoder"], d["gold"], key=strip_text))]
log(f"punct: {len(D['punct']['artifact']['demo'])} demo texts with per-word labels")

# --- 3.2 typos: the six ops on fixed (word, op, k, c) tuples, so the JS port can be checked
run_cell('OPS = ["sub", "del", "ins", "swap", "split", "merge"]')
OPS, add_noise = g["OPS"], g["add_noise"]


class FixedRng:
    """A stand-in for `random.Random` that returns a scripted sequence — the same op / position / letter in Python and JS."""
    def __init__(self, ops, ks, cs):
        self.ops, self.ks, self.cs = list(ops), list(ks), list(cs)

    def choice(self, seq):
        return self.ops.pop(0) if seq is OPS else self.cs.pop(0)

    def random(self):
        return 0.0

    def randrange(self, a, b):
        return self.ks.pop(0)


NOISE_CHECK = []
for text, ops, ks, cs in [("fears for pension after talks", ["sub", "del", "ins", "swap", "split"], [2, 1, 3, 2, 3], list("qzxwv")),
                          ("workers at turner newall say", ["merge", "none", "swap", "split", "none"], [1, 1, 3, 2, 1], list("abcde")),
                          ("federal mogul", ["none", "merge"], [1, 1], list("kk"))]:
    words = text.split()
    rng = FixedRng([o for o in ops if o != "none"] + ["none"] * 10, ks * 3, cs * 3)
    # add_noise draws an op only for words longer than 2 chars; the scripted sequence is consumed in that order
    seq_ops = iter(ops)
    class R(FixedRng):
        def choice(self, seq):
            return next(seq_ops) if seq is OPS else self.cs.pop(0)
    noisy, got_ops, flags = add_noise(text, 1.0, R([], ks * 3, cs * 3))
    NOISE_CHECK.append({"text": text, "ops": ops, "ks": ks, "cs": cs, "noisy": noisy, "opsOut": got_ops, "flags": flags})
D["typos"] = {"ops": OPS, "noiseCheck": NOISE_CHECK, "artifact": art("typos")}
log("typos exported")

# --- 3.3 NER: the formats, parsed back
run_cell("def bio_spans(tags)")
bio_spans, to_inline, to_list = g["bio_spans"], g["to_inline"], g["to_list"]
ner = art("ner")
for fmt in ("inline", "list"):
    for d in ner["formats"][fmt]["demo"]:
        parse = parse_inline if fmt == "inline" else parse_list
        tags, unmatched = parse(d["generated"], d["words"])
        d["parsed"] = tags
        d["unmatched"] = unmatched
        d["goldText"] = (to_inline if fmt == "inline" else to_list)(d["words"], d["gold"])
        assert tags == d["pred"], (fmt, d["generated"])
PARSE_CHECK = []
for d in ner["formats"]["inline"]["demo"][:20]:
    for text in [d["generated"], d["goldText"], "[ORG Bank of [LOC America]] said so", "nothing here", "[PER John Smith] met [PER John Smith]"]:
        tags, un = parse_inline(text, d["words"])
        PARSE_CHECK.append({"fmt": "inline", "text": text, "words": d["words"], "tags": tags, "unmatched": un})
for d in ner["formats"]["list"]["demo"][:20]:
    for text in [d["generated"], d["goldText"], "none", "Mars: LOC; Mars: PER", "SOCCER: MISC"]:
        tags, un = parse_list(text, d["words"])
        PARSE_CHECK.append({"fmt": "list", "text": text, "words": d["words"], "tags": tags, "unmatched": un})
D["ner"] = {"artifact": ner, "parseCheck": PARSE_CHECK}
run_cell("ner_curves.json")
D["ner"]["week4"] = {k: (v[-1] if isinstance(v, list) else v) for k, v in g["w4_ner"].items()}
log(f"ner: {len(PARSE_CHECK)} parse checks")

# --- 3.4 / 4.4 QA: the demos and the scorer
qa = art("qa")
for order in qa["orders"].values():
    for d in order["demo"]:
        em, f1 = squad_scores(d["pred"], d["gold"])
        d["em"], d["f1"] = em, round(f1, 4)
        d["substring"] = d["pred"].strip() != "" and d["pred"].strip().lower() in d["context"].lower()
D["qa"] = {"artifact": qa, "scoreCheck": [{"pred": p, "gold": gd, "em": squad_scores(p, gd)[0], "f1": round(squad_scores(p, gd)[1], 4)} for p, gd in
                                          [("Denver Broncos", ["Denver Broncos"]), ("the Denver Broncos.", ["Denver Broncos"]), ("Broncos", ["Denver Broncos"]),
                                           ("Carolina Panthers", ["Denver Broncos"]), ("", ["Denver Broncos"]), ("a game of football", ["football game", "game"])]]}
run_cell("qa_curves.json")
D["qa"]["week4"] = {k: (v[-1] if isinstance(v, list) else v) for k, v in g["w4_qa"].items()}
log("qa exported")

# ============================================================ 4. the two tables
run_cell("punct.json")
run_cell('record_cost("punctuation + case"')
run_cell("typos.json")
run_cell('record_cost("typos"')
run_cell('record_cost("NER"')
run_cell('record_cost("extractive QA"')
D["results"] = g["results"]
D["costs"] = g["costs"]
log(f"tables: {len(D['results'])} result rows, {len(D['costs'])} cost rows")

json.dump(D, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
log(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)")
