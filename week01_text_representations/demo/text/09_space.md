# space · The semantics and the space

## space-p1

Remember, we wanted to create embeddings where the distance between words means something? Type any three words and the arithmetic runs for real, so we can test how we're doing.

## space-why1

Newer vectors live on the HuggingFace Hub rather than in gensim's catalogue — the same GloVe files are mirrored as `fse/glove-twitter-100`. The library is not the stale part: gensim 4.4 shipped in October 2025, while `torchtext` was archived in 2024.

## an-note

With the inputs kept, the nearest vector to <span class="mono">king − man + woman</span> is **king itself**; <span class="mono">queen</span> is second, and close. The arithmetic is not moving you to a new region of the space — it is actually barely moving you at all, and <span class="mono">most\_similar</span> excludes the inputs by construction. See Nissim, van Noord &amp; van der Goot (2020), *Fair is Better than Sensational*.

## space-note1

Remember, we used the twits from 2014. Twitter itself is a pretty... specific place, and have always been. They encode what that corpus said about who does which job, and any system built on top inherits it silently, so model will accept every type of -ism you'll show it. The same concept will follow us during the whole course — it is the same mechanism in every model this course will touch, even the biggest ones and the modern ones. See Bolukbasi et al. (2016) to know more about language models' bias.

## space-p2

Every two-dimensional picture of an embedding space is a projection with parameters, and the parameters change the picture. The same 1 000 words, the same vectors, four values of t-SNE’s perplexity:

## space-why2

Both have a knob that changes the picture without changing the data, and neither preserves global distances. Use them to look, never to measure — if you need a number, compute it in the original space.

## space-note2

Cluster sizes, distances between clusters and the amount of empty space are all artefacts of the setting, not properties of the data. See Wattenberg, Viégas &amp; Johnson, *How to Use t-SNE Effectively* (Distill, 2016).

## space-p3

To classify with word embeddings you need one vector per document, and the simplest way is to average the vectors of the words in it. Same test set, same logistic regression on top, only the left factor changes:

## space-why3

Better aggregations exist and are still three lines: SIF weighting (Arora et al. 2017) plus removing the first principal component beats the plain mean reliably. Past that you stop pooling word vectors and encode the sentence directly — `sentence-transformers`, which is where week 6 and later go.

## space-note3

Mean pooling and IDF-weighted pooling land in the same place, and both lose to a bag of counts from 1972 — while costing four times the vectorizing time. The full table in block 10 puts these two rows next to everything else built today.

## space-p4

**And then the punchline from the table.** Averaged embeddings lose to TF-IDF. A representation from 2013 with real semantics inside it loses to one from 1972 that knows nothing but counts. TF-IDF hands the classifier one parameter per word. Mean pooling hands it 100 numbers produced before the labels were seen: every word's contribution is fixed by the embedding, and a single decisive rare word is diluted to 1/n of the average. The head cannot undo that compression, however good the compression is.

## an-out-missing

Not in the 8 006-word subset: {missing}. The full model has 1.2 million tokens; this page ships the most frequent slice.

## an-out-kept

With the inputs kept, the top of this list would be: <span class="mono">{top}</span>.
