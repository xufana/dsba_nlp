"""Every number the week-9 demo page shows -> artifacts/demo_data.json.

    uv run python export_demo_data.py

The notebook's definition cells (golden set, documents, evaluation, prompts) are exec'd from the .ipynb as they are,
found by marker strings. On top of them, on the CPU:
  * BM25 through LangChain's own BM25Retriever (tokenised with str.split(), and lower-cased) and the ensemble;
  * the fuzzy-match ceiling of the old evaluation, and fuzzy match against the post id over Qdrant's top 10 (proxies);
and artifacts/synthetic.json — the synthetic songs and shop documents of the 2025 RAG page (SelfQuery, FLARE) — is
copied in as it is. The model outputs precompute.py wrote (dense.json, rerank.json, llm.json) are read and summarised.
What the browser recomputes — BM25 over the 876 documents, the ensemble's RRF, rank metrics, the reranking pool —
is checked against the Python results written here, and the check is shown on the page.
"""
import json
import os
import re
import sys
import time
import warnings

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
warnings.filterwarnings("ignore")

import numpy as np

T0 = time.time()
NB = "week09_rag.ipynb"
ART = os.environ.get("ART", "artifacts")   # ART=… reads another precompute run (a dry run); the output always goes to artifacts/
OUT = os.path.join("artifacts", "demo_data.json")


def log(msg):
    print(f"[{time.time() - T0:5.0f}s] {msg}", flush=True)


# ------------------------------------------------------------------ the notebook's own definitions
nb = json.load(open(NB, encoding="utf-8"))
NS = {}


def run_cell(marker):
    for c in nb["cells"]:
        src = "".join(c["source"])
        if c["cell_type"] == "code" and marker in src:
            exec(src, NS)
            return
    sys.exit(f"no notebook cell contains {marker!r}")


exec("import numpy as np\nimport pandas as pd\nimport re\nimport json", NS)
NS["df"] = NS["pd"].read_csv("data/gonzo_dump.csv")
run_cell('test_df["post_id"] = ')
run_cell("from langchain_core.documents import Document")
run_cell("doc_list = RecursiveCharacterTextSplitter().split_documents")
run_cell("def evaluate_retriever(")
run_cell("QE_SYSTEM = ")
df, test_df, doc_list, no_answer = NS["df"], NS["test_df"], NS["doc_list"], NS["no_answer"]
summarize, gold_rank = NS["summarize"], NS["gold_rank"]
golden = list(test_df["question"])
questions = golden + list(no_answer)
gold = [int(x) for x in test_df["post_id"]]
title = [int(d.metadata["title"]) for d in doc_list]
log(f"{len(df)} posts, {len(doc_list)} documents, {len(golden)} golden + {len(no_answer)} without an answer")

dense = json.load(open(f"{ART}/dense.json"))
rerank = json.load(open(f"{ART}/rerank.json"))
llm = json.load(open(f"{ART}/llm.json"))
assert dense["questions"] == questions, "precompute ran on another question list"


def ranks_of(orders):
    return [next((r for r, j in enumerate(o[:10], 1) if title[j] == g), None) for o, g in zip(orders, gold)]


def S(ranks):
    s = summarize(ranks)
    return {"mrr": round(s["MRR"], 4), "hit": {str(k): round(v, 4) for k, v in s["Hit@k"].items()},
            "ndcg": {str(k): round(v, 4) for k, v in s["NDCG@k"].items()}, "ranks": ranks}


# ------------------------------------------------------------------ BM25 and the ensemble, through LangChain
from langchain_community.retrievers import BM25Retriever

first = {}
for i, d in enumerate(doc_list):
    first.setdefault(d.page_content, i)
lower = lambda t: re.findall(r"\w+", t.lower())
bm = {"split": BM25Retriever.from_documents(doc_list), "lower": BM25Retriever.from_documents(doc_list, preprocess_func=lower)}
bm_check = {}
bm_order = {}
for name, r in bm.items():
    r.k = 50
    orders, top_scores = [], []
    for q in questions:
        toks = r.preprocess_func(q)
        sc = r.vectorizer.get_scores(toks)
        orders.append([first[d.page_content] for d in r.invoke(q)])
        top_scores.append(np.round(np.sort(sc)[::-1][:10], 6).tolist())
    bm_order[name] = orders
    bm_check[name] = {"top10_scores": top_scores, "tokens": [r.preprocess_func(q) for q in questions]}
log("BM25 done")


