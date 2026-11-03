# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["nltk==3.10.4", "pymorphy3==2.0.6", "pymorphy3-dicts-ru==2.4.417150.4580142"]
# ///
"""Сохраняет результаты кода со страницы: uv run --script week01_text_representations/export_morphology.py."""

import json
import re
from importlib.metadata import version
from pathlib import Path

WEEK = Path(__file__).resolve().parent
source = (WEEK / "demo/add/text/02_tokens.md").read_text()
code = re.search(r"## code-normalization\n```python\n(.*?)```", source, re.S).group(1)
namespace = {}
exec(compile(code, "code-normalization", "exec"), namespace)
examples = [
    ("кошки", "словоформа"),
    ("кошкой", "словоформа"),
    ("кошкам", "словоформа"),
    ("бегу", "смена основы"),
    ("бежали", "смена основы"),
    ("люди", "смена основы"),
    ("лучше", "сравнительная форма"),
    ("стали", "неоднозначность"),
    ("пила", "неоднозначность"),
    ("замки", "омонимы с одной леммой"),
]
rows = []
for word, case in examples:
    stem, lemmas = namespace["normalize"](word)
    rows.append({"word": word, "stem": stem, "lemmas": lemmas, "case": case})
data = {
    "versions": {p: version(p) for p in ("nltk", "pymorphy3", "pymorphy3-dicts-ru")},
    "rows": rows,
}
path = WEEK / "artifacts/morphology.json"
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
for row in rows:
    print(f"{row['word']}: {row['stem']} → {', '.join(row['lemmas'])}")
print(data["versions"])
