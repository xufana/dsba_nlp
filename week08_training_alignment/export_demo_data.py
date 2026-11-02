"""Every number the week-7 demo page shows -> artifacts/demo_data.json.

Run from week08_training_alignment/:
    uv run python export_demo_data.py

The notebook itself is not executed (its live cells load four 1B checkpoints). Instead:
  * the definition cells the page mirrors (`sft_example`, `final_number` / `reward` / `pass_at_k`, `advantages`)
    are exec'd from the .ipynb as they are, found by marker strings, and run here on the CPU;
  * the measured artifacts precompute.py wrote on a T4 (stages, rewards, passk, think) are read and summarised;
  * two small things come from the hub, CPU only: one short dialogue of the SFT stage's own mixture, tokenised
    with SmolLM2-Instruct's template (the mask picture), and one UltraFeedback prompt with its four rated
    completions (the labelling / Bradley–Terry block).
What the browser computes — the mask count, Bradley–Terry by MM steps, agreement,
the DPO loss, GRPO advantages, the checker, pass@k — is checked against the Python results written here, and
the check is shown on the page.
"""
import contextlib
import io
import json
import os
import random
import re
import sys
import time
import warnings

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
sys.path.insert(0, os.getcwd())

import numpy as np

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = os.path.join(HERE, "artifacts", "demo_data.json")
NB = "week08_training_alignment.ipynb"
ART = "artifacts"
SEED = 42
SMALL_CHAT = "HuggingFaceTB/SmolLM2-135M-Instruct"
SFT_DATA = "allenai/tulu-3-sft-olmo-2-mixture-0225"
UF_DATA = "openbmb/UltraFeedback"


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def r4(a, nd=4):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# ------------------------------------------------------------------ the notebook's own definitions
nb = json.load(open(NB, encoding="utf-8"))
NS = {}


def run_cell(marker):
    """exec the first code cell containing `marker` into NS (stdout swallowed) — the notebook's lines, as they are."""
    for c in nb["cells"]:
        src = "".join(c["source"])
        if c["cell_type"] == "code" and marker in src:
            with contextlib.redirect_stdout(io.StringIO()):
                exec(compile(src, f"<notebook:{marker}>", "exec"), NS)
            return
    raise SystemExit(f"no notebook cell contains {marker!r}")


import math  # noqa: E402
import torch  # noqa: E402

NS.update({"np": np, "re": re, "math": math, "torch": torch, "IGNORE": -100, "SEED": SEED})
run_cell("def sft_example")          # sft_example, batches, train_sft
run_cell("def final_number")         # gold_number, final_number, reward, pass_at_k
run_cell("def advantages")           # advantages (+ its printed examples)
sft_example, final_number, reward, pass_at_k, advantages = (NS[k] for k in ["sft_example", "final_number", "reward", "pass_at_k", "advantages"])
D = {"meta": {"notebook": NB, "exported": time.strftime("%Y-%m-%d")}}

# ------------------------------------------------------------------ SFT: the mask on one real dialogue
log("SFT: one dialogue of the stage's own mixture, through SmolLM2-Instruct's template")
from datasets import load_dataset  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402

small_tok = AutoTokenizer.from_pretrained(SMALL_CHAT)
stream = load_dataset(SFT_DATA, split="train", streaming=True)          # no shuffle buffer: the first short dialogues of the first shard are as good as any
dialogues = []
for row in stream:
    m = row["messages"]
    if len(m) == 2 and m[0]["role"] == "user" and len(m[0]["content"]) + len(m[1]["content"]) < 2000:
        dialogues.append(m)
    if len(dialogues) == 64:
        break
# the shown one: short enough to read on a projector, a real answer (not code)
shown = next(d for d in dialogues if len(d[0]["content"]) < 260 and 80 < len(d[1]["content"]) < 420 and "```" not in d[1]["content"]
             and all(ord(c) < 128 for c in d[0]["content"] + d[1]["content"]))      # English: the page is read off a projector
