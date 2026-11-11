"""
Precompute artifacts for week 9 (RAG over the gonzo_ML dump) — everything that needs a model.

    uv run python precompute.py                    every step
    uv run python precompute.py --only dense       one step
    uv run python precompute.py --cpu              when the machine is short of GPU memory

The notebook's pipeline, run once on the 20 golden questions plus 10 questions the corpus cannot answer, so the demo
page can slice it in the browser. Models are the notebook's: BAAI/bge-m3 (embedder), BAAI/bge-reranker-v2-m3
(cross-encoder), RefalMachine/ruadapt_qwen2.5_3B_ext_u48_instruct_v4 (generator). Generation is greedy here, so the
artifact is reproducible; the notebook's live cells are greedy too.

Steps (and what they write to artifacts/):
    dense    dense.json, vectors.npz   bge-m3 vectors of the 876 documents, the child chunks and the 30 questions;
                                       question x document cosines; ranks of the gold post for dense / parent-document,
                                       and the notebook's run as it was (one Qdrant collection holding both, k = 4)
    rerank   rerank.json               the ensemble's top-50 per golden question, the cross-encoder's score for each
    llm      llm.json                  query expansion, HyDE (texts and the dense ranks they give), the CRAG check,
                                       answers under three prompts, the two judges

Dense retrieval is done in numpy on the same vectors (bge-m3 is normalised, so cosine = dot) and checked against
QdrantVectorStore / ParentDocumentRetriever built from the same vectors: the ranks must agree.

The blocks between `# --- notebook: <name> ---` and `# --- end ---` are the same code as the seminar notebook's
definition cells — if you change one, change the other.
"""
import argparse
import json
import os
import re
import time

import numpy as np
import pandas as pd
import torch
import transformers
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

transformers.logging.set_verbosity_error()
transformers.logging.disable_progress_bar()

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
ART = "artifacts"
EMBEDDER = "BAAI/bge-m3"
RERANKER = "BAAI/bge-reranker-v2-m3"
GENERATOR = "RefalMachine/ruadapt_qwen2.5_3B_ext_u48_instruct_v4"
POOL = 50          # candidates the reranking demo can choose from


def log(msg):
    print(msg, flush=True)


# ----------------------------------------------------------------------------------------------------
# Progress and memory (precompute only)
# ----------------------------------------------------------------------------------------------------

PEAK = 0.0


def gpu_gb():
    """What the GPU holds right now, in GB (reserved, cache included). MPS has no peak counter, so PEAK is sampled."""
    global PEAK
    now = (torch.mps.driver_allocated_memory() / 1e9 if torch.backends.mps.is_available() else
           torch.cuda.memory_reserved() / 1e9 if torch.cuda.is_available() else 0.0)
    PEAK = max(PEAK, now)
    return now


def free():
    """Give the allocator's cache back. `del` the model first — this cannot reach the caller's names."""
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()


def chunks(tag, n, size):
    """`range(0, n, size)`, plus one rewritten line with the rate, the estimate and the GPU."""
    t0 = time.time()
    for done, i in enumerate(range(0, n, size)):
        yield i
        seen = min(i + size, n)
        if done % 5 == 4 or seen == n:
            rate = seen / max(time.time() - t0, 1e-9)
            print(f"\r  {tag} {seen:,}/{n:,}  {rate:,.1f}/s  eta {(n - seen) / rate:4.0f}s  gpu {gpu_gb():4.1f} GB   ",
                  end="", flush=True)
    print(flush=True)


# ----------------------------------------------------------------------------------------------------
# Shared with the notebook
# ----------------------------------------------------------------------------------------------------

df = pd.read_csv("data/gonzo_dump.csv")

# --- notebook: golden ---
test_df = pd.read_excel("data/golden_mock.xlsx")

# The golden quotes are retold, not copied: only 5 of 20 occur in a post verbatim. So the gold is the post itself —
# the 20 questions are about 7 posts, two or three questions each (checked by reading the posts).
test_df["post_id"] = [3691] * 3 + [2598] * 3 + [2718] * 3 + [2745] * 3 + [2202] * 3 + [3183] * 2 + [3370] * 3

