# data · 124 000 jokes, and why counting words will not be enough

## data-p1

One joke per block, scraped from a Telegram channel, nothing shorter than 20 characters. Fair warning: the corpus is not curated, so the humour ranges from sharp to crude — as will, therefore, everything our models generate. One shuffle with the seed, then a cut: 5 000 test jokes we never train on, 2 000 for validation curves, the rest is training data. Every artifact on this page was trained on exactly that split.

## data-note1

Short texts, a long tail. That shape is the reason the whole seminar works on a laptop: the model has to hold a hundred characters in mind, not a chapter.

## data-p2

Before any model, a guess. The training set has about two million word occurrences. How many *distinct* words is that, and what share of those distinct words occurs **exactly once**? Move the slider, then reveal.

## zipf-note

Roughly half the vocabulary was seen **once**. Not "rarely" — once. Any estimate of P(next word | …) for those words is a single coin flip, and for the words that show up in the test set for the first time it is exactly zero. The straight line on log-log axes is Zipf's law, and it is the bill for working with words as units: no matter how much text you collect, a constant fraction of it is made of things you have never seen. Russian makes it worse — *кот, кота, коту, котом, коте* are five different words to a word tokenizer. Two answers, and we need both: change the unit (block 01) and stop assigning zero to the unseen (block 02).
