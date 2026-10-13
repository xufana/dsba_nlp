# oov · Out of vocabulary (theory only; the interactive part of this block is Zipf's law, 04b_zipf.md)

## oov-p1

A word the training set never contained. It happens three different ways — a misspelling, a name nobody had used yet, a rare form of a word everybody knows — and the question is not whether it happens. On clean English news with a large training set it is a fraction of a percent of test tokens (on AG News, {oov_rate_pct}), mostly timestamps and article codes; on Russian, on chat text, on a small training set it is an order of magnitude more. The question is what a representation does when it happens.

## oov-p1b

For a bag of words nothing raises. The new word has no column, so the row is computed as if the word were not there. The model is not *wrong* about the word, it is blind to it — and blindness is silent, which is the dangerous part: a product name, a new disease, a typo in the one word that carried the label all vanish without a trace in the logs. word2vec at least fails loudly: it has no row for the word and raises an error.

## oov-p2

There are three families of answers. **Normalise** the word to something that was seen: stemming and lemmatisation map the forms of a word onto one stem or lemma, so `walked` meets `walking`. **Change the unit**: cut words into pieces that are always known — character n-grams, or the subwords of BPE, which falls back to single characters if it must, so nothing is ever out of vocabulary. **Build the vector from pieces**: fastText represents a word as the sum of the vectors of its character n-grams, so an unseen word still gets a vector from the pieces it shares with seen ones. And word2vec has none of these: one row per training word, and nothing for anything else.

## oov-table-intro

Here is what each of them does with three words that are not among the {vocab_size} words of the AG News training set — a misspelling, a new brand name and a rare form of a known word. Every cell is computed by the real tool.

## oov-table-caption

Porter's stemmer, character 3–5-grams, the `cl100k_base` BPE tokenizer and fastText's n-grams, run on these three words against the AG News training vocabulary.

## oov-p3

Read the stemming row first, because it is the one the textbook gets wrong. Porter turns `recieved` into `reciev`, and no training word stems to that — the stem of `received` is `receiv`. Stemming rescues **morphology**, not spelling: `unbelievability` → `unbeliev`, which is also the stem of `unbelievable`, a training word, so that one is saved. A misspelling and a new name are not. Character n-grams never fail completely — {ng_recieved} of the {ng_total_recieved} n-grams of `recieved` were seen in training, as pieces of `received`, `believed`, `achieved`. BPE never fails at all: `{bpe_recieved}`, pieces that are in the vocabulary by construction. fastText builds the vector as the sum of {ft_recieved} n-gram vectors, and `recieved` lands next to `received` because they share most of them.

## oov-p4

Every fix has a bill, and the bill is the same in different currencies: things that look alike are treated alike, whether or not they *are* alike. Character n-grams pay in dimension — a news corpus has tens of thousands of words and hundreds of thousands of distinct 3–5-grams, most of which separate nothing. fastText pays in the vector space: `recieved` is near `received`, good, but so is any pair that shares a long substring. Stemming pays in collisions, `universe` and `university` in one column, and buys nothing for spelling. BPE moves the cost from the vocabulary into the sequence: nothing is ever unknown, but a rare word becomes several tokens, each a step to compute and a place to be wrong, and the pieces have no meaning of their own — `rec` is in `record` and `recipe` as well.
