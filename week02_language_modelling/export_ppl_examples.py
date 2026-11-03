"""Извлекает условия обучения и перплексии моделей DSBA на анекдотах."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = "autumn-2026:week02_language_modelling/artifacts/demo_data.json"


def export():
    data = json.loads(subprocess.check_output(["git", "show", SOURCE], cwd=ROOT))
    rows = []
    for key in ("rnn", "gru", "lstm"):
        model = data["lmCurves"][key]
        rows.append({"model": key.upper(), "ppl": model["testPplRecomputed"], "config": model["config"]})
    result = {
        "source": SOURCE,
        "sourceCommit": subprocess.check_output(["git", "rev-parse", "autumn-2026"], cwd=ROOT, text=True).strip(),
        "testJokes": data["corpus"]["nTest"],
        "vocabSize": len(data["tokenizer"]["vocab"]),
        "rows": rows,
    }
    target = ROOT / "artifacts/ppl_examples.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"{target}: {len(rows)} модели")


if __name__ == "__main__":
    export()