# Questions the corpus cannot answer: six from machine learning that the channel never covered, four from elsewhere.
# Checked by searching the dump for their key terms.
no_answer = [
    "Чем XGBoost отличается от LightGBM при построении деревьев?",
    "Какой результат показала Gemini 3 на бенчмарке ARC-AGI-2?",
    "Как работает GraphSAGE и чем он отличается от GCN?",
    "Как выбрать число кластеров в k-means?",
    "Почему случайный лес меньше переобучается, чем одно решающее дерево?",
    "Как устроен negative sampling в word2vec?",
    "Как сварить борщ?",
    "Как оформить налоговый вычет за лечение зубов?",
    "Во сколько открывается Третьяковская галерея по воскресеньям?",
    "Как взять ипотеку под семейную ставку?",
]
# --- end ---

# --- notebook: documents ---
doc_list = RecursiveCharacterTextSplitter().split_documents([
    Document(page_content=row["text"], metadata={"title": row["id"]})
    for _, row in df.iterrows()
])
# --- end ---


# --- notebook: evaluate ---
def gold_rank(docs, gold_id):
    """1-based position of the first document from the gold post, None if it is not there."""
    return next((i for i, d in enumerate(docs, start=1) if d.metadata.get("title") == gold_id), None)


def summarize(ranks, k_values=(1, 3, 5, 10)):
    """Hit rate@k (one relevant post per question, so it is recall@k), MRR and NDCG@k from the gold ranks."""
    n = len(ranks)
    return {
        "Hit@k": {k: sum(1 for r in ranks if r and r <= k) / n for k in k_values},
        "MRR": sum(1 / r for r in ranks if r) / n,
        "NDCG@k": {k: sum(1 / np.log2(r + 1) for r in ranks if r and r <= k) / n for k in k_values},
    }


def evaluate_retriever(retriever_fn, test_df, k=10):
    """Run the retriever on every golden question; return the metrics and the rank of the gold post per question."""
    ranks = [gold_rank(retriever_fn(q)[:k], gid) for q, gid in zip(test_df["question"], test_df["post_id"])]
    return {**summarize(ranks), "ranks": ranks}
# --- end ---


# --- notebook: prompts ---
QE_SYSTEM = ("Ты LLM-инженер и должен перефразировать вопросы пользователя, исправив грамматику, но не меняя смысла. "
             "Отвечай только перефразированным вопросом, без пояснений.")
HYDE_SYSTEM = ("Напиши короткий (2-3 предложения) гипотетический ответ на вопрос, как если бы он был фрагментом "
               "документа в базе знаний. Только текст ответа, без пояснений.")
CRAG_SYSTEM = ("Ты классификатор релевантности. Ответь ТОЛЬКО \"yes\" или \"no\": содержит ли контекст информацию, "
               "достаточную для ответа на вопрос?")
RAG_ROLE = "Ты — ассистент, отвечающий на вопросы по контексту ниже."
RAG_IDK = "Если в контексте нет ответа, явно скажи об этом."


def rag_messages(question, context=None, idk=True):
    """The notebook's rag_prompt, with its parts switchable: no context = closed book; idk = the "say so" line."""
    if context is None:
        return [{"role": "user", "content": f"Вопрос: {question}\n\nОтвет:"}]
    head = RAG_ROLE + ("\n" + RAG_IDK if idk else "")
    return [{"role": "user", "content": f"{head}\n\nКонтекст:\n{context}\n\nВопрос: {question}\n\nОтвет:"}]


def judge_messages(question, context, answer, strict=False):
    strictness = " Будь строг: снижай оценку даже за незначительные отклонения." if strict else ""
    prompt = (f"Оцени качество ответа на вопрос.{strictness}\n\n"
              f"Вопрос: {question}\nКонтекст: {context}\nОтвет: {answer}\n\n"
              "Верни JSON строго в таком формате (только JSON, без пояснений):\n"
              '{"relevance": <число 0-5>, "faithfulness": <число 0-5>}')
    return [{"role": "user", "content": prompt}]


