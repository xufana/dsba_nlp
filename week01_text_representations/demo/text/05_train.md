# train · Watch the classifier learn its vocabulary

## train-p1

The same logistic regression that produces the second row of the results table in block 10, but small enough to run here: 6 000 documents, a 4 000-word vocabulary, softmax regression trained by minibatch SGD *in this page*. Nothing is precomputed. The curves are the usual ones — the third panel is the one to watch, because the weights of a linear model on a sparse representation are literally words, and you can see them arrive.

## train-why1

`SGDClassifier` is the one to reach for when the matrix stops fitting in memory: it takes `partial_fit`, so you can stream. For a stronger non-linear head on sparse text, `LinearSVC` first, then `lightgbm` — but read block 10 before you spend the time.

## train-note1

At epoch 0 every coefficient is zero and the four lists are empty. Words arrive in order of how much evidence they carry, and the news agencies — <span class="mono">afp</span>, <span class="mono">ap</span>, <span class="mono">reuters</span> — surface among the first, which is block 05 arriving on its own before anyone points at it. The full model in the table is this, run to convergence on twenty times the data.
