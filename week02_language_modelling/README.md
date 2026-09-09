# Week 2 — Language Modelling and Text Generation

**Thesis:** `generator = P(next token | prefix) × decoding rule`. Every text
generator ever built — a 1948 n-gram model, an RNN, a modern LLM — is a
next-token distribution and a rule for turning it into a string. We build the
left factor three ways (counting, a recurrent network, an encoder–decoder) and
the right factor six ways, on one corpus, one test set, one table.

The corpus is ~124k Russian jokes (анекдоты); the seq2seq half translates
German → English on Multi30k. Everything runs on a laptop CPU or Colab; the
slow training runs ship as artifacts in `artifacts/`, each reproducible with
`RECOMPUTE = True` in the notebook or `python precompute.py`.

## Interactive demo

`demo/week02_demo.html` is the page driven live in class: every block above
as a bet-then-reveal, the BPE trainer and the n-gram counter running in the
browser, and the notebook's LSTM (`artifacts/lm_lstm.pt`, quantised) loaded
into the page so the decoding rules — temperature, top-k, top-p, min-p,
repetition penalty — sample from the real model right there.

The page is generated, not hand-edited: `demo/export_demo_data.py` reruns the
notebook's code on the notebook's split and writes `demo/demo_data.json`;
`demo/build_demo.py` assembles it with `demo/parts/*` into the HTML.
`demo/check_demo.js` opens the built page in headless Chrome over the
DevTools protocol and checks that the in-browser tokenizer and LSTM reproduce
the Python numbers. Formulas are native MathML — no external library, so the
page renders offline.

## Data

* Russian jokes — scraped Telegram corpus (`data/anek.txt`), one joke per
  blank-line-separated block.
* Multi30k — Elliott et al. (2016). [*Multi30K: Multilingual English-German
  Image Descriptions.*](https://aclanthology.org/W16-3210/) Raw task-1 files
  from [github.com/multi30k/dataset](https://github.com/multi30k/dataset).

## Sources

### Language modelling and smoothing

* Shannon (1948). [*A Mathematical Theory of Communication.*](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x) Bell System Technical Journal 27.
* Jelinek, Mercer (1980). *Interpolated estimation of Markov source parameters from sparse data.* Pattern Recognition in Practice.
* Kneser, Ney (1995). [*Improved backing-off for m-gram language modeling.*](https://doi.org/10.1109/ICASSP.1995.479394) ICASSP.
* Chen, Goodman (1999). [*An Empirical Study of Smoothing Techniques for Language Modeling.*](https://doi.org/10.1006/csla.1999.0128) Computer Speech & Language 13(4).

### Subword tokenization

* Gage (1994). *A New Algorithm for Data Compression.* C Users Journal. — BPE as compression.
* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://arxiv.org/abs/1508.07909) ACL.

### Neural language models

* Bengio et al. (2003). [*A Neural Probabilistic Language Model.*](https://www.jmlr.org/papers/v3/bengio03a.html) JMLR 3.
* Elman (1990). [*Finding Structure in Time.*](https://doi.org/10.1207/s15516709cog1402_1) Cognitive Science 14(2).
* Mikolov et al. (2010). [*Recurrent neural network based language model.*](https://www.fit.vutbr.cz/research/groups/speech/publi/2010/mikolov_interspeech2010_IS100722.pdf) Interspeech.
* Hochreiter, Schmidhuber (1997). [*Long Short-Term Memory.*](https://doi.org/10.1162/neco.1997.9.8.1735) Neural Computation 9(8).
* Cho et al. (2014). [*Learning Phrase Representations using RNN Encoder–Decoder for Statistical Machine Translation.*](https://arxiv.org/abs/1406.1078) EMNLP. — GRU, encoder–decoder.
* Chung et al. (2014). [*Empirical Evaluation of Gated Recurrent Neural Networks on Sequence Modeling.*](https://arxiv.org/abs/1412.3555) arXiv.

### Training recurrent nets

* Bengio, Simard, Frasconi (1994). [*Learning Long-Term Dependencies with Gradient Descent is Difficult.*](https://doi.org/10.1109/72.279181) IEEE Transactions on Neural Networks 5(2).
* Pascanu, Mikolov, Bengio (2013). [*On the difficulty of training recurrent neural networks.*](https://arxiv.org/abs/1211.5063) ICML. — gradient clipping.
* Zaremba, Sutskever, Vinyals (2014). [*Recurrent Neural Network Regularization.*](https://arxiv.org/abs/1409.2329) arXiv. — dropout for RNNs.
* Press, Wolf (2017). [*Using the Output Embedding to Improve Language Models.*](https://arxiv.org/abs/1608.05859) EACL. — weight tying.

### Decoding and text degeneration

* Fan, Lewis, Dauphin (2018). [*Hierarchical Neural Story Generation.*](https://arxiv.org/abs/1805.04833) ACL. — top-k.
* Holtzman et al. (2019). [*The Curious Case of Neural Text Degeneration.*](https://arxiv.org/abs/1904.09751) ICLR 2020. — nucleus (top-p) sampling.
* Keskar et al. (2019). [*CTRL: A Conditional Transformer Language Model for Controllable Generation.*](https://arxiv.org/abs/1909.05858) arXiv. — repetition penalty.
* Nguyen et al. (2024). [*Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs.*](https://arxiv.org/abs/2407.01082) arXiv.

### Sequence to sequence and evaluation

* Sutskever, Vinyals, Le (2014). [*Sequence to Sequence Learning with Neural Networks.*](https://arxiv.org/abs/1409.3215) NeurIPS.
* Ranzato et al. (2015). [*Sequence Level Training with Recurrent Neural Networks.*](https://arxiv.org/abs/1511.06732) ICLR. — exposure bias.
* Papineni et al. (2002). [*BLEU: a Method for Automatic Evaluation of Machine Translation.*](https://aclanthology.org/P02-1040/) ACL.
* Post (2018). [*A Call for Clarity in Reporting BLEU Scores.*](https://arxiv.org/abs/1804.08771) WMT. — sacrebleu.
* Wu et al. (2016). [*Google's Neural Machine Translation System.*](https://arxiv.org/abs/1609.08144) arXiv. — length-normalised beam search.

### Next week

* Bahdanau, Cho, Bengio (2015). [*Neural Machine Translation by Jointly Learning to Align and Translate.*](https://arxiv.org/abs/1409.0473) ICLR. — attention.
* Vaswani et al. (2017). [*Attention Is All You Need.*](https://arxiv.org/abs/1706.03762) NeurIPS. — the transformer.
