"""The measured numbers and examples the lecture page (demo/lecture/) shows -> artifacts/lecture_data.json.

    uv run python export_lecture_data.py

Read from the seminar's own artifacts — artifacts/demo_data.json (export_demo_data.py) and artifacts/rerank.json
(precompute.py) — no model runs here: the examples on the gonzo_ML posts (a question against its post, word by word;
a question the channel cannot answer and its nearest posts; the cascade's ceiling; the best
cosine of answerable and unanswerable questions). Besides them, two things that are not measurements: the reference
values of the ranking metrics, against which the page's in-browser metrics are checked (check_steps.json), and a
seeded 2-D point cloud with its k-means cells for the IVF figure, with what the browser has to reproduce;
and one measurement on artifacts/vectors.npz — IVF's recall against the exact search on the posts' bge-m3 vectors
(k-means on the stored vectors, CPU, seconds).
"""
import json
import math
import os
import re
import statistics

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import average_precision_score, ndcg_score

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
D = json.load(open("artifacts/demo_data.json", encoding="utf-8"))
RR = json.load(open("artifacts/rerank.json", encoding="utf-8"))
T, docs, S = D["table"], D["docs"], D["dense"]["scores"]
golden, n_g = D["golden"], len(D["golden"])
post_of = [d["id"] for d in docs]
r3 = lambda x: round(float(x), 3)
out = {"n_posts": D["n_posts"], "n_docs": D["n_docs"], "n_golden": n_g, "n_noanswer": len(D["no_answer"]),
       "bm25_split": T["BM25"]["mrr"], "bm25_lower": T["BM25, lower case"]["mrr"]}

# ---- block 00: a question against the post that answers it, word by word ------------------------------------------
# "form" = the post has a word with the same first five letters (a crude stemmer, said so in the caption)
words = lambda s: re.findall(r"\w+", s.lower())
EX = 5                                                  # «Как устроены связи и обучение в архитектуре KAN?»
post_words = set(words(" ".join(d["text"] for d in docs if d["id"] == golden[EX]["post"])))
def match(w):
    if w in post_words: return [w, "exact", ""]
    form = sorted(x for x in post_words if len(w) > 4 and x[:5] == w[:5])
    return [w, "form", form[0]] if form else [w, "none", ""]
out["ex_q"] = golden[EX]["q"]
out["ex_words"] = [match(w) for w in words(golden[EX]["q"])]
out["ex_post_words"] = sum(len(d["text"].split()) for d in docs if d["id"] == golden[EX]["post"])
out["ex_bm25_rank"] = T["BM25"]["ranks"][EX]                       # None: LangChain's split() never found it
out["ex_bm25_lower_rank"] = T["BM25, lower case"]["ranks"][EX]
out["q_words_median"] = statistics.median(len(g["q"].split()) for g in golden)
out["doc_words_median"] = statistics.median(len(d["text"].split()) for d in docs)

# ---- block 00: a question the channel cannot answer still gets a first document --------------------------------------
NA = 6                                                  # «Как сварить борщ?»
row = S[n_g + NA]
top = sorted(range(len(row)), key=lambda k: -row[k])[:3]
out["na_q"] = D["no_answer"][NA]
out["na_top"] = [[row[k], docs[k]["text"].replace("\n", " ")[:90]] for k in top]

# ---- block 01: one question is 0.05; the order of two retrievers depends on k ---------------------------------------
out["hit"] = {n: T[n]["hit"] for n in ("Qdrant", "Ensemble")}

# ---- block 01: reference values for the in-browser metrics (ir_metrics.py, checked against trec_eval) ----------------
from ir_metrics import CASES, metrics  # noqa: E402
cases = []
for grades, k, R in CASES:
    m = metrics(grades, k, R)
    rel = [max(g, 0) for g in grades]
    if sum(1 for g in rel if g) == R and R and k == len(grades):    # every relevant one is listed: sklearn agrees too
        sc = [[len(rel) - i for i in range(len(rel))]]
        assert abs(ndcg_score([rel], sc, k=k) - m["ndcg"]) < 1e-12, (grades, k, R)
        assert abs(average_precision_score([1 if g else 0 for g in rel], sc[0]) - m["ap"]) < 1e-12, (grades, k, R)
    cases.append({"rels": grades, "k": k, "R": R, "want": m})
out["metric_cases"] = cases

# ---- block 04: IVF, the mechanism on a seeded 2-D cloud (not data, a picture; the browser recomputes its recall) -------
rng = np.random.default_rng(0)
centres = rng.uniform(0.12, 0.88, size=(7, 2))
pts = np.vstack([c + rng.normal(0, 0.07, size=(64, 2)) for c in centres] + [rng.uniform(0, 1, size=(300, 2))])
pts = np.round(pts[(pts >= 0).all(1) & (pts <= 1).all(1)], 4)
km = KMeans(n_clusters=32, n_init=10, random_state=0).fit(pts)
cent, cell = np.round(km.cluster_centers_, 4), km.labels_
def ivf_found(X, C, labels, q, nprobe, k=10, sim=False):
    """the exact top k and what an IVF index with nprobe cells returns (squared distance, or a dot product if sim)"""
    d = (lambda A: -(A @ q)) if sim else (lambda A: ((A - q) ** 2).sum(1))
    exact = np.argsort(d(X), kind="stable")[:k]
    probed = np.argsort(d(C), kind="stable")[:nprobe]
    cand = np.where(np.isin(labels, probed))[0]
    return exact, cand[np.argsort(d(X[cand]), kind="stable")[:k]], cand.size
