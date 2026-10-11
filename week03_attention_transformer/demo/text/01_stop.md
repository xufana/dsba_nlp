# stop · The data, again — and the baseline

## stop-p1

Quick recap. Multi30k: 29 000 image captions in German with their English translations, 1 000 for validation, 1 000 for test. The tokenizers are the two 8k BPE models from the last week.

## stop-p2

Baseline: last week's model. The bidirectional LSTM encoder, a projection of its two final states down to one ${(h_0,c_0)}$, and an LSTM decoder that starts from there. The weights are pre-computed, cuz I don't know what to talk about while it's training (abt 30 mins, btw).

## stop-note1

The experiment shows that the translation loses the details first — the nouns survive, the adjectives and the actions go.

## stop-p3

The decoder currently gets 256 numbers for the whole sentence. Two ways to give it more: (a) make it 1 024 numbers; (b) keep the vector at 256 but let the decoder *re-read all the encoder states at every step*. Which one flattens the curve — and how many parameters does (b) add? Write down a number, and we check the real outcome.

## bet-stop-which

(1) Which one flattens the curve?

## bet-stop-params

(2) How many parameters does (b) add to the 8.0M model?

## stop-note

Attention with a 256-dimensional scoring space, the key projection and the attentional vector together add well under a million parameters to an 8M model — under ten percent, most of it in the wider decoder input. Whatever it does to the curve, it does not do it by being bigger. The curve itself is block 01.
