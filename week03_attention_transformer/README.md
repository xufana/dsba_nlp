# Week 3 — Attention and the Transformer

This week is a direct continuation of week 2. Same Multi30k German → English
data, same two 8k BPE tokenizers, the week-2 `Seq2SeqLSTM` (test BLEU 13.4, and
the BLEU-by-length slope that motivated all of this) as row 0 of the results
table, but this time we'll take a closer look on attention.

## Data

* Multi30k — Elliott et al. (2016). [*Multi30K: Multilingual English-German
  Image Descriptions.*](https://aclanthology.org/W16-3210/) In `../week02_language_modelling/data/`.
* CMU Pronouncing Dictionary — [github.com/cmusphinx/cmudict](https://github.com/cmusphinx/cmudict), `cmudict.dict`.
  Alphabetic headwords only, first pronunciation only: ~117k words, 26 letters → 69 phonemes (with stress).

## Sources

### Attention

* Bahdanau, Cho, Bengio (2015). [*Neural Machine Translation by Jointly Learning to Align and Translate.*](https://arxiv.org/abs/1409.0473) ICLR.
* Luong, Pham, Manning (2015). [*Effective Approaches to Attention-based Neural Machine Translation.*](https://arxiv.org/abs/1508.04025) EMNLP. — dot / general / concat, global vs local, input feeding.
* Xu et al. (2015). [*Show, Attend and Tell.*](https://arxiv.org/abs/1502.03044) ICML. — hard vs soft attention.
* Graves, Wayne, Danihelka (2014). [*Neural Turing Machines.*](https://arxiv.org/abs/1410.5401) — content-based addressing.
* Tu et al. (2016). [*Modeling Coverage for Neural Machine Translation.*](https://arxiv.org/abs/1601.04811) ACL.

### The transformer

* Vaswani et al. (2017). [*Attention Is All You Need.*](https://arxiv.org/abs/1706.03762) NeurIPS.
* He et al. (2016). [*Deep Residual Learning for Image Recognition.*](https://arxiv.org/abs/1512.03385) CVPR.
* Ba, Kiros, Hinton (2016). [*Layer Normalization.*](https://arxiv.org/abs/1607.06450)
* Xiong et al. (2020). [*On Layer Normalization in the Transformer Architecture.*](https://arxiv.org/abs/2002.04745) ICML. — Pre-LN vs Post-LN.
* Szegedy et al. (2016). [*Rethinking the Inception Architecture for Computer Vision.*](https://arxiv.org/abs/1512.00567) — label smoothing.
* Press, Wolf (2017). [*Using the Output Embedding to Improve Language Models.*](https://arxiv.org/abs/1608.05859) EACL. — weight tying.
* Dehghani et al. (2023). [*Scaling Vision Transformers to 22 Billion Parameters.*](https://arxiv.org/abs/2302.05442) — QK-norm.
* Elhage et al. (2021). [*A Mathematical Framework for Transformer Circuits.*](https://transformer-circuits.pub/2021/framework/index.html) — the residual stream.

### Positions

* Shaw, Uszkoreit, Vaswani (2018). [*Self-Attention with Relative Position Representations.*](https://arxiv.org/abs/1803.02155) NAACL.
* Su et al. (2021). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864)
* Press, Smith, Lewis (2021). [*Train Short, Test Long: Attention with Linear Biases.*](https://arxiv.org/abs/2108.12409)
* Haviv et al. (2022). [*Transformer Language Models without Positional Encodings Still Learn Positional Information.*](https://arxiv.org/abs/2203.16634)

### Which keys

* Child et al. (2019). [*Generating Long Sequences with Sparse Transformers.*](https://arxiv.org/abs/1904.10509)
* Beltagy, Peters, Cohan (2020). [*Longformer.*](https://arxiv.org/abs/2004.05150)
* Katharopoulos et al. (2020). [*Transformers are RNNs.*](https://arxiv.org/abs/2006.16236) ICML.
* Shazeer (2019). [*Fast Transformer Decoding: One Write-Head is All You Need.*](https://arxiv.org/abs/1911.02150)
* Ainslie et al. (2023). [*GQA.*](https://arxiv.org/abs/2305.13245) EMNLP.

### Evaluation and data

* Papineni et al. (2002). [*BLEU.*](https://aclanthology.org/P02-1040/) ACL. Post (2018). [*A Call for Clarity in Reporting BLEU Scores.*](https://arxiv.org/abs/1804.08771) — `sacrebleu`.
* Elliott et al. (2016). [*Multi30K.*](https://aclanthology.org/W16-3210/)

### Next week

* Devlin et al. (2019). [*BERT.*](https://arxiv.org/abs/1810.04805) Clark et al. (2019). [*What Does BERT Look At?*](https://arxiv.org/abs/1906.04341) Voita et al. (2019). [*Analyzing Multi-Head Self-Attention.*](https://arxiv.org/abs/1905.09418)
