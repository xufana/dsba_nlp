# repr · What we want from a vector

## repr-p1

Before any method, the demand. A classifier can do only a few things with its input: add it up, compare it, draw a line through it. So whatever we turn a string into has to be an object those operations make sense on — numeric, of a fixed size, and with a geometry that means something. The last one is the whole difficulty. We want `like` to sit near `love` and both of them far from `geografia`; we want the vector of a text to be buildable from the vectors of its words; we want it cheap, at a million documents; and we want it from the data we actually have, which is text, mostly without labels.

## repr-p2

The first thing anyone tries is to number the words. That pretends `cat` = 7 is closer to `dog` = 8 than to `house` = 200, so the next move is to give every word its own axis instead: **one-hot**, a vector of |V| zeros and a single 1. It is numeric and fixed-size, and it is useless as a representation of meaning. Every two words are at exactly the same distance, so `like` is as far from `love` as from `geografia`. Whatever the model learns about `love` tells it nothing about `like`. And a word that was not in the vocabulary has no axis at all — not a bad vector, no vector; two different unknown words are the same nothing. The dimension is the size of the vocabulary, tens of thousands, almost all zeros.

## ohe-caption

Three words, three axes. The dot product of any two rows is 0: the representation knows that the words differ, and nothing else.

## repr-p3

There are two objects to represent, and they want different things. A **word** vector should carry meaning — the geometry above, which we cannot read off the word itself and have to get from somewhere: from its contexts in a corpus, or from the labels of a task. A **text** vector should make the operation cheap — classification, search, deduplication — and it has to turn a variable number of words into one fixed-size object: a sum, an average, or something learned. That second step is a decision of its own, and it is where a good part of the meaning can get lost. We'll cover it later, stay tuned.

## repr-p4

Every method of this week makes four combinations: how the numbers are made — counted from the text, or learned by a model — and what gets a vector, a word or a text.

First, counted, per text: the bag of words and tf-idf, no semantics, very cheap, and the strongest baseline for the text-classification and regression tasks (speaking of the cost-quality tradeoff). Next, learned, per word: word2vec, GloVe, fastText — meaning by substitutability, learned from contexts. Though they are learned per word, next they can be assembled per text: mean pooling, the cheapest bridge between the two objects. Learned per *occurrence*: the contextual models of week 4, where `bank` finally gets two vectors. Each cell bought something and paid for something; none of them replaced the others.

## map-caption

Rows: how the numbers are made. Columns: what gets a vector. Click a cell in the question below.

## q-want · write

A vector for a word. What must be true of it for a classifier — or a search engine — to be able to use it? List the requirements, not the methods.

- fixed size, numeric
- distance means something: `like` near `love`, far from `geografia`
- a text's vector can be built from its words' vectors
- cheap to compute and to compare, at the size of a real corpus
- obtainable from what we have — text, mostly unlabelled

> Five things, and most methods satisfy three. Fixed-size and numeric is the price of entry. A geometry that reflects meaning is the hard requirement, and the one that one-hot, the bag of words and tf-idf all fail — by construction, not by accident. Composability is what lets a word representation become a text representation; it is also where meaning leaks. Cost decides what runs in production. And the source decides what is possible at all: a representation that needs labels for every word does not exist for most languages and most domains, which is why the field spent sixty years learning meaning from raw text.
> miss: if the list is "captures semantics" and nothing else: that is the one everyone remembers, and the other four are why tf-idf is still in production and a dictionary of meanings is not.

## q-ohe · fill

One-hot vectors for `like`, `love` and `geografia`. The cosine between `like` and `love` is [[a]]; between `like` and `geografia` it is [[b]]; the vectors have [[d]] dimensions.

- a = 0 | 0.0 | zero
- b = 0 | 0.0 | zero
- d = V | |V| | the vocabulary size | vocabulary size | vocab size | number of words | the number of words in the vocabulary

> 0 and 0: every pair of distinct words is orthogonal, so the representation cannot prefer `love` to `geografia` as a neighbour of `like`. The dimension is the vocabulary. Those two facts are the same fact — one axis per word means no axis is shared, and sharing is what similarity would have to be made of.
> miss: if the cosines came out different: you gave the words some structure they do not have. One-hot is exactly "these are different", nothing more.

## q-ohe-why · pick

What is wrong with one-hot as a representation of a word? Tick everything that applies.

