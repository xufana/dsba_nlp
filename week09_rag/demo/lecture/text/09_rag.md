# rag · retrieval for a language model

## s-rag

**RAG** = retrieve → put into the prompt → answer from it. The knowledge moves from the weights to the index: updatable, restricted per user, citable.

## rag-p1

A language model knows what was in its training data, up to its cutoff, and invents fluently past it. **Retrieval-augmented generation** (Lewis et al., 2020) puts the search in front: retrieve the passages for the question, put them into the prompt, let the model answer from them. The knowledge moves from the weights to the index, where it can be updated, restricted per user and cited. Everything on this page is the first half of that pipeline.

## rag-caption

Five places to intervene: the query, the search method, the encoder, the reranker, the generation.

## s-rag2

When the reader is a model:

- the budget is the context window → **Recall@k at a small $k$**
- it has to notice **when the context is not enough**
- the **position** in the prompt matters (lost in the middle)
- **two evaluations**: did retrieval bring the passage, did the model answer from it

## rag-p2

What changes when the reader is a model rather than a person:

- **the budget is the context window and the cost per token**: the top $k$ goes in whole, so Recall@k at a small $k$ is the number that matters, and precision costs money;
- **the model has to notice when the context is not enough** — a ranking always has a first document, and a model given a context tends to use it. "Answer only from the context, say so if it is not there" in the prompt helps; a second call that judges whether the context suffices (corrective RAG) helps more; a threshold on the best similarity is the obvious fix and rarely works, because the scores of answerable and unanswerable questions overlap;
- **where a passage sits in the prompt matters**: models use the beginning and the end of a long context better than its middle (Liu et al., 2024, "lost in the middle");
- **two evaluations, not one**: did the retriever bring the right passage (the metrics of block 01), and did the model answer correctly *from* it (faithfulness to the context, correctness of the answer). A wrong answer with the right passage in the context is the generator's failure; a wrong answer without it is the retriever's.

## q-blame · pick

A RAG system answered wrongly. For this question, the passage that contains the answer was second in the retrieved top 5, and all five were in the prompt. Where do you look first?

- [ ] the encoder: it should have ranked the passage first
- [ ] the chunk size: the passage was too short
- [x] the generation side: the prompt, the model, the position of the passage, distracting passages around it
- [ ] the index: an ANN index lost the passage

> The retriever did its job by the measure that matters for a prompt — the passage was in the top 5. The failure is downstream: the model ignored or misread the context, a neighbouring passage contradicted it, the instruction did not ask for an answer from the context. Separating the two evaluations is what makes this diagnosis possible.
> miss: if the encoder was blamed: rank 2 versus rank 1 does not change what the model sees when all five are pasted in.

## blame-caption

The row tells whose failure it is.

## q-threshold · pick

To stop the model from answering when the collection has nothing, you refuse whenever the best cosine is below a threshold. Why does this rarely work?

- [ ] cosines cannot be compared between queries
- [x] the best scores of answerable and unanswerable questions overlap: a question near the collection's topic but not covered by it scores as high as a covered one
- [ ] the threshold has to be computed for every document
- [ ] it works only for BM25 scores

> A question that is *about* the collection's subject but asks for something not in it — a method the channel never reviewed, a product the shop does not sell — has neighbours that are topically close, and its best score lands among the answerable ones, or just below them. On {n_posts} posts of a Russian ML channel, with {n_golden} answerable questions and {n_noanswer} unanswerable ones, the lowest answerable scored {g_min} and the highest unanswerable {n_max}: separated, by {gap} of cosine — a gap that the next question, or a new encoder, closes. Any threshold either refuses answerable questions or lets those through, and it moves whenever the encoder or the collection changes. Judging sufficiency needs to read the passage against the question: a cross-encoder or a model.
> miss: if "cannot be compared between queries" was picked: for a normalised encoder they can, on one scale; the problem is not the scale but that the two groups share it.

## strip-caption

The best cosine of each question: green — answerable ({n_golden}), red — not ({n_noanswer}). The gap is {gap}.
