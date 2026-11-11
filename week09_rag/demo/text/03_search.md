# search

## search-p1

Three families: sparse (TF-IDF, BM25 — they count word matches), dense (cosine between the encoder's vectors) and the ensemble (Reciprocal Rank Fusion — it adds up ranks, not scores). Each loses on its own kind of query; pick a question and see where.

## arena-hint

Pick a question — the gold post is green; or type your own text and press Enter. Free text works only for the lexical columns: the encoder cannot be run in the browser, its vectors for the fixed questions were computed in advance.

## arena-check

BM25 here is computed in the browser over all {docs} documents, with the same formula and the same tokens as `rank_bm25`; its top-10 scores equal Python's on {okSplit}/{n} questions (`str.split`) and {okLower}/{n} (lower case). The ensemble's order equals LangChain's `EnsembleRetriever` on {okEns}/{n}.

## bet-tok

`BM25Retriever` splits text with `str.split()`, so for it `LoRA,` and `lora` are two different words. Lower-case everything and drop the punctuation: does MRR move by more than one question's worth?

## tok-note

MRR {a} → {b}, Hit@1 {c} → {d}: {delta} questions' worth. The tokenizer is not a detail of BM25 — it decides which words exist.

## how-tok

lower case? No: `text.split()` — words are whatever stands between spaces, punctuation included. The lower-case column uses `re.findall(r"\w+", text.lower())`.

## how-bm25

saturation in the term's frequency ($k_1 = 1.5$) and a penalty for the document's length ($b = 0.75$); the score has no upper bound

## how-dense

the vectors of the documents and of the fixed questions were computed in advance, so for free text this column is empty

## how-rrf

ranks are added, not scores: BM25, cosine and TF-IDF live on different scales

## bet-rrf

Why does the ensemble add up ranks and not the scores themselves?

## rrf-answer

The scores are not comparable: BM25 runs from 0 to infinity, cosine from −1 to 1. Normalising them on the fly is not honest (BM25 has no upper bound), while any method has a rank. The price: RRF does not know how far the first one is ahead of the second.

## search-code-note

The notebook's cell. `weights=[0.5, 0.5]`, and a constant `c = 60` that is not in the call: it is the default.
