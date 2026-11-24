"""Генерирует примеры запросов GPT-2 для ноутбука о генерации."""

import json
import os
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import torch

ROOT = Path(__file__).resolve().parent


def prompt_examples():
    """Генерирует продолжения трёх фиксированных входов локальным GPT-2."""
    from huggingface_hub import hf_hub_download
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print("GPT-2: загрузка локального чекпойнта на CPU", flush=True)
    tokenizer = AutoTokenizer.from_pretrained("gpt2", local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained("gpt2", local_files_only=True, dtype=torch.float32,
                                                attn_implementation="eager").eval()
    prompts = [
        ("completion", "Продолжение", "The team won the championship. This news is about"),
        ("instruction", "Инструкция", "Classify the news as sports or business.\nNews: The team won the championship.\nCategory:"),
        ("examples", "Примеры", "News: Shares rose on the stock exchange.\nCategory: business\n\nNews: The player scored a goal.\nCategory: sports\n\nNews: The team won the championship.\nCategory:"),
    ]
    records = []
    with torch.inference_mode():
        for key, label, prompt in prompts:
            inputs = tokenizer(prompt, return_tensors="pt")
            result = model.generate(**inputs, max_new_tokens=16, do_sample=False,
                                    pad_token_id=tokenizer.eos_token_id, use_cache=True)
            continuation = result[0, inputs.input_ids.shape[1]:].tolist()
            records.append({"key": key, "label": label, "prompt": prompt,
                            "output": tokenizer.decode(continuation), "tokens": [tokenizer.decode([i]) for i in continuation]})
            print(f"  {label}: {records[-1]['output']!r}", flush=True)
    revision = Path(hf_hub_download("gpt2", "config.json", local_files_only=True)).parent.name
    data = {"model": "gpt2", "device": "CPU", "dtype": "float32", "decoding": "greedy",
            "max_new_tokens": 16, "revision": revision, "examples": records}
    (ROOT / "prompt_examples.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")



if __name__ == "__main__":
    torch.set_num_threads(2)
    prompt_examples()
