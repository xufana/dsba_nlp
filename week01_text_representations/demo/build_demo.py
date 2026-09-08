"""Assemble parts/* + demo_data.json into the interactive seminar page.

Run from week01_text_representations/demo/:
    uv run python build_demo.py

Writes two builds of the same content:
  week01_demo.html   standalone, opens straight from disk
  artifact.html      bare fragment, for hosts that supply their own skeleton
"""
import hashlib
import json
import os

P = "parts"
data = open("demo_data.json").read()
head_part = "00_head.html"
body_parts = ["10_body_a.html", "11_body_b.html"]
js_parts = ["20_core.js", "21_blocks_a.js", "22_blocks_b.js", "23_blocks_c.js"]

head = open(os.path.join(P, head_part)).read()

body = "\n".join(
    [open(os.path.join(P, p)).read() for p in body_parts]
    + ['<script type="application/json" id="demo-data">', data.replace("</", "<\\/"), "</script>"]
    + ["<script>"] + [open(os.path.join(P, j)).read() for j in js_parts] + ["</script>"]
)

artifact = head + "\n" + body
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


guard("artifact.html", artifact)

standalone = (
    '<!doctype html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + head
    + "\n</head>\n<body>\n"
    + body
    + "\n</body>\n</html>\n"
)
guard("week01_demo.html", standalone)

for f in ("week01_demo.html", "artifact.html"):
    print(f"{f}  {os.path.getsize(f) / 1e6:.2f} MB")