def ensemble(bm_list, dense_list, k=10):
    """EnsembleRetriever(weights=[0.5, 0.5]) over BM25 (k) and Qdrant (k): RRF with c = 60, dedup by content."""
    from collections import defaultdict
    lists = [[first[doc_list[j].page_content] for j in bm_list[:k]], [first[doc_list[j].page_content] for j in dense_list[:k]]]
    score, order, seen = defaultdict(float), [], set()
    for lst in lists:
        for rank, j in enumerate(lst, start=1):
            score[j] += 0.5 / (rank + 60)
    for j in lists[0] + lists[1]:
        if j not in seen:
            seen.add(j)
            order.append(j)
    return sorted(order, key=lambda j: -score[j])


ens_order = [ensemble(b, d) for b, d in zip(bm_order["split"], dense["dense_order"])]
# check our RRF against LangChain's EnsembleRetriever on the same two lists
from langchain_classic.retrievers import EnsembleRetriever
from langchain_core.retrievers import BaseRetriever


class Fixed(BaseRetriever):
    lists: dict

    def _get_relevant_documents(self, query, *, run_manager=None):
        return [doc_list[j] for j in self.lists[query]]


er = EnsembleRetriever(retrievers=[Fixed(lists={q: o[:10] for q, o in zip(questions, bm_order["split"])}),
                                   Fixed(lists={q: o[:10] for q, o in zip(questions, dense["dense_order"])})], weights=[0.5, 0.5])
ens_agree = sum([first[d.page_content] for d in er.invoke(q)] == o for q, o in zip(questions, ens_order))
log(f"RRF agrees with EnsembleRetriever on {ens_agree}/{len(questions)} questions")

# ------------------------------------------------------------------ the old evaluation: fuzzy match >= 80
from rapidfuzz import fuzz

best_fuzzy = [int(max(fuzz.partial_ratio(q, d.page_content) for d in doc_list)) for q in test_df["text"]]
log(f"fuzzy ceiling: {sum(b >= 80 for b in best_fuzzy)}/20 reach 80")

# the proxy stand: every (question, document) of Qdrant's top 10, scored by fuzzy match against the golden quote;
# the browser labels each pair by post id and counts where the two proxies disagree at a threshold
proxy = []
for i, quote in enumerate(test_df["text"]):
    for j in dense["dense_order"][i][:10]:
        al = fuzz.partial_ratio_alignment(quote, doc_list[j].page_content)
        proxy.append([i, int(j), round(al.score, 2), [al.src_start, al.src_end, al.dest_start, al.dest_end]])
sc_gold = [p[2] for p in proxy if int(title[p[1]]) == gold[p[0]]]
sc_other = [p[2] for p in proxy if int(title[p[1]]) != gold[p[0]]]
log(f"proxy pairs: {len(proxy)}; gold posts score {min(sc_gold):.0f}-{max(sc_gold):.0f}, other posts at most {max(sc_other):.0f}")

# ------------------------------------------------------------------ the kappa stand: synthetic labels, the browser's kappas checked here
def mulberry32(a):
    """the page's seeded generator, bit for bit (32-bit unsigned arithmetic)"""
    a &= 0xFFFFFFFF
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((a ^ (a >> 15)) * (1 | a)) & 0xFFFFFFFF
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt
from sklearn.metrics import cohen_kappa_score as _kappa
_r1, _r2, _r3 = mulberry32(11), mulberry32(23), mulberry32(37)
k_human = [2 + int(_r1() * 4) for _ in range(60)]
k_u = [_r2() for _ in range(60)]
k_sign = [-1 if _r3() < .5 else 1 for _ in range(60)]
kappa_check = {}
for sh in range(3):
    for pn in range(0, 61, 5):
        judge_k = [max(1, min(5, v - sh + (k_sign[i] if k_u[i] < pn / 100 else 0))) for i, v in enumerate(k_human)]
        kappa_check[f"{sh}/{pn}"] = [round(_kappa(k_human, judge_k, labels=[1, 2, 3, 4, 5]), 9),
                                     round(_kappa(k_human, judge_k, labels=[1, 2, 3, 4, 5], weights="quadratic"), 9)]

# ------------------------------------------------------------------ the retrievers' table
table = {
    "BM25": S(ranks_of(bm_order["split"])),
    "BM25, lower case": S(ranks_of(bm_order["lower"])),
    "Qdrant": S(dense["dense_ranks"]),
    "Ensemble": S(ranks_of(ens_order)),
    "PD-Retriever": S(dense["pd_ranks"]),
    "QE + Qdrant": S(llm["qe_ranks"]),
    "HyDE + Qdrant": S(llm["hyde_ranks"]),
}
assert table["Ensemble"]["ranks"] == ranks_of(ens_order)
rr = []
for i in range(len(golden)):
    cand = rerank["pool_order"][i][:20]
    sc = rerank["scores"][i][:20]
    order = [cand[j] for j in np.argsort(-np.asarray(sc), kind="stable")][:10]
    rr.append(next((r for r, j in enumerate(order, 1) if title[j] == gold[i]), None))
