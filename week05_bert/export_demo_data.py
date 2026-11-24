"""Переносит примеры BERT из autumn-2026 и проверяет учебные расчёты на CPU."""

import json
import subprocess
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent


def main():
    """Сохраняет данные исходного семинара и эталонные значения PyTorch."""
    source = "week04_pretraining_transfer/artifacts/demo_data.json"
    commit = subprocess.check_output(["git", "rev-parse", "autumn-2026"], text=True).strip()
    original = json.loads(subprocess.check_output(["git", "show", f"{commit}:{source}"], text=True))
    norms = []
    for values in ([3, -1, 2, 0], [0, 0, 0, 0], [7, 7, 7, 7], [-4, -3, -2, -1]):
        x = torch.tensor(values, dtype=torch.float64)
        norms.append({"x": values, "ln": F.layer_norm(x, (4,), eps=1e-5).tolist(),
                      "rms": F.rms_norm(x, (4,), eps=1e-5).tolist()})
    rope = []
    q, k = torch.tensor([1., 0., .5, -1.], dtype=torch.float64), torch.tensor([.5, 1., -1., .5], dtype=torch.float64)
    for p, r in ((0, 0), (3, 8), (19, 24), (1000, 1005)):
        def rotate(x, position):
            angle = position / 10000 ** (torch.arange(0, 4, 2, dtype=torch.float64) / 4)
            pairs = x.reshape(2, 2)
            return torch.stack((pairs[:, 0] * angle.cos() - pairs[:, 1] * angle.sin(),
                                pairs[:, 0] * angle.sin() + pairs[:, 1] * angle.cos()), dim=1).flatten()
        rope.append({"p": p, "r": r, "q": rotate(q, p).tolist(), "k": rotate(k, r).tolist(),
                     "score": torch.dot(rotate(q, p), rotate(k, r)).item()})
    x = torch.tensor([-4., -1., 0., 2., 5.], dtype=torch.float64)
    ffn = []
    for kind in ("gelu", "silu"):
        for coordinate in range(3):
            for raw in (-4., 0., 1., 4.):
                gate = torch.tensor([-1., 1., 2.], dtype=torch.float64)
                gate[coordinate] = raw
                activated = F.gelu(gate, approximate="tanh") if kind == "gelu" else F.silu(gate)
                hidden = torch.tensor([2., -1., .5], dtype=torch.float64) * activated
                output = hidden @ torch.tensor([[1., -.5], [.5, 1.], [-1., .25]], dtype=torch.float64)
                ffn.append({"kind": kind, "coordinate": coordinate, "raw": raw, "hidden": hidden.tolist(), "output": output.tolist()})
    masks = []
    for layer in range(1, 7):
        positions = torch.arange(9)
        full = (layer - 1) % 3 == 0
        allowed = torch.ones(9, 9, dtype=torch.bool) if full else (positions[:, None] - positions[None, :]).abs() <= 1
        masks.append({"layer": layer, "allowed": allowed.tolist()})
    data = {
        "source": {"branch": "autumn-2026", "commit": commit, "path": source},
        "body": original["body"]["config"], "mlm": original["mlm"]["guesses"],
        "recipe": {"selected": 15, "mask": 80, "random": 10, "unchanged": 10},
        "modern": {"context": 8192, "window": 128, "every": 3, "trainingTokens": "2 трлн"},
        "reference": {"engine": f"PyTorch {torch.__version__}, float64, CPU", "norms": norms,
                      "rope": rope, "ffn": ffn, "masks": masks, "gate": {"x": x.tolist(), "silu": F.silu(x).tolist(),
                      "gelu": F.gelu(x, approximate="tanh").tolist()}},
    }
    out = ROOT / "artifacts/demo_data.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"BERT: {len(data['mlm'])} сохранённых примера; нормы, RoPE и активации проверены на CPU", flush=True)


if __name__ == "__main__":
    main()
