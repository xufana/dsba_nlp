# holtz · The picture that named the problem

## holtz-p1

Take a real joke from the test set and, at every position, ask the model: *what probability did you assign to the token that actually came next?* Do the same for the model's own greedy continuation from the same first three tokens. Then look at the two curves. Pick any joke — both curves are computed here, by the LSTM in this page.

## holtz-note1

The human text is **jagged**: real language constantly includes tokens the model found unlikely — a surprising word is what makes a sentence worth reading. The greedy continuation is a **flat line near 1.0**: it only ever emits tokens it was already sure of, which is precisely why it reads as bland and loops. "Natural language does not maximise probability" is the one-sentence version, and the fix is not a better model — it is a decoding rule that reintroduces the jaggedness on purpose.

## holtz-p2

Turn jaggedness into numbers and measure every rule at once, on five prompts and six seeds each: **repetition** — the share of generated tokens that repeat one from the last twenty; **distinct-2** — the share of generated bigrams that are unique; and the average log-probability the model gave its own output.

## holtz-note2

Greedy has the **highest** average log-probability — by construction, it is the most probable text — and the **worst** repetition. The sampling methods give up log-probability and buy back diversity. This is the likelihood trap made quantitative: the objective the model was *trained* on is not the objective you *decode* for, and optimising the first too hard destroys the second. Open question: distinct-2 keeps rising as you sample more aggressively, but past some point the text is nonsense, so higher is not simply better. Human text has a *particular* value of these statistics. How would you turn "reads like a human wrote it" into a target for the sampler?

## holtz-note3

Greedy, unpatched, loops. Greedy plus a penalty of 1.3 and a no-repeat-3-gram ban stops — it has nothing safe left to say. A hack, and a cheap one that works.

## holtz-note4

Nothing above was specific to our LSTM. The notebook drives a pretrained Russian GPT-2 with the identical parameters — <span class="mono">top_p</span>, <span class="mono">temperature</span>, <span class="mono">repetition_penalty</span> — and greedy loops there too. What about beam search? It approximates the most probable *sequence*, which for jokes is the blandest text of all. It comes back the moment there is a right answer to approximate — next block.

## gpt2-missing

The GPT-2 block is optional in the notebook (needs <span class="mono">transformers</span> and a 500 MB download).
