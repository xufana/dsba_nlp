"""Execute a week's notebook end to end against tiny models, with no network.

    python scripts/smoke_run.py week06_modern_llm [--allow-errors]

Run `python precompute.py --smoke` in the week first: it writes tiny random checkpoints and toy artifacts to
/tmp/dsba_nlp/weekNN/artifacts_smoke/, and the patches below point the notebook there (and shrink the
live loops). The executed notebook goes to /tmp/dsba_nlp/weekNN/smoke_executed.ipynb; open it to read the
outputs. Nothing is written into the repository. A week not listed in PATCHES runs unpatched.
"""
import os
import sys

import nbformat
from nbclient import NotebookClient

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AG_NEWS = 'ds = {s: Dataset.from_pandas(pd.read_csv(f"{W1}/data/ag_news_{s}.csv", sep="\\t")) for s in ["train", "test"]}'

# (text in the notebook, replacement); {SMOKE} is the week's artifacts_smoke/ path
PATCHES = {
    "week05_decoder_only": [
        ('MODEL_NAME = "gpt2" ', 'MODEL_NAME = "{SMOKE}/tiny_gpt2" '),
        ('ENCODER_NAME = "bert-base-uncased" ', 'ENCODER_NAME = "{SMOKE}/tiny_bert" '),
        ('ART_DIR = "artifacts"', 'ART_DIR = "{SMOKE}"'),
        ('ds = load_dataset("fancyzhx/ag_news")', AG_NEWS),
        ("for n in [64, 256, 512, 896]:", "for n in [16, 32, 64, 128]:"),
        ("N_LIVE = 2_000 ", "N_LIVE = 200 "),
        ("!uv run python precompute.py", "pass  # !uv run python precompute.py"),
        ("!python precompute.py", "pass  # !python precompute.py"),
    ],
    "week06_modern_llm": [
        ('MODEL_OLD = "gpt2" ', 'MODEL_OLD = "{SMOKE}/tiny_gpt2" '),
        ('MODEL_NEW = "HuggingFaceTB/SmolLM2-135M" ', 'MODEL_NEW = "{SMOKE}/tiny_smollm2_135m" '),
        ('name = f"EleutherAI/pythia-{size}"', 'name = f"{SMOKE}/tiny_pythia_{size}"'),
        ('ART_DIR = "artifacts"', 'ART_DIR = "{SMOKE}"'),
        ('ds = load_dataset("fancyzhx/ag_news")', AG_NEWS),
        ("[16, 64, 256, 960]", "[8, 16, 32, 64]"),
        ("torch.randn(4096, 4096, device=device)", "torch.randn(512, 512, device=device)"),
        ("measure_matmul(device)", "measure_matmul(device, (16, 64, 256))"),
        ("N_DEMO = 200 ", "N_DEMO = 40 "),
        ("!python precompute.py", "pass  # !python precompute.py"),
    ],
    "week07_training_alignment": [
        *[(f'"{hub}"', f'"{{SMOKE}}/tiny_{local}"') for hub, local in [
            ("allenai/OLMo-2-0425-1B", "olmo_2_0425_1b"), ("allenai/OLMo-2-0425-1B-SFT", "olmo_2_0425_1b_sft"),
            ("allenai/OLMo-2-0425-1B-DPO", "olmo_2_0425_1b_dpo"), ("allenai/OLMo-2-0425-1B-Instruct", "olmo_2_0425_1b_instruct"),
            ("HuggingFaceTB/SmolLM2-135M", "smollm2_135m"), ("HuggingFaceTB/SmolLM2-135M-Instruct", "smollm2_135m_instruct"),
            ("Qwen/Qwen3-0.6B", "qwen3_0_6b"), ("HuggingFaceFW/fineweb-edu-classifier", "fineweb_edu_classifier"),
            ("xufana/dsba-week05-punct", "dsba_week05_punct")]],
        ('GPT2 = "gpt2"', 'GPT2 = "{SMOKE}/tiny_gpt2"'),
        ('ART_DIR = "artifacts"', 'ART_DIR = "{SMOKE}"'),
        ('ds = load_dataset("fancyzhx/ag_news")',
         'ds = load_dataset("json", data_files={"train": "{SMOKE}/data/ag_train.jsonl", "test": "{SMOKE}/data/ag_test.jsonl"})'),
        ('load_dataset("HuggingFaceFW/fineweb", name="sample-10BT", split="train", streaming=True)',
         'load_dataset("json", data_files="{SMOKE}/data/web.jsonl", split="train")'),
        ('load_dataset(SFT_DATA, split="train", streaming=True).shuffle(seed=SEED, buffer_size=10_000)',
         'load_dataset("json", data_files="{SMOKE}/data/sft.jsonl", split="train")'),
        ('load_dataset(PREF_DATA, split="train", streaming=True).shuffle(seed=SEED, buffer_size=5_000)',
         'load_dataset("json", data_files="{SMOKE}/data/pref.jsonl", split="train")'),
        ('load_dataset("openai/gsm8k", "main", split="test")', 'load_dataset("json", data_files="{SMOKE}/data/gsm8k.jsonl", split="train")'),
        ("N_DEMO = 200 ", "N_DEMO = 24 "),
        ("N_LIVE = 2_000 ", "N_LIVE = 64 "),
        ("!python precompute.py", "pass  # !python precompute.py"),
    ],
}

if __name__ == "__main__":
    pos = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not pos:
        sys.exit(__doc__)
    week = os.path.basename(os.path.normpath(pos[0]))
    wd = os.path.join(ROOT, week)
    tmp = f"/tmp/dsba_nlp/week{week[4:6]}"
    smoke = f"{tmp}/artifacts_smoke"
    os.makedirs(tmp, exist_ok=True)
    nb = nbformat.read(os.path.join(wd, f"{week}.ipynb"), as_version=4)
    for cell in nb.cells:
        if cell.cell_type == "code":
            for a, b in PATCHES.get(week, []):
                cell.source = cell.source.replace(a, b.replace("{SMOKE}", smoke))
    client = NotebookClient(nb, timeout=1200, kernel_name="python3", resources={"metadata": {"path": wd}},
                            allow_errors="--allow-errors" in sys.argv)
    client.execute()
    out = f"{tmp}/smoke_executed.ipynb"
    nbformat.write(nb, out)
    errors = [(i, o["ename"], o["evalue"][:300]) for i, c in enumerate(nb.cells) if c.cell_type == "code"
              for o in c.get("outputs", []) if o.get("output_type") == "error"]
    print("errors:", errors or "none")
    print("executed notebook:", out)
