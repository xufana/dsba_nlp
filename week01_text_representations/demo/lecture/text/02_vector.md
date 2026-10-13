# vector · What is the vector, actually?

## vector-p1

A **bag of words** represents a document as one number per vocabulary word. The vocabulary is the columns; each document is a row. That is the whole idea — the document becomes a point in a space with one axis per word. Two things are already gone and will not come back: **word order** and **anything not in the vocabulary**.

## vector-p2

Raw counts are a poor number to put in a cell, for two reasons. A long document has bigger counts for everything, so it looks different from a short one about the same thing. And a word that occurs in every document — `the`, `today` — gets large counts while telling us nothing about which document this is. **tf-idf** fixes both, in three steps.

**Term frequency** divides the count by the length of the document: $\mathrm{tf}(t, d) = \frac{N(t, d)}{|d|}$, how much of *this* document the word is.

**Inverse document frequency** measures how much the word distinguishes documents across the corpus: $\mathrm{idf}(t) = \mathrm{ln}\frac{|D|}{\mathrm{df}(t)}$, where $\mathrm{df}(t)$ is the number of documents that contain $t$. A word in one document of four gets $\mathrm{ln}\,4$; a word in all four gets $\mathrm{ln}\,1 = 0$.

**Multiply, then normalise**: the cell is $\mathrm{tf} · \mathrm{idf}$, and each row is divided by its length, so that every document is a vector of length 1. Libraries usually smooth the idf so that it never reaches exactly zero; the idea does not change. Click a cell below to see what is written in it and where it came from.

## matrix-note

Columns are the vocabulary, sorted; rows are the documents. A cell is tf × idf, divided by the length of its row. Computed in your browser.

## q-twice · pick

In `d0 = oil prices rise today` the cell for `prices` holds {w_prices_1}. Now write `prices` twice: `oil prices prices rise today`. What happens to the row?

- [ ] the `prices` cell doubles, the others stay as they were
- [x] the `prices` cell grows, but less than twice — and every other word in the row loses weight
- [ ] nothing: tf-idf only records whether a word is present
- [ ] the `prices` cell grows and the idf of `prices` grows with it

> The row `d0`, computed in your browser before and after:
>
> <div data-fig="tfidf-twice"></div>
>
> `prices` goes from {w_prices_1} to {w_prices_2} — up, but not doubled. Two things hold it back. The tf is relative: two occurrences in a five-word document is 2/5, not 2/4. And the normalisation keeps the row at length 1, so whatever `prices` gains the other words have to give up: `rise` falls from {w_rise_1} to {w_rise_2}, `oil` from {w_oil_1} to {w_oil_2}. A tf-idf weight is a *share* of the document, not a count. The idf does not move at all — it depends on how many documents contain the word, and `prices` is still in the same two.
> miss: if "doubles": that would be true of raw counts. tf divides by the length and the normalisation divides by the row's size, so the cells compete with each other.

## vector-p3

Where the columns come from matters as much as what goes in them. The vocabulary is collected once, from the training documents, and fixed: every later document is mapped onto those columns. Before anything is counted the text goes through preprocessing — usually lowercasing and splitting into tokens — and whatever the preprocessing merges or drops never reaches the vector.

## q-newdoc · pick

A new headline arrives at test time: nine words, two of them never seen in training. How long is its tf-idf vector?

- [ ] 9 — one number per word in the headline
- [ ] 7 — the two unseen words have no column
- [x] |V| — the number of columns was fixed by the training set
- [ ] |V| + 2 — the two new words get columns of their own

> |V|, and nothing else is possible: the columns are the training vocabulary. The new headline has at most seven non-zero cells out of |V| — tens of thousands on a real corpus — and the two new words leave no trace at all: not an error, not an `[UNK]`, just nothing. The block on out-of-vocabulary words is about exactly that.
> miss: if 7 or 9: you described the headline, not the vector. A vector is a point in a space whose axes were chosen before this headline existed.

## q-changes · pick

Which one of these changes the tf-idf vector of a document? (Lowercasing is on, as usual.)

- [ ] swapping two words
- [x] repeating a word
- [ ] writing a word in capitals
- [ ] adding a word that is not in the vocabulary

> Only the repetition: the count of that word grows, and its cell with it. Order was thrown away at step zero — `oil prices rise, stocks fall` and `oil prices fall, stocks rise` are the same row, cosine similarity exactly 1. Casing is removed before anything is counted. And a word outside the vocabulary has no column; it changes nothing except the length $|d|$ in the tf, which the final normalisation removes again.
> miss: if the unseen word: adding it changes nothing *because* the vector cannot see it. That is the OOV problem, stated as a non-event.

## vector-p4

The last step deserves a second look. Normalising each row to length 1 means the vector says *in what proportions* the document uses its words, and nothing about how long it is.

## q-oneword · pick

A document that is the single word `oil`, written three times and nothing else. After normalisation its vector has

- [ ] one non-zero cell, holding 3 × idf(oil)
- [x] one non-zero cell, holding 1.0
- [ ] three non-zero cells
- [ ] no non-zero cells — `oil` is too common

> One cell, and it is 1.0: the row is $(0, …, \mathrm{tf} · \mathrm{idf}, …, 0)$, and dividing by its own length leaves exactly 1. The count and the idf cancel. A tf-idf weight is *relative within the document*, and a one-word document is all that word. (If `oil` were in every training document its idf would be 0 and the row would be all zeros — the one case where the answer changes.)
> miss: if 3 × idf: you stopped before the last step. The normalisation is the step that makes documents comparable.
