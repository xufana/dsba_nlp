"""Questions of a lecture page live in demo/lecture/text/*.md next to its prose; this parses them for
scripts/build_demo.py, which embeds them as JSON for demo_base/quiz.js.

A question is a chunk whose header carries a type: `## q-key · pick`. Inside, in this order:

    the question, in markdown (no `- ` lists here: a dash line starts the options)
    bins: a · b · c            sort only, optional: the bins in the order to show them (else: first appearance)
    - options                  one per line, form depends on the type (below)
    > the answer, in markdown  every line starts with `>`; an empty `>` separates paragraphs
    > miss: ...                optional, last: the wrong answer that diagnoses the gap

Types and their option lines:
    pick    - [x] label            one `[x]` = click to commit; several = tick all that apply, then Check
    point   - [x] key: label       like pick, and the figure in the question has clickable parts with
                                   data-pick="key" (drawn by demo/lecture/lecture.js, see demo_base/quiz.js)
    sort    - item → bin           every item is placed in a bin; `→ a | b` accepts either
    fill    - id = alt | alt       `[[id]]` in the question becomes an input; alternatives are compared
                                   case- and space-insensitively; a number may take a tolerance,
                                   `- w = 0.631 ~ 0.005`, and `@name` reads QUIZ.values.name computed in the
                                   browser, so no measured number is typed here
    write   - checklist item       a textarea; after Reveal the items appear as tick boxes "what you had"

In demo/lecture/body.html, `{{quiz:q-key}}` places a question; questions are numbered in body order.
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demo_text  # noqa: E402

TYPES = {"pick", "point", "sort", "fill", "write"}
OPT = re.compile(r"^- (?:\[([ xX])\] )?(.*)$")
KEYED = re.compile(r"^([a-z0-9_-]+): (.+)$")
BLANK = re.compile(r"\[\[([A-Za-z0-9_]+)\]\]")
SEP = re.compile(r"\s\|\s")


def _split_alts(s):
    return [a.strip() for a in SEP.split(s.strip()) if a.strip()]


def parse_question(key, qtype, src):
    if qtype not in TYPES:
        raise SystemExit(f"question '{key}': unknown type '{qtype}' (one of {sorted(TYPES)})")
    q_lines, opts, ans, miss, bins = [], [], [], [], None
    phase = "q"
    for line in src.split("\n"):
        if phase == "q" and line.startswith("bins:"):
            bins = [b.strip() for b in line[5:].split("·") if b.strip()]
            continue
        if line.startswith(">"):
            phase = "a"
            body = line[1:].lstrip(" ")
            if body.startswith("miss:"):
                phase = "m"
                miss.append(body[5:].strip())
            elif phase == "m":
                miss.append(body)
            else:
                ans.append(body)
            continue
        if phase == "m":
            miss.append(line)  # a wrapped miss line without `>`
            continue
        if phase == "a":
            if line.strip():
                raise SystemExit(f"question '{key}': text after the answer must start with '>' ({line[:40]!r})")
            continue
        m = OPT.match(line)
        if m:
            phase = "o"
            opts.append([m.group(1) is not None and m.group(1).lower() == "x", m.group(2).strip(), m.group(1) is not None])
            continue
        if phase == "o":
            if line.startswith("  ") and opts:
                opts[-1][1] += " " + line.strip()
            elif line.strip():
                raise SystemExit(f"question '{key}': unexpected line between options and answer: {line[:40]!r}")
            continue
        q_lines.append(line)
    question = "\n".join(q_lines).strip("\n")
    if not question:
        raise SystemExit(f"question '{key}': no question text")
    if not ans:
        raise SystemExit(f"question '{key}': no answer (lines starting with '>')")
    out = {"key": key, "type": qtype, "q": demo_text.render_block(question),
           "a": demo_text.render_block("\n".join(ans).strip()),
           "miss": demo_text.render_inline(" ".join(x for x in miss if x.strip()).strip()) if any(x.strip() for x in miss) else ""}
    if qtype in ("pick", "point"):
        if not opts or not all(o[2] for o in opts):
            raise SystemExit(f"question '{key}': every option of a {qtype} question needs a [ ] or [x] box")
        options = []
        for right, label, _ in opts:
            km = KEYED.match(label)
            k = km.group(1) if km else None
            if qtype == "point" and not k:
                raise SystemExit(f"question '{key}': point options need a `key: label` (key = data-pick in the figure): {label!r}")
            options.append({"k": k or f"o{len(options)}", "label": demo_text.render_inline(km.group(2) if km else label), "right": right})
        if not any(o["right"] for o in options):
            raise SystemExit(f"question '{key}': no [x] option")
        out["opts"] = options
        out["multi"] = sum(o["right"] for o in options) > 1
    elif qtype == "sort":
        items, seen = [], []
        for _, label, boxed in opts:
            if boxed or "→" not in label:
                raise SystemExit(f"question '{key}': sort options are `item → bin`: {label!r}")
            item, target = label.rsplit("→", 1)  # the item itself may contain an arrow
            targets = _split_alts(target)
            for t in targets:
                if t not in seen:
                    seen.append(t)
            items.append({"label": demo_text.render_inline(item.strip()), "bins": targets})
        bins = bins or seen
        for it in items:
            for t in it["bins"]:
                if t not in bins:
                    raise SystemExit(f"question '{key}': bin '{t}' is not in bins: {bins}")
        out["bins"], out["items"] = bins, items
    elif qtype == "fill":
        blanks = BLANK.findall(question)
        answers = {}
        for _, label, boxed in opts:
            if boxed or "=" not in label:
                raise SystemExit(f"question '{key}': fill options are `id = alt | alt`: {label!r}")
            bid, rhs = label.split("=", 1)
            bid = bid.strip()
            alts, tol = _split_alts(rhs), None
            if len(alts) == 1 and "~" in alts[0]:
                val, tol = alts[0].split("~", 1)
                alts, tol = [val.strip()], float(tol)
            answers[bid] = {"alts": alts, "tol": tol}
        if set(blanks) != set(answers) or len(set(blanks)) != len(blanks):
            raise SystemExit(f"question '{key}': blanks {blanks} and answers {sorted(answers)} do not match one to one")
        size = {b: max(4, min(18, len(answers[b]["alts"][0]) + 1)) for b in blanks}
        out["blanks"] = [{"id": b, **answers[b]} for b in blanks]
        out["q"] = BLANK.sub(lambda m: f'<input class="qz-blank" data-blank="{m.group(1)}" size="{size[m.group(1)]}" autocomplete="off" spellcheck="false">', out["q"])
    elif qtype == "write":
        if any(o[2] for o in opts):
            raise SystemExit(f"question '{key}': a write question's list is a plain checklist, no boxes")
        out["check"] = [demo_text.render_inline(o[1]) for o in opts]
    return out


def questions(chunks, meta):
    """{key: parsed question} for every chunk with a type tag; those chunks are not prose."""
    return {k: parse_question(k, t, chunks[k]) for k, t in meta.items()}


def place(body, qs):
    """{{quiz:key}} -> a host div; numbers the questions in body order; every question must be placed."""
    order = []
    def repl(m):
        key = m.group(1)
        if key not in qs:
            raise SystemExit(f"body.html asks for question '{key}', not defined in demo/lecture/text/")
        if key in order:
            raise SystemExit(f"question '{key}' is placed twice")
        order.append(key)
        return f'<div class="qz" data-q="{key}"></div>'
    body = re.sub(r"\{\{quiz:([A-Za-z0-9_.-]+)\}\}", repl, body)
    missing = [k for k in qs if k not in order]
    if missing:
        raise SystemExit(f"questions defined but not placed in body.html: {missing}")
    for i, k in enumerate(order, 1):
        qs[k]["n"] = i
    return body, order
