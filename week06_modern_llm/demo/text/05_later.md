# later · Bits per byte

## later-p1

Back to the bet from block 00: 124M parameters and everything learned since. You have now seen what was actually changed — depth for width, a norm, a gate, a rotation, fewer keys and values — and, in the bill, the change that is not in the block at all: `tokens / param` went from something like 80 to 14 900.

## later-note1

**Nothing in this block separates the architecture from the data.** SmolLM2 has the new parts *and* on the order of a hundred times GPT-2's tokens, of better-filtered text. Its own paper is subtitled *data-centric training of a small language model*. What the comparison shows is what five years bought at a fixed size — not what RoPE is worth.

## later-p2

The measurement of block 01, on our two bodies, and on the two bigger SmolLM2s — the same news, bits per byte, the unit that survives a change of tokenizer.

## bet-bpb

Click the models from best (lowest loss) to worst. Who is ahead, by how much — and what does the 1.7B add?

## later-p3

Two readings, and this table cannot separate them. *Capacity*: at a fixed $N$ the curve $L(D)$ goes flat — 135M parameters hold what they hold, however much text goes past them. *Domain*: AG News is newswire from 2004, close to what GPT-2 read on the web, and far from the filtered educational text, code and maths that SmolLM2 spent its capacity on. The other rows say which dial still works. The parts of block 02 did not make a small model better at this; they made a *bigger* one affordable.

## later-p4

Week 5: classify AG News with no labels by asking which of four words the model finds most likely after `This news is about`. GPT-2 got 0.61 with one-token words. `score` is that function, unchanged; only the model passed to it is new.

## bet-zs

Same prompt, same four words. Click the models from most to least accurate. Does anyone pass TF-IDF's 0.92?

## bet-zs-class

And which class does the 1.7B fail on most?

## later-p5

Read the per-class columns before the accuracy. A better language model does not automatically fix a prompt that was tuned on a different one: `This news is about` and the four words were chosen for GPT-2. Keep week 5's reading of this row: the scorer guarantees the *form* of the answer and four passes per text is the price. A bigger body moves the accuracy; it does not move the cost column.

## later-p6

Everything today was a decoder. The encoders did not stand still — they changed the same parts. ModernBERT (Warner et al. 2024) is BERT rebuilt with this seminar's list: rotary positions, pre-norm, a gated feed-forward, no biases, full attention only in every third layer, a context of 8 192 instead of 512, and two trillion tokens of training. The row below is week 4's fine-tune with the body swapped — 6 000 texts, two epochs, the same recipe.

## later-note2

On four-way news topics there was little left to gain — week 1's TF-IDF is at 0.92 — so do not read much into the third digit. The reason the encoder line is still alive is on last week's cost table: **one pass per item, and the pass can be done in advance.** Ten million documents are each encoded once, offline, into a vector; a query is encoded in one pass, and the answer is a nearest-neighbour search among vectors that already exist. The long context is what changed its reach: 8 192 tokens is a whole document, where 512 was a paragraph.

## later-note3

Read the bill by columns, left to right — it is the seminar in one table. `N` and `D` moved apart: the models you can run got *smaller* than GPT-3 and read many times more. `tokens / param` is the dial that was turned furthest, and it is not an architectural one. `weights` and `cache` are the memory bill, and at long contexts the second catches up with the first. `active N` is where the last two rows stop being equal to `N`.

## later-note4

No row added today was trained by us, except one encoder. That is what a seminar about 2026 looks like — the interesting numbers are in the bill.

## bpb-note

<b>{g} and {s135}.</b> Five years, four new parts in the block and a couple of hundred times the training tokens — and on news text the 135M model of 2024 predicts the next token {compare} the 124M model of 2019: the gap is {gap}%, inside the noise between samples (the live cell on {live_n} texts: {live_g} against {live_s}). The other rows say which dial still works: 360M is {better_360}% better, 1.7B another {better_17}%. `bytes / token` settles the guess from block 01: {bpt} for GPT-2, not 4 — WebText is nearer 9B tokens than 10B.

## zs-note

{list}. Nobody passes TF-IDF's 0.92, and the 1.7B is {points} points above GPT-2 for thirteen times the compute per pass. Read the per-class columns: GPT-2 was at {g_business} on *Business* and {g_sports} on *Sports*; the 1.7B fixes *Sports* ({s_sports}) and fails on *{worst}* ({worst_acc}) — the weak class moves with the model, because the prompt and the four words were chosen for GPT-2. A bigger body moves the accuracy; it does not move the cost column.

## changes-summary

{k} of your {n} are on SmolLM2's list of {made}. The one that moved the bill furthest is not architectural: tokens per parameter.

## changes-none

No picks in block 00 — the list is still there, scroll up.

## bpb-same

exactly as well as

## bpb-better

a little better than

## bpb-worse

a little worse than

## zs-live

the live cell on {n} texts: {list} — same ordering, noisier
