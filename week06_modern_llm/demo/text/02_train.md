# train · Six N D

## train-p1

First, what we're trying to calculate. A FLOP is one floating-point operation — one multiplication or one addition. A matrix product of an $m×k$ matrix by a $k×n$ one is $m·n·k$ multiply-adds, so $2mnk$ FLOPs, and a transformer is almost nothing but matrix products. Mind the S: **FLOPs** is a count of operations, **FLOP/s** is a rate — how many a chip does per second. The bill is in the first; the hardware is sold by the second.

**Why count them, rather than hours or dollars.** Hours depend on the chip, dollars on the year and the cloud, and neither is in a paper. The operation count is a property of the model and the data alone. Divide it by a chip's rate and you have time; multiply by the price of the chip-hour and you have money.

One formula carries this whole section. A forward pass costs about $2N$ floating-point operations per token — every weight is used in one multiplication and one addition. The backward pass costs about twice the forward. So training on $D$ tokens costs

## train-p2

To be completely honest, the formula ignores what attention adds on top of the weights (a term that grows with the context), counts the embedding table as if it were multiplied, and forgets the optimiser — so it is good to tens of percent, not to the digit. For a bill whose rows differ by factors of a thousand, that is enough.

## bet-plane

Five models, two numbers each from their papers. Put each one where you think it sits. The grey diagonals are equal compute, $C=6ND$ — which model cost the most to train?

## train-note1

An A100 is rated at 3.1 × 10<sup>14</sup> FLOP/s in bf16, and a real training run uses 30–50% of that; the GPU-years above assume 40%. GPT-3's own paper has 3.14 × 10<sup>23</sup> — computed with the same rule.

## train-p3

Okay, by 2020 it became pretty obvious, that the more layers we have, the better is the model.

## train-cap1

We clearly see, that GPT-3 was significantly more expensive, so why would anyone pay 3 × 10<sup>23</sup> FLOPs for a language model in 2020 without knowing we're gonna be successful by doing so? Because by then it was known what the money buys.

## train-p4

Kaplan et al. (2020) trained hundreds of transformers, from under a thousand parameters to over a billion, and found that the test loss is a **power law** in each of the three quantities, across the whole range, with nothing else — depth, width, number of heads — mattering much:

## train-p5

That is a brutal law, and it is the best news the field ever had. Brutal: nine thousand times the model for half the loss. Good news: it is a *straight line on log-log paper*, so you can measure the slope on models you can afford and read off the loss of the model you cannot — **before** buying the cluster. A bet became an investment with a forecast.

We can see the line ourselves without training anything. `pythia-160m` has seven siblings: eight sizes, 70M to 12B, trained on the same corpus (the Pile, about 300B tokens) *in the same order*, with a checkpoint saved every thousand steps (Biderman et al. 2023). Same data, same recipe, only $N$ changes.

## bet-scaling

Loss against parameters on log-log axes, 70M to 2.8B. A straight line? Does it bend, and which way?

## train-p6

Read the left panel first. The sizes sit close to a line; put the fitted slope next to Kaplan's 0.076 and do not expect the two to agree to the second digit. Their exponent was measured on the training distribution; ours is on news the models were not trained on, and the largest sizes saw the same 300B tokens as the smallest, so they are the least "trained to convergence" of the family. What transfers is the shape: every multiplication of $N$ by a constant takes the same *fraction* off the loss.

The right panel is the other dial, on one model: the same 160M parameters, looked at earlier and earlier in its training run. It is a learning curve, not Kaplan's $L(D)$ — but it says what the bill needs: the tokens are paid for in $6ND$, and each further doubling of them buys less. Which leaves the question the next block answers: with a fixed budget $C$, how much goes into $N$ and how much into $D$?

## train-p7

Hoffmann et al. (2022) ran the experiment properly: 400 models, sizes and data budgets varied independently, and for each compute budget they found the pair $(N,D)$ with the lowest loss. The answer is nearly a constant ratio — the optimum has **about 20 tokens per parameter**. Their demonstration was Chinchilla: 70B parameters on 1.4T tokens, the same compute as the 280B-parameter Gopher on 300B tokens — a quarter of the size, and better on almost every benchmark. By that rule GPT-3, at 1.7 tokens per parameter, was a model far too big for the data it was given.

## train-note2

Slide to 20 tokens per parameter: <math><mn>6</mn><mo>·</mo><mi>N</mi><mo>·</mo><mn>20</mn><mi>N</mi><mo>=</mo><mi>C</mi></math> gives <math><mi>N</mi><mo>=</mo><msqrt><mi>C</mi><mo>/</mo><mn>120</mn></msqrt><mo>≈</mo><mn>51</mn></math>B parameters on 1.0T tokens — a model 3.4 times smaller than GPT-3, on 3.4 times the data. Then look at the chart: Llama-3-8B at 1 900 tokens per parameter, SmolLM2-135M at 14 900. Not 20. These models are *overtrained* by Chinchilla's rule, by two and three orders of magnitude, and the people who trained them knew the rule.

## train-p8

**Open question:** Chinchilla minimises one of the three bills in the claim. Which one? Now take a model that, over its lifetime, will *generate* many more tokens than it was trained on — or one that has to fit on a laptop. Which bills does its owner pay, and which of $N$ and $D$ appears in them?

## plane-score

your guesses were off by {err} orders of magnitude on average (N + D)

## plane-note

<b>{top}</b> cost the most — {top_flops} FLOPs against GPT-3's {gpt3_flops}. A model that runs on a laptop took more compute to train than GPT-3; nobody would have paid that for an 8B model in 2020. SmolLM2-135M cost {smol_flops} — {ratio} times less than GPT-3 — while reading {more_text} times more text. N and D are two separate dials: {tpp_gpt3} tokens per parameter for GPT-3, {tpp_chinchilla} for Chinchilla, {tpp_llama} for Llama-3-8B, {tpp_smol} for SmolLM2. GPT-2's row is an estimate: OpenAI published WebText in gigabytes, not tokens.

## fit-note-partial

read off the line for pythia-2.8b: {pred} bits/byte; measured {measured} — the small sizes make the line {direction} by {pct}%.

## fit-note-all

all six sizes: slope −{slope} on log-log paper, Kaplan's −0.076 on theirs. Every ×10 in N takes {pct}% off the loss here.

## scaling-note

Close to a line, bending slightly <b>up</b> — the two largest sizes sit above the line through the small ones. Fit on the first three sizes and the line predicts {pred3} for 2.8B; measured {measured}. Slope on all six: −{slope6}; Kaplan's −0.076 was measured on the training distribution with the irreducible loss left in, ours is on news nobody trained on. The right panel: {bpb_first} → {bpb_mid} bits/byte over the first {tokens_mid} tokens, then flat — the last two checkpoints are {bpb_7} and {bpb_8} on {n_texts} texts; do not read the difference.

## fit-optimistic

too optimistic

## fit-pessimistic

too pessimistic
