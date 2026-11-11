# Week 9 — Information Retrieval (lecture) and RAG (seminar)

**Lecture** (`demo/week09_lecture.html`, published as `/week09/lecture/`): information retrieval as questions — the task
and relevance, rank metrics, the inverted index and BM25, query and document expansion, bi-encoders and contrastive
training, approximate nearest neighbours, rank fusion, cross-encoders and late interaction, chunking, and RAG as an
application of retrieval.

**Seminar** (`week09_rag.ipynb`, demo `demo/week09_demo.html`): a RAG pipeline in LangChain over 830 posts of the
Telegram channel gonzo_ML, with a golden set of 20 questions about 7 posts and 10 questions the corpus cannot answer.
Qdrant + bge-m3, parent-document retrieval, BM25 and the ensemble, query expansion, HyDE, a cross-encoder reranker,
CRAG, an LLM judge. The questions are scored by the gold *post*: the first version scored them by fuzzy match against
retold quotes, which capped every retriever at 13 of 20.

    uv run python precompute.py            # bge-m3, bge-reranker-v2-m3 and a 3B ruadapt Qwen over the 30 questions
    uv run python export_demo_data.py      # artifacts/demo_data.json (BM25 and the checks on the CPU)
    uv run python export_lecture_data.py   # the lecture's one measured example

The corpus and the golden set (`data/`) live on the Hugging Face Hub (`scripts/hub.py`); the notebook pulls them.
