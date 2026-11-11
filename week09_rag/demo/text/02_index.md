# index

## index-p1

To encode documents and queries we use **`BAAI/bge-m3`** — a symmetric multilingual model that needs no special prefixes for queries. The documents go into Qdrant, in memory; the retriever is the store's `as_retriever()`.

## bet-k

`qdrant.as_retriever()` with no arguments — how many documents does it return for a query?

## k-note

Four: LangChain's default `k`, for every retriever, `BM25Retriever` too. The first run of the notebook compared Qdrant at four against BM25 at ten. Everything on this page is a top-10.

## index-code-note

The notebook's cells, as they are.

## pd-p1

Now let's split everything into chunks: the parent-document retriever, which does well on long texts. Small children are what gets searched — a short piece is close to a short question; the parent it came from is what gets returned — the model needs the whole context.

## f6-cap

Chunking: the text is cut into chunks with an overlap, so that a fact on the border is not lost. The chunk size is bounded by the input length of the bi-encoder.

## pd-note

The {children} children of the {docs} documents, 120 characters each, no overlap. Highlighted: the five children closest to the question, in the parent they came from. Gold post: rank {pd} by parent-document, rank {dense} by plain dense search.

## pd-trap

The children get their own collection. In the first run of the notebook they went into `qdrant` itself, next to the full documents — and the plain dense search above searched the 120-character pieces too.

## symm-p1

**Symmetric search.** Index the questions to a text instead of the text itself: a user's question looks like a question, not like a paragraph of a review. The answer is linked to its question and comes along. Where the questions come from: an LLM per chunk, experts by hand, and above all the real queries of users, added as they come — the index grows with the product.

## f7-cap

Symmetric search: on top, the query is compared with answers; below, with questions to the answers, which are closer to it in form; the answer comes by the link "question → answer".
