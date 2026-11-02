# ngram · Counting, and its ceiling

## ngram-p1

The chain rule needs $P(w_t | w_1, …, w_{t-1})$, a distribution conditioned on the *entire* prefix. Nobody has counts for entire prefixes. So the second move is an approximation, the **Markov assumption**: only the last $n − 1$ tokens matter. This is a lie, and a useful one — with $n = 3$ the model needs counts of triples, and triples we have.

## q-ngram-params · fill

A vocabulary of 8 000 pieces. A bigram table has up to [[b]] cells, a trigram table up to [[t]].

- b = 64 000 000 | 64000000 | 6.4e7 | V² | V^2 | V**2 | 8000² | 8000^2 | 64M | 64 million
- t = 512 000 000 000 | 5.12e11 | V³ | V^3 | V**3 | 8000³ | 8000^3 | 512 billion | 512G | 512 000 000 000

> $|V|^2$ = 64 million and $|V|^3$ = 512 billion possible cells, against 2 million tokens of training text. Almost every cell stays empty, and that is the sparsity plot in a different form: the table grows exponentially with $n$ and the data does not. In practice the model stores only the n-grams it saw — under a million for a trigram model on 2 million words — which is also why counting is fast and why it cannot generalise: an empty cell has no neighbours.
> miss: if $|V| × n$: that is the size of an *embedding* table, one row per word. The n-gram table is indexed by the whole prefix, so it multiplies.

## q-fivegram · pick

Trigram samples read as coherent for three words, then nonsense. The 5-gram samples read *much* better. What is happening?

- [x] it is reciting: almost no 4-word prefix was seen more than once, so the "distribution" is a single option and sampling is table lookup
- [ ] it generalises better because it sees more context
- [ ] it has learned the structure of a joke
- [ ] the trigram was undertrained; the 5-gram just needs more epochs

> Memorised, not learned. Sample from a 5-gram model trained on 2 million words of jokes and {copied5_pct} of what it writes is a training joke, copied; for the trigram it is {copied3_pct}. With 2 million words there are almost no 4-word prefixes that occurred twice, so the next-word distribution after most of them has one entry, and the model walks through a stored joke. This is the n-gram dilemma in one experiment: small $n$, coherent for three words then nonsense; large $n$, coherent because it is quoting. There is no setting in between where it generalises, because counting has no notion that two prefixes are similar. Neural models exist to fix exactly that.
> miss: if "more context, better model": that is true only with the data to fill the context. The 5-gram, even interpolated, did not beat the trigram on perplexity either — the extra orders are almost all counts of one.

## ngram-p2

The fix for sparsity is to stop trusting raw counts. **Add-δ** (Laplace) smoothing pretends that every possible continuation was seen δ extra times. **Interpolation** mixes the trigram estimate with the bigram and the unigram, so that when the long context was never seen, the short one still speaks. **Kneser–Ney** also changes what the lower-order model counts, and was the state of the art for twenty years.

## q-smooth · pick

Every smoothing method does the same thing. Which?

- [x] takes a little probability mass away from the n-grams that were seen and spreads it over the ones that were not
- [ ] adds more training data
- [ ] lowers $n$ until every prefix has been seen
- [ ] removes rare words from the vocabulary

> Stop assigning zero: move mass from the seen to the unseen. The methods differ in how much and how cleverly. Add-$δ$ pretends every continuation was seen $δ$ extra times — and with $δ = 1$ and a 200 000-word vocabulary a prefix seen ten times gets two hundred thousand imaginary observations added to its total, so an add-1 trigram on the jokes ({add1_3gram_ppl} perplexity) comes out *worse than the unigram* ({unigram_ppl}). Interpolation falls back to the bigram and the unigram when the trigram is unreliable, and won. Kneser–Ney also changes *what* the lower-order model counts — in how many contexts a word appears, not how often — and was the state of the art for twenty years.
> miss: if "add-1 is the standard": the textbook constant is the wrong one on any realistic vocabulary. The smoothing constant is a hyperparameter, and 0.01 beat 1 by an order of magnitude here.