def parse_judge(raw):
    m = re.search(r"\{[^}]+\}", raw)
    try:
        s = json.loads(m.group()) if m else {}
        return {"relevance": int(s.get("relevance", -1)), "faithfulness": int(s.get("faithfulness", -1))}
    except (json.JSONDecodeError, ValueError, TypeError):
        return {"relevance": -1, "faithfulness": -1}


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)
# --- end ---


# ----------------------------------------------------------------------------------------------------
# Precompute only
# ----------------------------------------------------------------------------------------------------

class Cached(Embeddings):
    """Hands LangChain the vectors computed once, so the Qdrant check costs no second pass of bge-m3."""
    def __init__(self, table):
        self.table = table
        self.dim = len(next(iter(table.values())))

    def embed_documents(self, texts):
        # QdrantVectorStore probes the dimension with "dummy_text"; anything else must already be in the table
        return [self.table[t].tolist() if t != "dummy_text" else [0.0] * self.dim for t in texts]

    def embed_query(self, text):
        return self.table[text].tolist()


def child_docs():
    """The notebook's child_splitter applied to every parent, as ParentDocumentRetriever does it."""
    child_splitter = RecursiveCharacterTextSplitter(chunk_size=120, chunk_overlap=0)
    out = []
    for p, d in enumerate(doc_list):
        for c in child_splitter.split_documents([d]):
            c.metadata["parent"] = p
            out.append(c)
    return out


def embedder(device):
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name=EMBEDDER, model_kwargs={"device": str(device)},
                                 encode_kwargs={"normalize_embeddings": True, "batch_size": 16})


def embed(emb, texts, tag, size=64):
    out = []
    for i in chunks(tag, len(texts), size):
        out.append(np.asarray(emb.embed_documents(texts[i:i + size]), dtype=np.float32))
    return np.concatenate(out)


def parent_order(child_scores, children, k=10):
    """ParentDocumentRetriever: children by score, their parents in order of first appearance."""
    seen = []
    for j in np.argsort(-child_scores, kind="stable"):
        p = children[j].metadata["parent"]
        if p not in seen:
            seen.append(p)
            if len(seen) == k:
                break
    return seen


