# smooth · A number for the model — and the number that lies

## smooth-p1

Looking at samples is not a metric. The metric for a language model is how much probability it assigns to text it has not seen, reported as **perplexity**: exp of the average negative log-likelihood per token — exp of the cross-entropy, the exact quantity a network minimises as its training loss. If the model were uniformly unsure between k tokens at every step, its perplexity would be exactly k; so a perplexity of 60 means "as confused as choosing among 60 equally likely tokens". Lower is better.

## smooth-p2

**Bet:** before running it — what will the unsmoothed trigram model's perplexity on the 5 000 test jokes be? Type a number.

## ppl-note

**Infinity.** Not a large number — infinity. One unseen trigram anywhere in 5 000 jokes gives P = 0 for that token, log 0 = −∞ for the sum, and the whole test set is "impossible" according to the model. How often does this happen? Count, for each n, the share of test n-grams that never occurred in training:

## smooth-note1

This plot is the reason the rest of the seminar exists. At n = 1 the word model already has a few percent of test tokens it has never seen; the BPE model has none — that is what subwords bought us. At n = 3 roughly a third of the test trigrams are new; at n = 5, almost all of them. Ten times more data would move these points a little, not change the shape, because the number of possible n-grams grows exponentially with n and the corpus grows linearly. The problem has a name — **sparsity** — and the classical fix is to stop trusting the counts.

## smooth-p3

Every smoothing method is the same idea: take a little probability mass away from the n-grams you have seen and spread it over the ones you have not. **Add-δ** pretends every possible continuation was seen δ extra times — nothing is zero any more, but with |V| = 134 000 and δ = 1, a prefix seen ten times gets 134 000 imaginary observations added, and the ten real ones drown. **Interpolation** (Jelinek–Mercer) is the smarter move: when the trigram estimate is unreliable, lean on the bigram, and behind it the unigram. Kneser–Ney is the best classical method; we do not implement it — <span class="mono">nltk.lm</span> and KenLM have.

## smooth-p4

**Bet, three questions.** Answer all three, then reveal the table.

## bet-sm-n

(1) Which n wins once we smooth?

## bet-sm-delta

(2) Laplace with δ = 1 against δ = 0.01 — which is better?

## bet-sm-interp

(3) Does interpolation beat the best single-order model?

## smooth-note

**Add-1 is a disaster** and gets worse with n: the trigram with δ = 1 is worse than the unigram. Two hundred thousand imaginary observations per prefix flatten every distribution toward uniform. Add-0.01 is far better — the smoothing constant is a hyperparameter, and the textbook value of 1 is the wrong one on any realistic vocabulary. **Interpolation wins**, by letting the model fall back gracefully: when the trigram has never seen the prefix, the bigram usually has. **The 5-gram does not win**, even interpolated: the 4- and 5-gram counts are almost all ones (look at the sparsity plot again). More context is only useful if you have the data to estimate it. This is the ceiling of counting.

## smooth-p5

Now the same experiment on BPE tokens — the units every neural model on this page uses. Look at the two <span class="mono">test_ppl</span> columns. The BPE trigram has a perplexity several times *lower* than the word trigram. Is it a better model?

## smooth-note2

No. It is the same algorithm on the same text. What changed is **what a token is**. Predicting a subword piece is an easier task than predicting a whole word — half the time the next piece is the obvious end of the current word. Per-token perplexity rewards you for cutting the text finer, and it rewards you for nothing; it is useless for comparing across tokenizers. The fix is to divide the same negative log-likelihood by the number of *characters*: that is <span class="mono">bits/char</span>, and it is a real quantity — how many bits per character an ideal compressor built on this model would need. But read that column carefully, because it contains a second trap: the word model's bits/char comes out *lower*. The word tokenizer throws away every space and punctuation mark — one character in five — and is never charged for predicting them. Divide a smaller description length by the full character count and you get a flattering number for a model that is simply modelling less of the string. **Even bits/char is only fair when the models account for the same string.** BPE is reversible, so within the BPE family the number is honest, and the honest baseline to beat is the interpolated **BPE trigram**. Keep it in mind — a well-smoothed count model is not a weak opponent.

## smooth-note-measured

**Add-1 is a disaster** and gets worse with n: the trigram with δ = 1 ({add1}) is worse than the unigram ({uni_ppl}). {n_types} imaginary observations per prefix flatten every distribution toward uniform. Add-0.01 is far better — the smoothing constant is a hyperparameter, and the textbook value of 1 is the wrong one on any realistic vocabulary. **Interpolation wins** ({interp_model}, {interp_ppl}), by letting the model fall back gracefully: when the trigram has never seen the prefix, the bigram usually has. **The 5-gram does not win**, even interpolated ({ppl5}): the 4- and 5-gram counts are almost all ones — look at the sparsity plot again. More context is only useful if you have the data to estimate it, and we have two million words. This is the ceiling of counting.
