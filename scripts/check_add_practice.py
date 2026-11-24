"""Проверяет ячейки практики ADD на маленьких моделях и локальных данных."""

import argparse
import contextlib
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

ROOT = Path(__file__).resolve().parent.parent
WEEK = ROOT / "week08_practice"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--real-lora", action="store_true", help="Проверить LoRA на GPT-2 из локального кэша")
    args = parser.parse_args()
    import torch
    import transformers
    from datasets import Dataset, DatasetDict

    torch.set_num_threads(1)
    notebook = json.loads((WEEK / "week08_practice.ipynb").read_text())
    tokenizer_loader = transformers.AutoTokenizer.from_pretrained
    loaders = {
        name: getattr(transformers, name).from_pretrained
        for name in ["AutoModel", "AutoModelForMaskedLM", "AutoModelForSequenceClassification",
                     "AutoModelForTokenClassification", "AutoModelForQuestionAnswering", "AutoModelForCausalLM"]
    }
    work = Path(tempfile.mkdtemp(prefix="add-practice-", dir="/tmp/dsba_nlp"))
    bert_path, gpt_path = work / "bert", work / "gpt2"
    transformers.BertModel(transformers.BertConfig(
        vocab_size=30522, hidden_size=24, intermediate_size=48,
        num_hidden_layers=2, num_attention_heads=2,
    )).save_pretrained(bert_path)
    transformers.GPT2ForSequenceClassification(transformers.GPT2Config(
        vocab_size=50257, n_embd=24, n_inner=48, n_layer=2, n_head=2,
        n_positions=256, num_labels=2, eos_token_id=50256, pad_token_id=50256,
    )).save_pretrained(gpt_path)

    def tokenizer(checkpoint, **kwargs):
        name = "gpt2" if "gpt2" in str(checkpoint) or "OLMo" in str(checkpoint) or "SmolLM" in str(checkpoint) else "bert-base-uncased"
        loaded = tokenizer_loader(name, local_files_only=True)
        if name == "gpt2":
            loaded.chat_template = "{% for m in messages %}{{ m['role'] + ': ' + m['content'] + '\\n' }}{% endfor %}{% if add_generation_prompt %}assistant: {% endif %}"
        return loaded

    def model_loader(name):
        def load(checkpoint, **kwargs):
            is_gpt = "gpt2" in str(checkpoint) or "OLMo" in str(checkpoint)
            target = "gpt2" if args.real_lora and str(checkpoint) == "gpt2" else str(gpt_path if is_gpt else bert_path)
            return loaders[name](target, local_files_only=True, ignore_mismatched_sizes=True, **kwargs)
        return load

    def dataset(name, *args, **kwargs):
        if "conll" in name:
            rows = Dataset.from_dict({"tokens": [["Werner", "Zwingmann", "visited", "France", "."]] * 8,
                                      "ner_tags": [[1, 2, 0, 5, 0]] * 8})
        elif "squad" in name:
            context = "Paris is in France. " * 30
            rows = Dataset.from_dict({"id": [str(i) for i in range(8)],
                                      "question": ["Where is Paris?"] * 8,
                                      "context": [context] * 8,
                                      "answers": [{"text": ["France"], "answer_start": [12]}] * 8})
        else:
            text_key = "sentence" if name == "glue" else "text"
            texts = (["A wonderful film.", "A boring movie."] * 8 if name == "glue"
                     else ["World politics today.", "The team won.", "The company grew.", "A new computer."] * 4)
            rows = Dataset.from_dict({text_key: texts, "label": [i % (2 if name == "glue" else 4) for i in range(16)]})
        return DatasetDict(train=rows, test=rows, validation=rows)

    namespace = {}
    started = __import__("time").monotonic()
    os.chdir(WEEK)
    log = io.StringIO()
    try:
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch("transformers.AutoTokenizer.from_pretrained", tokenizer))
            for name in loaders:
                stack.enter_context(patch.object(getattr(transformers, name), "from_pretrained", model_loader(name)))
            stack.enter_context(patch("datasets.load_dataset", dataset))
            for i, cell in enumerate(notebook["cells"]):
                if cell["cell_type"] != "code":
                    continue
                tags = cell.get("metadata", {}).get("tags", [])
                if args.real_lora and tags not in [["setup"], ["classification-functions"], ["lora-training"], ["lora-roundtrip"]]:
                    continue
                print(f"Ячейка {i}: {', '.join(tags) or 'установка'}", flush=True)
                with contextlib.redirect_stdout(log):
                    exec(compile("".join(cell["source"]), f"cell_{i}", "exec"), namespace)
                if "setup" in tags:
                    namespace.update(RUN_BERT=not args.real_lora, RUN_BERT_TRAINING=not args.real_lora,
                                     RUN_GENERATION=not args.real_lora, RUN_LORA=True, N_TRAIN=8, N_TEST=4,
                                     BATCH_SIZE=2, TRAIN_STEPS=2, MAX_LENGTH=32, OUTPUT_DIR=work / "output")
                    namespace["OUTPUT_DIR"].mkdir()
        if not args.real_lora:
            verify_math(namespace, torch)
            verify_alignment(namespace)
        (work / "execution.log").write_text(log.getvalue())
        print(f"Проверка пройдена за {__import__('time').monotonic()-started:.1f} с. Журнал: {work / 'execution.log'}")
    except BaseException:
        (work / "execution.log").write_text(log.getvalue())
        print(log.getvalue()[-2500:])
        print("Журнал:", work / "execution.log")
        raise


