"""Every number the demo page shows -> artifacts/demo_data.json.

    uv run python export_demo_data.py

Three sources, kept apart in the JSON:
  * "run"   — read from the notebook's own outputs: the autumn-2025 run on a Colab T4 (transformers 4.x), kept in the
              ported notebook. Accuracies, trainable-parameter counts, it/s and wall times are parsed, not typed.
  * "paper" — tables copied from the papers (each entry names its table), checked against the arXiv PDFs.
  * "synthetic" — what we had no time to measure, drawn with a fixed seed so that it looks like the real thing:
              the eval curves between the measured endpoints, and two 48 x 48 matrices for the rank slider.
              The page marks every such panel "illustrative".
GPT-2's shapes are exact and the page computes parameter counts from them in the browser, checked against "run".
"""
import json
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
NB = "week07_peft.ipynb"
cells = json.load(open(NB))["cells"]


def src(c):
    return "".join(c["source"])


def text_out(c):
    out = []
    for o in c.get("outputs", []):
        out.append("".join(o.get("text", [])) or "".join(o.get("data", {}).get("text/plain", [])))
    return "\n".join(out)


def cell_after(marker, start=0):
    """Index of the first code cell at or after `start` whose source contains `marker`."""
    for i in range(start, len(cells)):
        if cells[i]["cell_type"] == "code" and marker in src(cells[i]):
            return i
    raise KeyError(marker)


# ------------------------------------------------------------------ the run
# order of the experiments in the notebook; each has an optimizer cell, a %%time training cell and an evaluate cell
METHODS = [("ft", "full fine-tuning"), ("lp", "linear probing"), ("lora", "LoRA, r = 8 on c_attn"), ("pt", "prompt tuning, 12 tokens"), ("lpft", "LP-FT")]
train_cells, i = [], 0
while True:
    try:
        i = cell_after("training_loop_fn(", i + 1)
    except KeyError:
        break
    if "%%time" in src(cells[i]):
        train_cells.append(i)
assert len(train_cells) == 5, train_cells
run = {}
for (key, label), ti in zip(METHODS, train_cells):
    stderr = text_out(cells[ti])
    rate = float(re.findall(r"([\d.]+)it/s\]", stderr)[-1])
    wall = re.search(r"Wall time: (?:(\d+)min )?([\d.]+)s", stderr)
    ev = text_out(cells[cell_after("evaluate(", ti + 1)])
    acc = float(re.search(r"val acc(?:uracy)?: ([\d.]+)", ev).group(1))
    loss = float(re.search(r"val loss: ([\d.]+)", ev).group(1))
    run[key] = {"label": label, "acc": acc, "loss": loss, "it_s": rate, "wall_s": int(wall.group(1) or 0) * 60 + float(wall.group(2))}

total = int(text_out(cells[cell_after("sum(p.numel() for p in model.parameters())")]).strip())
lora_out = text_out(cells[cell_after("LoraConfig(")])
pt_out = text_out(cells[cell_after("PromptTuningConfig(")])
trainable = lambda s: int(re.search(r"trainable params: ([\d,]+)", s).group(1).replace(",", ""))
run["ft"]["trainable"] = run["lpft"]["trainable"] = total
run["lp"]["trainable"] = 768 * 2                          # score = Linear(768, 2, bias=False), printed in the model repr
run["lora"]["trainable"] = trainable(lora_out)
run["pt"]["trainable"] = trainable(pt_out)

balance = re.search(r"Valid: ([\d.]+) ([\d.]+)", text_out(cells[cell_after("Percentage of classes")]))
n_valid = 872
D = {"meta": {"notebook": NB, "device": "Colab T4", "year": 2025, "n_valid": n_valid, "n_train": 50000, "steps": 1000, "batch": 128,
              "valid_pos": float(balance.group(2))},
     "run": run,
     "gpt2": {"layers": 12, "d": 768, "ffn": 3072, "vocab": 50258, "positions": 1024, "classes": 2, "total": total}}

# ------------------------------------------------------------------ prompt tuning: what the init text becomes
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
pt_src = src(cells[cell_after("PromptTuningInit.TEXT:")])
init_text = re.search(r'PromptTuningInit.TEXT: "(.*?)"', pt_src).group(1)
n_virtual = int(re.search(r"num_virtual_tokens=(\d+)", src(cells[cell_after("num_virtual_tokens=")])).group(1))
sample = "it 's slow -- very , very slow . "
assert sample in text_out(cells[cell_after("for i in range(10):")])
D["prompt"] = {"init_text": init_text, "init": [tok.decode([i]) for i in tok(init_text)["input_ids"]], "n": n_virtual,
               "sample": [tok.decode([i]) for i in tok(sample)["input_ids"]]}