presets = np.round(np.array([[0.5, 0.5], [0.15, 0.85], [0.8, 0.25], [0.35, 0.3]]), 4)
out["ivf"] = {"pts": pts.tolist(), "cent": cent.tolist(), "cell": cell.tolist(), "presets": presets.tolist(), "k": 10,
              "preset_found": [[sorted(ivf_found(pts, cent, cell, q, n)[1].tolist()) for n in range(1, 9)] for q in presets]}

# ---- block 04: IVF on the real vectors — bge-m3 over the posts and their 120-character chunks, the 30 questions ------
z = np.load("artifacts/vectors.npz")
X = np.vstack([z["doc"], z["child"]]).astype(np.float32); Q = z["q"].astype(np.float32)
X /= np.linalg.norm(X, axis=1, keepdims=True); Q /= np.linalg.norm(Q, axis=1, keepdims=True)
C_REAL = 64
km = KMeans(n_clusters=C_REAL, n_init=1, max_iter=50, random_state=0).fit(X)
probes = [1, 2, 4, 8, 16, 32, 64]
rec, scanned = [], []
for n in probes:
    r = [ivf_found(X, km.cluster_centers_, km.labels_, q, n, sim=True) for q in Q]
    rec.append(r3(np.mean([len(set(e) & set(f)) / 10 for e, f, _ in r]))); scanned.append(r3(np.mean([c / len(X) for _, _, c in r])))
out["ivf_real"] = {"n": int(len(X)), "d": int(X.shape[1]), "cells": C_REAL, "n_q": int(len(Q)), "nprobe": probes,
                   "recall": rec, "scanned": scanned}

# ---- block 06: the cascade on the posts — the first stage's Hit@k is the ceiling of the reranker -----------------------
pools, scores = RR["pool_order"], RR["scores"]
def gold_rank(order, i): return next((r + 1 for r, j in enumerate(order[:10]) if post_of[j] == golden[i]["post"]), None)
depths = list(range(1, len(pools[0]) + 1))
first_hit, rr_mrr, rr_hit1 = [], [], []
for k in depths:
    first_hit.append(np.mean([any(post_of[j] == golden[i]["post"] for j in pools[i][:k]) for i in range(n_g)]))
    ranks = [gold_rank([pools[i][j] for j in np.argsort(-np.array(scores[i][:k]), kind="stable")], i) for i in range(n_g)]
    rr_mrr.append(np.mean([1 / r if r else 0 for r in ranks])); rr_hit1.append(np.mean([r == 1 for r in ranks]))
first_ranks = [gold_rank(pools[i], i) for i in range(n_g)]
assert abs(rr_mrr[19] - T["Ensemble + Reranking"]["mrr"]) < 1e-3, rr_mrr[19]       # the seminar's row: depth 20
out["cascade"] = {"depth": depths, "first_hit": [r3(x) for x in first_hit], "mrr": [r3(x) for x in rr_mrr],
                  "hit1": [r3(x) for x in rr_hit1], "first_mrr": r3(np.mean([1 / r if r else 0 for r in first_ranks]))}
out["rerank_s_per_pair"] = RR["seconds_per_pair"]
out["rerank_model"], out["rerank_device"], out["rerank_params"] = RR["model"], RR["device"], RR["params"]

# ---- block 07: the best cosine of every question, answerable or not ---------------------------------------------------
out["top1_golden"] = [r3(max(r)) for r in S[:n_g]]
out["top1_noanswer"] = [r3(max(r)) for r in S[n_g:]]
out["top1_golden_min"], out["top1_noanswer_max"] = min(out["top1_golden"]), max(out["top1_noanswer"])

json.dump(out, open("artifacts/lecture_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"artifacts/lecture_data.json  {os.path.getsize('artifacts/lecture_data.json') / 1e3:.0f} KB")
for k in ("ex_words", "ex_post_words", "ex_bm25_rank", "ex_bm25_lower_rank", "q_words_median", "doc_words_median", "na_top", "hit"):
    print(f"  {k}: {out[k]}")
print("  ivf 2-D", len(pts), "points; real", out["ivf_real"])
print("  cascade first_hit@1,5,10,20,50", [out["cascade"]["first_hit"][k - 1] for k in (1, 5, 10, 20, 50)],
      "mrr", [out["cascade"]["mrr"][k - 1] for k in (1, 5, 10, 20, 50)], "first-stage mrr", out["cascade"]["first_mrr"])
print("  top1 golden min", out["top1_golden_min"], "noanswer max", out["top1_noanswer_max"])
