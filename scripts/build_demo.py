"""Assemble a week's demo page from its human-edited sources.

    python scripts/build_demo.py week06_modern_llm            # -> week06_modern_llm/demo/week06_demo.html
    python scripts/build_demo.py week06_modern_llm --artifact  # also the bare fragment for the Artifact tool,
                                                              #    written to /tmp/dsba_nlp/week06/artifact.html
    python scripts/build_demo.py --all

Sources, all inside the week directory:
  demo/head.html             the <title> (and any extra <link>/<meta> the week needs)
  demo/week.css              optional: rules this week adds to the shared demo_base/base.css
  demo/body.html             the page's structure; {{text:key}} / {{inline:key}} place the prose,
                             {{name}} inlines figures/name.png as a data URI
  demo/text/*.md             the prose, in chunks (scripts/demo_text.py); chunks the body does not place
                             become <template>s that demo.js reads with TXT(key, vars)
  demo/demo.js               the interactive part; demo_base/base.js is put in front of it
  demo/check_yourself.html   optional appendix body (same head, no data)
  artifacts/demo_data.json   every number the page shows, written by export_demo_data.py

Outputs are committed (GitHub Pages copies them as they are), so each one ends with a build marker:
rebuilding refuses to overwrite a page whose content no longer matches its marker, i.e. one edited by
hand since the last build. Port the edit into demo/ first, or pass --force.
"""
import argparse
import base64
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import demo_text  # noqa: E402

TMP = "/tmp/dsba_nlp"
MARK = re.compile(r"\n<!-- built from demo/ · sha256:([0-9a-f]{64}) -->\n?$")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def stamped(text):
    return text + f"\n<!-- built from demo/ · sha256:{sha(text)} -->\n"


def write(path, text, force=False):
    """Refuse to clobber a build whose content was edited by hand since it was built."""
    if os.path.exists(path) and not force:
        old = read(path)
        m = MARK.search(old)
        if m is None or sha(old[: m.start()]) != m.group(1):
            sys.exit(f"\n{path} was edited by hand since the last build.\n"
                     "Building would discard those edits — port them into demo/ first, or pass --force.\n")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(stamped(text))
    print(f"{path}  {os.path.getsize(path) / 1e6:.2f} MB")


def inline_figures(html, fig_dir):
    """{{name}} -> data URI of figures/name.png: one copy of the picture, the notebook's."""
    def repl(m):
        with open(os.path.join(fig_dir, m.group(1) + ".png"), "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode()
    return re.sub(r"\{\{([a-z0-9_]+)\}\}", repl, html)


def standalone(head, body, title=None):
    if title is not None:
        head = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", head, count=1)
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            + head + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")


def build(week, artifact=None, force=False):
    wd = os.path.join(ROOT, week)
    num = week[4:6]
    demo = os.path.join(wd, "demo")
    week_css = os.path.join(demo, "week.css")
    head = (read(os.path.join(demo, "head.html")).rstrip("\n") + "\n" + read(os.path.join(ROOT, "demo_base", "fonts.html")).rstrip("\n")
            + "\n<style>\n" + read(os.path.join(ROOT, "demo_base", "base.css")).rstrip("\n")
            + ("\n\n/* --- this week --- */\n" + read(week_css).rstrip("\n") if os.path.exists(week_css) else "") + "\n</style>\n")
    data_path = os.path.join(wd, "artifacts", "demo_data.json")
    out = []
    if os.path.exists(data_path):
        chunks = demo_text.load_chunks(os.path.join(demo, "text"))
        body, used = demo_text.place(read(os.path.join(demo, "body.html")), chunks)
        body = "\n".join([
            inline_figures(body, os.path.join(wd, "figures")),
            demo_text.templates(chunks, used),
            '<script type="application/json" id="demo-data">', read(data_path).replace("</", "<\\/"), "</script>",
            "<script>", read(os.path.join(ROOT, "demo_base", "base.js")), read(os.path.join(demo, "demo.js")), "</script>",
        ])
        write(os.path.join(demo, f"week{num}_demo.html"), standalone(head, body), force)
        if artifact is not None:
            write(artifact or os.path.join(TMP, f"week{num}", "artifact.html"), head + "\n" + body, force=True)
    else:
        print(f"{week}: no artifacts/demo_data.json — run export_demo_data.py first; skipping the demo page")
    check = os.path.join(demo, "check_yourself.html")
    if os.path.exists(check):
        body = read(check)
        write(os.path.join(demo, f"week{num}_check_yourself.html"), standalone(head, body, "Check Yourself"), force)
        if artifact is not None:
            check_head = re.sub(r"<title>.*?</title>", "<title>Check Yourself</title>", head, count=1)
            write(os.path.join(TMP, f"week{num}", "check_yourself_artifact.html"), check_head + "\n" + body, force=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("week", nargs="?", help="week directory, e.g. week06_modern_llm")
    ap.add_argument("--all", action="store_true", help="every week*/ with a demo/")
    ap.add_argument("--artifact", nargs="?", const="", default=None, metavar="PATH",
                    help="also write the bare fragment for the Artifact tool (default /tmp/dsba_nlp/weekNN/artifact.html)")
    ap.add_argument("--force", action="store_true", help="overwrite a hand-edited build")
    a = ap.parse_args()
    weeks = sorted(d for d in os.listdir(ROOT) if re.match(r"week\d\d_", d) and os.path.isdir(os.path.join(ROOT, d, "demo"))) \
        if a.all else [os.path.basename(os.path.normpath(a.week or sys.exit(ap.format_usage())))]
    for w in weeks:
        build(w, a.artifact, a.force)
