"""Обновляет вложенные схемы в существующем ноутбуке: PNG-копии SVG-схем HTML-страниц.

Вкладываем только PNG. Рендерер GitHub не показывает вложение `image/svg+xml` (битая картинка), VS Code
рисует SVG без атрибута `style`; PNG показывают все. Ссылка `attachment:имя.svg` переписывается на `имя.png`.
"""

import argparse
import base64
import json
import re
from pathlib import Path


def embed(notebook, figure_dirs):
    """Берёт PNG-копии выгруженных схем HTML-страниц."""
    data = json.loads(notebook.read_text())
    count = 0
    for cell in data["cells"]:
        if cell["cell_type"] != "markdown":
            continue
        source = cell["source"]
        if isinstance(source, list):
            source = "".join(source)
        source = re.sub(r"attachment:([\w-]+)\.svg", r"attachment:\1.png", source)
        cell["source"] = source.splitlines(True)
        names = set(re.findall(r"attachment:([\w-]+\.png)", source))
        attachments = {}
        for name in sorted(names):
            candidates = [directory / name for directory in figure_dirs
                          if (directory / name).exists()]
            if len(candidates) != 1:
                raise SystemExit(f"{name}: найдено файлов {len(candidates)}, требуется один")
            attachments[name] = {"image/png": base64.b64encode(candidates[0].read_bytes()).decode("ascii")}
            count += 1
        if attachments:
            cell["attachments"] = attachments
        else:
            cell.pop("attachments", None)
    notebook.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{notebook}: вложено схем {count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notebook", type=Path)
    parser.add_argument("--figures", nargs="+", type=Path, required=True)
    args = parser.parse_args()
    embed(args.notebook, args.figures)
