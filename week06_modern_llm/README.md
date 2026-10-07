# Week 6 — The Bill: How Models Could Afford to Grow

One question frames the seminar and is answered at the end: *how did models afford to
become a hundred times bigger than GPT-2?*

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

### Context without the square

* Katharopoulos, Vyas, Pappas, Fleuret (2020). [*Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention.*](https://arxiv.org/abs/2006.16236) ICML.
* Gu, Dao (2023). [*Mamba: Linear-Time Sequence Modeling with Selective State Spaces.*](https://arxiv.org/abs/2312.00752)
* Yang, Wang, Shen, Panda, Kim (2024). [*Gated Linear Attention Transformers with Hardware-Efficient Training.*](https://arxiv.org/abs/2312.06635) ICML.

### The models

* Radford et al. (2019). [*Language Models are Unsupervised Multitask Learners.*](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
* Allal et al. (2025). [*SmolLM2: When Smol Goes Big — Data-Centric Training of a Small Language Model.*](https://arxiv.org/abs/2502.02737)
* Warner et al. (2024). [*Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder for Fast, Memory Efficient, and Long Context Finetuning and Inference.*](https://arxiv.org/abs/2412.13663) — ModernBERT.
* Gemma Team (2025). [*Gemma 3 Technical Report.*](https://arxiv.org/abs/2503.19786)
