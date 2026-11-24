"""Добавляет эталоны PyTorch к сохранённым данным лекции ADD."""

import ast
import json
from pathlib import Path

import torch
from torch.nn import functional as F
from transformers import GPT2Config, GPT2ForSequenceClassification
from peft import LoraConfig, TaskType, get_peft_model

ROOT = Path(__file__).resolve().parent
notebook = json.loads((ROOT.parent / "week08_practice/week08_practice.ipynb").read_text())
source = next("".join(c["source"]) for c in notebook["cells"] if c["metadata"].get("tags") == ["alignment-functions"])
tree = ast.parse(source)
namespace = {"torch": torch, "F": F}
functions = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
exec(compile(ast.Module(body=functions, type_ignores=[]), "alignment-functions", "exec"), namespace)

checks = {"dpo": [], "grpo": [], "lora": []}
for values in [(-35, -52, -40, -42, 0.1), (-45, -62, -40, -42, 0.1), (-40, -42, -40, -42, 0.1), (-80, 0, 0, -80, 1.0)]:
    pc, pr, rc, rr, beta = values
    tensors = [torch.tensor(v, dtype=torch.float64) for v in values[:4]]
    checks["dpo"].append({"input": values, "loss": namespace["dpo_loss"](*tensors, beta=beta).item()})
for rewards in [[1, 0, 0, 1, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 0], [1] * 8, [0] * 8]:
    result = namespace["group_advantages"](torch.tensor([rewards], dtype=torch.float64))
    checks["grpo"].append({"rewards": rewards, "advantages": result[0].tolist()})
for rank in [1, 8, 64]:
    with torch.device("meta"):
        model = GPT2ForSequenceClassification(GPT2Config(vocab_size=50258, num_labels=2))
        model = get_peft_model(model, LoraConfig(task_type=TaskType.SEQ_CLS, r=rank,
                                               target_modules=["c_attn"], modules_to_save=["score"],
                                               fan_in_fan_out=True))
    checks["lora"].append({"rank": rank, "trainable": sum(p.numel() for p in model.parameters() if p.requires_grad)})
    del model
path = ROOT / "artifacts/demo_data.json"
data = json.loads(path.read_text())
data["checks"] = checks
bert = json.loads((ROOT.parent / "week08_practice/practice_data.json").read_text())["bert"]
data["bertTransfer"] = {"model": "bert-base-uncased", "device": bert["meta"]["device"],
                        "layers": bert["body"]["config"]["layers"], "transfer": bert["transfer"],
                        "tfidf": bert["data"]["tfidf"]}
path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
print("Эталоны PyTorch: DPO, GRPO и число параметров LoRA")