def step_dense(device):
    from langchain_qdrant import QdrantVectorStore
    from langchain_classic.retrievers import ParentDocumentRetriever
    from langchain_core.stores import InMemoryStore
    from rapidfuzz import fuzz

    children = child_docs()
    questions = list(test_df["question"]) + no_answer
    log(f"    {len(doc_list)} documents, {len(children)} child chunks, {len(questions)} questions")
    emb = embedder(device)
    t = time.time()
    V_doc = embed(emb, [d.page_content for d in doc_list], "documents", 16)
    V_child = embed(emb, [c.page_content for c in children], "children", 128)
    V_q = np.asarray(emb.embed_documents(questions), dtype=np.float32)   # bge-m3: no query prefix, same call
    secs = time.time() - t
    del emb
    free()
    np.savez_compressed(f"{ART}/vectors.npz", doc=V_doc.astype(np.float16), child=V_child.astype(np.float16),
                        q=V_q.astype(np.float16))

    S_doc, S_child = V_q @ V_doc.T, V_q @ V_child.T
    gold = list(test_df["post_id"])
    dense_order = [list(np.argsort(-s, kind="stable")[:POOL]) for s in S_doc]
    pd_order = [parent_order(s, children, POOL) for s in S_child]
    rank_of = lambda order, g: next((i for i, p in enumerate(order[:10], 1) if doc_list[p].metadata["title"] == g), None)
    dense_ranks = [rank_of(dense_order[i], gold[i]) for i in range(len(gold))]
    pd_ranks = [rank_of(pd_order[i], gold[i]) for i in range(len(gold))]

    # the notebook as it ran: PD's children were added to the same collection, then Qdrant was asked with k = 4
    # and scored by fuzzy match >= 80 against the golden quote
    mixed = np.concatenate([S_doc, S_child], axis=1)
    mixed_text = [d.page_content for d in doc_list] + [c.page_content for c in children]
    asis = []
    for i in range(len(gold)):
        top = np.argsort(-mixed[i], kind="stable")[:4]
        asis.append(next((r for r, j in enumerate(top, 1) if fuzz.partial_ratio(test_df["text"][i], mixed_text[j]) >= 80), None))

    # check: Qdrant and ParentDocumentRetriever on the same vectors return the same ranking
    table = {t: v for t, v in zip([d.page_content for d in doc_list], V_doc)}
    table.update({t: v for t, v in zip([c.page_content for c in children], V_child)})
    table.update({t: v for t, v in zip(questions, V_q)})
    cached = Cached(table)
    qdrant = QdrantVectorStore.from_documents(doc_list, cached, location=":memory:", collection_name="documents")
    qd = qdrant.as_retriever(search_kwargs={"k": 10})
    agree_dense = sum(gold_rank(qd.invoke(q), g) == r for q, g, r in zip(test_df["question"], gold, dense_ranks))
    from qdrant_client import QdrantClient, models
    client = QdrantClient(":memory:")
    client.create_collection("children", vectors_config=models.VectorParams(size=V_doc.shape[1], distance=models.Distance.COSINE))
    child_store = QdrantVectorStore(client=client, collection_name="children", embedding=cached)
    # its own collection (in the notebook the children went into the documents' one); a deep child search so that
    # ten distinct parents are always among the hits
    pdr = ParentDocumentRetriever(vectorstore=child_store, docstore=InMemoryStore(),
                                  child_splitter=RecursiveCharacterTextSplitter(chunk_size=120, chunk_overlap=0),
                                  search_kwargs={"k": 400})
    pdr.add_documents(doc_list)
    agree_pd = sum(gold_rank(pdr.invoke(q)[:10], g) == r for q, g, r in zip(test_df["question"], gold, pd_ranks))
    log(f"    LangChain agrees with numpy: dense {agree_dense}/20, parent-document {agree_pd}/20")

    art = {"device": str(device), "model": EMBEDDER, "seconds_embed": round(secs, 1),
           "n_docs": len(doc_list), "n_children": len(children), "child_chunk_size": 120,
           "questions": questions, "n_golden": len(gold),
           "doc_scores": np.round(S_doc, 4).tolist(),
           "dense_order": [[int(x) for x in o] for o in dense_order],
           "pd_order": [[int(x) for x in o] for o in pd_order],
           "pd_best_child": [[{"child": int(j), "parent": children[j].metadata["parent"], "score": round(float(S_child[i, j]), 4),
                               "text": children[j].page_content} for j in np.argsort(-S_child[i], kind="stable")[:5]]
                             for i in range(len(questions))],
           "dense_ranks": dense_ranks, "pd_ranks": pd_ranks, "notebook_as_ran_qdrant_ranks": asis,
           "check": {"qdrant_vs_numpy": agree_dense, "parent_document_vs_numpy": agree_pd}}
    for name, rk in [("dense", dense_ranks), ("parent-document", pd_ranks), ("as ran (k=4, fuzzy, mixed)", asis)]:
        s = summarize(rk)
        log(f"    {name:28s} MRR {s['MRR']:.3f}  Hit@1 {s['Hit@k'][1]:.2f}  Hit@10 {s['Hit@k'][10]:.2f}")
    json.dump(art, open(f"{ART}/dense.json", "w"), ensure_ascii=False)


def bm25_retriever(k):
    from langchain_community.retrievers import BM25Retriever
    r = BM25Retriever.from_documents(doc_list)
    r.k = k
    return r


def ensemble_order(question, bm25, dense_idx):
    """EnsembleRetriever(weights=[0.5, 0.5]) over BM25 and dense, as document indices (dedup by content, as it does)."""
    from collections import defaultdict
    content = [d.page_content for d in doc_list]
    first = {}
    for i, c in enumerate(content):
        first.setdefault(c, i)
    lists = [[first[d.page_content] for d in bm25.invoke(question)], [first[content[j]] for j in dense_idx]]
    score = defaultdict(float)
    for lst in lists:
        for rank, j in enumerate(lst, start=1):
            score[j] += 0.5 / (rank + 60)
    seen, order = set(), []
    for j in lists[0] + lists[1]:
        if j not in seen:
            seen.add(j)
            order.append(j)
    return sorted(order, key=lambda j: -score[j])


