# dial · Head only, top blocks, everything

## dial-p1

First a question about the frozen body that we skipped: we took the *last* layer's vectors. BERT has thirteen (the embeddings, then twelve blocks). A logistic regression on the mean-pool of each — a **linear probe** — asks: *which layer knows the topic best?*

## bet-layer

Which layer wins — the last one? The middle? Draw the curve in your head.

## layer-note

Layer 0 is the embedding table — a bag of WordPiece vectors, averaged: week 1's "average the word vectors" row. One block of mixing buys two points, the second one more — and then the curve is flat. Layers 2 to 12 all sit inside the noise of a 7 600-text test set. No peak in the middle, no dip at the end. The last layer is a *convention*, not a measured choice: when you freeze a body you probe rather than assume.

## dial-note1

Bottom to top: the embeddings, twelve blocks, the pooler, the head. Frozen parts are grey; what moves is coloured. The pooler sits above the last block, so it moves whenever any block does. The measured accuracy and the bill appear on the knob after the reveal below — and the knob then moves the point on the chart.

## dial-p2

Now let the body move — a little, then more. `set_trainable(body, k)` unfreezes the top $k$ blocks and leaves the rest as it came. Four settings, same data, same epochs.

## bet-dial-pass

(1) The smallest setting that passes week 1's 0.92?

## bet-dial-gap

(2) The gap between "top 6 blocks" and "everything"?

## dial-note

**Head only** is the 2.4 row again, and still under TF-IDF. The x-axis is logarithmic: the next point is *four thousand times* more parameters. **Two blocks** — 13% of the body — and we almost pass week 1's line. **Six blocks, everything:** a little more each, at the usual diminishing rate. Read the right plot as the bill. The forward pass through 110M parameters is paid whatever you freeze; what freezing saves is the *backward* pass and the optimizer state.
