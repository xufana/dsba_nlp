"""Извлекает генерации DSBA и проверяет совпадения с учебной подвыборкой."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = "autumn-2026:week02_language_modelling/artifacts/demo_data.json"


def export():
    data = json.loads(subprocess.check_output(["git", "show", SOURCE], cwd=ROOT))
    docs = [re.findall(r"\w+", text.lower()) for text in data["jokesSample"]]
    joined = "\n" + "\n".join(" " + " ".join(doc) + " " for doc in docs) + "\n"
    rows = {}
    for order in (3, 5):
        rows[str(order)] = []
        for text in data["ngramFirst"][f"samples{order}"]:
            words = text.split()
            copied = None
            for length in range(len(words), 2, -1):
                for start in range(len(words) - length + 1):
                    fragment = " ".join(words[start:start + length])
                    if " " + fragment + " " in joined:
                        copied = {"start": start, "length": length}
                        break
                if copied:
                    break
            rows[str(order)].append({"text": text, "copied": copied})
    result = {
        "source": SOURCE,
        "sourceCommit": subprocess.check_output(["git", "rev-parse", "autumn-2026"], cwd=ROOT, text=True).strip(),
        "trainingJokes": data["ngramFirst"]["nJokes"],
        "checkedJokes": len(docs),
        "samples": rows,
    }
    target = ROOT / "artifacts/ngram_examples.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"{target}: {sum(map(len, rows.values()))} примеров, проверено {len(docs)} анекдотов")


if __name__ == "__main__":
    export()
