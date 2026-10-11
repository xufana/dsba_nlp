# decoder · What physically comes out

## decoder-p1

What GPT-2 is: the decoder block from week 3 without the cross-attention — masked self-attention and a feed-forward — stacked twelve times, one vector per position flowing up through the stack. That is the whole body; the picture is complete.

## decoder-p2

The encoder returns 768 numbers per token, and 768 numbers are not an answer — last week's whole point was that the answer is whatever Linear we bolt on. The decoder returns 50 257 numbers per token, and those *are* an answer: a probability for every token in the vocabulary. The head is already there. It is the input embedding matrix, transposed — the weight tying from week 3 — and it accounts for close to 40M of the 124M parameters.

**The task cannot go into the head, because the head is the vocabulary, and the vocabulary is not ours to change.**

## decoder-p3

Week 4 asked *which layer knows the topic best* with a probe per layer. The decoder comes with a reader for its own residual stream — the head. Take the vector after block $k$, pass it through the final LayerNorm and the vocabulary head as if the model ended there, and read what it would have predicted. This is the *logit lens* (nostalgebraist, 2020).

## bet-lens

Click the layer. Then the curve.

## decoder-p4

The curve is about positions on average. The strip below is one text, every position: click a token and read what every layer would have said next. Green is the gold next token; the outlined guess is the one the final layer settles on.

## decoder-note1

Read a column top to bottom, then left to right: the early layers copy the word they are standing on, the late layers turn it into a continuation — plausible, not necessarily the gold one. Committing is not the same as being right.

## decoder-p5

In week 3 the decoder read the source sentence through cross-attention: its queries against the *encoder's* keys and values. That layer is gone. What is left is causal self-attention: every position attends to everything on its left — and "on its left" includes the prompt.

## bet-att-share

Of the attention the generated tokens pay, what share lands on the prompt in the last layers?

## bet-att-sink

And of *that*, how much is the very first token alone?

## decoder-p6

Cross-attention did not disappear — it became self-attention on the prefix. The source is just the first thing in the sequence, and the block reads it with the same weights it reads its own output with. That is the trade: one attention instead of two, one weight matrix instead of two, and one sequence for everything.

It is also a constraint, and it will come back in block 05: **the prefix is read causally**. A token of the prompt does not see what stands after it. If you put a document first and a question second, the document was encoded *without knowing the question*. Hold that thought — we will measure it.

## fig-block-note-gpt

<b>{total}</b> parameters: <b>{wte_m}M</b> in the token embedding, which is also the head, <b>{blocks_m}M</b> in the 12 blocks, <b>{wpe_m}M</b> in the position table. Head tied to the input embedding: `{tied}`.

## fig-block-note-bert

<b>{total}</b> parameters, and not one of them turns 768 numbers into an answer — last week's whole point.

## lens-stats

{n_texts} test texts, {n_tokens} positions · layer 0 is the embeddings straight through the head (perplexity {ppl_0}, off the chart)

## lens-note

Even layer {half} agrees with the final answer on only {agree_half} of positions, and the perplexity drops at every layer — {ppl_1} after layer 1, {ppl_11} after layer 11, {ppl_12} after the last. There is no layer you can cut at. *Open question:* the probe in week 4 peaked in the *middle* of BERT. Both are 12-layer transformers trained to predict tokens — what is different about *how we read them*?

## att-note

Measured on this prompt: {early_lo}–{early_hi} of the generated tokens' attention lands on the prompt in the first five layers, {late_lo}–{late_hi} from layer 6 on — the shape changes with depth. But from layer 6 on, {sink_lo}–{sink_hi} of *all* attention sits on the very first token. That is the **attention sink** (Xiao et al. 2023): a position heads park on when they have nothing to look up. Hide it, and the other 31 prompt tokens get no more than their count would predict. "Reads the prompt" is mostly "parks on token 0".
