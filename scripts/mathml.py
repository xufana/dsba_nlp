r"""Inline formulas for the text chunks: a small LaTeX dialect <-> the MathML the pages use.

    $C = 6ND$                 <math><mi>C</mi><mo>=</mo><mn>6</mn><mi>N</mi><mi>D</mi></math>
    $d_{head}$  $x_t^2$       msub / msup / msubsup; braces group into an <mrow>
    $\sqrt{d_k}$  $\frac{x-μ}{σ}$
    $\mathrm{exp}(x)$         upright function name;  $\mathit{PE}$  one italic multi-letter identifier
    $\text{head}_i$  $\hspace{0.4em}$  $\munder{∑}{i}$  $\mover{h}{~}$
    ${−∞}$                    outer braces wrap the whole formula in one <mrow>

Letters (Latin, Greek, ℝ, ℓ, ∞) are identifiers, digits are numbers, everything else is an operator; the unicode
signs (−, ×, ·, ≈) are written as themselves. `mathml_to_latex` is the inverse used once, when the pages were
migrated; it returns None for MathML this dialect cannot express (then the chunk keeps the <math> as raw HTML).
"""
import html
import re
import unicodedata

IDENT_EXTRA = set("ℝℓ∞")
FUNCS = {"mathrm": "normal"}


def is_ident_char(c):
    return unicodedata.category(c).startswith("L") or c in IDENT_EXTRA


def tokenize(s):
    i, out = 0, []
    while i < len(s):
        c = s[i]
        if c.isspace():
            out.append(("ws", c)); i += 1
        elif c == "\\":
            m = re.match(r"\\([A-Za-z]+|.)", s[i:])
            out.append(("cmd", m.group(1))); i += m.end()
        elif c in "{}_^":
            out.append((c, c)); i += 1
        elif c.isdigit():
            m = re.match(r"\d+(\.\d+)?", s[i:])
            out.append(("mn", m.group(0))); i += m.end()
        elif is_ident_char(c):
            out.append(("mi", c)); i += 1
        else:
            out.append(("mo", c)); i += 1
    return out


class Parser:
    def __init__(self, s):
        self.t = tokenize(s); self.i = 0

    def peek(self):
        while self.i < len(self.t) and self.t[self.i][0] == "ws":
            self.i += 1
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def take(self, kind=None):
        if self.peek()[0] is None:
            raise ValueError("unexpected end")
        tok = self.t[self.i]
        if kind and tok[0] != kind:
            raise ValueError(f"expected {kind}, got {tok}")
        self.i += 1
        return tok

    def raw_group(self):
        """{ ... } taken as literal text (for \\text, \\hspace)."""
        self.take("{"); depth, parts = 1, []
        while depth:
            kind, val = self.t[self.i]; self.i += 1   # raw: whitespace kept
            if kind == "{": depth += 1
            elif kind == "}": depth -= 1
            if depth: parts.append(val)
        return "".join(parts)

    def group(self):
        """{ ... } -> list of nodes."""
        self.take("{"); nodes = []
        while self.peek()[0] != "}":
            if self.peek()[0] is None:
                raise ValueError("unbalanced braces")
            nodes.extend(self.item())
        self.take("}")
        return nodes

    def arg(self):
        """One argument: a brace group (an <mrow> if it holds several nodes) or a single atom."""
        if self.peek()[0] == "{":
            nodes = self.group()
            return nodes[0] if len(nodes) == 1 else ("mrow", nodes)
        nodes = self.atom()
        if len(nodes) != 1:
            raise ValueError("bad script argument")
        return nodes[0]

    def atom(self):
        kind, val = self.take()
        if kind == "{":
            self.i -= 1
            return [("mrow", self.group())]
        if kind == "cmd":
            if val == "mathrm": return [("mi", self.raw_group(), "normal")]
            if val == "mathit": return [("mi", self.raw_group())]
            if val == "text": return [("mtext", self.raw_group())]
            if val == "hspace": return [("mspace", self.raw_group())]
            if val == "sqrt": return [("msqrt", self.group())]
            if val == "frac": return [("mfrac", [self.arg(), self.arg()])]
            if val == "munder": return [("munder", [self.arg(), self.arg()])]
            if val == "mover": return [("mover", [self.arg(), self.arg()])]
            if len(val) == 1: return [("mo", val)]  # escaped punctuation: \{ \_ \$ \\ ...
            raise ValueError(f"unknown command \\{val}")
        if kind in ("mi", "mn", "mo"):
            return [(kind, val)]
        raise ValueError(f"unexpected {kind}")

    def item(self):
        base = self.atom()
        sub = sup = None
        while self.peek()[0] in ("_", "^"):
            k = self.take()[0]
            if k == "_":
                if sub is not None: raise ValueError("double subscript")
                sub = self.arg()
            else:
                if sup is not None: raise ValueError("double superscript")
                sup = self.arg()
        if sub is None and sup is None:
            return base
        if len(base) != 1: raise ValueError("script on a group")
        b = base[0]
        if sub is not None and sup is not None: return [("msubsup", [b, sub, sup])]
        if sub is not None: return [("msub", [b, sub])]
        return [("msup", [b, sup])]

    def parse(self):
        nodes = []
        while self.peek()[0] is not None:
            nodes.extend(self.item())
        return nodes


