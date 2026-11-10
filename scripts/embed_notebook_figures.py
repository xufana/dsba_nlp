"""Обновляет вложенные SVG-схемы и PNG-копии в существующем ноутбуке."""

import argparse
import base64
import json
import re
from pathlib import Path


def embed(notebook, figure_dirs):
    """Берёт вложения из выгруженных схем HTML-страниц."""
    data = json.loads(notebook.read_text())
    count = 0
    for cell in data["cells"]:
        if cell["cell_type"] != "markdown":
            continue
        source = cell["source"]
        if isinstance(source, list):
            source = "".join(source)
        names = set(re.findall(r"attachment:([\w-]+\.svg)", source))
        for name in sorted(names):
            candidates = [directory / name for directory in figure_dirs
                          if (directory / name).exists()]
            if len(candidates) != 1:
                raise SystemExit(f"{name}: найдено файлов {len(candidates)}, требуется один")
            svg = candidates[0]
            png = svg.with_suffix(".png")
            if not png.exists():
                raise SystemExit(f"Нет PNG-копии: {png}")
            cell.setdefault("attachments", {})[name] = {
                "image/svg+xml": base64.b64encode(svg.read_bytes()).decode("ascii"),
                "image/png": base64.b64encode(png.read_bytes()).decode("ascii"),
            }
            count += 1
    notebook.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{notebook}: вложено схем {count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notebook", type=Path)
    parser.add_argument("--figures", nargs="+", type=Path, required=True)
    args = parser.parse_args()
    embed(args.notebook, args.figures)