ex = sft_example(small_tok, shown)
pieces = [small_tok.decode([t]) for t in ex["input_ids"]]
D["sft"] = {
    "messages": shown, "pieces": pieces, "labels": [int(l != -100) for l in ex["labels"]],
    "n_tokens": len(pieces), "n_loss": int(sum(l != -100 for l in ex["labels"])),
    "template": small_tok.apply_chat_template([{"role": "user", "content": "{question}"}], add_generation_prompt=True, tokenize=False),
}
# the collator picture: 64 dialogues, batches of 8 — random order against sorted by length
lens = [len(sft_example(small_tok, d)["input_ids"]) for d in dialogues]
rng = random.Random(SEED)
rand = lens[:]
rng.shuffle(rand)
srt = sorted(lens)
pad_share = lambda ls: 1 - sum(ls) / sum(max(ls[i:i + 8]) * len(ls[i:i + 8]) for i in range(0, len(ls), 8))
D["sft"]["collate"] = {"lengths_random": rand, "lengths_sorted": srt, "batch": 8,
                       "pad_random": round(pad_share(rand), 4), "pad_sorted": round(pad_share(srt), 4), "mean_len": round(float(np.mean(lens)), 1)}
log(f"  {D['sft']['n_loss']} of {D['sft']['n_tokens']} tokens carry loss; padding {D['sft']['collate']['pad_random']:.0%} random vs {D['sft']['collate']['pad_sorted']:.0%} sorted")

# ------------------------------------------------------------------ which share of the weights each stage changed
w = json.load(open(f"{ART}/weights.json"))
D["weights"] = {}
for name, key in [("SFT", "base -> SFT"), ("DPO", "SFT -> DPO"), ("RLVR", "DPO -> RLVR")]:
    pr, agg = w["pairs"][key], {}
    for t in pr["tensors"]:
        a = agg.setdefault(t["kind"], [0.0, 0])
        a[0] += t["same"] * t["numel"]; a[1] += t["numel"]
    D["weights"][name] = {"from": key.split(" -> ")[0], "changed": round(1 - pr["same"], 4), "relative": pr["relative"], "numel": sum(v[1] for v in agg.values()),
                          "by_kind": {k: round(1 - v[0] / v[1], 4) for k, v in agg.items()}}

# ------------------------------------------------------------------ labelling + Bradley–Terry: one UltraFeedback prompt, four completions
log("UltraFeedback: one prompt with four rated completions")
uf = None
try:
    for row in load_dataset(UF_DATA, split="train", streaming=True):
        comps = row["completions"]
        if len(comps) != 4 or not (60 < len(row["instruction"]) < 320) or row.get("source") == "evol_instruct":
            continue
        if any(not c["response"] or len(c["response"]) > 700 or len(c["response"]) < 120 or c.get("overall_score") is None for c in comps):
            continue
        scores = [float(c["overall_score"]) for c in comps]
        if len(set(scores)) < 4 or min(scores) < 2 or max(scores) - min(scores) < 3:
            continue
        if "```" in row["instruction"] or any("```" in c["response"] for c in comps):
            continue
        uf = {"source": row.get("source"), "instruction": row["instruction"],
              "completions": [{"model": c["model"], "text": c["response"], "score": float(c["overall_score"]),
                               "ratings": {k: v.get("Rating") for k, v in c["annotations"].items()} if isinstance(c.get("annotations"), dict) else {}}
                              for c in comps]}
        break
except Exception as e:  # noqa: BLE001
    log(f"  UltraFeedback unavailable ({e}); falling back to the four OLMo stages' answers")
if uf is None:
    st_ = json.load(open(f"{ART}/stages.json"))
    uf = {"source": "stages.json", "instruction": st_["prompts"][1],
          "completions": [{"model": f"OLMo 2 1B {s}", "text": r["demo"][1][:700], "score": None, "ratings": {}} for s, r in st_["stages"].items()]}
