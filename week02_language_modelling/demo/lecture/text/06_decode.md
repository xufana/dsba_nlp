# decode · The decoding rule

## decode-p1

We have a model that, given a prefix, returns a distribution over 8 000 next tokens. Everything below operates on a single vector of logits for one position; each rule is a small function that turns that vector into a chosen token id. Whatever the model, the interface is the same, which is why the code that generates from a 6M-parameter LSTM is byte-for-byte the code that drives a 400B-parameter LLM.

## decode-p1b

The rules come in a few kinds. **Greedy** takes the most probable token every time; **sampling** draws from the distribution as the model gives it. **Temperature** divides the logits by $T$ before the softmax: $T < 1$ sharpens the distribution, $T > 1$ flattens it, $T → 0$ is greedy. **Truncation** cuts the tail off before sampling: top-k keeps the $k$ most probable tokens, top-p (nucleus) the smallest set whose probabilities sum to $p$, min-p every token at least $p_{min}$ times as probable as the top one. A **repetition penalty** lowers the logits of tokens already used. **Beam search** is different in kind: it keeps the $b$ most probable *sequences* and extends all of them.

## q-decode-sort · sort

Each knob does one of four things to the next-token distribution. Which?

bins: reshapes it · truncates it, then renormalises · changes which sample you draw, not the distribution · searches over sequences, not tokens

- temperature → reshapes it
- top-k → truncates it, then renormalises
- top-p (nucleus) → truncates it, then renormalises
- min-p → truncates it, then renormalises
- repetition penalty → reshapes it
- the random seed → changes which sample you draw, not the distribution
- greedy ($T → 0$) → reshapes it | changes which sample you draw, not the distribution
- beam search → searches over sequences, not tokens

> Temperature divides the logits before the softmax: $T < 1$ sharpens, $T > 1$ flattens, and the *whole* distribution moves — it cannot keep the sensible middle and delete the absurd tail, because raising $T$ to explore the middle fattens the tail too. The repetition penalty also reshapes, by dividing the logits of tokens already emitted. Top-k, top-p and min-p *cut* instead: zero everything outside a set, renormalise, then sample; they differ only in how the set is chosen. The seed changes nothing about the model or the sampler, only which draw you get. Greedy is the limit $T → 0$ — all mass on the argmax — and also simply "always take the top one"; both readings are right. Beam search is the odd one out: it does not pick a token from one distribution, it keeps the $b$ best *sequences* and extends all of them.
> miss: if top-p went into "reshapes": after the cut the kept tokens are renormalised but keep their *ratios*. Temperature changes the ratios; truncation changes the support.

## q-greedy · pick

Greedy and pure sampling sit at the two extremes. One of them loops, the other drifts. Which is which?

- [x] greedy loops — it is deterministic, so once it enters a cycle it cannot leave; pure sampling drifts — the long tail's total mass is large, so an unlikely token comes eventually and the prefix is now nonsense
- [ ] greedy drifts, sampling loops
- [ ] both loop
- [ ] both drift

> Greedy maximises the probability of each *step*, and that walks it into the safe, high-probability, low-information phrases that are fine everywhere and mean nothing — and once two of them chain into a cycle there is no randomness to break it. On a small LSTM trained on jokes, greedy text has the highest average log-probability per token ({greedy_lp}) of all decoding rules and the worst repetition: {greedy_rep_pct} of its tokens repeat one from the last twenty. Pure sampling puts the model's own small probabilities on thousands of tokens; their *sum* is large, so a derailing token arrives, and the next token is conditioned on nonsense. Every rule in between is an attempt to sit between the two failures.
> miss: if greedy drifts: deterministic text cannot drift, it can only repeat. Drift needs a draw that went wrong.

## decode-p2

The tail of the distribution — thousands of tokens with tiny probability each — is where incoherence comes from, and truncation cuts it off. The rules differ in how they decide where the tail starts.

## q-topp · pick

Why did top-p replace top-k as the default?

- [x] the number of plausible tokens changes per step — a handful after *Заходит мужик в*, hundreds after a comma — and a fixed $k$ is too tight in the first case and too loose in the second
- [ ] top-p is faster to compute
- [ ] top-k cannot be combined with temperature
- [ ] top-p never cuts a token the model wanted

> Adaptivity. Nucleus keeps the smallest set whose probability sums to $p$: three tokens when the model is confident, two hundred when it is not. Top-k keeps $k$ either way — on the confident step $k = 10$ is already reaching into noise, on the uncertain one it is choking the model. Min-p is the newer, even simpler version of the same idea: keep every token at least $p_{min}$ times as likely as the top one; it adapts like nucleus with one multiply and holds up better at high temperature.
> miss: if "faster": the cumulative sum needs a sort; top-k needs a partial one. Speed is not why.

## decode-p3

Why is the most probable text not the best text? Holtzman et al. (2020) answered with one picture: take a real text and, at every position, ask the model what probability it gave to the token that actually came next; then do the same for the model's own greedy continuation, and compare the two curves.

## q-holtz · pick

Take a real joke and, at every position, ask the model what probability it assigned to the token that actually came next. Do the same for the model's own greedy continuation. The two curves:

- [x] the human text is jagged — it keeps using tokens the model found unlikely; the greedy text is a flat line near 1
- [ ] both are jagged, the human one slightly more
- [ ] the human text is flat near 1 — the model has learned it
- [ ] the greedy text is jagged, because errors compound

> This is Holtzman et al.'s plot, and it is the picture that reframed decoding. Real language constantly includes tokens the model found unlikely — a surprising word is what makes a sentence worth reading — while the greedy continuation only ever emits what it was already sure of, which is precisely why it reads as bland and loops. "Natural language does not maximise probability" is the one-sentence version, and the fix is not a better model: it is a decoding rule that puts the jaggedness back on purpose. That is what sampling with truncation does, and it is why the objective you *train* on (probability) is not the objective you *decode* for (readable text).
> miss: if "the model has learned it": the perplexity of human text is never 1, and a model that assigned 1 to every real token would have memorised the test set.

## q-beam · pick

Beam search raised BLEU on the translation task ({bleu_greedy} → {bleu_beam5} with a beam of 5) and would have made the jokes worse. Why does the same algorithm get opposite verdicts?

- [x] it approximates the most probable *sequence*; translation has a right answer for probability to track, open-ended text does not — the most probable joke is the blandest
- [ ] beam search is slower, and jokes are generated interactively
- [ ] jokes are shorter than translations
- [ ] it needs a bilingual model

> Because the *task* changed, not the decoder. Beam search keeps the $b$ most probable partial outputs and so recovers from a locally bad token that leads somewhere globally good — a far better approximation of $\mathrm{argmax} P(\mathrm{sequence})$ than greedy. For translation the output is largely determined by the input and the highest-probability sequence is what you want. For open-ended generation the most probable text is the worst text to show a human, so a better maximiser produces blander, more loop-prone output. Even in translation the gain flattens: wider beams spend the extra probability on shorter, safer translations — the same likelihood trap, milder.
> miss: if "slower": true and irrelevant. It would be worse on the jokes at any speed.
