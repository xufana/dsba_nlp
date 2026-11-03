# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["torch==2.14.1"]
# ///
"""Выполняет примеры со страницы и сохраняет векторы для вкладок документа."""

import json
import re
from importlib.metadata import version
from pathlib import Path

WEEK = Path(__file__).resolve().parent
sources = "\n".join(p.read_text() for p in sorted((WEEK / "demo/add/text").glob("*.md")))


def execute(key, namespace):
    match = re.search(r"## code-" + re.escape(key) + r"\n\s*```python\n(.*?)```", sources, re.S)
    if not match:
        raise ValueError(f"Не найден блок code-{key}")
    exec(compile(match.group(1), f"code-{key}", "exec"), namespace)


print("Обучаем маленький Skip-Gram на CPU…", flush=True)
namespace = {}
for key in ("embedding-data", "embedding-init", "embeddings", "pool"):
    execute(key, namespace)
word_vectors = namespace["word_vectors"].tolist()
mean_vector = namespace["document_vector"].tolist()
print("Обучаем проекцию по меткам документов…", flush=True)
execute("projection", namespace)
projection = namespace["projection"]
data = {
    "tokens": namespace["tokens"],
    "word_vectors": word_vectors,
    "mean": mean_vector,
    "projection": {
        "weight": projection.weight.detach().T.tolist(),
        "bias": projection.bias.detach().tolist(),
        "output": namespace["document_vector"].tolist(),
    },
    "versions": {"torch": version("torch")},
}
(WEEK / "artifacts/pooling.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
# Проверяем исполнение остальных примеров с теми же данными и начальными весами.
for method in ("cbow", "negative"):
    example = {}
    for key in ("embedding-data", "embedding-init", method):
        execute(key, example)
    print(f"{method}: loss = {example['loss'].item():.4f}", flush=True)
print("Среднее:", mean_vector)
print("Проекция:", data["projection"]["output"])