# ------------------------------------------------------------------ the papers
D["paper"] = {
    "kumar": {"src": "Kumar et al. (2022), Tables 1–2: averages over 6 ID and 10 OOD image datasets",
              "id": {"FT": 85.1, "LP": 82.9, "LP-FT": 85.7}, "ood": {"FT": 59.3, "LP": 66.2, "LP-FT": 68.9}},
    "latency": {"src": "Hu et al. (2021), Table 1: one forward pass of GPT-2 medium, ms, Quadro RTX8000",
                "cols": [{"batch": 32, "seq": 512}, {"batch": 16, "seq": 256}, {"batch": 1, "seq": 128}],
                "rows": {"fine-tuned / LoRA merged": [1449.4, 338.0, 19.8], "Adapter (Lin et al.)": [1482.0, 354.8, 23.9], "Adapter (Houlsby et al.)": [1492.2, 366.3, 25.8]}},
    "weight_type": {"src": "Hu et al. (2021), Table 5: GPT-3, 18M trainable parameters in every column",
                    "cols": [["Wq", 8], ["Wk", 8], ["Wv", 8], ["Wo", 8], ["Wq, Wk", 4], ["Wq, Wv", 4], ["Wq, Wk, Wv, Wo", 2]],
                    "wikisql": [70.4, 70.0, 73.0, 73.2, 71.4, 73.7, 73.7], "mnli": [91.0, 90.8, 91.0, 91.3, 91.3, 91.3, 91.7], "sd": {"wikisql": 0.5, "mnli": 0.1}},
    "rank": {"src": "Hu et al. (2021), Table 6: GPT-3, validation accuracy by rank", "r": [1, 2, 4, 8, 64],
             "wikisql": {"Wq": [68.8, 69.6, 70.5, 70.4, 70.0], "Wq, Wv": [73.4, 73.3, 73.7, 73.8, 73.5], "Wq, Wk, Wv, Wo": [74.1, 73.7, 74.0, 74.0, 73.9]},
             "mnli": {"Wq": [90.7, 90.9, 91.1, 90.7, 90.7], "Wq, Wv": [91.3, 91.4, 91.3, 91.6, 91.4], "Wq, Wk, Wv, Wo": [91.2, 91.7, 91.7, 91.5, 91.4]}},
    "gpt3": {"src": "Hu et al. (2021), Table 4: GPT-3 175B",
             "rows": [["FT", 175255.8, 73.8, 89.5], ["BitFit", 14.2, 71.3, 91.0], ["PreEmbed", 3.2, 63.1, 88.6], ["PreLayer", 20.2, 70.1, 89.5],
                      ["Adapter (Houlsby)", 7.1, 71.9, 89.8], ["Adapter (Houlsby)", 40.1, 73.2, 91.5], ["LoRA", 4.7, 73.4, 91.7], ["LoRA", 37.7, 74.0, 91.6]]},
}

# ------------------------------------------------------------------ synthetic, seeded
rng = np.random.default_rng(7)
steps = [0, 250, 500, 750, 1000]
curves = {}
for key, start, tau in [("ft", 0.50, 160), ("lp", 0.50, 420), ("lora", 0.50, 190), ("pt", 0.50, 520), ("lpft", run["lp"]["acc"], 140)]:
    end = run[key]["acc"]
    ys = [start + (end - start) * (1 - np.exp(-s / tau)) / (1 - np.exp(-1000 / tau)) for s in steps]
    ys = [round(float(y + (rng.normal(0, 0.006) if 0 < s < 1000 else 0)), 4) for s, y in zip(steps, ys)]
    ys[0] = round(float(start + (rng.normal(0, 0.01) if key != "lpft" else 0)), 4)
    curves[key] = ys
n = 48
# W: a "pretrained" matrix — slowly decaying spectrum; dW: the update — a few strong directions plus noise
U0, _ = np.linalg.qr(rng.normal(size=(n, n))); V0, _ = np.linalg.qr(rng.normal(size=(n, n)))
W = U0 @ np.diag(1.0 / np.sqrt(1 + np.arange(n) * 0.35)) @ V0.T
dW = sum(s * np.outer(rng.normal(size=n), rng.normal(size=n)) / n for s in [3.0, 1.9, 1.1, 0.6]) + rng.normal(0, 0.012, size=(n, n))


def svd_pack(M):
    u, s, vt = np.linalg.svd(M)
    return {"u": np.round(u, 4).tolist(), "s": np.round(s, 5).tolist(), "vt": np.round(vt, 4).tolist()}


D["synthetic"] = {"curves": {"steps": steps, **curves}, "W": svd_pack(W), "dW": svd_pack(dW), "n": n}

os.makedirs("artifacts", exist_ok=True)
json.dump(D, open("artifacts/demo_data.json", "w"), ensure_ascii=False, separators=(",", ":"))
print({k: (v["acc"], v["trainable"], v["it_s"], round(v["wall_s"])) for k, v in run.items()})