def verify_math(ns, torch):
    for name in ["ppo_policy", "dpo_policy", "grpo_policy"]:
        p = ns[name]().softmax(-1).detach()
        assert p[0, 0] > 0.5 and p[1, 1] > 0.5, (name, p)
    for rewards in [torch.zeros(1, 8), torch.ones(1, 8)]:
        assert torch.equal(ns["group_advantages"](rewards), rewards * 0)
    logits = torch.tensor([[0.4, -0.4]], requires_grad=True)
    ns["exact_kl"](logits, torch.zeros_like(logits)).backward()
    assert logits.grad.abs().sum() > 0
    logp = torch.tensor([0.3, 0.1, 0.1], dtype=torch.float64).log().requires_grad_()
    old = torch.tensor([0.2, 0.2, 0.2], dtype=torch.float64).log()
    advantage = torch.tensor([2.0, -2.0, 2.0], dtype=torch.float64)
    objective = ns["ppo_surrogate"](logp, old, advantage)
    torch.testing.assert_close(objective, torch.tensor([2.4, -1.6, 1.0], dtype=torch.float64))
    objective.sum().backward()
    torch.testing.assert_close(logp.grad, torch.tensor([0.0, 0.0, 1.0], dtype=torch.float64))
    values = [torch.tensor(v, dtype=torch.float64) for v in [-35, -52, -45, -62, -40, -42]]
    a, b, c, d, refc, refr = values
    torch.testing.assert_close(ns["dpo_loss"](a, b, refc, refr), ns["dpo_loss"](c, d, refc, refr))
    assert not ns["reward_model"].weight.requires_grad
    print("PPO/DPO/GRPO: направления обновлений, clipping, reference и одинаковые награды проверены.")


def verify_alignment(ns):
    features = ns["ner_features"]
    previous = None
    for word_id, label in zip(features[0]["word_ids"], features[0]["labels"]):
        if word_id is None or word_id == previous:
            assert label == -100
        previous = word_id
    for row in ns["qa_features"]:
        start, end = row["start_positions"], row["end_positions"]
        if start:
            offsets = row["offset_mapping"]
            assert ns["qa_example"][0]["context"][offsets[start][0]:offsets[end][1]] == "France"
    print("NER: подслова и -100; QA: обратное преобразование границ проверено.")


if __name__ == "__main__":
    main()
