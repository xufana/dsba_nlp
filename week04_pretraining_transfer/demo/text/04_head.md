# head · Shape, attachment point, loss

## head-p1

Whatever the task, the body does one thing: a batch of $B$ texts, each $L$ tokens long, goes in, and a tensor ${H=\text{body}(x)∈ℝ^{B×L×d}}$ comes out — one 768-vector per token. A **head** is whatever turns $H$ into the answer, and for every task we'll meet it is *one Linear layer*. The tasks differ in three places only: **which part of $H$** the Linear reads, **what shape** comes out, and **along which axis the softmax runs** inside the loss.

## head-note1

Look at the last two. NER and QA both read *all* of $H$ and both produce a `[B, L, something]` tensor. The difference is one word: NER normalises **over classes** at every position ("what is this token"), QA normalises **over positions** ("which token starts the answer"). That is also why extractive QA is *not* "tag every token as start / end / neither" — the version you'd write if you thought of it as NER with three labels. Tagging gives you a decision per token, independently, so you can get four starts and no end. Two softmaxes over positions give you exactly one start and exactly one end, by construction.

## head-note2

**Sequence classification reads `outputs[1]`** — the pooler. Our `SequenceHead` reads `H[:, 0]` directly. **QA is `Linear(d, 2)` then `split` into two `[B, L]` tensors.** Exactly `SpanHead`. And the loss in the source — go look — is two `CrossEntropyLoss` calls over the position axis. One more thing these classes do that ours don't: when you load one, the body weights come from the checkpoint and **the head weights are random**.

## head-note3

Six thousand parameters for NER against a hundred and ten million in the body. If the body's vectors already contain "this token is the name of a person", a Linear is enough to read it out — and if they don't, no head will fix it. The library prints `classifier.weight MISSING`: the "pretrained model" you download for a task is *this* — a pretrained body and a coin-flip head — until you train the head.

## head-note4

Not far off the *pooler* + logreg row of 2.4 — and it *is* that row: the library's head reads the pooler output, the pooler is frozen with the body, and a Linear on a frozen vector trained with SGD is a logistic regression on that vector. Same thing, written in `torch`. That's the bottom setting of the dial. Now let's turn it.

## fig-heads-note-seq

**Sequence classification** reads one row of $H$ — position 0, `[CLS]` (the library reads it through the pooler) — and a `Linear(768, C)` turns it into `[B, C]`. The softmax runs *along the row*: which of the C classes is this text. The other L−1 vectors are computed and thrown away.

## fig-heads-note-tok

**Token classification** applies the *same* `Linear(768, C)` to every row: `[B, L, C]`. The softmax runs along *each row separately*: which of the 9 tags is *this* token. L independent decisions; the loss is a cross-entropy per row, skipping the rows labelled −100.

## fig-heads-note-span

**Span extraction** applies a `Linear(768, 2)` to every row — two numbers per token, a start score and an end score: `[B, L, 2]`. `unbind(-1)` splits the two *columns* apart, and each column is one softmax *down the positions*: which token starts the answer, which token ends it. That is why the output size is 2 and not 3: not "start / end / neither" per token, but two distributions over L.

## head-untrained-unexpected

… 8 UNEXPECTED keys: the MLM and NSP heads of the checkpoint, dropped
