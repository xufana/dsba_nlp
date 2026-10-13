"""Assemble the GitHub Pages site from the built week demos.

    python scripts/build_site.py [out_dir] [branch]

Each card links the week's lecture page first and its seminar demo second, as two equal boxes; the lecture's
topics (demo/lecture/text/09_topics.md, carried in the built page as a <template>) are listed above them.
Every week*/demo/week*_demo.html is copied to <out>/weekNN/index.html, a
week*/demo/week*_check_yourself.html appendix to <out>/weekNN/check-yourself/index.html and a
week*/demo/week*_lecture.html page to <out>/weekNN/lecture/index.html
(the pages' relative links to each other are rewritten to match); <out>/index.html
lists all week directories. On copy, each page's rail gets a site navigation line —
all weeks / previous / next — that the standalone file has no use for. <out> defaults
to /tmp/dsba_nlp/_site. Each card's topic and formula are read from the demo's own
rail and h1, so the index cannot drift from the pages. A week without a built demo is
listed with its notebook links only.
"""

import html
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "xufana/dsba_nlp"


def inner(pattern, text):
    m = re.search(pattern, text, re.S)
    return m.group(1).strip() if m else None


def flatten(fragment):
    """Demo headings break lines with <br>; the index shows them on one line."""
    return re.sub(r"\s*<br\s*/?>\s*", " ", fragment)


def readme_title(week_dir):
    readme = week_dir / "README.md"
    if not readme.exists():
        return week_dir.name
    first = readme.read_text().splitlines()[0]
    # "# Week 5 — The Decoder, Alone: GPT ..." -> "The Decoder, Alone: GPT ..."
    return html.escape(re.sub(r"^#\s*Week\s*\d+\s*[—-]\s*", "", first).strip())


NAV_STYLE = """<style>
.site-nav { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 12px; font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
.site-nav a { color: var(--ink-2); text-decoration: none; }
.site-nav a:hover { color: var(--ink); text-decoration: underline; }
</style>
"""


def with_nav(page, up, prev_num, next_num):
    """Add the all-weeks / previous / next line at the top of the rail footer. `up` is the path to the site root."""
    links = [f'<a href="{up}">all weeks</a>']
    if prev_num:
        links.append(f'<a href="{up}week{prev_num}/">← week {prev_num}</a>')
    if next_num:
        links.append(f'<a href="{up}week{next_num}/">week {next_num} →</a>')
    nav = '<div class="site-nav">' + " ".join(links) + "</div>\n    "
    page, n = re.subn(r'(<div class="rail-foot">\s*)', lambda m: m.group(1) + nav, page, count=1)
    if n:
        page = page.replace("</head>", NAV_STYLE + "</head>", 1)
    return page


def collect(out, branch):
    weeks = []
    week_dirs = sorted(ROOT.glob("week[0-9][0-9]_*"))
    built = [d.name[4:6] for d in week_dirs if list((d / "demo").glob("week*_demo.html"))]
    for week_dir in week_dirs:
        num = week_dir.name[4:6]
        prev_num = max((n for n in built if n < num), default=None)
        next_num = min((n for n in built if n > num), default=None)
        demo = next(iter(sorted((week_dir / "demo").glob("week*_demo.html"))), None)
        nb = week_dir / f"{week_dir.name}.ipynb"
        check = next(iter(sorted((week_dir / "demo").glob("week*_check_yourself.html"))), None)
        lecture = next(iter(sorted((week_dir / "demo").glob("week*_lecture.html"))), None)
        card = {"num": num, "topic": None, "formula": None, "href": None, "check": None, "lecture": None, "topics": [],
                "github": f"https://github.com/{REPO}/tree/{branch}/{week_dir.name}",
                "colab": None}
        if nb.exists():
            card["colab"] = (f"https://colab.research.google.com/github/{REPO}/blob/"
                             f"{branch}/{week_dir.name}/{nb.name}")
        if demo:
            page = demo.read_text()
            rail = inner(r'class="rail-eq"[^>]*>(.*?)</div>', page)
            if rail:
                card["topic"] = re.split(r"<br\s*/?>", rail, maxsplit=1)[-1].strip()
            h1 = inner(r"<h1[^>]*>(.*?)</h1>", page)
            card["formula"] = flatten(h1) if h1 else None
            dest = out / f"week{num}"
            dest.mkdir(parents=True, exist_ok=True)
            # the demo's rail links to the appendix by file name; on the site it is a directory
            page = re.sub(r'href="week\d\d_check_yourself\.html"', 'href="check-yourself/"', page)
            page = re.sub(r'href="week\d\d_lecture\.html"', 'href="lecture/"', page)
            (dest / "index.html").write_text(with_nav(page, "../", prev_num, next_num))
            card["href"] = f"week{num}/"
        if lecture:
            # the lecture's demo/lecture/text/09_topics.md, which build_demo.py leaves in the page as a <template>
            tpl = inner(r'<template data-text="topics">(.*?)</template>', lecture.read_text())
            card["topics"] = [li.strip() for li in re.findall(r"<li>(.*?)</li>", tpl or "", re.S)]
        for src, sub, key in ((check, "check-yourself", "check"), (lecture, "lecture", "lecture")):
            if not src:
                continue
            dest = out / f"week{num}" / sub
            dest.mkdir(parents=True, exist_ok=True)
            page = re.sub(r'href="week\d\d_demo\.html"', 'href="../"', src.read_text())
            page = re.sub(r'href="week\d\d_check_yourself\.html"', 'href="../check-yourself/"', page)
            page = re.sub(r'href="week\d\d_lecture\.html"', 'href="../lecture/"', page)
            (dest / "index.html").write_text(with_nav(page, "../../", prev_num, next_num))
            card[key] = f"week{num}/{sub}/"
        card["topic"] = card["topic"] or readme_title(week_dir)
        weeks.append(card)
    return weeks


