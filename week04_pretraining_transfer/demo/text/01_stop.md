# stop · The data — AG News, again

## stop-p1

AG News is back: same 120 000 news texts, four classes, same test set, same TF-IDF + logistic regression at 0.92 accuracy from week 1. It's here for one reason — the results table. Every row of today's table is one representation of the same texts, and week 1's row 0 is the number to beat.

One change from week 1: the data comes from the Hugging Face hub through `datasets`, not from a CSV. Everything today — the model, the tokenizer, the data, the training loop, the metrics — is the `transformers` stack. Two datasets are new, because two of today's tasks are not classification of a whole text — CoNLL-2003 for named entity recognition and SQuAD v1.1 for extractive question answering. Each one is loaded where its task begins.

## stop-p2

AG News only, one row per way of turning the pretrained body into a classifier. We fill it during the seminar — for now only row 0 is there. It stays in the rail on the left: every reveal today adds a row, and the dashed line is the number to beat.
