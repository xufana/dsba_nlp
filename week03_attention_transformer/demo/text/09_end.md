# end · Every row is one formula, used in a different place

## end-p1

Put the results table back up and read it as one story.

## end-note1

**nowhere** (row 0): one vector between the halves, and the translation loses the details of anything long;
**between the decoder and the encoder** (rows 1–3): access replaces the summary, the curve lifts by twenty points at every length, and the score function — the part with the most papers — barely moves the number, until its scale is wrong;
**everywhere** (the transformer rows): self-attention replaces recurrence, training becomes parallel, and the two ablations say where the gain comes from — cross-attention (remove it and the bottleneck is back) and positions (remove them and the encoder is a bag of words).

## end-p2

**Try it yourself** (the notebook's homework cells, `RUN_HOMEWORK = True`): implement rotary position embeddings and add a third curve to the length-generalisation plot; train the attention LSTM with `score="dot"` at 256 and at 1 024 dimensions and record the entropy of the weights after 50 steps; count, for every test sentence, the German tokens that never receive a weight above 0.3, and plot that count against the sentence's BLEU.

## end-p3

* Bahdanau, Cho, Bengio (2015). [*Neural Machine Translation by Jointly Learning to Align and Translate.*](https://arxiv.org/abs/1409.0473) ICLR.
* Luong, Pham, Manning (2015). [*Effective Approaches to Attention-based Neural Machine Translation.*](https://arxiv.org/abs/1508.04025) EMNLP.
* Xu et al. (2015). [*Show, Attend and Tell.*](https://arxiv.org/abs/1502.03044) ICML.
* Graves, Wayne, Danihelka (2014). [*Neural Turing Machines.*](https://arxiv.org/abs/1410.5401)
* Tu et al. (2016). [*Modeling Coverage for Neural Machine Translation.*](https://arxiv.org/abs/1601.04811) ACL.
* Vaswani et al. (2017). [*Attention Is All You Need.*](https://arxiv.org/abs/1706.03762) NeurIPS.
* Shaw, Uszkoreit, Vaswani (2018). [*Self-Attention with Relative Position Representations.*](https://arxiv.org/abs/1803.02155) NAACL.
* Su et al. (2021). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864)
* Press, Smith, Lewis (2021). [*Train Short, Test Long: Attention with Linear Biases.*](https://arxiv.org/abs/2108.12409)
* Haviv et al. (2022). [*Transformer Language Models without Positional Encodings Still Learn Positional Information.*](https://arxiv.org/abs/2203.16634) EMNLP Findings.
* He et al. (2016). [*Deep Residual Learning for Image Recognition.*](https://arxiv.org/abs/1512.03385) CVPR.
* Ba, Kiros, Hinton (2016). [*Layer Normalization.*](https://arxiv.org/abs/1607.06450)
* Xiong et al. (2020). [*On Layer Normalization in the Transformer Architecture.*](https://arxiv.org/abs/2002.04745) ICML.
* Szegedy et al. (2016). [*Rethinking the Inception Architecture for Computer Vision.*](https://arxiv.org/abs/1512.00567) CVPR.
* Press, Wolf (2017). [*Using the Output Embedding to Improve Language Models.*](https://arxiv.org/abs/1608.05859) EACL.
* Dehghani et al. (2023). [*Scaling Vision Transformers to 22 Billion Parameters.*](https://arxiv.org/abs/2302.05442)
* Elhage et al. (2021). [*A Mathematical Framework for Transformer Circuits.*](https://transformer-circuits.pub/2021/framework/index.html)
* Elliott et al. (2016). [*Multi30K: Multilingual English-German Image Descriptions.*](https://aclanthology.org/W16-3210/)
* Post (2018). [*A Call for Clarity in Reporting BLEU Scores.*](https://arxiv.org/abs/1804.08771) WMT.
* Alammar, J. (2018). [*The Illustrated Transformer.*](https://jalammar.github.io/illustrated-transformer/) Blog post. The schematics on this page are redrawn after it.
