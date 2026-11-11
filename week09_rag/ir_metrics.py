"""The ranking metrics the lecture page computes in the browser (demo/lecture/lecture.js, `metrics`), as the reference.

A ranked list is given by the grades of its documents, top first: 2 / 1 relevant (graded), 0 judged not relevant,
-1 not judged. R is the number of relevant documents in the collection (at least those listed; the ones not in the
list count with grade 1 in the ideal order of NDCG). N, for bpref, is the number of judged non-relevant documents —
here, those listed with grade 0. Every metric except bpref treats "not judged" as not relevant, as trec_eval does.

Checked against trec_eval (pytrec_eval) once, by check_ir_metrics() below; export_lecture_data.py writes the cases.
"""
import math


def metrics(grades, k, R, gmax=2):
    top = grades[:k]
    rel = [1 if g > 0 else 0 for g in grades]
    b = rel[:k]
    hits = sum(b)
    first = next((i + 1 for i, x in enumerate(b) if x), None)
    p = hits / k
    recall = hits / R if R else 0.0
    f1 = 2 * p * recall / (p + recall) if p + recall else 0.0
    ap, seen = 0.0, 0
    for i, x in enumerate(b):
        if x:
            seen += 1
            ap += seen / (i + 1)
    ap = ap / min(R, k) if R else 0.0
    rprec = sum(rel[:R]) / R if R else 0.0
    listed = [g for g in grades if g > 0]
    ideal = sorted(listed + [1] * (R - len(listed)), reverse=True)[:k]
    dcg = sum(max(g, 0) / math.log2(i + 2) for i, g in enumerate(top))
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal))
    # ERR (Chapelle et al., 2009): a user reads down the list and stops at document r with probability R_r
    err, keep = 0.0, 1.0
    for r, g in enumerate(top, start=1):
        stop = (2 ** max(g, 0) - 1) / 2 ** gmax
        err += keep * stop / r
        keep *= 1 - stop
    # bpref (Buckley & Voorhees, 2004), trec_eval's version: judged non-relevant above each retrieved relevant one
    N = sum(1 for g in grades if g == 0)
    bpref, nonrel = 0.0, 0
    for g in grades:
        if g == 0:
            nonrel += 1
        elif g > 0:
            bpref += 1.0 if nonrel == 0 or N == 0 else 1 - min(nonrel, R) / min(R, N)
    bpref = bpref / R if R else 0.0
    return {"p": p, "rprec": rprec, "recall": recall, "hit": 1.0 if hits else 0.0, "f1": f1, "rr": 1 / first if first else 0.0,
            "ap": ap, "ndcg": dcg / idcg if idcg else 0.0, "err": err, "bpref": bpref}


CASES = [([0, 1, 0, 1, 0], 5, 2), ([0, 1, 0, 1, 0], 3, 2), ([1, 0, 0, 0, 0, 0, 0, 0, 0, 0], 10, 1),
         ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 10, 1), ([2, 0, 1, 0, 0, 1, 0, 0, 2, 0], 10, 4), ([2, 0, 1, 0, 0, 1, 0, 0, 2, 0], 5, 6),
         ([0, 1, 1, 0, 1, 0, 0, 0, 0, 1], 10, 4), ([0, 1, 1, 0, 1, 0, 0, 0, 0, 1], 4, 4), ([1, 1, 1], 2, 5), ([0, 0, 2, 0, 0], 5, 1),
         ([-1, 1, 0, -1, 2, 0, 0, 1, -1, 0], 10, 3), ([-1, -1, 1, 0, 0], 5, 2), ([0, 1, -1, 1, 0, 2, 0, 0, -1, 0], 10, 5)]


def check_ir_metrics():
    """Against trec_eval: uv run --with pytrec-eval-terrier python -c 'import ir_metrics; ir_metrics.check_ir_metrics()'.
    trec_eval scores the whole list (recip_rank, map, Rprec, bpref) and P_k / recall_k / ndcg_cut_k at its cutoffs, so
    the comparison uses k = 5 or 10 = the list length; map divides by R, ours by min(R, k): equal when R <= k."""
    import pytrec_eval
    worst = 0.0
    for grades, k, R in CASES:
        if k != len(grades) or k not in (5, 10):
            continue
        run = {"q": {f"d{i}": float(len(grades) - i) for i in range(len(grades))}}
        qrel = {f"d{i}": g for i, g in enumerate(grades) if g >= 0}
        for j in range(R - sum(1 for g in grades if g > 0)):
            qrel[f"x{j}"] = 1                                  # relevant, never retrieved
        if not any(v > 0 for v in qrel.values()):
            continue
        ev = pytrec_eval.RelevanceEvaluator({"q": qrel}, {"P", "recall", "recip_rank", "map", "ndcg_cut", "Rprec", "bpref"})
        t = ev.evaluate(run)["q"]
        m = metrics(grades, k, R)
        pairs = [("p", t[f"P_{k}"]), ("recall", t[f"recall_{k}"]), ("rr", t["recip_rank"]), ("ndcg", t[f"ndcg_cut_{k}"]),
                 ("rprec", t["Rprec"]), ("bpref", t["bpref"])] + ([("ap", t["map"])] if R <= k else [])
        for name, want in pairs:
            d = abs(m[name] - want)
            worst = max(worst, d)
            assert d < 1e-4, (grades, k, R, name, m[name], want)       # trec_eval prints 4 decimals
    print(f"trec_eval agrees, max |diff| {worst:.1e}")
