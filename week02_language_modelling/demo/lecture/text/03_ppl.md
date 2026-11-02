# ppl · A number for the model

## ppl-p1

Looking at samples is not a metric. The metric for a language model is how much probability it assigns to text it has not seen, and by convention we report it as **perplexity**: $\mathrm{PPL} = \mathrm{exp}(-\frac{1}{T} \munder{∑}{t} \mathrm{log} P(w_t | w_{<t}))$. Lower is better.

## q-ppl-mean · pick

A model has test perplexity 60. That means

- [x] on average it is as unsure as if it were choosing among 60 equally likely tokens — the effective branching factor of the text under the model
- [ ] it picks the right token about one time in 60
- [ ] its cross-entropy loss is 60
- [ ] it predicts 60% of the tokens correctly

> If the model were uniformly unsure between $k$ tokens at every step, its perplexity would be exactly $k$. So 60 reads as "as confused as a 60-way coin toss, on average" — a geometric average, so a few very confident positions and a few hopeless ones can land there too. The cross-entropy is $\mathrm{log} 60$, about 4.1 nats; the hit rate is a different quantity altogether, and a model can have a low perplexity while rarely putting the true token first.
> miss: if "one time in 60": that would be true only if the model were literally uniform over 60 candidates. It is the intuition behind the name, not a fact about accuracy.

## ppl-p2

A count model estimates every probability as a ratio of counts. That leaves the question of what it does with a continuation it has never counted — and on held-out text such continuations are not rare, because the number of possible n-grams grows exponentially with $n$ while a corpus grows linearly. The problem is called **sparsity**.

## q-ppl-inf · pick

A trigram model, counts only, no smoothing. Its perplexity on 5 000 held-out jokes is

- [x] infinity — one unseen trigram anywhere gives $P = 0$ for that token, and the whole test set is impossible
- [ ] about the vocabulary size
- [ ] about the training perplexity, a bit worse
- [ ] a large number, in the thousands

> Not a large number: infinity. $\mathrm{log} 0 = -∞$ in the sum, once, and the average is $-∞$. How often does it happen? On 2 million words of Russian jokes, {sparsity_w3_pct} of held-out trigrams had never occurred in training; at $n = 5$, {sparsity_w5_pct}. Ten times more data would move these points a little and not change the shape, because the number of possible n-grams grows exponentially with $n$ and the corpus grows linearly. The problem has a name, sparsity, and every smoothing method exists because of this one number.
> miss: if "in the thousands": that is the perplexity *after* smoothing. The textbook jumps straight there and skips the infinity that motivated it.

## q-ppl-sparsity · fill

Before smoothing, how sparse is it? Train a word trigram model on 2 million words of jokes. Roughly [[s3]]% of the held-out *trigrams* were never seen in training (give or take ten points).

- s3 = @sparsity_w3 ~ 10

> {sparsity_w3_pct} — nearly three quarters. At $n = 2$ it is {sparsity_w2_pct}, at $n = 5$ it is {sparsity_w5_pct}: almost everything. On BPE pieces the per-token numbers are a little lower, because shorter units are shared more, but the shape is identical: the tokenizer changed the units, not the problem. And it starts before any n-gram — roughly half of the word *types* in the training set occur exactly once ({hapax_pct}), so their next-word estimate is a single coin flip.
> miss: if you guessed a few percent: that is the unigram OOV rate, the number from week 1. If you guessed a third: that is the bigram number. Every extra token in the window multiplies the number of things that can be new.

## ppl-p3

Perplexity is an average *per token*, so it depends on what a token is. The same text cut into words and cut into subword pieces has a different number of tokens and a different difficulty per token. To compare models with different tokenizers, the same negative log-likelihood is divided by the number of *characters* instead — **bits per character** — because characters do not depend on the tokenizer.

## q-ppl-compare · pick

Two trigram models on the same jokes and the same test set — one over words, one over BPE pieces. The BPE model's per-token perplexity is several times lower ({bpe_trigram_ppl} against {word_trigram_ppl}). Is it the better model?

- [x] cannot say from this — predicting a subword piece is an easier task, and per-token perplexity rewards you for cutting the text finer
- [ ] yes: lower perplexity is better, that is the metric
- [ ] no: the word model is better, words carry the meaning
- [ ] yes, provided both saw the same training text

> It is the same algorithm on the same text; what changed is **what a token is**. Half the time the next piece is the obvious end of the current word, so per-token perplexity drops for free — and it drops for nothing. Perplexity is comparable only under the same tokenizer and test set. The fix is to charge the model per *character* instead — bits per character — because characters do not depend on the tokenizer; and even that is fair only when both models account for the same string. A word tokenizer that throws away spaces and punctuation — one character in five — is never charged for them, and its bits per character come out flatteringly low.
> miss: if "yes, lower is better": that is the sentence this block exists to break. Perplexity is a property of a model, a tokenizer and a test set together; change one and the number changes.

## q-ppl-loss · fill

The training loss of a neural language model is the cross-entropy. Perplexity is [[f]] of it.

- f = exp | e^ | the exponential | exponential | e to the power | exponent | 2^ if in bits

> $\mathrm{PPL} = \mathrm{exp}(\text{cross-entropy})$, when the loss is in nats, as PyTorch's `CrossEntropyLoss` is; $2^{\text{bits}}$ if you measured in bits. Nothing else: the loss curve you watch during training *is* the log of the perplexity curve, and a model that minimises one minimises the other. That is also why the number you get from `loss.exp()` on the validation set is the same quantity the n-gram table reported, and why the two could share one results table.
> miss: if "the logarithm": the other direction. Cross-entropy is the log; perplexity undoes it so that the number reads as a count of choices.