def render(weeks):
    cards = []
    for w in weeks:
        # two equal entry points, lecture first; the seminar box carries its own notebook links
        if w["lecture"]:
            lecture = (f'<div class="main"><a class="t" href="{w["lecture"]}">Lecture</a>'
                       '<span class="s">theory, then check yourself</span></div>')
        else:
            lecture = '<div class="main off"><span class="t">Lecture</span><span class="s">page coming</span></div>'
        extra = []
        if w["check"]:
            extra.append(f'<a href="{w["check"]}">Check yourself</a>')
        if w["colab"]:
            extra.append(f'<a href="{w["colab"]}">Colab</a>')
        extra.append(f'<a href="{w["github"]}">GitHub</a>')
        if w["href"]:
            seminar = (f'<div class="main"><a class="t" href="{w["href"]}">Seminar demo</a>'
                       f'<span class="s">the live experiments</span><span class="x">{" · ".join(extra)}</span></div>')
        else:
            seminar = (f'<div class="main off"><span class="t">Seminar demo</span><span class="s">not built yet</span>'
                       f'<span class="x">{" · ".join(extra)}</span></div>')
        topics = ""
        if w["topics"]:
            topics = ('<div class="topics"><div class="k">This week\'s lecture</div><ul>'
                      + "".join(f"<li>{t}</li>" for t in w["topics"]) + "</ul></div>")
        formula = f'<div class="formula">{w["formula"]}</div>' if w["formula"] else ""
        cls = "card" if (w["href"] or w["lecture"]) else "card off"
        cards.append(f"""<li class="{cls}">
  <div class="num">{w["num"]}</div>
  <div class="text">
    <h2>{w["topic"]}</h2>
    {formula}
    {topics}
    <div class="entry">{lecture}{seminar}</div>
  </div>
</li>""")
    return TEMPLATE.replace("{{cards}}", "\n".join(cards))


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NLP @ HSE DSBA</title>
<meta name="description" content="Lectures and seminar demos for the NLP course, HSE DSBA, autumn 2026.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
:root {
  color-scheme: light;
  --ground: #f7f6f2; --panel: #fdfdfc; --panel-sunk: #f1efe9;
  --ink: #14161a; --ink-2: #55595f; --ink-3: #8b8e92;
  --rule: #dcdad3; --rule-strong: #bab7ad; --cls-0: #2a78d6;
  --shadow: 0 1px 2px rgba(20,22,26,.05), 0 8px 24px -16px rgba(20,22,26,.28);
  --display: "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --body: "Source Serif 4", Georgia, "Times New Roman", serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground: #131413; --panel: #1b1c1b; --panel-sunk: #232422;
    --ink: #f0efe9; --ink-2: #a8a79f; --ink-3: #7b7a73;
    --rule: #31322e; --rule-strong: #4c4d47; --cls-0: #3987e5;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 28px -18px rgba(0,0,0,.9);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #131413; --panel: #1b1c1b; --panel-sunk: #232422;
  --ink: #f0efe9; --ink-2: #a8a79f; --ink-3: #7b7a73;
  --rule: #31322e; --rule-strong: #4c4d47; --cls-0: #3987e5;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 28px -18px rgba(0,0,0,.9);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--body); font-size: 20px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 920px; margin: 0 auto; padding: 56px 16px 96px; }
.eyebrow {
  font-family: var(--mono); font-size: 14px; font-weight: 500;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3);
  margin: 0 0 10px; display: flex; align-items: baseline; gap: 10px;
}
.eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
h1 {
  font-family: var(--display); font-weight: 700; letter-spacing: -.025em;
  font-size: clamp(40px, 7vw, 68px); line-height: .98; margin: 0 0 18px;
}
.lede { font-size: 22px; line-height: 1.5; color: var(--ink-2); margin: 0 0 40px; }
ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.card {
  display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 16px;
  background: var(--panel); border: 1px solid var(--rule); border-radius: 4px;
  box-shadow: var(--shadow); padding: 20px 22px;
}
.card.off { box-shadow: none; background: transparent; }
.card.off h2, .card.off .num { color: var(--ink-3); }
.num {
  font-family: var(--mono); font-size: 30px; font-weight: 500; color: var(--ink-3);
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
h2 {
  font-family: var(--display); font-weight: 700; font-size: 26px;
  letter-spacing: -.012em; line-height: 1.15; margin: 0 0 6px;
}
.formula { font-family: var(--mono); font-size: 16px; color: var(--ink-2); margin: 0 0 12px; overflow-wrap: anywhere; }
.topics { margin: 2px 0 14px; padding: 12px 0 0; border-top: 1px solid var(--rule); }
.topics .k { font-family: var(--mono); font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 6px; }
.topics ul { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 22px; }
.topics li { font-size: 17px; line-height: 1.4; padding-left: 14px; position: relative; }
.topics li::before { content: "·"; position: absolute; left: 2px; color: var(--ink-3); }
.entry { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 4px 0 2px; }
.entry .main { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border: 1px solid var(--rule-strong); border-radius: 4px; background: var(--panel-sunk); }
.entry .main:has(a.t:hover) { border-color: var(--cls-0); }
.entry .main .t { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--cls-0); text-decoration: none; }
.entry .main a.t::after { content: " →"; }
.entry .main .s { font-family: var(--mono); font-size: 13px; color: var(--ink-3); }
.entry .main .x { font-family: var(--mono); font-size: 13.5px; color: var(--ink-3); margin-top: 6px; }
.entry .main.off { background: transparent; border-style: dashed; }
.entry .main.off .t { color: var(--ink-3); }
a { color: inherit; text-underline-offset: 2px; text-decoration-color: var(--rule-strong); }
a.go { color: var(--cls-0); font-weight: 600; text-decoration: none; }
a.go:hover { text-decoration: underline; }
.soon { font-style: italic; }
footer { margin-top: 48px; font-family: var(--mono); font-size: 14px; color: var(--ink-3); }
@media (max-width: 560px) {
  .card { grid-template-columns: 1fr; gap: 4px; padding: 16px; }
  .num { font-size: 22px; }
  .topics ul, .entry { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Author: Daria Andreeva</p>
  <h1>NLP @ HSE DSBA</h1>
  <p class="lede">Lectures and seminar demos for the NLP course, 4th year DSBA, autumn 2026.</p>
  <ol>
{{cards}}
  </ol>
  <footer><a href="https://github.com/xufana/dsba_nlp">github.com/xufana/dsba_nlp</a></footer>
</div>
</body>
</html>
"""


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/dsba_nlp/_site")
    branch = sys.argv[2] if len(sys.argv) > 2 else "autumn-2026"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    weeks = collect(out, branch)
    (out / "index.html").write_text(render(weeks))
    for w in weeks:
        print(f"week {w['num']}: {w['href'] or '(no demo)'}  {w['topic']}" + (f"  + {w['check']}" if w['check'] else "") + (f"  + {w['lecture']}" if w['lecture'] else ""))


if __name__ == "__main__":
    main()
