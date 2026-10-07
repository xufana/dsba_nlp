# Week 6 — The Bill: How Models Could Afford to Grow

GPT-2 was 1.5B parameters at most, read 40 GB of text and saw 1 024 tokens at a time. The
same block now runs at hundreds of billions of parameters, on trillions of tokens, over a
hundred thousand tokens of context. This week is about what that growth costs — three
bills: training (`6·N·D`, paid once), memory (the weights and the KV cache, paid per
request) and compute (`2·N_active`, paid per token) — and about the parts of the block
that were replaced because of them: the norm, the feed-forward, the positions, the
keys and values, and the feed-forward again, as a mixture of experts.

Nothing is trained in class. Every number is either computed by hand from a
`config.json` and then checked by a cell, or is one forward pass through a checkpoint
somebody else trained. The modern block is written from scratch in about sixty lines
and loaded with the trained weights of SmolLM2-135M; the logits match the library's.

One question frames the seminar and is answered at the end: *how did models afford to
become a hundred times bigger than GPT-2?*

## Models

All from the Hugging Face hub, none gated.

* **`gpt2`** (124M, 2019) and **`HuggingFaceTB/SmolLM2-135M`** (135M, 2024) — the same
  parameter budget, five years apart; the two "passports" of section 2.
* **`EleutherAI/pythia-{70m … 12b}`** — eight sizes trained on one corpus in one data
  order, with checkpoints along the run: both axes of a scaling law without a training
  step. Three sizes run live; `artifacts/scaling.json` has six (all eight with `--full`,
  which needs a 24 GB GPU).
* **`HuggingFaceTB/SmolLM2-1.7B-Instruct`** and **`-135M-Instruct`** — the chat
  template, the task by instruction, and speculative decoding (section 4).
* **`answerdotai/ModernBERT-base`** — the same parts in an encoder; artifact only.

Llama-3-8B, Mistral 7B, Mixtral 8x7B and gpt-oss-20b appear as numbers from their
configs and model cards; they are not downloaded.

## Data

**AG News** — `fancyzhx/ag_news` through `datasets`, the same split as weeks 1, 4 and 5.

## Artifacts

`python precompute.py` writes six JSON files to `artifacts/` (about an hour on an
M-series Mac; `--only <step>` for one of them). The notebook needs them: the cells that
read an artifact fail until it exists. `python precompute.py --smoke` followed by
`python scripts/smoke_run.py` executes the whole notebook offline on tiny random models.

The prose after the measured cells carries `<!-- REVISE AFTER PRECOMPUTE -->` and
`<!-- CHECK LIVE -->` comments where a sentence has to be matched to the real numbers.

## Sources

### The bill for training

* Kaplan et al. (2020). [*Scaling Laws for Neural Language Models.*](https://arxiv.org/abs/2001.08361)
* Hoffmann et al. (2022). [*Training Compute-Optimal Large Language Models.*](https://arxiv.org/abs/2203.15556) — Chinchilla.
* Brown et al. (2020). [*Language Models are Few-Shot Learners.*](https://arxiv.org/abs/2005.14165) — GPT-3 and its compute table.
* Biderman et al. (2023). [*Pythia: A Suite for Analyzing Large Language Models Across Training and Scaling.*](https://arxiv.org/abs/2304.01373)

### The parts

* Zhang, Sennrich (2019). [*Root Mean Square Layer Normalization.*](https://arxiv.org/abs/1910.07467)
* Xiong et al. (2020). [*On Layer Normalization in the Transformer Architecture.*](https://arxiv.org/abs/2002.04745) — pre-norm.
* Shazeer (2020). [*GLU Variants Improve Transformer.*](https://arxiv.org/abs/2002.05202) — SwiGLU, GeGLU.
* Su et al. (2021). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864)
* Shazeer (2019). [*Fast Transformer Decoding: One Write-Head is All You Need.*](https://arxiv.org/abs/1911.02150) — multi-query attention.
* Ainslie et al. (2023). [*GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints.*](https://arxiv.org/abs/2305.13245)

### The bill for serving

* Pope et al. (2022). [*Efficiently Scaling Transformer Inference.*](https://arxiv.org/abs/2211.05102)
* Shazeer et al. (2017). [*Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer.*](https://arxiv.org/abs/1701.06538)
* Jiang et al. (2024). [*Mixtral of Experts.*](https://arxiv.org/abs/2401.04088)
* Leviathan, Kalman, Matias (2023). [*Fast Inference from Transformers via Speculative Decoding.*](https://arxiv.org/abs/2211.17192) ICML.

### The models

* Radford et al. (2019). [*Language Models are Unsupervised Multitask Learners.*](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
* Allal et al. (2025). [*SmolLM2: When Smol Goes Big — Data-Centric Training of a Small Language Model.*](https://arxiv.org/abs/2502.02737)
* Warner et al. (2024). [*Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder for Fast, Memory Efficient, and Long Context Finetuning and Inference.*](https://arxiv.org/abs/2412.13663) — ModernBERT.
* Gemma Team (2025). [*Gemma 3 Technical Report.*](https://arxiv.org/abs/2503.19786)