def step_rerank(device):
    from langchain_community.cross_encoders import HuggingFaceCrossEncoder
    dense = json.load(open(f"{ART}/dense.json"))
    bm25 = bm25_retriever(POOL)
    pools = [ensemble_order(q, bm25, dense["dense_order"][i])[:POOL] for i, q in enumerate(test_df["question"])]
    cross_encoder = HuggingFaceCrossEncoder(model_name=RERANKER, model_kwargs={"device": str(device)})
    n_params = sum(p.numel() for p in cross_encoder.client.model.parameters())
    scores, t = [], time.time()
    for i in chunks("questions", len(pools), 1):
        q = test_df["question"][i]
        pairs = [(q, doc_list[j].page_content) for j in pools[i]]
        scores.append(np.asarray(cross_encoder.client.predict(pairs, batch_size=8, show_progress_bar=False), dtype=float).ravel())
    secs = time.time() - t
    del cross_encoder
    free()
    art = {"device": str(device), "model": RERANKER, "params": n_params, "pool": POOL,
           "seconds": round(secs, 1), "seconds_per_pair": round(secs / (len(pools) * POOL), 4),
           "pool_order": [[int(j) for j in p] for p in pools], "scores": [np.round(s, 4).tolist() for s in scores]}
    for k in (10, 20, 50):
        rk = []
        for i, p in enumerate(pools):
            cand = p[:k]
            order = [cand[j] for j in np.argsort(-scores[i][:k], kind="stable")][:10]
            rk.append(next((r for r, j in enumerate(order, 1) if doc_list[j].metadata["title"] == test_df["post_id"][i]), None))
        log(f"    rerank top-{k:<3d} MRR {summarize(rk)['MRR']:.3f}")
    json.dump(art, open(f"{ART}/rerank.json", "w"), ensure_ascii=False)


def load_generator(device):
    from transformers import pipeline
    dtype = torch.float16 if device.type == "cuda" else torch.bfloat16 if device.type == "mps" else torch.float32
    gen = pipeline("text-generation", model=GENERATOR, device=device, dtype=dtype)
    gen.tokenizer.padding_side = "left"
    # the checkpoint's generation_config keeps Qwen's pad id (151 643), past ruadapt's 147 097-token vocabulary: a batch
    # that pads a finished sequence with it indexes past the embedding table. The tokenizer's own pad id is the right one.
    gen.model.generation_config.pad_token_id = gen.tokenizer.pad_token_id
    if getattr(gen, "generation_config", None) is not None:      # the pipeline keeps a copy of its own
        gen.generation_config.pad_token_id = gen.tokenizer.pad_token_id
    return gen


def generate(gen, batch, max_new_tokens, tag):
    """Greedy, one conversation at a time — as the notebook calls it, so no padding (whose id this checkpoint gets wrong)."""
    out = []
    for i in chunks(tag, len(batch), 1):
        res = gen(batch[i], max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=gen.tokenizer.pad_token_id)
        out.append(res[0]["generated_text"][-1]["content"].strip())
    return out


