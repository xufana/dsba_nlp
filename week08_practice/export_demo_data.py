"""Готовит общие данные ноутбука и эталоны интерактивной страницы."""

import base64
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix

ROOT = Path(__file__).resolve().parent
path = ROOT / "practice_data.json"
data = json.loads(path.read_text())
zero_shot = data["bert"]["zeroShot"]
probabilities = np.frombuffer(base64.b64decode(zero_shot["probs"]), dtype="<f2").reshape(zero_shot["n"], -1)
references = {}
for name, example in zero_shot["python"].items():
    columns = [zero_shot["candidates"].index(word) for word in example["words"]]
    prediction = probabilities[:, columns].argmax(-1)
    references[name] = {"accuracy": accuracy_score(zero_shot["gold"], prediction),
                        "confusion": confusion_matrix(zero_shot["gold"], prediction, labels=[0, 1, 2, 3]).tolist()}
zero_shot["browserReference"] = references
text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
path.write_text(text)
(ROOT / "artifacts/demo_data.json").write_text(text)
print("Zero-shot: точность и матрицы ошибок вычислены в Python из сохранённых вероятностей")
