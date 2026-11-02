"""The measured numbers the lecture page (demo/lecture/) quotes -> artifacts/lecture_data.json.

    uv run python export_lecture_data.py

Copied from the seminar's own artifact, artifacts/demo_data.json (export_demo_data.py): OLMo 2 1B after each stage,
32 samples on each of 100 GSM8K problems. Nothing is recomputed here; the browser derives pass@k and the share of
groups that carry no gradient from the per-problem counts.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
D = json.load(open("artifacts/demo_data.json", encoding="utf-8"))
P = D["passk"]

out = {
    "passk": {"n": P["n"], "nProblems": P["n_problems"], "ks": P["ks"],
              "stages": {s: {"correct": v["correct"], "curve": v["curve"]} for s, v in P["stages"].items()}},
}
json.dump(out, open("artifacts/lecture_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"artifacts/lecture_data.json  {os.path.getsize('artifacts/lecture_data.json') / 1e3:.1f} kB")
