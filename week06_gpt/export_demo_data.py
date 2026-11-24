"""Готовит примеры GPT и эталоны attention, KV-кэша и GQA на CPU."""

import json
import subprocess
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent


def main():
    """Сохраняет эталоны SDPA для полных и причинных масок и нескольких размеров плитки."""
    torch.set_num_threads(2)
    (ROOT / "artifacts").mkdir(parents=True, exist_ok=True)
    commit = subprocess.check_output(["git", "rev-parse", "autumn-2026"], text=True).strip()
    source = "week05_decoder_only/artifacts/demo_data.json"
    original = json.loads(subprocess.check_output(["git", "show", f"{commit}:{source}"], text=True))
    modern = json.loads(subprocess.check_output(["git", "show", f"{commit}:week06_modern_llm/artifacts/demo_data.json"], text=True))
    generator = torch.Generator().manual_seed(2026)
    refs = []
    for length, width, scale in ((1, 2, 1), (5, 4, 1), (6, 2, 30), (7, 4, 1)):
        q = torch.randn(length, width, generator=generator, dtype=torch.float64) * scale
        k = torch.randn(length, width, generator=generator, dtype=torch.float64) * scale
        v = torch.randn(length, 3, generator=generator, dtype=torch.float64)
        for causal in (False, True):
            output = F.scaled_dot_product_attention(q[None, None], k[None, None], v[None, None], is_causal=causal)[0, 0]
            refs.append({"q": q.tolist(), "k": k.tolist(), "v": v.tolist(), "causal": causal, "output": output.tolist()})
    base = refs[2]
    q, k, v = [torch.tensor(base[key], dtype=torch.float64) for key in ("q", "k", "v")]
    prefixes = []
    for length in range(1, len(q) + 1):
        prefixes.append(F.scaled_dot_product_attention(q[length-1:length][None, None], k[:length][None, None],
                                                       v[:length][None, None])[0, 0, 0].tolist())
    data = {"source": {"branch": "autumn-2026", "commit": commit, "path": source},
            "generation": {"prompt": original["attention"]["tokens"][:original["attention"]["n_prompt"]],
                           "tokens": original["attention"]["tokens"][original["attention"]["n_prompt"]:], "model": "gpt2"},
            "passports": modern["passports"],
            "reference": {"engine": f"PyTorch {torch.__version__}, float64, CPU", "attention": refs,
                          "prefixes": prefixes, "cache": [{"layers": 32, "heads": h, "width": 128, "length": n,
                          "bytes": 2 * 32 * h * 128 * n * 2} for h in (1, 2, 8) for n in (1, 1024, 8192)]}}
    (ROOT / "artifacts/demo_data.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"GPT: {len(refs)} эталонов SDPA, причинные префиксы и размеры кэша", flush=True)


if __name__ == "__main__":
    main()