def render(node):
    kind = node[0]
    if kind in ("mi", "mn", "mo", "mtext"):
        attr = ' mathvariant="normal"' if len(node) > 2 else ""
        return f"<{kind}{attr}>{html.escape(node[1], quote=False)}</{kind}>"
    if kind == "mspace":
        return f'<mspace width="{node[1]}"/>'
    return f"<{kind}>" + "".join(render(c) for c in node[1]) + f"</{kind}>"


def latex_to_mathml(s):
    nodes = Parser(s).parse()
    return "<math>" + "".join(render(n) for n in nodes) + "</math>"


# ---- the inverse, for the one-time migration ----------------------------------------------------------------

TAG = re.compile(r"<(/?)(m[a-z]+)((?:\s+[a-z]+=\"[^\"]*\")*)\s*(/?)>")


def parse_mathml(src):
    """<math>...</math> -> list of nodes as `render` expects, or None if a tag or attribute is outside the dialect."""
    src = re.sub(r">\s+<", "><", src.strip())
    m = re.fullmatch(r"<math>(.*)</math>", src, re.S)
    if not m:
        return None
    pos, stack, root = 0, [], []
    cur = root
    inner = m.group(1)
    for t in TAG.finditer(inner):
        if t.start() < pos:
            continue  # the closing tag of a leaf, consumed below
        if t.start() != pos:
            return None  # text outside leaf elements
        closing, tag, attrs, selfclose = t.groups()
        attrs = dict(re.findall(r'([a-z]+)="([^"]*)"', attrs))
        if closing:
            if not stack or stack[-1][0][0] != tag: return None
            node, cur = stack.pop()
            pos = t.end(); continue
        if tag in ("mi", "mn", "mo", "mtext"):
            e = inner.find(f"</{tag}>", t.end())
            if e < 0: return None
            text = html.unescape(inner[t.end():e])
            if attrs == {"mathvariant": "normal"} and tag == "mi": cur.append(("mi", text, "normal"))
            elif attrs: return None
            else: cur.append((tag, text))
            pos = e + len(tag) + 3
        elif tag == "mspace":
            if set(attrs) != {"width"} or not selfclose: return None
            cur.append(("mspace", attrs["width"])); pos = t.end()
        elif tag in ("mrow", "msub", "msup", "msubsup", "msqrt", "mfrac", "munder", "mover"):
            if attrs: return None
            node = (tag, []); cur.append(node); stack.append((node, cur)); cur = node[1]; pos = t.end()
        else:
            return None
    if pos != len(inner) or stack:
        return None
    return root


LATEX_SPECIAL = set("\\{}$_^%&#")


def esc(text):
    return "".join("\\" + c if c in LATEX_SPECIAL else c for c in text)


def to_latex(node, script=False):
    kind = node[0]
    if kind == "mi":
        if len(node) > 2: return "\\mathrm{" + esc(node[1]) + "}"
        if len(node[1]) == 1 and is_ident_char(node[1]): return node[1]
        return "\\mathit{" + esc(node[1]) + "}"
    if kind == "mn":
        if not re.fullmatch(r"\d+(\.\d+)?", node[1]): raise ValueError
        return node[1]
    if kind == "mo":
        c = node[1]
        if len(c) != 1 or c.isspace() or c.isdigit() or is_ident_char(c): raise ValueError
        return esc(c)
    if kind == "mtext": return "\\text{" + esc(node[1]) + "}"
    if kind == "mspace": return "\\hspace{" + node[1] + "}"
    if kind == "mrow": return "{" + "".join(to_latex(c) for c in node[1]) + "}"
    if kind == "msqrt": return "\\sqrt{" + "".join(to_latex(c) for c in node[1]) + "}"
    if kind == "mfrac": return "\\frac" + arg(node[1][0], True) + arg(node[1][1], True)
    if kind == "munder": return "\\munder" + arg(node[1][0], True) + arg(node[1][1], True)
    if kind == "mover": return "\\mover" + arg(node[1][0], True) + arg(node[1][1], True)
    if kind == "msub": return base(node[1][0]) + "_" + arg(node[1][1])
    if kind == "msup": return base(node[1][0]) + "^" + arg(node[1][1])
    if kind == "msubsup": return base(node[1][0]) + "_" + arg(node[1][1]) + "^" + arg(node[1][2])
    raise ValueError(kind)


def base(node):
    if node[0] in ("mspace", "msub", "msup", "msubsup"): raise ValueError("script base")
    return to_latex(node)


def arg(node, always=False):
    if node[0] == "mrow": return "{" + "".join(to_latex(c) for c in node[1]) + "}"
    s = to_latex(node)
    return s if len(s) == 1 and not always else "{" + s + "}"


def mathml_to_latex(src):
    """Inverse of latex_to_mathml, or None when the dialect cannot reproduce the MathML exactly."""
    nodes = parse_mathml(src)
    if nodes is None:
        return None
    try:
        tex = "".join(to_latex(n) for n in nodes)
        if re.sub(r">\s+<", "><", src.strip()) != latex_to_mathml(tex):
            return None
        if "$" in tex:
            return None
        return tex
    except ValueError:
        return None


if __name__ == "__main__":
    import glob, sys
    ok = bad = 0
    for w in sorted(glob.glob("week0*")):
        for m in re.finditer(r"<math>.*?</math>", open(f"{w}/demo/body.html", encoding="utf-8").read(), re.S):
            tex = mathml_to_latex(m.group(0))
            if tex is None: bad += 1; print("RAW ", m.group(0)[:150])
            else: ok += 1; print("  $" + tex + "$") if "-v" in sys.argv else None
    print(f"\n{ok} converted, {bad} kept as raw MathML")
