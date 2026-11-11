# dense · bi-encoders

## s-lanes

- **offline**, once per document: encode every document → keep the vectors in a **vector store**
- **online**, per query: encode only the query → look up the nearest vectors (exactly, or with an ANN index)

## dense-lead

**Offline and online.** Every retriever splits its work in two. *Offline*, when the collection changes: read every document once and store what the search will need — postings lists for words, vectors for meaning — in an index. *Online*, per query: process only the query and look the answer up in the index. That is what lets a neural network take part at all: the expensive pass over every document happens once, ahead of time, and a query pays for one forward pass of its own and a lookup. For vectors, the index is a **vector store** (FAISS, Qdrant, pgvector, …): it keeps the document vectors with their metadata and answers "the $k$ nearest to this vector" — exactly, or approximately and much faster (block 04).

## lanes-caption

The same encoder on both lanes; only the lookup grows with the collection.

## s-bienc

**Bi-encoder:** each text → one vector, on its own; the score is a dot product. The words need not match — the meaning has to.

## dense-p1

**Dense retrieval** replaces the bag of words with one vector per text. A transformer encoder (lecture 4) reads the text; its token states are pooled — the `[CLS]` state, or the mean — into a vector $e(x) ∈ ℝ^d$; the score is a dot product or a cosine. This is a **bi-encoder**: query and document never see each other; each becomes a vector on its own, and they meet only in the dot product. Two texts with no word in common can be close, if the encoder was trained to put them close. That is what makes it fast — and what limits it, as block 06 shows.

## bienc-caption

Tokens → encoder → token states → mean → one vector. The passage's vector never sees the question.

## s-train

**Contrastive training:** pull (query, its passage) together, push the other passages away. What the model learns depends on **which** passages it is pushed away from — the negatives.

## dense-p2

**How it is trained.** A pretrained encoder does not put questions next to their answers by itself: the mean of BERT's token states is a poor retriever out of the box. It is trained contrastively, on pairs (query, relevant passage): pull the pair together, push the query away from passages that are not its own. With a batch of $B$ pairs, the other $B − 1$ passages of the batch serve as negatives for free — **in-batch negatives**:

## inbatch-caption

Diagonal — positives; every other cell — a free negative. The button adds one hard negative per pair.

## dense-p3

Random negatives are easy: a passage about cooking is far from a question about attention anyway. The model learns more from **hard negatives** — passages that look relevant and are not, typically the top results of BM25 that are not marked relevant. DPR (Karpukhin et al., 2020) added one BM25 negative per question to the in-batch ones; modern models (E5, BGE) are pretrained this way on hundreds of millions of pairs, then fine-tuned on labelled data.

## q-inbatch · fill

A batch of [[b]] pairs. How many negatives does each query get from the batch, and how many query–passage scores does the batch compute?

negatives per query: [[neg]] · scores in the batch: [[scores]]

- b = @b
- neg = @neg
- scores = @scores

> Every other passage of the batch is a negative: $B − 1$ per query. The score matrix is $B × B$: $B$ positives on the diagonal, $B(B − 1)$ negatives off it, all from one matrix multiplication of vectors that were computed anyway. That is why these models are trained with batches of thousands of pairs: more negatives per step at almost no extra cost.
> miss: if the scores came out as $2B$: the vectors are $2B$, but the scores are every query against every passage.

## s-neg

Where the negatives come from — from easy to hard:

- **random** — any document · **in-batch** — the other pairs' passages
- **BM25** — share words with the query, are not the answer
- **hard, by cosine** — the model's own nearest neighbours (ANCE)

The harder the negative, the more it teaches — and the likelier it is **relevant after all**.

## negs-caption

Each row: where one strategy's negatives sit relative to the query. The closest ones include relevant documents nobody labelled — false negatives.

## neg-table

<table class="asym">
<tr><th></th><th>the negatives</th><th>the minus</th></tr>
<tr><td><b>random</b></td><td>any document of the collection</td><td>too easy: far from the query, the loss is already near zero — little to learn</td></tr>
<tr><td><b>in-batch</b></td><td>the other pairs' passages, for free</td><td>just as random; their number is capped by the batch size, i.e. by memory; a near-duplicate question in the batch becomes a false negative</td></tr>
<tr><td><b>BM25</b></td><td>the top of BM25 without the positive</td><td>hard only in words: teaches not to trust word overlap, nothing about meaning; some are relevant</td></tr>
<tr><td><b>hard, by cosine</b></td><td>the nearest by the model's own cosine, from an ANN index</td><td>the most useful and the most dangerous: many are <b>false negatives</b> — relevant but unlabelled; the index goes stale as the model trains and has to be rebuilt</td></tr>
</table>

## dense-neg

**Negative mining.** The loss pushes the query away from its negatives, and how far they already are decides how much it learns. Random documents are far away: their term in the softmax is already tiny, the gradient is near zero. In-batch negatives are the same random documents, only free — the encoder computed them anyway — and modern models are trained with batches of thousands of pairs precisely to get more of them; a near-duplicate question elsewhere in the batch quietly becomes a negative for its twin. BM25 negatives (DPR, Karpukhin et al., 2020) look relevant by their words: the model learns that word overlap is not enough. The hardest are the model's own mistakes: encode the collection, take each query's nearest neighbours by cosine and use those that are not the positive (**ANCE**, Xiong et al., 2021). They teach the most and bring two problems. The index is computed with an older version of the model and has to be refreshed during training. And among the nearest neighbours are documents that *do* answer the question but were never labelled — the incompleteness of the pool, now inside the training data; pushing them away teaches the model to separate true matches. The fixes: re-score the candidates with a cross-encoder and drop the ones it calls relevant (**RocketQA**, Qu et al., 2021), or drop every candidate whose score comes too close to the positive's (**NV-Retriever**, Moreira et al., 2024).

## s-asym

**Asymmetric models** (E5) need prefixes, `query: ` and `passage: `. A wrong prefix raises no error — the numbers are just lower.

## dense-p4

**Symmetric and asymmetric.** A question and a passage are different kinds of text. Asymmetric models mark which is which: E5 expects `query: ` before a query and `passage: ` before a document, and was trained so that a query lands near the passages that answer it. Symmetric models (bge-m3, sentence-similarity models) treat both sides the same and are trained on pairs of the same kind as well. Using an asymmetric model without its prefixes, or with the wrong one on the documents, quietly costs quality: nothing fails, the numbers are just lower.

## q-asym · pick

You index with `intfloat/multilingual-e5-large` and, by mistake, put `query: ` in front of every *document* as well. What happens?

- [ ] an error: the model refuses unknown prefixes
- [ ] nothing: the prefix is a convention, the vectors are the same
- [x] search works, but worse: the documents are encoded as if they were questions, so a question now looks for other questions
- [ ] the index becomes twice as large

> The prefix is part of the input, and the model was trained with it: `query: ` texts were pulled towards `passage: ` texts. Documents encoded as queries land in the queries' region of the space, and the nearest ones to a new question are the documents that *read like questions*. Nothing raises an error — which is why it is a classic bug, found only by measuring on a golden set.
> miss: if "nothing" was picked: a prefix of two tokens changes every token state after it through attention, so the pooled vector changes too.

## prefix-caption

Encode the documents with `query: ` and the nearest neighbours of a question become question-like documents.