D["bt"] = {"item": uf}
log(f"  {uf['source']}: {[c['model'] for c in uf['completions']]} scores {[c['score'] for c in uf['completions']]}")


def bt_mm(wins, steps=60):
    """Bradley–Terry by Hunter's MM iterations on a wins matrix (wins[i][j] = times i beat j); scores r = log p, centred.
    Returns the trajectory of r after every step and the negative log-likelihood −Σ w_ij log σ(r_i − r_j) along it."""
    w = np.asarray(wins, dtype=float)
    n = w + w.T
    p = np.ones(len(w))
    traj, nll = [], []
    for _ in range(steps):
        W = w.sum(1)
        denom = np.array([sum(n[i, j] / (p[i] + p[j]) for j in range(len(w)) if j != i) for i in range(len(w))])
        p = np.where(W > 0, W / np.maximum(denom, 1e-12), 1e-6)
        p = p / np.exp(np.log(p).mean())
        r = np.log(p)
        traj.append(r.tolist())
        diff = r[:, None] - r[None, :]
        nll.append(float(-(w * np.log(1 / (1 + np.exp(-diff)) + 1e-300)).sum()))
    return traj, nll


def agreement(wins):
    """Per pair: the share of votes with the majority; mean over pairs; chance-corrected against a coin (0.5)."""
    w = np.asarray(wins, dtype=float)
    shares = [max(w[i, j], w[j, i]) / (w[i, j] + w[j, i]) for i in range(len(w)) for j in range(i + 1, len(w)) if w[i, j] + w[j, i] > 0]
    pa = float(np.mean(shares))
    maj = w > w.T
    cycle = any(maj[i, j] and maj[j, k] and maj[k, i] for i in range(len(w)) for j in range(len(w)) for k in range(len(w)) if len({i, j, k}) == 3)
    return {"per_pair": r4(shares), "mean": round(pa, 4), "kappa": round((pa - 0.5) / 0.5, 4), "cycle": bool(cycle)}


# a fixed vote table for the in-browser check only (25 voters, six pairs); the page starts empty and takes the room's votes
CHECK_WINS = [[0, 18, 20, 14], [7, 0, 13, 9], [5, 12, 0, 10], [11, 16, 15, 0]]
traj, nll = bt_mm(CHECK_WINS)
D["bt"]["check"] = {"wins": CHECK_WINS, "steps": len(traj), "r_first": r4(traj[0]), "r_final": r4(traj[-1]), "nll_first": round(nll[0], 4), "nll_final": round(nll[-1], 4),
                    "p_final": r4(1 / (1 + np.exp(-(np.array(traj[-1])[:, None] - np.array(traj[-1])[None, :])))), "agreement": agreement(CHECK_WINS)}
# Bradley–Terry worked numbers from the notebook's "let's calculate" (a)
sig = lambda x: 1 / (1 + math.exp(-x))
D["bt"]["example_a"] = {"r_chosen": 2.0, "r_rejected": 0.5, "p": round(sig(1.5), 4), "loss": round(-math.log(sig(1.5)), 4)}
log(f"  MM fit: r = {D['bt']['check']['r_final']}, nll {nll[0]:.3f} -> {nll[-1]:.3f}; agreement {D['bt']['check']['agreement']}")

# ------------------------------------------------------------------ DPO: the toy numbers (b), (c) and the real pairs
beta = 0.1
dpo = lambda pc, pr, rc, rr: beta * ((pc - rc) - (pr - rr))
D["dpo"] = {"beta": beta, "examples": {}}
for name, pc, pr in [("b", -35, -52), ("c", -45, -62)]:
    m = dpo(pc, pr, -40, -42)
    D["dpo"]["examples"][name] = {"pi_chosen": pc, "pi_rejected": pr, "ref_chosen": -40, "ref_rejected": -42, "r_chosen": round(beta * (pc + 40), 4), "r_rejected": round(beta * (pr + 42), 4),
                                  "margin": round(m, 4), "loss": round(-math.log(sig(m)), 4), "grad_weight": round(sig(-m), 4)}
