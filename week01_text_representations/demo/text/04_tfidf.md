# tfidf · Building TF-IDF by hand, understanding how does the vector look like

## tfidf-p1

Before running anything on 120 000 documents, build the thing on four. Every number below is computed in your browser with <span class="mono">sklearn</span>’s exact formulas — edit the documents and watch the matrix move.

## tfidf-why1

The defaults matter more than the class: `lowercase=True`, `token_pattern=r"(?u)\b\w\w+\b"` (one-character tokens are dropped), `norm="l2"`, and the smoothed IDF you see in stage 3. For retrieval rather than classification, reach for BM25 instead — `rank_bm25`, or Elasticsearch/OpenSearch.

## tfidf-p2

**Bet:** two headlines, the same five words, opposite meaning. What is the cosine similarity of their TF-IDF vectors?

## tfidf-note1

To a bag of words those two headlines are *the same document*. One says oil fell and stocks rose; the other says the opposite. No classifier on top can tell them apart. Bigrams buy the local part of word order back — and on AG News take the vocabulary from 29 350 to 196 911 for **+0.002 accuracy**. On a task where order carries the label — sentiment, negation, intent — the same change is worth far more.

## tfidf-note

Read the last stage rather than skimming it. <span class="mono">today</span> holds the smallest non-zero weight in every row — it is in every document, so it distinguishes nothing. <span class="mono">rise</span> in <span class="mono">d0</span> gets {w_rise}, the largest in its row, because it appears once, in one document. {the_note} **This is the whole method.** Everything on the rest of this page is these five stages on a bigger vocabulary.

## tfidf-note-edit

Edit the documents above and every stage recomputes — this is <span class="mono">sklearn</span>’s exact arithmetic, running here.

## tfidf-caption-vocab

The columns. sklearn’s analyzer lowercases and keeps runs of two or more word characters, then sorts.

## tfidf-caption-counts

One number per vocabulary word. Word order and anything out of vocabulary are gone, and never come back.

## tfidf-caption-idf

sklearn smooths: idf = ln((1+n)/(1+df)) + 1. A term in every document is pushed to the floor of 1.0, never to zero.

## tfidf-caption-tfidf

tf × idf. A term’s weight is its frequency here times its rarity across the corpus.

## tfidf-caption-l2

Every row now has length exactly 1, so a ten-word and a thousand-word document are comparable.

## tfidf-note-the

<span class="mono">the</span> in <span class="mono">d2</span> gets {w_the} — higher than <span class="mono">game</span> or <span class="mono">team</span>, purely because it occurs twice.
