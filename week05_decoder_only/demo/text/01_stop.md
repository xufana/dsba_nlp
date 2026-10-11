# stop · Two tables

## stop-p1

Same 120 000 texts, same four classes, same test set, same TF-IDF at 0.92 from week 1. Two functions we use all day: `target_text` drops the tokens that are punctuation and nothing else — that is the text we will ask models to restore in block 05 — and `strip_text` is what a speech recogniser hands you: lower case, no punctuation. Apostrophes stay, because they are pronounced.

## stop-p2

Last week had one table: AG News accuracy, one row per way of using the body. It is back, with its three rows from weeks 1 and 4. Today has a second table, and it is the one this seminar is about: **what an answer costs**. Four numbers per row — forward passes per item, tokens read, tokens written, and milliseconds per 1 000 items on the machine that measured it. Every reveal in block 05 writes one row into each table, and at the end we read the two side by side.

## stop-p3

Week 3 built the middle one — encoder and decoder, joined by cross-attention. Week 4 took the left one, threw the decoder away, and put a head on top. Today is the right one: the decoder from week 3 with the cross-attention removed, and *no head to put anything on*.
