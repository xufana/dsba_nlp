"""Assemble the GitHub Pages site from the built week demos.

    python scripts/build_site.py [out_dir] [branch]

Every week*/demo/week*_demo.html is copied to <out>/weekNN/index.html, and a
week*/demo/week*_check_yourself.html appendix to <out>/weekNN/check-yourself/index.html
(the two pages' relative links to each other are rewritten to match); <out>/index.html
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
        card = {"num": num, "topic": None, "formula": None, "href": None, "check": None,
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
            (dest / "index.html").write_text(with_nav(page, "../", prev_num, next_num))
            card["href"] = f"week{num}/"
        if check:
            dest = out / f"week{num}" / "check-yourself"
            dest.mkdir(parents=True, exist_ok=True)
            page = re.sub(r'href="week\d\d_demo\.html"', 'href="../"', check.read_text())
            (dest / "index.html").write_text(with_nav(page, "../../", prev_num, next_num))
            card["check"] = f"week{num}/check-yourself/"
        card["topic"] = card["topic"] or readme_title(week_dir)
        weeks.append(card)
    return weeks


def render(weeks):
    cards = []
    for w in weeks:
        links = []
        if w["href"]:
            links.append(f'<a class="go" href="{w["href"]}">Open the demo →</a>')
        else:
            links.append('<span class="soon">demo not built yet</span>')
        if w["check"]:
            links.append(f'<a href="{w["check"]}">Check yourself</a>')
        if w["colab"]:
            links.append(f'<a href="{w["colab"]}">Colab</a>')
        links.append(f'<a href="{w["github"]}">GitHub</a>')
        formula = f'<div class="formula">{w["formula"]}</div>' if w["formula"] else ""
        cls = "card" if w["href"] else "card off"
        cards.append(f"""<li class="{cls}">
  <div class="num">{w["num"]}</div>
  <div class="text">
    <h2>{w["topic"]}</h2>
    {formula}
    <div class="links">{" · ".join(links)}</div>
  </div>
</li>""")
    return TEMPLATE.replace("{{cards}}", "\n".join(cards))


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NLP @ HSE DSBA</title>
<meta name="description" content="Seminar demos for the NLP course, HSE DSBA, autumn 2026.">
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
.links { font-family: var(--mono); font-size: 15px; color: var(--ink-3); }
a { color: inherit; text-underline-offset: 2px; text-decoration-color: var(--rule-strong); }
a.go { color: var(--cls-0); font-weight: 600; text-decoration: none; }
a.go:hover { text-decoration: underline; }
.soon { font-style: italic; }
footer { margin-top: 48px; font-family: var(--mono); font-size: 14px; color: var(--ink-3); }
@media (max-width: 560px) {
  .card { grid-template-columns: 1fr; gap: 4px; padding: 16px; }
  .num { font-size: 22px; }
}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Author: Daria Andreeva</p>
  <h1>NLP @ HSE DSBA</h1>
  <p class="lede">Seminar demos for the NLP course, 4th year DSBA, autumn 2026.</p>
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
        print(f"week {w['num']}: {w['href'] or '(no demo)'}  {w['topic']}" + (f"  + {w['check']}" if w['check'] else ""))


if __name__ == "__main__":
    main()
