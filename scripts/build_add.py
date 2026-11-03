"""Собирает русские страницы ADD: python scripts/build_add.py [weekNN_topic]."""

import argparse
import html
import json
import re
from pathlib import Path

import build_demo
import demo_text
import quiz_text

ROOT = Path(__file__).resolve().parent.parent
WEEKS = ("week01_text_representations", "week02_language_modelling")


def code_panel(source):
    """Размечает строки Python по связям # @ключ со схемой."""
    lines = source.strip().splitlines()
    if lines[0].startswith("```"):
        lines = lines[1:-1]
    out = []
    for line in lines:
        match = re.search(r"\s+# @([\w-]+)$", line)
        key = match.group(1) if match else None
        line = line[:match.start()] if match else line
        escaped = html.escape(line)
        escaped = re.sub(r"\b(import|from|as|def|return|for|in|if|else|class|with|None|True|False)\b", r'<b class="kw">\1</b>', escaped)
        attr = f' data-f="{key}" tabindex="0"' if key else ""
        out.append(f'<span class="ln"{attr}>{escaped}</span>')
    return '<pre class="code"><code>' + "".join(out) + '</code></pre>'


def build(week):
    wd = ROOT / week
    src = wd / "demo/add"
    chunks, meta = demo_text.load_chunks_meta(str(src / "text"))
    qs = quiz_text.questions(chunks, meta)
    prose = {k: v for k, v in chunks.items() if k not in meta and not k.startswith("code-")}
    body = (src / "body.html").read_text()
    body = re.sub(r"\{\{code:([\w-]+)\}\}", lambda m: code_panel(chunks['code-' + m.group(1)]), body)
    body, used = demo_text.place(body, prose)
    body, _ = quiz_text.place(body, qs)
    num = week[4:6]
    data = json.loads((wd / "artifacts/demo_data.json").read_text())
    morphology = wd / "artifacts/morphology.json"
    if num == "01":
        data["morphology"] = json.loads(morphology.read_text())
        data["pooling"] = json.loads((wd / "artifacts/pooling.json").read_text())
    if num == "02":
        data["ngramExamples"] = json.loads((wd / "artifacts/ngram_examples.json").read_text())
        data["pplExamples"] = json.loads((wd / "artifacts/ppl_examples.json").read_text())
    def embedded(value):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    body += '\n' + demo_text.templates(prose, used)
    body += f'\n<script type="application/json" id="quiz-data">{embedded(qs)}</script>'
    body += f'\n<script type="application/json" id="add-data">{embedded(data)}</script>'
    js = ['base.js', 'quiz.js', 'add.js']
    body += '\n<script>\n' + '\n'.join((ROOT / 'demo_base' / f).read_text() for f in js)
    body += '\n' + (src / 'lesson.js').read_text() + '\n</script>'
    head = build_demo.make_head((src / "head.html").read_text(), str(ROOT / "demo_base/add.css"))
    head += f'<meta name="quiz-store" content="add2026_week{num}">\n'
    page = build_demo.standalone(head, body).replace('<html lang="en">', '<html lang="ru">', 1)
    build_demo.write(str(wd / f'demo/week{num}_add.html'), page)
    print(f"  {len(qs)} вопросов")


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('week', nargs='?', choices=WEEKS)
    args = ap.parse_args()
    for week in (args.week,) if args.week else WEEKS:
        build(week)
