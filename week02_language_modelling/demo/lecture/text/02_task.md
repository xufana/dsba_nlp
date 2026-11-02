# task · The task at one position

## task-p1

Every position is a classification problem with $|V| = 8\,000$ classes: given the state, predict the next piece. The input at step $t$ is the token $w_t$; the target is $w_{t+1}$. So the model's input sequence is the joke with `[BOS]` in front, the target sequence is the same joke shifted left by one with `[EOS]` at the end.

## q-shift · point

Input and targets for one short joke. Click the token the model is trained to predict at position 2, where the input is `открыл`.

<div data-fig="shift"></div>

- [ ] y0: Штирлиц
- [ ] y1: открыл
- [x] y2: дверь
- [ ] y3: и
- [ ] y4: [EOS]

> `дверь`: at every position the label is the *next* input token, so the target row is the input row shifted left by one, with `[EOS]` filling the last slot. That shift is the whole trick that makes one forward pass over a joke of 30 tokens into 31 classification problems trained in parallel — and the first thing to get wrong in a data pipeline. In `transformers` the model does the shift internally when you pass `labels = input_ids`; shift once more yourself and the model learns to predict the token *after* the next one.
> miss: if you clicked `открыл`: that is the input at position 2, not its target. The model never predicts what it was just given.

## q-task-type · pick

At every position, the model solves

- [x] an 8 000-way classification — the same softmax and cross-entropy as week 1, with the next token as the label
- [ ] a regression onto the id of the next token
- [ ] a binary decision: does the text continue, or stop
- [ ] a ranking of the vocabulary by similarity to the current token

> The same classifier as for text classification, with a different label: the class is "which of the 8 000 pieces comes next", the loss is $-\mathrm{log} P(\text{the piece that did})$, averaged over positions. That average is the cross-entropy, and $\mathrm{exp}$ of it is the perplexity — so **training minimises perplexity directly**. Regression onto an id would say piece 4 017 is between 4 016 and 4 018, which means nothing; "continue or stop" is one of the 8 000 classes (`[EOS]`), not a separate head.
> miss: if "ranking by similarity": that is what a nearest-neighbour search over embeddings does. A language model's softmax is conditioned on the *prefix*, not on the current token alone.

## task-p2

One forward pass over a text therefore trains every position at once. Two tokens are added around the text: `[BOS]` in front, so that the first real token also has something to be predicted from, and `[EOS]` at the end, so that the model learns when a text stops — without it, it could never stop generating. Texts have different lengths and a tensor does not, so a batch is padded with `[PAD]` to its longest text.

## q-positions · fill

A joke of 30 BPE pieces. The input is `[BOS]` + the 30 pieces, the targets are the 30 pieces + `[EOS]`. One forward pass gives [[n]] classification problems, each with [[k]] classes.

- n = 31
- k = 8000 | 8 000 | |V| | V | vocabulary size | the vocabulary size

> 31: one per input position, the last one asked to predict `[EOS]` — the model has to learn *when a joke ends*, or it could never stop generating. Each is a softmax over the full 8 000-piece vocabulary; there is no smaller "likely candidates" set, the model scores everything every time. That is where the memory goes: logits of shape batch × length × 8 000, before any backward pass.
> miss: if 30: you dropped `[EOS]`. It is an ordinary token to the loss, and the most important one for the output's length.

## q-pad · pick

Jokes have different lengths, a tensor does not, so the batch is padded with `[PAD]`. What goes wrong if the loss does *not* ignore the padded positions?

- [x] the model learns to predict `[PAD]` after `[EOS]` with near-certainty — easy, worthless — and the perplexity looks better than it is
- [ ] the loss becomes NaN
- [ ] nothing: `[PAD]` is just another token
- [ ] the model cannot stop generating

> It learns the easiest pattern in the data: after `[EOS]`, pad; after pad, pad. Those positions are a large share of a padded batch, they are predicted almost perfectly, and they pull the average loss down, so the perplexity you report is flattered by a token that never appears in real text. `ignore_index = PAD` in the loss removes them from the sum and from the normalisation — *if* the padding id is the one you told it. Nothing errors either way, which is exactly the problem.
> miss: if "just another token": it is to the model. It is not to the metric, and the metric is what you will compare models by.
