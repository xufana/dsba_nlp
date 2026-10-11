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

<ul style="padding-left:1.2em; line-height:1.6">
      <li>Bahdanau, Cho, Bengio (2015). <a href="https://arxiv.org/abs/1409.0473" target="_blank" rel="noopener"><em>Neural Machine Translation by Jointly Learning to Align and Translate.</em></a> ICLR.</li>
      <li>Luong, Pham, Manning (2015). <a href="https://arxiv.org/abs/1508.04025" target="_blank" rel="noopener"><em>Effective Approaches to Attention-based Neural Machine Translation.</em></a> EMNLP.</li>
      <li>Xu et al. (2015). <a href="https://arxiv.org/abs/1502.03044" target="_blank" rel="noopener"><em>Show, Attend and Tell.</em></a> ICML.</li>
      <li>Graves, Wayne, Danihelka (2014). <a href="https://arxiv.org/abs/1410.5401" target="_blank" rel="noopener"><em>Neural Turing Machines.</em></a></li>
      <li>Tu et al. (2016). <a href="https://arxiv.org/abs/1601.04811" target="_blank" rel="noopener"><em>Modeling Coverage for Neural Machine Translation.</em></a> ACL.</li>
      <li>Vaswani et al. (2017). <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener"><em>Attention Is All You Need.</em></a> NeurIPS.</li>
      <li>Shaw, Uszkoreit, Vaswani (2018). <a href="https://arxiv.org/abs/1803.02155" target="_blank" rel="noopener"><em>Self-Attention with Relative Position Representations.</em></a> NAACL.</li>
      <li>Su et al. (2021). <a href="https://arxiv.org/abs/2104.09864" target="_blank" rel="noopener"><em>RoFormer: Enhanced Transformer with Rotary Position Embedding.</em></a></li>
      <li>Press, Smith, Lewis (2021). <a href="https://arxiv.org/abs/2108.12409" target="_blank" rel="noopener"><em>Train Short, Test Long: Attention with Linear Biases.</em></a></li>
      <li>Haviv et al. (2022). <a href="https://arxiv.org/abs/2203.16634" target="_blank" rel="noopener"><em>Transformer Language Models without Positional Encodings Still Learn Positional Information.</em></a> EMNLP Findings.</li>
      <li>He et al. (2016). <a href="https://arxiv.org/abs/1512.03385" target="_blank" rel="noopener"><em>Deep Residual Learning for Image Recognition.</em></a> CVPR.</li>
      <li>Ba, Kiros, Hinton (2016). <a href="https://arxiv.org/abs/1607.06450" target="_blank" rel="noopener"><em>Layer Normalization.</em></a></li>
      <li>Xiong et al. (2020). <a href="https://arxiv.org/abs/2002.04745" target="_blank" rel="noopener"><em>On Layer Normalization in the Transformer Architecture.</em></a> ICML.</li>
      <li>Szegedy et al. (2016). <a href="https://arxiv.org/abs/1512.00567" target="_blank" rel="noopener"><em>Rethinking the Inception Architecture for Computer Vision.</em></a> CVPR.</li>
      <li>Press, Wolf (2017). <a href="https://arxiv.org/abs/1608.05859" target="_blank" rel="noopener"><em>Using the Output Embedding to Improve Language Models.</em></a> EACL.</li>
      <li>Dehghani et al. (2023). <a href="https://arxiv.org/abs/2302.05442" target="_blank" rel="noopener"><em>Scaling Vision Transformers to 22 Billion Parameters.</em></a></li>
      <li>Elhage et al. (2021). <a href="https://transformer-circuits.pub/2021/framework/index.html" target="_blank" rel="noopener"><em>A Mathematical Framework for Transformer Circuits.</em></a></li>
      <li>Elliott et al. (2016). <a href="https://aclanthology.org/W16-3210/" target="_blank" rel="noopener"><em>Multi30K: Multilingual English-German Image Descriptions.</em></a></li>
      <li>Post (2018). <a href="https://arxiv.org/abs/1804.08771" target="_blank" rel="noopener"><em>A Call for Clarity in Reporting BLEU Scores.</em></a> WMT.</li>
      <li>Alammar, J. (2018). <a href="https://jalammar.github.io/illustrated-transformer/" target="_blank" rel="noopener"><em>The Illustrated Transformer.</em></a> Blog post. The schematics on this page are redrawn after it.</li>
    </ul>