def step_llm(device):
    dense = json.load(open(f"{ART}/dense.json"))
    questions = dense["questions"]
    golden = list(test_df["question"])
    gen = load_generator(device)
    t0 = time.time()
    qe = generate(gen, [[{"role": "system", "content": QE_SYSTEM}, {"role": "user", "content": q}] for q in golden], 64, "query expansion")
    hyde = generate(gen, [[{"role": "system", "content": HYDE_SYSTEM}, {"role": "user", "content": q}] for q in golden], 128, "HyDE")
    top1 = [doc_list[o[0]].page_content for o in dense["dense_order"]]
    crag_raw = generate(gen, [[{"role": "system", "content": CRAG_SYSTEM},
                               {"role": "user", "content": f"Вопрос: {q}\n\nКонтекст:\n{c}"}] for q, c in zip(questions, top1)], 10, "CRAG")
    ctx3 = [format_docs([doc_list[j] for j in o[:3]]) for o in dense["dense_order"]]
    answers = {
        "closed book": generate(gen, [rag_messages(q) for q in questions], 128, "closed book"),
        "context": generate(gen, [rag_messages(q, c, idk=False) for q, c in zip(questions, ctx3)], 128, "context"),
        "context + say so": generate(gen, [rag_messages(q, c, idk=True) for q, c in zip(questions, ctx3)], 128, "context + say so"),
    }
    judged = generate(gen, [[{"role": "user", "content": f"Контекст:\n{c}\n\nВопрос: {q}\n\nОтвет:"}]
                            for q, c in zip(golden, test_df["text"])], 128, "answers for the judge")
    j1 = generate(gen, [judge_messages(q, c, a) for q, c, a in zip(golden, test_df["text"], judged)], 64, "judge")
    j2 = generate(gen, [judge_messages(q, c, a, strict=True) for q, c, a in zip(golden, test_df["text"], judged)], 64, "strict judge")
    secs_llm = time.time() - t0
    del gen
    free()

    emb = embedder(device)
    V_doc = np.load(f"{ART}/vectors.npz")["doc"].astype(np.float32)
    ranks, tops = {}, {}
    for name, texts in [("query expansion", qe), ("HyDE", hyde)]:
        S = np.asarray(emb.embed_documents(texts), dtype=np.float32) @ V_doc.T
        order = [np.argsort(-s, kind="stable")[:10] for s in S]
        ranks[name] = [next((r for r, j in enumerate(o, 1) if doc_list[j].metadata["title"] == g), None)
                       for o, g in zip(order, test_df["post_id"])]
        tops[name] = [[[int(j), round(float(s[j]), 4)] for j in o] for o, s in zip(order, S)]
        log(f"    {name:16s} MRR {summarize(ranks[name])['MRR']:.3f}")
    del emb
    free()
    art = {"device": str(device), "model": GENERATOR, "greedy": True, "seconds_generation": round(secs_llm, 1),
           "qe": qe, "hyde": hyde, "qe_ranks": ranks["query expansion"], "hyde_ranks": ranks["HyDE"],
           "qe_top": tops["query expansion"], "hyde_top": tops["HyDE"],
           "crag_raw": crag_raw, "crag_yes": ["yes" in r.lower() for r in crag_raw],
           "answer_context_docs": [o[:3] for o in dense["dense_order"]], "answers": answers,
           "judge_answers": judged, "judge": [parse_judge(r) for r in j1], "judge_strict": [parse_judge(r) for r in j2],
           "judge_raw": j1, "judge_strict_raw": j2}
    log(f"    CRAG says yes: golden {sum(art['crag_yes'][:20])}/20, no-answer {sum(art['crag_yes'][20:])}/10")
    json.dump(art, open(f"{ART}/llm.json", "w"), ensure_ascii=False, indent=0)


STEPS = {"dense": step_dense, "rerank": step_rerank, "llm": step_llm}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="+", choices=list(STEPS), default=list(STEPS))
    ap.add_argument("--cpu", action="store_true", help="ignore the GPU (when the machine is short of memory)")
    args = ap.parse_args()
    os.makedirs(ART, exist_ok=True)
    device = torch.device("cpu" if args.cpu else "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    total = (torch.cuda.get_device_properties(0).total_memory / 1e9 if device.type == "cuda" else
             torch.mps.recommended_max_memory() / 1e9 if device.type == "mps" else 0)
    log(f"device {device} ({total:.1f} GB), steps {args.only}")
    for step in args.only:
        globals()["PEAK"] = 0.0
        t = time.time()
        log(f"--- {step}")
        STEPS[step](device)
        gpu_gb()
        log(f"    {step}: {time.time() - t:.0f}s, GPU peak {PEAK:.1f} GB")
        free()


if __name__ == "__main__":
    main()
