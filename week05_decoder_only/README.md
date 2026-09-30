# Week 5 — The Decoder, Alone: GPT and Where the Task Lives

This week the body is a decoder — week 3's decoder with the cross-attention removed —
and the head is the vocabulary, the same for every task. The task cannot live in the
head any more, so it moves into the input; what that costs is one forward pass per
output token. Three tasks are done both ways — an encoder with a head and a decoder
with the task in the prefix — and two tables are filled: what the answer is worth, and
what it costs.

Two questions frame the seminar and are answered at the end: *why not an encoder for
everything?* and *why not a decoder for everything?*

## Data

All from the Hugging Face hub through `datasets`, cached under `~/.cache/huggingface`;
the same three sets as week 4.

* **AG News** — `fancyzhx/ag_news`, the 120 000 / 7 600 split of week 1. The
  punctuation and typo tasks are built from it: `target_text` (the original, minus
  the CSV's line-break and `#36;` artifacts and minus punctuation-only tokens) is the
  target; `strip_text` (lower case, no punctuation, apostrophes kept) and `add_noise`
  (six kinds of synthetic typos at 10%) are the inputs.
* **CoNLL-2003** — `eriktks/conll2003`, parquet branch, IOB2 (Tjong Kim Sang & De Meulder 2003).
* **SQuAD v1.1** — `rajpurkar/squad` (Rajpurkar et al. 2016).

## Sources

### GPT

* Radford, Narasimhan, Salimans, Sutskever (2018). [*Improving Language Understanding by Generative Pre-Training.*](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1.
* Radford et al. (2019). [*Language Models are Unsupervised Multitask Learners.*](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
* Brown et al. (2020). [*Language Models are Few-Shot Learners.*](https://arxiv.org/abs/2005.14165) — the prefix as the whole interface.

### Reading the stack

* nostalgebraist (2020). [*Interpreting GPT: the logit lens.*](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens) — 1.2.
* Alammar (2019). [*The Illustrated GPT-2.*](https://jalammar.github.io/illustrated-gpt2/) — masked self-attention and the cache, with pictures.
* Xiao et al. (2023). [*Efficient Streaming Language Models with Attention Sinks.*](https://arxiv.org/abs/2309.17453) — why the first token takes so much attention in 1.3.

### Generation and its cost

* Holtzman et al. (2019). [*The Curious Case of Neural Text Degeneration.*](https://arxiv.org/abs/1904.09751) — week 2.
* von Platen (2020). [*How to generate text.*](https://huggingface.co/blog/how-to-generate) — the `generate` API.
* Su et al. (2022). [*A Contrastive Framework for Neural Text Generation.*](https://arxiv.org/abs/2202.06417) — *Try it yourself*.
* Pope et al. (2022). [*Efficiently Scaling Transformer Inference.*](https://arxiv.org/abs/2211.05102) — the KV cache bill, next week.

### The task in the prefix

* Schick, Schütze (2021). [*Exploiting Cloze Questions for Few-Shot Text Classification and Natural Language Inference.*](https://arxiv.org/abs/2001.07676) EACL. — verbalizers.
* Zhang et al. (2025). [*Do BERT-Like Bidirectional Models Still Perform Better on Text Classification in the Era of LLMs?*](https://arxiv.org/abs/2505.18215)
* Zhan, Wang, Huang (2026). [*Assessment of Generative Named Entity Recognition in the Era of Large Language Models.*](https://arxiv.org/abs/2601.17898) — formats, and how generators are wrong.
* Omelianchuk et al. (2020). [*GECToR — Grammatical Error Correction: Tag, Not Rewrite.*](https://arxiv.org/abs/2005.12592) BEA. — the encoder with a vocabulary of edits.
* Tam et al. (2024). [*Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of LLMs.*](https://arxiv.org/abs/2408.02442) — next week.

### Positions

* Su et al. (2021). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864) — RoPE.
* Chen et al. (2023). [*Extending Context Window of Large Language Models via Positional Interpolation.*](https://arxiv.org/abs/2306.15595) — interpolation instead of extrapolation.
* Peng et al. (2023). [*YaRN: Efficient Context Window Extension of Large Language Models.*](https://arxiv.org/abs/2309.00071) — per-frequency scaling.
* Biderman et al. (2023). [*Pythia: A Suite for Analyzing Large Language Models Across Training and Scaling.*](https://arxiv.org/abs/2304.01373) ICML. — the RoPE model of 1.4.

### Next week

* Leviathan, Kalman, Matias (2023). [*Fast Inference from Transformers via Speculative Decoding.*](https://arxiv.org/abs/2211.17192) ICML.
* Willard, Louf (2023). [*Efficient Guided Generation for Large Language Models.*](https://arxiv.org/abs/2307.09702) — constrained generation.
