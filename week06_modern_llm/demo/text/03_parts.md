# parts · Two passports

## parts-p1

The law says *grow*. This block is about what physically stood in the way — and it is easiest to see on two models with the same budget. `gpt2`, 2019, 124M parameters. `SmolLM2-135M`, 2024, 135M parameters. The same money, five years apart.

## parts-note1

Almost every line of the passport differs; four of the differences are the blocks below. One thing is the same in both, and it is usually listed among the "modern" changes: *where* the norm stands — before each sublayer. Keep that for the norm.

## parts-p2

Rebuild both parameter counts from the passports. For GPT-2 one block is attention ($4d^2$: queries, keys, values, output) plus a feed-forward ($8d^2$: up to $4d$ and back), every matrix with a bias, plus two LayerNorms; add the token table, the position table, and a final LayerNorm. For SmolLM2 the attention is two full matrices (queries, output) and two a third as wide (keys, values); the feed-forward is *three* matrices $d×1536$; no biases; no position table.

## parts-note2

124 439 808 and 134 515 008, to the last parameter. Nothing is hidden in a transformer: a dozen numbers in a JSON file, and arithmetic. And the arithmetic already tells the story. **Depth instead of width:** 12 × 768 became 30 × 576. **The feed-forward is still 8d²** — with three matrices instead of two. **The attention went from 4d² to 2.67d²:** keys and values are three times narrower, and what that saves is not mainly parameters. **Positions are no longer parameters:** 786 432 of them in GPT-2; zero here.

## parts-p3

A norm is applied to one vector at a time — the $d$ numbers of one token at one layer, nothing across the batch or the sequence. Its job is to hand the next sublayer an input of a fixed scale, whatever the residual stream has grown to by layer 20. The transformer of 2017 and GPT-2 use **LayerNorm** (Ba et al. 2016): centre the vector, divide by its standard deviation, then let two learned $d$-vectors undo as much of that as training wants. **RMSNorm** (Zhang &amp; Sennrich 2019) keeps only the division. No mean is subtracted; the vector is divided by its root mean square, and a single gain remains.

## bet-norm

Which coordinate is still exactly 0 after RMSNorm — and after LayerNorm?

## norm-note

What RMSNorm dropped: the centring and the bias. A zero stays a zero; before the learned gain, the *direction* of the vector is untouched and only its length is fixed. Nobody switched norms to save parameters — <span id="norm-counts"></span> — and the time saved is a few percent at best. It is the habit that matters: at scale every operation that does not earn its place goes.

## parts-note3

In the 2017 transformer and in BERT the norm comes *after* the residual addition — every layer normalises the stream itself. From GPT-2 on, it stands *before* each sublayer: `x + attention(norm(x))`. The residual stream is never normalised, only read through a norm; gradients reach layer 1 of 30 through plain additions. Post-norm transformers need a careful warm-up to train at all (Xiong et al. 2020); pre-norm ones are routinely trained a hundred layers deep. Depth instead of width was only affordable because of that. **Pre-norm is the one item on today's list that GPT-2 already had.**

## parts-p4

The feed-forward of 2017 is two matrices and a nonlinearity: up to $4d$, ReLU or GELU, down. SwiGLU (Shazeer 2020) splits the way up in two parallel projections: one is the value, the other, through SiLU, is a **gate** that multiplies it — so each hidden unit is a product of two linear views of the input, not a threshold on one. Three matrices instead of two.

## bet-ffn

GPT-2 spends 8d² on a feed-forward. What hidden size h gives a three-matrix feed-forward the same budget? <input type="text" id="ffn-guess" placeholder="h = ?" style="width:120px;display:inline-block;margin-left:8px">

## parts-p5

The left curve is what changed least: SiLU and GELU are nearly the same curve. The right picture is what changed: the output of a hidden unit depends on *two* projections of the input, and the gate can switch the value off, pass it, or — because SiLU dips below zero — flip its sign a little. Shazeer's own conclusion is a sentence worth quoting to anyone who asks why it works: he offers no explanation and attributes the result, as with everything else in the architecture, to divine benevolence. It trains to a lower loss at the same budget; that is the evidence.