# length-normalised DPO flips a pair (the Tülu 3 variant): Δ_w = 2 over 100 tokens, Δ_l = 1 over 10
D["dpo"]["examples"]["ln"] = {"dw": 2, "lw": 100, "dl": 1, "ll": 10, "gap": 1.0, "gap_normalised": round(2 / 100 - 1 / 10, 4)}

rw = json.load(open(f"{ART}/rewards.json"))
S = {k: np.array(rw["SFT"][k]) for k in ["chosen", "rejected"]}
lc, lr = np.array(rw["len_chosen"]), np.array(rw["len_rejected"])
src = rw["source"]
short = {s: s.split("/")[-1].replace("olmo2-1b-", "").replace("tulu-3-pref-", "") for s in set(src)}
pairs = {"n": rw["n"], "device": rw["device"], "source": [short[s] for s in src], "on_policy": [("on-policy" in s) for s in src],
         "len_chosen": lc.tolist(), "len_rejected": lr.tolist(), "SFT": {k: r4(S[k], 3) for k in S}}
summary = {}
for stage in ["DPO", "RLVR"]:
    P = {k: np.array(rw[stage][k]) for k in ["chosen", "rejected"]}
    dc, dr = P["chosen"] - S["chosen"], P["rejected"] - S["rejected"]
    pairs[stage] = {k: r4(P[k], 3) for k in P}
    def stats(m):
        return {"n": int(m.sum()), "margin_pos": round(float(np.mean(dc[m] > dr[m])), 4), "chosen_up": round(float(np.mean(dc[m] > 0)), 4),
                "both_down": round(float(np.mean((dc[m] < 0) & (dr[m] < 0))), 4), "mean_dc": round(float(dc[m].mean()), 2), "mean_dr": round(float(dr[m].mean()), 2),
                "median_dc": round(float(np.median(dc[m])), 2), "median_dr": round(float(np.median(dr[m])), 2)}
    allm = np.ones(len(dc), bool)
    on = np.array(pairs["on_policy"])
    summary[stage] = {"all": stats(allm), "on_policy": stats(on), "off_policy": stats(~on),
                      "by_source": {short[s]: stats(np.array([x == s for x in src])) for s in sorted(set(src), key=lambda s: -src.count(s))}}
D["dpo"]["pairs"] = pairs
D["dpo"]["summary"] = summary
D["dpo"]["length"] = {"chosen_longer": round(float(np.mean(lc > lr)), 4), "mean_chosen": round(float(lc.mean()), 1), "mean_rejected": round(float(lr.mean()), 1),
                      "sft_prefers_chosen": round(float(np.mean(S["chosen"] > S["rejected"])), 4),
                      "sft_prefers_chosen_per_token": round(float(np.mean(S["chosen"] / lc > S["rejected"] / lr)), 4)}
st = json.load(open(f"{ART}/stages.json"))
D["stages"] = {"n_open": st["n_open"], "n_gsm": st["n_gsm"], "max_new_tokens": st["max_new_tokens"], "device": st["device"], "prompts": st["prompts"],
               "rows": {s: {"model": r["model"], "params": r["params"], "bits_per_byte": r["bits_per_byte"], "open_tokens": r["open"]["tokens"], "open_stopped": r["open"]["stopped"],
                            "gsm_acc": r["gsm8k"]["accuracy"], "gsm_tokens": r["gsm8k"]["tokens"], "gsm_stopped": r["gsm8k"]["stopped"],
                            "answers": r["demo"]} for s, r in st["stages"].items()}}       # answers: greedy, 160 new tokens, the notebook's three prompts
log(f"  DPO on its pairs: {summary['DPO']['all']}; on-policy {summary['DPO']['on_policy']['margin_pos']} vs off {summary['DPO']['off_policy']['margin_pos']}")

