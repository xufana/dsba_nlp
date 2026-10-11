"""The prose of a demo page lives in demo/text/*.md; this renders it for scripts/build_demo.py.

A text file holds chunks, each opened by a `## key` line (keys are unique across the page); anything before
the first `##` is a header and is ignored. A chunk is CommonMark with inline HTML allowed, plus `$...$`
inline formulas in the dialect of scripts/mathml.py.

Placement, in demo/body.html:
    {{text:key}}     the chunk as block HTML: every paragraph wrapped in <p>, lists as lists
    {{inline:key}}   the chunk as inline HTML (one paragraph, no <p>): bet questions, panel notes, captions
Chunks not placed in the body are emitted as <template data-text="key"> and reached from demo.js with
TXT("key", {name: value}): a `{name}` in the chunk is replaced by the value, so the sentence stays here
and only the number comes from the data.
"""
import html
import os
import re
import sys

from markdown_it import MarkdownIt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathml import latex_to_mathml  # noqa: E402

md = MarkdownIt("commonmark", {"html": True, "typographer": False, "breaks": False})
CHUNK = re.compile(r"^## (\S+)\s*$", re.M)
MATH = re.compile(r"(?<![\\$\w])\$(?!\s)((?:[^$\\\n]|\\.)+?)(?<!\s)\$(?![\w$])")


def load_chunks(text_dir):
    """All demo/text/*.md, in name order -> {key: markdown}. A key defined twice is an error."""
    chunks = {}
    if not os.path.isdir(text_dir):
        return chunks
    for name in sorted(os.listdir(text_dir)):
        if not name.endswith(".md"):
            continue
        src = open(os.path.join(text_dir, name), encoding="utf-8").read()
        parts = CHUNK.split(src)
        for key, body in zip(parts[1::2], parts[2::2]):
            if key in chunks:
                raise SystemExit(f"{text_dir}/{name}: chunk '{key}' is defined twice")
            chunks[key] = body.strip("\n")
    return chunks


CODE_SPAN = re.compile(r"(`+)(?!`).*?(?<!`)\1(?!`)", re.S)


def _protect_math(src):
    """$...$ outside code spans -> private-use placeholders the markdown parser passes through untouched."""
    found = []
    def repl(m):
        found.append(latex_to_mathml(m.group(1)))
        return f"\ue000{len(found) - 1}\ue001"
    out, pos = [], 0
    for c in CODE_SPAN.finditer(src):
        out.append(MATH.sub(repl, src[pos:c.start()])); out.append(c.group(0)); pos = c.end()
    out.append(MATH.sub(repl, src[pos:]))
    return "".join(out), found


def _restore_math(out, found):
    return re.sub("\ue000(\\d+)\ue001", lambda m: found[int(m.group(1))], out)


def render_block(src):
    s, found = _protect_math(src)
    return _restore_math(md.render(s), found).rstrip("\n")


def render_inline(src):
    if "\n\n" in src.strip():
        raise ValueError("an inline chunk must be a single paragraph")
    s, found = _protect_math(src)
    return _restore_math(md.renderInline(s), found)


def is_single_paragraph(src):
    tokens = md.parse(src)
    return [t.type for t in tokens] == ["paragraph_open", "inline", "paragraph_close"]


def render_auto(src):
    """Inline when the chunk is one plain paragraph (so a note or a bet gets no <p>), block otherwise."""
    return render_inline(src) if is_single_paragraph(src) else render_block(src)


def normalize_html(s):
    """For comparing a rendered chunk to hand-written HTML: whitespace runs and entities do not matter."""
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"> <", "><", s)
    return html.unescape(s.strip())


def place(body, chunks):
    """Fill {{text:key}} / {{inline:key}} in the body; return (body, keys used)."""
    used = set()
    def repl(m):
        mode, key = m.group(1), m.group(2)
        if key not in chunks:
            raise SystemExit(f"body.html asks for text chunk '{key}', not found in demo/text/")
        used.add(key)
        return render_block(chunks[key]) if mode == "text" else render_inline(chunks[key])
    body = re.sub(r"\{\{(text|inline):([A-Za-z0-9_.-]+)\}\}", repl, body)
    return body, used


def templates(chunks, used):
    rest = [k for k in chunks if k not in used]
    if not rest:
        return ""
    rows = [f'<template data-text="{k}">{render_auto(chunks[k])}</template>' for k in rest]
    return '<div hidden id="text-chunks">\n' + "\n".join(rows) + "\n</div>"
