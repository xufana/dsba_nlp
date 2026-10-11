# tasks · Nothing in Transformer knows it is translating German

## tasks-p1

It maps a sequence of ids to a sequence of ids; the tokenizers, the data and the metric decide what that means. To make the point with numbers rather than words, we train the *same class* on two other tasks — small enough to fit in the remaining minutes — and we look at what the attention learned in each. Both models are loaded into this page: type your own input.

## tasks-p2

`"the fifth of March, 2021"` → `2021-03-05`. A real class of problem (text normalisation in speech systems, parsing dates and addresses in forms) with a generator we can write in ten lines. Character-level tokens, eleven surface formats, one target format.

## bet-date

What exact-match accuracy does it reach on 2 000 unseen dates?

## date-note

And would the attention LSTM from block 01 get there faster or slower? Same 64-wide budget; try it after class.

## tasks-note1

The map is an *algorithm*: the year is copied from the end of the input to the front of the output (the block in the top-right), the month name is read while two digits are written, the day digits are copied straight. Try a format the generator never produced, or a day above 28 (the generator draws days 1–28) — the model has no idea what a date *is*, only what the eleven templates look like.

## tasks-p3

The smallest task with a non-trivial alignment: reverse a sequence of letters. The map should be the anti-diagonal. Then the experiment that matters: train on lengths 5–12, **test on lengths the model has never seen**, once with sinusoidal positions and once with learned ones.

## bet-rev-13

(1) Exact match at length 13 — one past the training range — with sinusoidal positions:

## bet-rev-which

(2) Which encoding degrades more gracefully past 12?

## rev-note

Inside the training range both are near-perfect. One position past it, both fall off a cliff — <span id="rev-say"></span>. The learned table has *no row* it was ever trained on for positions 13–20: they were initialised and never updated, so the model has no idea where those tokens are. The sinusoid has a well-defined vector for every position, which buys it about one extra length and nothing more — the model learned to read "position ${S−t}$" only for the $S$ it saw. Neither generalises; that is the honest state of the art, and it is why position encoding is still an active research topic (and we'll talk about RoPE later).

## rev-say

the sinusoid keeps <b>{ex13}%</b> of the strings ({char13}% of the characters) right at length 13, the learned table <b>{ex_l13}%</b> ({char_l13}% of the characters), and by 14 both are at {both14}%

## date-count

{n_chars} characters; {n_train} training pairs, {n_val} validation