- [x] every two words are at the same distance — no similarity at all
- [x] the dimension is the whole vocabulary, almost all zeros
- [x] a word outside the vocabulary gets nothing, and two unknown words are indistinguishable
- [ ] it is slow to compute
- [ ] it loses the order of the letters

> Three real faults, and they are one fault seen three times: nothing is shared between words. No shared axis, so no similarity; one axis per word, so the dimension is |V|; no axis for a new word, so unseen means absent. It is instant to compute and it is exact, which is why it survives as the *input* to things that learn — the lookup into `W_in` in the word2vec block is one-hot times a matrix — just never as the output.
> miss: if "slow": it is the fastest representation there is. The cost of one-hot is not time; it is that it knows nothing.


## agg-p1

How do we get from word vectors to one vector for a text? The simple ways are all arithmetic over the word vectors: **sum**, **mean**, **max** per coordinate, a **weighted mean** (by idf, so rare words count more), **concatenation**, or keeping **one word** (the last, the first). The requirements come from what the classifier needs: one fixed size for every text; nothing new to train, so it works the moment you have word vectors; every word contributing; no dependence on length, or a long review and a short one with the same content end up in different places; and similar texts close together. Check them yourself — every number below is computed in your browser on toy 2-d word vectors:

<div data-fig="agg"></div>

Concatenation fails the first requirement at once, the last word ignores every other word and depends on order, the sum fails length, max keeps only the loudest word per coordinate. Mean and weighted mean pass all five — that is why mean pooling is the default bridge. And the last column fails for *every* row: no arithmetic over word vectors knows that `not` flips `good`, because a sum does not know which vector stood next to which. Order and composition need a model that reads the sequence — that is where weeks 2–4 go.

## q-agg-props · pick

The mean of a text's word vectors. Which of these does it keep? Tick all that apply.

- [x] a fixed size for any text
- [x] the same vector for a text and that text written twice
- [x] a contribution from every word
- [ ] the order of the words
- [ ] the effect of `not` on the word after it

> The first three, and not the last two. The mean is fixed-size, length-invariant and hears every word — though each word gets only $1/n$ of the vote, so one decisive rare word in a long text is diluted; the weighted mean softens that. Order and negation are lost by construction: the mean of `good film` and `film good` is the same point, and `not a good film` lands next to `good film`, as the cosine in the table shows.
> miss: if you ticked order: the windows of word2vec saw order while training the word vectors, but the mean throws positions away. What the words learned does not survive into how they are added up.

## q-two-objects · sort

Which object does each method give a vector to?

bins: a word · a text · each occurrence of a word, then pooled

- tf-idf → a text
- word2vec → a word
- GloVe → a word
- fastText → a word
- mean pooling of word vectors → a text
- an LDA topic vector → a text
- BERT (week 4) → each occurrence of a word, then pooled

> The count methods represent texts directly, because they count what a text contains. The learned static methods represent words, and getting from them to a text is a separate step — pooling — with a price of its own. The contextual models represent *occurrences*: the same word gets a different vector in every sentence, and a text vector is again a pooling decision on top. Keep the two objects apart when you read a paper: "sentence embeddings" and "word embeddings" are different problems with different requirements, and a good solution to one is routinely a weak solution to the other.
> miss: if word2vec went to "a text": gensim gives you a vector per word. The text vector you have seen built from it was *your* average, not the model's.

## q-map · point

Where does the mean of word2vec vectors sit? Click the cell.

<div data-fig="repr-map"></div>

- [ ] cw: counted · per word
- [ ] ct: counted · per text
- [ ] lw: learned · per word
- [x] lt: learned · per text

> Learned, per text — with the catch that only the word vectors were learned; the text vector is assembled by an average that nobody trained. That is why the cell is weaker than it looks, and why with plenty of labels a tf-idf baseline often beats it: the counted-per-text cell gives the classifier one parameter per word, the assembled one gives it 100 numbers fixed before the labels were seen. The other cells: counted per text is the bag of words, tf-idf and LDA; learned per word is word2vec, GloVe, fastText; counted per word is the co-occurrence matrix and LSA, the ancestor of the learned row. Week 4 adds a column the table does not have yet — per occurrence.
> miss: if "learned · per word": those are the inputs. The question was about the object you hand to the classifier, and that is a text.
