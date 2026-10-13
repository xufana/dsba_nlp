# table · The results table, read as one story

## table-note1

Every row is the same equation — P(next token | prefix) × a decoding rule — with the left factor built a different way. **Counting** is a strong, cheap baseline that generalises not at all; well-smoothed, it beat our small networks on perplexity today. **A recurrent network** generalises through embeddings and an unbounded-in-principle state; at laptop scale it matched the trigram rather than beating it — but it writes novel text instead of reciting, its curve is still falling, and, decisively, it can be conditioned. **An encoder–decoder** conditions the whole thing on a second sequence, bottlenecked by the one vector between the halves. And the right factor turned out to carry as much weight as the left. None of that is about the model.

## table-p1

**1 · Everything is next-token prediction.** The training loss is cross-entropy, which is log perplexity; the model outputs a distribution, and text is a second decision on top. Transformers change how P is computed, not this frame.<br>
**2 · Perplexity is comparable only under a fixed tokenizer and test set** — and bits/char only lifts the tokenizer restriction for models that are lossless over the text. Off that, the number lies.<br>
**3 · The decoding rule is a design choice with its own failure modes.** Temperature, top-p, min-p, repetition penalty, beam width — the same knobs on our LSTM and on a 400B LLM.<br>
**4 · A fixed-size bottleneck loses information as the input grows, with a measurable slope.** That slope is next week's motivation.<br>
**5 · Likelihood is not quality.** The most probable continuation is usually not the one to show a human — the single most important thing decoding taught the field.

<p class="footnote" style="margin-top:30px">Full notebook, homework and the reading list: <span class="mono">week02_language_modelling/</span>. Everything marked 🏠 there runs as-is — Kneser–Ney against the LSTM per bits/char, weight tying and dropout, scheduled sampling, and min-p at T = 2 are the ones worth an evening.</p>

## end-refs

* Shannon (1948). [*A Mathematical Theory of Communication.*](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x) Bell System Technical Journal 27.
* Jelinek, Mercer (1980). *Interpolated estimation of Markov source parameters from sparse data.* Pattern Recognition in Practice.
* Kneser, Ney (1995). [*Improved backing-off for m-gram language modeling.*](https://doi.org/10.1109/ICASSP.1995.479394) ICASSP.
* Gage (1994). *A New Algorithm for Data Compression.* C Users Journal. — BPE as compression.
* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://arxiv.org/abs/1508.07909) ACL.
* Bengio et al. (2003). [*A Neural Probabilistic Language Model.*](https://www.jmlr.org/papers/v3/bengio03a.html) JMLR 3.
* Elman (1990). [*Finding Structure in Time.*](https://doi.org/10.1207/s15516709cog1402_1) Cognitive Science 14.
* Mikolov et al. (2010). [*Recurrent neural network based language model.*](https://www.fit.vutbr.cz/research/groups/speech/publi/2010/mikolov_interspeech2010_IS100722.pdf) Interspeech.
* Hochreiter, Schmidhuber (1997). [*Long Short-Term Memory.*](https://doi.org/10.1162/neco.1997.9.8.1735) Neural Computation 9(8).
* Cho et al. (2014). [*Learning Phrase Representations using RNN Encoder–Decoder.*](https://arxiv.org/abs/1406.1078) EMNLP. — GRU and the encoder–decoder.
* Chung et al. (2014). [*Empirical Evaluation of Gated Recurrent Neural Networks.*](https://arxiv.org/abs/1412.3555)
* Bengio et al. (1994). [*Learning Long-Term Dependencies with Gradient Descent is Difficult.*](https://doi.org/10.1109/72.279181) IEEE TNN 5(2).
* Pascanu, Mikolov, Bengio (2013). [*On the difficulty of training recurrent neural networks.*](https://arxiv.org/abs/1211.5063) ICML. — gradient clipping.
* Press, Wolf (2017). [*Using the Output Embedding to Improve Language Models.*](https://arxiv.org/abs/1608.05859) EACL. — weight tying.
* Sutskever, Vinyals, Le (2014). [*Sequence to Sequence Learning with Neural Networks.*](https://arxiv.org/abs/1409.3215) NeurIPS.
* Papineni et al. (2002). [*BLEU: a Method for Automatic Evaluation of Machine Translation.*](https://aclanthology.org/P02-1040/) ACL.
* Post (2018). [*A Call for Clarity in Reporting BLEU Scores.*](https://arxiv.org/abs/1804.08771) WMT. — `sacrebleu`.
* Ranzato et al. (2015). [*Sequence Level Training with Recurrent Neural Networks.*](https://arxiv.org/abs/1511.06732) ICLR. — exposure bias.
* Fan, Lewis, Dauphin (2018). [*Hierarchical Neural Story Generation.*](https://arxiv.org/abs/1805.04833) ACL. — top-k.
* Holtzman et al. (2019). [*The Curious Case of Neural Text Degeneration.*](https://arxiv.org/abs/1904.09751) ICLR 2020. — nucleus sampling.
* Keskar et al. (2019). [*CTRL: A Conditional Transformer Language Model.*](https://arxiv.org/abs/1909.05858) — repetition penalty.
* Nguyen et al. (2024). [*Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs.*](https://arxiv.org/abs/2407.01082)
* Wu et al. (2016). [*Google's Neural Machine Translation System.*](https://arxiv.org/abs/1609.08144) — length-normalised beam search.
* Bahdanau, Cho, Bengio (2015). [*Neural Machine Translation by Jointly Learning to Align and Translate.*](https://arxiv.org/abs/1409.0473) ICLR.
