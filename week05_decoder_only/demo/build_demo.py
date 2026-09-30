"""Assemble parts/* + demo_data.json into the interactive seminar page.

Run from week05_decoder_only/demo/:
    uv run python build_demo.py

Writes two builds of the same content:
  week05_demo.html   standalone, opens straight from disk
  artifact.html      bare fragment, for hosts that supply their own skeleton
and the appendix page, same head, no data:
  week05_check_yourself.html   "Check yourself" — questions with the answer under a toggle
  check_yourself_artifact.html bare fragment of the same
"""
import hashlib
import json
import os

P = "parts"
data = open("demo_data.json").read() if os.path.exists("demo_data.json") else None
head_part = "00_head.html"
body_parts = ["10_body.html"]
js_parts = ["20_demo.js", "21_extra.js"]

head = open(os.path.join(P, head_part)).read()
check_body = open(os.path.join(P, "30_check.html")).read()

body = None if data is None else "\n".join(
    [open(os.path.join(P, p)).read() for p in body_parts]
    + ['<script type="application/json" id="demo-data">', data.replace("</", "<\\/"), "</script>"]
    + ["<script>"] + [open(os.path.join(P, j)).read() for j in js_parts] + ["</script>"]
)

STAMP = ".build-stamp.json"


def guard(path, new_text):
    """Refuse to clobber a build that was edited by hand since the last run."""
    stamps = json.load(open(STAMP)) if os.path.exists(STAMP) else {}
    if os.path.exists(path):
        on_disk = hashlib.sha256(open(path, "rb").read()).hexdigest()
        if stamps.get(path, on_disk) != on_disk:
            raise SystemExit(
                "\n" + path + " has changed since the last build.\n"
                "Building would discard those edits — port them into parts/ first,\n"
                "or delete " + STAMP + " to build anyway.\n")
    with open(path, "w") as f:
        f.write(new_text)
    stamps[path] = hashlib.sha256(new_text.encode()).hexdigest()
    json.dump(stamps, open(STAMP, "w"), indent=1)


def standalone(body_text, title=None):
    h = head if title is None else head.replace("<title>Decoder, Alone</title>", f"<title>{title}</title>", 1)
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + h
        + "\n</head>\n<body>\n"
        + body_text
        + "\n</body>\n</html>\n"
    )


built = []
if body is None:
    print("demo_data.json not found — skipping week05_demo.html (run export_demo_data.py first)")
else:
    guard("artifact.html", head + "\n" + body)
    guard("week05_demo.html", standalone(body))
    built += ["week05_demo.html", "artifact.html"]

check_head = head.replace("<title>Decoder, Alone</title>", "<title>Check Yourself</title>", 1)
guard("check_yourself_artifact.html", check_head + "\n" + check_body)
guard("week05_check_yourself.html", standalone(check_body, "Check Yourself"))
built += ["week05_check_yourself.html", "check_yourself_artifact.html"]

for f in built:
    print(f"{f}  {os.path.getsize(f) / 1e6:.2f} MB")
