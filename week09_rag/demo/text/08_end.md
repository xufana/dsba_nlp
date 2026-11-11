# end

## end-p1

No block is there "just because": each has a default to start from and a lever to pull when the metrics on the golden set do not add up. The loop closes on validation by experts — and goes back to the index.

## f10-cap

The blocks and the loop: after validation by experts, back to the index.

## checklist

1. Are there external documents the correctness of the answer depends on?
    * Yes; is the volume of documents larger than the model's context window?
        * Yes → you need RAG, a retriever / chunking.
        * No → you can try to stuff all the documents into the system prompt.
    * No; we don't use contexts in generation
2. Is the query short and different from the wording of the documents?
    * Yes, slightly → think about different encoders, query expansion, a reranker.
    * Yes, strongly → most likely you should use symmetric search instead of asymmetric
3. Do you need citations / traceability?
    * Yes → do RAG (keeping the sources).
4. Domains with a high cost of error?
    * Yes → RAG + a strict instruction "rely only on the context".

## takeaways

1. Five points of influence and the order in which they are turned: first the data and the index, then the search, then the prompt, and only then the model.
2. Every metric misses something — and the golden set, with what counts as a hit, is needed before the first experiment, not after.
3. A difference of one question on twenty is not a result.

## end-refs

* Lewis et al. (2020). [*Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.*](https://arxiv.org/abs/2005.11401) NeurIPS.
* Robertson, Zaragoza (2009). [*The Probabilistic Relevance Framework: BM25 and Beyond.*](https://dl.acm.org/doi/10.1561/1500000019) Foundations and Trends in Information Retrieval 3(4). — not on arXiv.
* Cormack, Clarke, Büttcher (2009). [*Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods.*](https://dl.acm.org/doi/10.1145/1571941.1572114) SIGIR. — not on arXiv.
* Chen et al. (2024). [*M3-Embedding: Multi-Linguality, Multi-Functionality, Multi-Granularity Text Embeddings Through Self-Knowledge Distillation.*](https://arxiv.org/abs/2402.03216) — bge-m3.
* Gao et al. (2023). [*Precise Zero-Shot Dense Retrieval without Relevance Labels.*](https://arxiv.org/abs/2212.10496) ACL. — HyDE.
* Jiang et al. (2023). [*Active Retrieval Augmented Generation.*](https://arxiv.org/abs/2305.06983) EMNLP. — FLARE.
* Yan et al. (2024). [*Corrective Retrieval Augmented Generation.*](https://arxiv.org/abs/2401.15884) — CRAG.
* Zheng et al. (2023). [*Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena.*](https://arxiv.org/abs/2306.05685) NeurIPS.
* Wang et al. (2023). [*Large Language Models are not Fair Evaluators.*](https://arxiv.org/abs/2305.17926) — position bias of LLM judges.
* Shankar et al. (2024). [*Who Validates the Validators? Aligning LLM-Assisted Evaluation of LLM Outputs with Human Preferences.*](https://arxiv.org/abs/2404.12272) UIST. — criteria drift.
* Liu et al. (2023). [*G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment.*](https://arxiv.org/abs/2303.16634) EMNLP.
* Es et al. (2024). [*RAGAS: Automated Evaluation of Retrieval Augmented Generation.*](https://arxiv.org/abs/2309.15217) EACL.
* Landis, Koch (1977). [*The Measurement of Observer Agreement for Categorical Data.*](https://doi.org/10.2307/2529310) Biometrics 33(1). — the κ scale; not on arXiv.
