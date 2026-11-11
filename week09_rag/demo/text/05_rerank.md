# rerank

## rerank-p1

A reranker is a language model that takes two texts and returns how close they are. Cheap: select candidates with the bi-encoder and BM25; expensive: rerank only those with a cross-encoder, which sees the pair "query–document" as a whole. As the reranker we use a multilingual model trained for exactly this, `BAAI/bge-reranker-v2-m3`.

## f8-cap

ReRank: light retrieval selects candidates from the whole collection; the cross-encoder sees the pair "query–document" as a whole and reorders only them.

## bet-rerank

More candidates for the reranker: does quality keep growing all the way to 50?

## rerank-note

With {k} candidates: MRR {mrr}, Hit@1 {h1}; {sec} s of the cross-encoder per query on {device}. Without the reranker the same ensemble gives MRR {base}. The reranker cannot bring up what the pool does not hold: Hit@{k} of the pool is {recall}.

## rerank-code-note

The notebook's cell. `cross_encoder.score` runs the model on every pair: the cost grows linearly with `k_candidates`.
