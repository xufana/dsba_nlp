# Week 4 — Pretraining and Transfer: BERT and the Shape of a Head

This week the body is the same stack,
pretrained by someone else, and mostly frozen. What changes from task to task is
not the model: it is the shape of the head's output, the point where it
attaches, and the axis the softmax runs along. The head is ~0.006% of the
parameters, and it is the whole difference between NER and question answering.


## Data

All three come from the Hugging Face hub through `datasets` and are cached under
`~/.cache/huggingface`.

* **AG News** — `fancyzhx/ag_news`, the same 120 000 / 7 600 split as the CSV in
  `../week01_text_representations/data/` (checked on 2026-09-23: the test set is
  identical, text for text, so the rows stay comparable with week 1).
* **CoNLL-2003** — Tjong Kim Sang, De Meulder (2003).
  [*Introduction to the CoNLL-2003 Shared Task: Language-Independent Named Entity Recognition.*](https://aclanthology.org/W03-0419/)
  `eriktks/conll2003`, loaded from its `refs/convert/parquet` branch because the
  repository itself is a loading script, which `datasets` ≥ 4 refuses to run.
  Tags are IOB2 as distributed there.
* **SQuAD v1.1** — Rajpurkar et al. (2016).
  [*SQuAD: 100,000+ Questions for Machine Comprehension of Text.*](https://arxiv.org/abs/1606.05250) EMNLP.
  `rajpurkar/squad`.

## Sources

### Subword tokenization, part two

* Schuster, Nakajima (2012). [*Japanese and Korean Voice Search.*](https://research.google/pubs/japanese-and-korean-voice-search/) ICASSP. — WordPiece.
* Wu et al. (2016). [*Google's Neural Machine Translation System.*](https://arxiv.org/abs/1609.08144) — the WordPiece description everyone actually cites.
* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://arxiv.org/abs/1508.07909) ACL. — BPE (week 2).
* Kudo (2018). [*Subword Regularization.*](https://arxiv.org/abs/1804.10959) ACL. — the Unigram LM and sampling from it.
* Kudo, Richardson (2018). [*SentencePiece.*](https://arxiv.org/abs/1808.06226) EMNLP.
* Bostrom, Durrett (2020). [*Byte Pair Encoding is Suboptimal for Language Model Pretraining.*](https://arxiv.org/abs/2004.03720) Findings of EMNLP.
* Rust et al. (2021). [*How Good is Your Tokenizer?*](https://arxiv.org/abs/2012.15613) ACL. — what a bad tokenizer costs in another language.

### Pretraining

* Devlin et al. (2019). [*BERT.*](https://arxiv.org/abs/1810.04805) NAACL.
* Peters et al. (2018). [*Deep Contextualized Word Representations.*](https://arxiv.org/abs/1802.05365) NAACL. — ELMo.
* Howard, Ruder (2018). [*Universal Language Model Fine-tuning for Text Classification.*](https://arxiv.org/abs/1801.06146) ACL. — ULMFiT: discriminative learning rates, gradual unfreezing.
* Liu et al. (2019). [*RoBERTa.*](https://arxiv.org/abs/1907.11692) — NSP removed, nothing lost.
* Lan et al. (2020). [*ALBERT.*](https://arxiv.org/abs/1909.11942) ICLR.
* Clark et al. (2020). [*ELECTRA.*](https://arxiv.org/abs/2003.10555) ICLR.
* He et al. (2021). [*DeBERTa.*](https://arxiv.org/abs/2006.03654) ICLR.

### What the layers hold, and how to transfer

* Tenney, Das, Pavlick (2019). [*BERT Rediscovers the Classical NLP Pipeline.*](https://arxiv.org/abs/1905.05950) ACL.
* Liu et al. (2019). [*Linguistic Knowledge and Transferability of Contextual Representations.*](https://arxiv.org/abs/1903.08855) NAACL. — why the last layer is not the best layer.
* Peters, Ruder, Smith (2019). [*To Tune or Not to Tune?*](https://arxiv.org/abs/1903.05987) RepL4NLP.
* Reimers, Gurevych (2019). [*Sentence-BERT.*](https://arxiv.org/abs/1908.10084) EMNLP. — why raw `[CLS]` is a poor sentence vector.
* Mosbach, Andriushchenko, Klakow (2021). [*On the Stability of Fine-tuning BERT.*](https://arxiv.org/abs/2006.04884) ICLR.
* Houlsby et al. (2019). [*Parameter-Efficient Transfer Learning for NLP.*](https://arxiv.org/abs/1902.00751) ICML. — adapters.
* Hu et al. (2021). [*LoRA.*](https://arxiv.org/abs/2106.09685) — where the dial goes next.

### Tasks and evaluation

* Ramshaw, Marcus (1995). [*Text Chunking using Transformation-Based Learning.*](https://aclanthology.org/W95-0107/) — where BIO tagging comes from.
* Rajpurkar, Jia, Liang (2018). [*Know What You Don't Know.*](https://arxiv.org/abs/1806.03822) ACL. — SQuAD 2.0, unanswerable questions.
* Wang et al. (2019). [*GLUE.*](https://arxiv.org/abs/1804.07461) ICLR.

### Next week

* Radford et al. (2018). [*Improving Language Understanding by Generative Pre-Training.*](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1.
  Radford et al. (2019). [*Language Models are Unsupervised Multitask Learners.*](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
