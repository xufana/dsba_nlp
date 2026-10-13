"""Start a new week from the shared skeleton and register it in the uv workspace.

    python scripts/new_week.py 07 alignment "Seminar 7 — Alignment: ..." 

Creates week07_alignment/ with README.md, pyproject.toml, an empty notebook, precompute.py and export_demo_data.py
stubs, demo/{head.html,body.html,demo.js,text/00_hero.md,check_steps.json}, the lecture page's demo/lecture/{body.html,
text/00_intro.md,check_steps.json} (scripts/quiz_text.py), artifacts/ and figures/; then runs
`uv sync` so the root .venv knows the new member. Nothing is committed.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(num, slug, title):
    assert re.fullmatch(r"\d\d", num) and re.fullmatch(r"[a-z0-9_]+", slug), "usage: new_week.py NN slug 'Title'"
    name = f"week{num}_{slug}"
    wd = os.path.join(ROOT, name)
    assert not os.path.exists(wd), f"{name} exists"
    for d in ["demo/text", "demo/lecture/text", "artifacts", "figures"]:
        os.makedirs(os.path.join(wd, d))
    w = lambda rel, text: open(os.path.join(wd, rel), "w", encoding="utf-8").write(text)
    w("README.md", f"# Week {int(num)} — {title}\n")
    w("pyproject.toml", f'''[project]
name = "nlp-dsba-week{num}"
version = "0.1.0"
description = "Week {int(num)} — {title}."
readme = "README.md"
requires-python = ">=3.12,<3.13"
dependencies = [
    "numpy>=1.26",
    "pandas>=2.2",
    "matplotlib>=3.8",
    "torch>=2.2",
    "transformers[torch]>=5.0",
    "ipykernel>=6.29",
]

[tool.uv]
package = false
''')
    w(f"{name}.ipynb", json.dumps({"cells": [
        {"cell_type": "markdown", "id": "a0", "metadata": {}, "source": ["*NLP @ HSE DSBA, autumn 2026. Author: Daria Andreeva.*"]},
        {"cell_type": "markdown", "id": "a1", "metadata": {}, "source": [f"# Seminar {int(num)} — {title}"]},
        {"cell_type": "code", "id": "a2", "metadata": {}, "execution_count": None, "outputs": [], "source": [
            "# Colab setup. If needed, uncomment the following lines to install dependencies and clone the repository\n",
            "#!git clone -q --branch autumn-2026 https://github.com/xufana/dsba_nlp.git\n", f"#%cd dsba_nlp/{name}"]},
    ], "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4, "nbformat_minor": 5}, indent=1, ensure_ascii=False) + "\n")
    w("precompute.py", f'"""Artifacts of week {int(num)} that take longer than a few minutes in Colab. Run once, commit artifacts/*.json.\n\n    uv run python precompute.py [--only step ...] [--smoke]\n"""\n')
    w("export_demo_data.py", f'"""Every number the demo page shows, produced by the notebook\'s own code -> artifacts/demo_data.json.\n\n    uv run python export_demo_data.py\n"""\nimport json, os\n\nHERE = os.path.dirname(os.path.abspath(__file__))\nos.chdir(HERE)\nD = {{}}\njson.dump(D, open("artifacts/demo_data.json", "w"), ensure_ascii=False, separators=(",", ":"))\n')
    w("demo/head.html", f"<title>{title.split(':')[0]}</title>\n")
    w("demo/body.html", f'''<div class="tooltip" id="tip"></div>
<div class="shell">
<aside class="rail">
  <div>
    <div class="rail-mark">NLP @ HSE DSBA · autumn 2026</div>
    <div class="rail-eq">Seminar {int(num)}<br>{title.split(':')[0]}</div>
  </div>
  <nav id="nav"></nav>
  <div class="rail-foot">
    <div class="rail-btns">
      <button id="btn-present" title="Hide the prose, one screen per block">Present</button>
      <button id="btn-theme" title="Light / dark">Theme</button>
    </div>
    <div class="score" id="score"></div>
  </div>
</aside>

<main>
<div class="wrap">

<section id="hero">
  <p class="eyebrow">Author: Daria Andreeva</p>
  <h1>{title}</h1>
  <p class="lede">{{{{inline:lede}}}}</p>
  <div class="prose">
    {{{{text:hero-p1}}}}
  </div>
</section>

</div>
</main>
</div>
''')
    w("demo/text/00_hero.md", "# hero\n\n## lede\n\nOne paragraph: where we stopped, what today pays for.\n\n## hero-p1\n\nFirst paragraph of the seminar.\n")
    w("demo/lecture/body.html", f'''<div class="shell">
<aside class="rail">
  <div>
    <div class="rail-mark">NLP @ HSE DSBA · autumn 2026</div>
    <div class="rail-eq">Lecture {int(num)}<br>{title.split(':')[0]} · check yourself</div>
  </div>
  <nav id="nav"></nav>
  <div class="rail-btns">
    <button id="btn-reset" title="Forget every answer on this page">Reset answers</button>
    <button id="btn-theme" title="Light / dark">Theme</button>
  </div>
  <div class="quiz-progress" id="quiz-progress"></div>
  <div class="rail-foot">
    <a class="back" href="week{num}_demo.html">← the seminar demo</a>
    <div style="margin-top:10px">Answer first, then open.</div>
  </div>
</aside>

<main>
<div class="wrap">

<section id="hero">
  <p class="eyebrow">Author: Daria Andreeva</p>
  <h1>{title.split(':')[0]},<br>as questions</h1>
  <p class="lede">{{{{inline:lede}}}}</p>
</section>

<section id="first">
  <p class="eyebrow">Block 00</p>
  <h2>First block</h2>
  {{{{quiz:q-first}}}}
</section>

</div>
</main>
</div>
''')
    w("demo/lecture/text/00_intro.md", "# intro\n\n## lede\n\nOne paragraph: what this page asks about.\n\n## q-first · pick\n\nThe first question?\n\n- [x] the right answer\n- [ ] a wrong one\n> Why.\n> miss: the wrong answer that diagnoses the gap.\n")
    w("demo/lecture/text/09_topics.md", "# topics · the short list on the course index page\n\n## topics\n\n- first topic of the lecture\n- second topic\n")
    w("demo/lecture/check_steps.json", json.dumps({"steps": [{"name": "count", "expr": "return document.querySelectorAll('.qz').length + ' questions · ' + document.getElementById('quiz-progress').textContent;"}], "screens": [{"sel": "#hero", "file": "lec_00_hero.png"}]}, indent=1) + "\n")
    w("demo/demo.js", f'/* week {int(num)} — the interactive part. demo_base/base.js (TXT) is prepended at build; the data is in #demo-data. */\nconst D = JSON.parse(document.getElementById("demo-data").textContent);\n')
    w("demo/check_steps.json", json.dumps({"steps": [{"name": "loaded", "expr": "return document.querySelectorAll('section').length + ' sections';"}], "screens": [{"sel": "#hero", "file": "00_hero.png"}]}, indent=1) + "\n")
    print(f"created {name}/ — the workspace globs week*, so one `uv sync` registers it")
    subprocess.run(["uv", "sync", "--all-packages"], cwd=ROOT, check=False)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