table["Ensemble + Reranking"] = S(rr)
crag_yes = llm["crag_yes"]
table["CRAG"] = S([r if y else None for r, y in zip(dense["dense_ranks"], crag_yes[:20])])
for k, v in table.items():
    log(f"  {k:22s} MRR {v['mrr']:.3f}  Hit@1 {v['hit']['1']:.2f}  Hit@10 {v['hit']['10']:.2f}")

# the old table, as it ran: fuzzy >= 80, Qdrant at k = 4 over a collection holding the children too
asis = S(dense["notebook_as_ran_qdrant_ranks"])

# ------------------------------------------------------------------ the two judges' agreement
from sklearn.metrics import cohen_kappa_score

clamp = lambda xs: [max(0, min(5, x)) for x in xs]
kappa = {k: float(cohen_kappa_score(clamp([s[k] for s in llm["judge"]]), clamp([s[k] for s in llm["judge_strict"]])))
         for k in ("relevance", "faithfulness")}
log(f"judges' kappa: {kappa}")

# ------------------------------------------------------------------ which answers decline: read by hand, 2026-11-10
# A regular expression over "не содержит / нет информации" missed «…в предоставленном контексте нет», so every answer to the
# ten questions without an answer was read under all three prompts. Declined = says the corpus / context has no answer and
# does not answer from its own knowledge. Closed book N2 says the results were not published (then mistakes Gemini 3 for
# NASA's 1965 mission); with the "say so" line N2 says the context has nothing, N8 and N10 say the question is off the
# context's topic. The golden answers under "say so" all answer (G11 first asks to clarify, then answers anyway).
DECLINED_NA = {"closed book": [2], "context": [], "context + say so": [2, 8, 10]}      # N-numbers, 1-based
declined = {m: [False] * len(golden) + [k + 1 in DECLINED_NA[m] for k in range(len(no_answer))] for m in DECLINED_NA}

# ------------------------------------------------------------------ write
docs = [{"id": title[i], "date": str(df.set_index("id").loc[title[i], "date"])[:10], "text": d.page_content} for i, d in enumerate(doc_list)]
D = {
    "n_posts": int(len(df)), "n_docs": len(doc_list), "date_from": str(df["date"].min())[:10], "date_to": str(df["date"].max())[:10],
    "word_hist": np.histogram(df["text"].fillna("").str.split().str.len(), bins=np.arange(0, 701, 25))[0].tolist(),
    "docs": docs,
    "golden": [{"q": q, "quote": t, "post": g} for q, t, g in zip(golden, test_df["text"], gold)],
    "no_answer": list(no_answer),
    "models": {"embedder": dense["model"], "reranker": rerank["model"], "generator": llm["model"]},
    "devices": {"dense": dense["device"], "rerank": rerank["device"], "llm": llm["device"]},
    "dense": {"scores": [[round(x, 3) for x in row] for row in dense["doc_scores"]], "order": [o[:10] for o in dense["dense_order"]],
              "seconds_embed": dense["seconds_embed"], "n_children": dense["n_children"], "check": dense["check"]},
    "pd": {"order": [o[:10] for o in dense["pd_order"]], "best_child": dense["pd_best_child"]},
    "bm25": {"order": {k: [o[:10] for o in v] for k, v in bm_order.items()}, "check": bm_check},
    "ensemble": {"order": [o[:10] for o in ens_order], "agree": ens_agree},
    "rerank": {"pool": rerank["pool_order"], "scores": rerank["scores"], "seconds_per_pair": rerank["seconds_per_pair"],
               "params": rerank["params"]},
    "qe": llm["qe"], "hyde": llm["hyde"], "qe_top": llm["qe_top"], "hyde_top": llm["hyde_top"],
    "crag": {"yes": crag_yes, "raw": llm["crag_raw"]},
    "answers": llm["answers"], "answer_docs": llm["answer_context_docs"], "declined": declined,
    "judge": {"answers": llm["judge_answers"], "lenient": llm["judge"], "strict": llm["judge_strict"], "kappa": kappa},
    "fuzzy": {"best": best_fuzzy, "proxy": proxy},
    "kappa_check": kappa_check,
    "synthetic": json.load(open("artifacts/synthetic.json", encoding="utf-8")),
    "table": table, "as_ran": asis,
}
json.dump(D, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
log(f"{OUT}: {os.path.getsize(OUT) / 1e6:.2f} MB")