# ------------------------------------------------------------------ GRPO: advantages, the checker, which groups teach, pass@k
groups = {"mixed": [1, 0, 0, 1, 0, 0, 0, 1], "all right": [1] * 8, "all wrong": [0] * 8, "one right": [1, 0, 0, 0, 0, 0, 0, 0]}
D["grpo"] = {"advantages": {k: r4(advantages(v)) for k, v in groups.items()},
             "mixed_prob": {str(p): {str(G): round(1 - p ** G - (1 - p) ** G, 4) for G in [2, 4, 8, 16, 32, 64]} for p in [0.5, 0.1, 0.01]}}
CHECK_TEXTS = ["Subtract 2 from both sides: n = 6 - 2 = 4. So the value of n is 4.", "#### 4", "The answer is \\boxed{4}.", "the answer is 4, or maybe 12",
               "FINAL: 4.0", " 4\n\nQuestion: Find x in 2x + 3 = 7.\nAnswer: 2", "The answer is: 12 since 4 + 8", "I am not sure.", "3x = 12, x = 4. Answer: 4",
               "It costs 1,000 dollars, i.e. 4 per item", "the answer is -4", "n = 4\n#### 12"]
D["grpo"]["checker"] = {"gold": 4.0, "tests": [{"text": t, "final": final_number(t), "reward": reward(t, 4.0)} for t in CHECK_TEXTS]}

pk = json.load(open(f"{ART}/passk.json"))
ks = [k for k in [1, 2, 4, 8, 16, 32, 64, 128] if k <= pk["n"]]
D["passk"] = {"n_problems": pk["n_problems"], "n": pk["n"], "temperature": pk["temperature"], "max_new_tokens": pk["max_new_tokens"], "device": pk["device"], "ks": ks, "stages": {}}
cnt = {s: np.array(r["correct"]) for s, r in pk["stages"].items()}
for s, c in cnt.items():
    D["passk"]["stages"][s] = {"correct": c.tolist(), "curve": r4([np.mean([pass_at_k(pk["n"], ci, k) for ci in c]) for k in ks]),
                               "all_wrong": round(float(np.mean(c == 0)), 4), "all_right": round(float(np.mean(c == pk["n"])), 4), "tokens": pk["stages"][s]["tokens"]}
D["passk"]["overlap"] = {"base_never": int((cnt["base"] == 0).sum()), "base_never_sft_solves": int(((cnt["base"] == 0) & (cnt["SFT"] > 0)).sum()),
                         "base_never_rlvr_solves": int(((cnt["base"] == 0) & (cnt["RLVR"] > 0)).sum()), "sft_never": int((cnt["SFT"] == 0).sum()),
                         "sft_never_rlvr_solves": int(((cnt["SFT"] == 0) & (cnt["RLVR"] > 0)).sum())}
log("  pass@k: " + ", ".join(f"{s} {r['curve'][0]:.3f}->{r['curve'][-1]:.3f}" for s, r in D['passk']['stages'].items()))

th = json.load(open(f"{ART}/think.json"))
D["think"] = {"model": th["model"], "n": th["n"], "device": th["device"], "modes": {}}
for m, r in th["modes"].items():
    t = np.array(r["tokens"])
    D["think"]["modes"][m] = {"accuracy": r["accuracy"], "tokens": r["tokens"], "mean": round(float(t.mean()), 1), "median": float(np.median(t)), "stopped": r["stopped"],
                              "budget": r["max_new_tokens"], "ran_out": round(float(np.mean(t >= r["max_new_tokens"])), 4), "seconds": r["seconds"], "demo": r["demo"][:3000]}
D["think"]["ratio"] = round(D["think"]["modes"]["thinking"]["mean"] / D["think"]["modes"]["no thinking"]["mean"], 2)
# the R1 / s1 filter: a problem survives if at least one of K teacher solutions is verified
D["filter"] = {str(p): {str(K): round(1 - (1 - p) ** K, 4) for K in [1, 2, 4, 8, 16]} for p in [0.9, 0.5, 0.1]}

json.dump(D, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
log(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)")
