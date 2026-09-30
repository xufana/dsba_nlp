"""Execute the notebook against artifacts_smoke/ with no network: the tiny models and the week-1 CSV stand in for
gpt2, bert-base-uncased and the hub. Writes scripts/smoke_executed.ipynb; never commit it."""

import sys
import nbformat
from nbclient import NotebookClient

here = __file__.rsplit("/", 1)[0]
nb = nbformat.read(f"{here}/../week05_decoder_only.ipynb", as_version=4)
patches = [
    ('MODEL_NAME = "gpt2" ', 'MODEL_NAME = "artifacts_smoke/tiny_gpt2" '),
    ('ENCODER_NAME = "bert-base-uncased" ', 'ENCODER_NAME = "artifacts_smoke/tiny_bert" '),
    ('ART_DIR = "artifacts"', 'ART_DIR = "artifacts_smoke"'),
    ('ds = load_dataset("fancyzhx/ag_news")',
     'ds = {s: Dataset.from_pandas(pd.read_csv(f"{W1}/data/ag_news_{s}.csv", sep="\\t")) for s in ["train", "test"]}'),
    ("for n in [64, 256, 512, 896]:", "for n in [16, 32, 64, 128]:"),
    ("N_LIVE = 2_000 ", "N_LIVE = 200 "),
    ("!uv run python precompute.py", "pass  # !uv run python precompute.py"),
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
