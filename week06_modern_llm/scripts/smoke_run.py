"""Execute the notebook against artifacts_smoke/ with no network: tiny random models and the week-1 CSV stand in for
the checkpoints and the hub. Run `python precompute.py --smoke` first. Writes scripts/smoke_executed.ipynb; never commit it."""

import sys
import nbformat
from nbclient import NotebookClient

here = __file__.rsplit("/", 1)[0]
nb = nbformat.read(f"{here}/../week06_modern_llm.ipynb", as_version=4)
patches = [
    ('MODEL_OLD = "gpt2" ', 'MODEL_OLD = "artifacts_smoke/tiny_gpt2" '),
    ('MODEL_NEW = "HuggingFaceTB/SmolLM2-135M" ', 'MODEL_NEW = "artifacts_smoke/tiny_smollm2_135m" '),
    ('MODEL_CHAT = "HuggingFaceTB/SmolLM2-1.7B-Instruct" ', 'MODEL_CHAT = "artifacts_smoke/tiny_smollm2_1_7b_instruct" '),
    ('MODEL_DRAFT = "HuggingFaceTB/SmolLM2-135M-Instruct" ', 'MODEL_DRAFT = "artifacts_smoke/tiny_smollm2_135m_instruct" '),
    ('name = f"EleutherAI/pythia-{size}"', 'name = f"artifacts_smoke/tiny_pythia_{size}"'),
    ('ART_DIR = "artifacts"', 'ART_DIR = "artifacts_smoke"'),
    ('ds = load_dataset("fancyzhx/ag_news")',
     'ds = {s: Dataset.from_pandas(pd.read_csv(f"{W1}/data/ag_news_{s}.csv", sep="\\t")) for s in ["train", "test"]}'),
    ("[16, 64, 256, 960]", "[8, 16, 32, 64]"),
    ("torch.randn(4096, 4096, device=device)", "torch.randn(512, 512, device=device)"),
    ("measure_matmul(device)", "measure_matmul(device, (16, 64, 256))"),
    ("max_new_tokens=160", "max_new_tokens=8"),
    ("N_DEMO = 200 ", "N_DEMO = 40 "),
    ("!python precompute.py", "pass  # !python precompute.py"),
]
for cell in nb.cells:
    if cell.cell_type == "code":
        for a, b in patches:
            cell.source = cell.source.replace(a, b)

client = NotebookClient(nb, timeout=1200, kernel_name="python3", resources={"metadata": {"path": f"{here}/.."}},
                        allow_errors="--allow-errors" in sys.argv)
client.execute()
nbformat.write(nb, f"{here}/smoke_executed.ipynb")
errors = [(i, o["ename"], o["evalue"][:300]) for i, c in enumerate(nb.cells) if c.cell_type == "code"
          for o in c.get("outputs", []) if o.get("output_type") == "error"]
print("errors:", errors or "none")