## parts-p6

Last week we talked a bit about the RoPE. Two things are left for today: see it on a checkpoint, and read one more number off the passport. The function below is week 5's `rotate` for a whole tensor of heads — with the pairing Hugging Face uses: coordinate $j$ turns with coordinate $j+d/2$, not $2i$ with $2i+1$.

## parts-note4

The whole matrix is 32 rotations of 32 planes, each at its own speed: pair 0 turns a full circle every 6.3 positions, pair 31 once in <span id="rope-slowest"></span> positions. The code never builds it — the two `chunk` halves and `cat([-x2, x1])` are the four cells of every block applied at once.

## parts-note5

Layer 0, query head 0 of SmolLM2-135M, before and after the rotation. Click a token: the first coordinates (fast pairs) are scrambled by position, the last ones (slow pairs) barely move — at position 7 pair 31 has turned by six thousandths of a degree, and the biggest coordinate, 21, has not moved either. The attention score $q^⊤k$ between two rotated vectors depends only on the *difference* of their positions.

## bet-shift

Tell SmolLM2 that the text starts at position 1 000, not 0 — every token shifted by the same amount. Tell GPT-2 the same with a shift of 400. What happens to the logits of each?

## shift-note

For SmolLM2 the difference is rounding error — orders of magnitude below the logits themselves: 135M trained parameters, thirty layers, and not one of them can tell position 5 from position 1 005 — only how far apart two tokens are. For GPT-2 the shifted text is a different input: other rows of the table were added to it.

## parts-note6

A pair is *slow* if it does not complete one turn inside the context: those are the ones that tell *near* from *far* without ambiguity. 11 slow pairs at (10<sup>4</sup>, 2 048); quadruple the context and four of the eleven are lost; raise θ tenfold and they are back. So θ is tuned to the context the way a ruler is chosen for the thing measured.

## parts-p7

One more suspicious thing: nine query heads, three key/value heads. This is **grouped-query attention** (Ainslie et al. 2023), and the class below is all of it — standard multi-head attention with the key and value projections a third as wide, and each K/V head *shared* by three query heads.

## parts-note7

Each query head still asks its own question — nine different $q$, nine things to look for — but heads 0, 1, 2 look the answers up in the same keys and read the same values: one space of answers, shared by three questions. Why keys and values and not queries? The queries are not cached — a query is used once, at its own step, and thrown away — so there was never a reason to group them. A third fewer parameters in the attention is a small saving. The real one is in block 03.

## parts-p8

We now have every part: `RMSNorm`, `SwiGLU`, `rope`, `Attention`. Two more classes put them in order, and the names of the attributes are chosen to match Hugging Face's, for one reason: so that we can take the **trained weights of SmolLM2-135M and load them into our classes**. If our sixty lines are the model, the logits come out the same. Or do they?

## bet-assemble

SmolLM2's weights loaded into our Decoder. Largest difference in any logit, against logits of order 10?

## assemble-note

The same numbers, to rounding. There is nothing else in there: no trick in the library, no hidden layer. A model that people call a "small LLM" is the six definitions above, a table of 49 152 vectors, and thirty copies of one block. Take week 3's transformer, remove the encoder (week 5), move the norm in front (GPT-2), swap four parts (today) — and you have this. Seven years of architecture is a short diff. The long diff is in $N$, $D$ and $T$, and in the next block's bills.

## ffn-note

{verdict} 3 · d · h = 8d² gives h = 8d/3, and 576 · 8/3 = <b>1 536</b> exactly. The "8/3" you meet in every Llama-style config is not a discovery about language; it is bookkeeping, so that a paper can say *same parameters, lower loss*. Llama-3-8B uses 14 336 / 4 096 = 3.5 — the convention is a budget, not a law. {check}

## ffn-none

No guess typed.

## ffn-right

<b>Right:</b>

## ffn-said

You said {g}.
