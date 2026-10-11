# score · Four ways to score, and why √dk is a temperature

## score-p1

There are several options of how to calculate the attention:

## score-p2

Four steps.

**1. By definition.** The weights are ${\mathrm{softmax}_i(q^⊤k_i/\sqrt{d_k})}$. Last week's temperature softmax was ${\mathrm{softmax}_i(z_i/T)}$. Same formula, with ${z_i=q^⊤k_i}$ and ${T=\sqrt{d_k}}$. Dividing the logits by a constant before the softmax *is* a temperature; the scale does nothing else.

**2. Why that constant.** If the coordinates of $q$ and $k$ are independent with mean 0 and variance 1 — which they are at initialisation — then ${q^⊤k=∑_{j=1}^{d_k}q_jk_j}$ is a sum of $d_k$ independent terms of variance 1. Its variance is $d_k$; its standard deviation is $\sqrt{d_k}$. At ${d_k=64}$ the scores spread over roughly ±8; at 1 024, over ±32. Nothing about the *content* changed — longer vectors give bigger numbers. Dividing by $\sqrt{d_k}$ puts the standard deviation back to 1 whatever the dimension.

**3. What breaks without it.** Softmax over logits that spread ±32: the largest is typically tens of units above the second, $e^{30}$ against $e^0$, so the biggest key gets weight ≈ 1 and everything else ≈ 0. The derivative of the softmax is ${p_i(δ_{ij}−p_j)}$, and with one ${p=1}$ and the rest 0 every such product is zero — no gradient reaches the scores, and the model cannot learn to look elsewhere. The same flat region as a saturated sigmoid, for a different reason.

**4. The two limits are two degenerate attentions.** ${T→0}$: softmax → argmax, the weighted sum picks one value — that is hard attention. ${T→∞}$: uniform, the mean of all values. $\sqrt{d_k}$ puts the model in the middle at the start.

## score-note1

Unscaled, the entropy collapses toward zero and the gradient with it, by orders of magnitude as $d_k$ grows; scaled, both are independent of $d_k$. At ${d_k=16}$ it barely matters — which is why the RNN-era attention models, with their small scoring spaces, got away without it. The transformer, with $d_k$ in the hundreds, did not. One honest footnote: the scale fixes the temperature *at initialisation only*. The model can learn any other through the norms of $W_Q$ and $W_K$, so the constant conditions training rather than constraining the model. Large models have since made that explicit — QK-norm (Dehghani et al. 2023; Gemma, OLMo) normalises $q$ and $k$ and learns the temperature as a scalar.

## score-p3

Everything is pretrained (again): the same AttnSeq2Seq, the same 6 epochs, the same 29 000 pairs, only the `score=` argument differs. Run `precompute.py` if you want to retrain the models.

## bet-score-worst

(1) Which of the three lands lowest?

## bet-score-gap

(2) Additive vs scaled dot — how far apart?

## score-note

Claim 2, checked: **additive and scaled dot land within half a BLEU point of each other**, with the same parameter budget to within a percent. The surprise is *general* — the bilinear score with a free 256×256 matrix — which trains slowly from the first epoch and ends seventeen points behind. Its ${q^⊤Wk}$ is an unscaled dot product in disguise, with the temperature left to the norm of $W$: the score function barely matters, the scale does.

## temp-note

the notebook tabulates d_k = 16, 64, 256, 1024 (block 2.1); other sizes are this page's only. 200 draws: once the softmax has collapsed, the median gradient norm moves by an order of magnitude between seeds — the entropy is the stable number
