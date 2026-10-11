# ngram · The n-gram language model, and its first text

## ngram-p1

The chain rule needs P(w<sub>t</sub> | everything so far). Nobody has counts for entire prefixes, so the second move is an approximation — the **Markov assumption**: only the last n−1 tokens matter. With n = 3 the model needs counts of triples, and triples we have. The estimate is the obvious ratio of counts. Two bookkeeping details every implementation needs: pad the start with n−1 copies of <span class="mono">[BOS]</span>, and append <span class="mono">[EOS]</span> and count it like any other token, so the model can learn *when a joke ends*.

## ngram-p2

To get text we *pick* from the distribution, one token at a time, feeding each choice back in as context — autoregressive generation, the way every LLM works too. Generate, then read the highlight: the orange run is the longest stretch that occurs verbatim in the training jokes.

## ngram-note1

Every three words came from a real joke, but two words later the model has forgotten what the joke was about — the Markov assumption, as advertised. Small n babbles, large n quotes; nothing in between generalises, because counting has no notion that two prefixes are similar.

## ngram-why1

For anything beyond a seminar: `nltk.lm` has the smoothing methods below already written, and `kenlm` counts billions of n-grams in C++ with modified Kneser–Ney — still the baseline to beat when you have text and no GPU.

## ng-copied

n = {n}, seeds {seed_lo}–{seed_hi}. Orange: the longest run that occurs verbatim in the 8 000 training jokes counted here. A <span class="dead">⟂</span> is a dead end — a prefix that never occurred, so the unsmoothed model has nothing to sample from; that is the zero we fix in block 03.
