# rerank · bi-encoders, cross-encoders, late interaction

## s-inter

Where the query meets the document:

- **no interaction** — bi-encoder: one vector each, a dot product
- **late** — ColBERT: a vector per token each, MaxSim
- **early** — cross-encoder: one transformer reads both texts

## rr-p1

**Where the query meets the document.** The neural retrievers differ by *when* the two texts first see each other.

- **No interaction — the bi-encoder** (block 03). Each text becomes one vector on its own; they meet only in a dot product. The whole passage is compressed before anyone knows the question, and whatever the question will ask about must survive that compression.
- **Late interaction — ColBERT** (Khattab & Zaharia, 2020). Each text becomes a vector *per token*, still on its own; they meet at the very end, in MaxSim: every query token finds its best match among the document's tokens, and the matches are summed. Finer than one vector — a rare term in the query can find its token in the passage — and still precomputable.
- **Early interaction — the cross-encoder** (Nogueira & Cho, 2019). Query and passage are concatenated, `[CLS] query [SEP] passage`, and read by one transformer: from the first layer on, every token of one attends to every token of the other, and the `[CLS]` state becomes a relevance score. It sees the pair — negation, which entity, which sentence answers — and is the most accurate of the three.

## rr-table

<table class="asym">
<tr><th></th><th>no interaction</th><th>late</th><th>early</th></tr>
<tr><td>document side offline</td><td>one vector</td><td>a vector per token</td><td>nothing: its states depend on the query</td></tr>
<tr><td>per query</td><td>one forward pass + $N$ dot products (or an ANN lookup)</td><td>one forward pass + MaxSim over candidates</td><td>a forward pass per (query, document) pair</td></tr>
<tr><td>storage</td><td>$d$ numbers per document</td><td>$d$ numbers per <i>token</i>: tens to hundreds of times more</td><td>none beyond the text</td></tr>
<tr><td>can search a collection</td><td>yes</td><td>yes, with a special index</td><td>no: only reorder a short list</td></tr>
<tr><td>accuracy</td><td>lowest</td><td>between</td><td>highest</td></tr>
</table>

## enc-caption

Grey — offline, once per document · blue — once per query · orange — once per (query, document) pair.

## q-enc · point

Which of these run a transformer once for *every (query, document) pair*? Click all that do, then Check.

<div data-fig="encoders"></div>

- [ ] bi-doc: the bi-encoder's document encoder
- [ ] bi-q: the bi-encoder's query encoder
- [ ] bi-dot: the bi-encoder's dot product
- [x] cross: the cross-encoder
- [ ] col-doc: ColBERT's document token encoder
- [ ] col-q: ColBERT's query token encoder
- [ ] col-max: ColBERT's MaxSim

> Only the cross-encoder. The bi-encoder and ColBERT encode documents offline and the query once; per pair they do arithmetic on stored vectors — one dot product, or MaxSim over token vectors — no transformer at all. That is why a cross-encoder cannot search a collection, only rerank a short list.
> miss: if MaxSim was ticked: it is per pair, but it is a few matrix products over stored vectors, not a forward pass.

## s-slow

**A cross-encoder is slow:** a forward pass per pair, nothing precomputed — {rr_s_pair} s per pair on an M4: {rr_full} s for all {n_docs} posts, {rr_top20} s for a top 20.

## rr-slow

**Why a cross-encoder is slow.** A bi-encoder's cost per query does not depend on the collection: one forward pass for the query, then arithmetic on stored vectors. A cross-encoder's cost is one forward pass *per pair*, and each pass reads query and passage together, with attention quadratic in their joint length. Nothing of it can be reused for the next query, because every hidden state of the passage depends on the question. Measured: {rr_model} ({rr_params} parameters) on an Apple M4 scores one pair in {rr_s_pair} s. Over the {n_docs} documents of gonzo_ML that is {rr_full} s for a single query; over a first stage's top 20 — {rr_top20} s.

## s-rerank

- **ranking** — the whole collection, cheap per document; the goal is **recall**
- **reranking** — a short list, expensive per document; the goal is **precision at the top**, and it cannot add what was missed
- → a **cascade**: a cheap top 20–100, then the cross-encoder

## rr-task

**Reranking is a different task from ranking.** Ranking orders a whole collection: it must be cheap per document, run from an index, and its job is *recall* — not to lose the relevant document somewhere among millions. Reranking orders a short list somebody else made: it can afford an expensive model per item, its job is *precision at the top* — what comes first — and it cannot add anything: what the first stage missed is gone. So a reranker is judged by MRR or NDCG@10 over its input, and its ceiling is the first stage's recall at the depth it reads. Hence the **cascade**: a cheap retriever selects the top 20–100 out of millions; the cross-encoder reorders only those. And on a short list, models that compare candidates with each other (pairwise, listwise, a language model reading all of them) become affordable too.

## cascade-caption

gonzo_ML, {n_golden} questions. Grey — the first stage's Hit@k, the ceiling; blue — MRR after reranking; dashed — the first stage alone.

## s-cascade

On gonzo_ML the reranker's whole gain comes from **depth**: the missing posts sit at ranks {cas_ranks} of the first stage.

## rr-p2

The arithmetic of the cascade decides how deep the first stage goes. On this corpus the first stage already puts first every post it finds in its top 10 — its MRR, {cas_first}, equals its Hit@10 — so up to depth 10 the reranker has nothing to fix (at depth 2 it even demotes one post). Its whole gain comes from depth: the three remaining posts sit at ranks {cas_ranks} of the fused list, and once the reranker reads them (depth {cas_full}) MRR rises to {cas_mrr_full}. Reading 50 adds nothing. The depth is set by where the first stage's recall stops growing, not by the reranker.

## q-cascade · fill

A collection of [[n]] passages; a cross-encoder reranks the first stage's top [[k]]. How many cross-encoder forward passes does one query cost — with the cascade, and if the cross-encoder had to score the whole collection?

with the cascade: [[with]] · without: [[without]]

- n = @n_coll
- k = @k_pool
- with = @with
- without = @without

> One pass per candidate: $k$ with the cascade, $N$ without. At tens of milliseconds per batch of passages, the first is a fraction of a second and the second is hours — per query. The depth $k$ is the knob: deeper finds what the first stage ranked low, at a cost linear in $k$, and with diminishing returns once the first stage's recall at $k$ stops growing.
> miss: if the cascade's cost came out as $k · N$: the first stage does not run the cross-encoder at all; it is a vector or index lookup.
