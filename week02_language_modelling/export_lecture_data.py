"""The measured numbers the lecture page (demo/lecture/) quotes -> artifacts/lecture_data.json.

    uv run python export_lecture_data.py

Everything is copied from the seminar's own artifact, artifacts/demo_data.json (written by export_demo_data.py from
the notebook's code and the precomputed runs); nothing is recomputed here, so the lecture page and the seminar page
cannot disagree.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
D = json.load(open("artifacts/demo_data.json", encoding="utf-8"))

out = {
    "corpus": {"nTokens": D["corpus"]["nTokens"], "nTypes": D["corpus"]["nTypes"], "hapax": D["corpus"]["hapax"],
               "medianChars": D["corpus"]["median"]},
    "ngramFirst": {"copied3": D["ngramFirst"]["copied3"], "copied5": D["ngramFirst"]["copied5"]},
    "sparsity": D["sparsity"],                                        # share of test n-grams never seen in training, words and BPE
    "smoothingWords": [{k: r[k] for k in ("model", "n", "delta", "interp", "ppl")} for r in D["smoothing"]["words"]],
    "smoothingBpe": [{k: r[k] for k in ("model", "n", "ppl")} for r in D["smoothing"]["bpe"]],
    "results": D["results"],                                          # the seminar's results table: model, tokens, ppl, bpc
    "decode": D["decodeTable"]["rows"],                               # repetition, distinct-2, avg log-prob per decoding rule
    "bleuByLen": D["s2sCurves"]["bleu_by_src_len"],
    "bleuSweep": {k: v["bleu_by_src_len"] for k, v in D["s2sSweep"].items()},
    "beam": {"greedy": D["s2sBleu"]["greedy"], "beam5": D["s2sBleu"]["beam5"]},
    "gradTime": D["gradTime"],                                        # gradient of the last-position loss w.r.t. each earlier input
    "lstm": {"V": D["lstm"]["V"], "E": D["lstm"]["E"], "H": D["lstm"]["H"], "params": D["lstm"]["params"]},
}
json.dump(out, open("artifacts/lecture_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"artifacts/lecture_data.json  {os.path.getsize('artifacts/lecture_data.json') / 1e3:.1f} kB")
