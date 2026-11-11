# design · the scenario

## q-design · write

A bank's support operators answer clients' questions using 40 000 pages of internal regulations, in Russian, updated weekly; the pages are full of product codes and tariff names. Operators type short questions in their own words. Every answer must cite the paragraph it comes from, and some regulations are visible only to some departments. Sketch the retrieval: the task, the data, the representation, the model, the metric, and what breaks first.

- the task: rank paragraphs of the regulations for an operator's question; the answer is the cited paragraph (or an answer generated from it), and "not in the regulations" is a valid outcome
- the data: a golden set from the operators' logs — real questions, each with the id of the paragraph that answers it, plus questions with no answer — written down before the first experiment
- the units: paragraph-level chunks with overlap, the section and the document as parents; metadata for the date, the version and the departments allowed to see it
- hybrid search: BM25 with Russian lemmatisation for codes and tariff names, a multilingual bi-encoder for paraphrases, fused with RRF; a cross-encoder over the top 50
- access rights and the current version as filters during the search, not after it
- the metric: Recall@5 and MRR on the golden set, by question type; separately, the share of no-answer questions correctly refused
- what breaks first: product codes split by the tokenizer, stale paragraphs from the previous version, a post-filter on departments returning nothing, and confident answers when the regulation is silent

> **Task.** Ranking, with the paragraph as the unit and a citation as the output. Two outcomes count: the right paragraph in the first few, and "the regulations do not say" when they do not — a bank cannot afford an invented rule.
>
> **Data.** The operators' logs are the golden set: real wording, real distribution. Label each question with the *id* of the answering paragraph, not a quote, and add questions with no answer. This comes before any model choice, and it is versioned with the regulations.
>
> **Representation.** Paragraph chunks with overlap, parents for context. Codes and tariff names are exact strings: BM25 with a Russian lemmatiser and a tokenizer that keeps "ТП-0451" in one piece. Paraphrases need a bi-encoder; multilingual, because Russian. Fuse with RRF — the scores are not comparable — and rerank the top 50 with a cross-encoder, which also reads negation and conditions ("except for", "only if").
>
> **Model and filters.** Department rights and "current version only" are filters inside the search; post-filtering on a rare department returns empty lists. Weekly updates mean re-indexing changed pages, keeping ids stable so the golden set survives.
>
> **Metric.** Recall@5 — operators read a few — and MRR, per question type (codes, procedures, paraphrases), plus the refusal rate on no-answer questions. Twenty questions are not a benchmark: one question is five points.
>
> **What breaks first.** The tokenizer on codes; the previous version of a rule outranking the current one; access filters; and the generator answering from a neighbouring rule when the right one is absent.
