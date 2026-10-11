# decode · Turning a distribution into text — with the real LSTM, here

## decode-p1

We have a model that, given a prefix, returns a distribution over 8 000 next tokens. Sampling from it was one choice among many, and it turns out to be the choice that matters most for how the text reads. This is the right factor of the opening equation, and for the whole RNN era it was an afterthought; Holtzman et al. (2019) made the field take it seriously. Everything below operates on a single vector of logits for one position, and each method is a small function that turns it into a token id. That interface is why the code that generates from a 4.6M-parameter LSTM is byte-for-byte the code that drives a 400B-parameter LLM.

**Bet first.** The two obvious rules sit at opposite ends: *greedy* takes the most probable token every time; *pure sampling* draws from the distribution as the model gives it. One of these produces repetitive, looping text; the other produces incoherent, drifting text. Which is which?

## bet-ext

Greedy loops, sampling drifts — or the other way round?

## ext-note

**Greedy loops** — and it is deterministic, so the seed changes nothing, and once it enters a loop it cannot leave. This is Holtzman's central, counter-intuitive result: the most probable continuation is a *worse* continuation than a random one. Maximising probability at every step walks you into the high-probability, low-information regions of the language — the phrases that are safe everywhere and mean nothing. **Pure sampling drifts:** the model puts a small probability on thousands of tokens, the *sum* of that tail is large, so at almost every step there is a real chance of drawing something the model thought unlikely. One unlucky token and the prefix is nonsense, which makes the next token worse. Every method below is an attempt to sit between them.

## decode-p2

The notebook's LSTM — the same 4.6M weights, quantised to fit in this page — runs in your browser. Type a prompt, pick a rule, generate. Every token is coloured by the probability the model gave it (dark: the model was sure; pale: a surprise), and the bars show the distribution at the *next* step with the part the current rule would keep. **Temperature** divides the logits before the softmax: T → 0 is greedy, T &gt; 1 flattens toward uniform. **Top-k** keeps the k most probable tokens; **top-p** keeps the smallest set whose probability sums to p, so the kept set adapts — three tokens when the model is confident, two hundred when it is not; **min-p** keeps every token at least p<sub>min</sub> times as probable as the top one. **Repetition penalty** divides the logit of any token already emitted, and **no-repeat-n-gram** hard-bans a token that would complete an n-gram already generated. Both are hacks that fight a symptom rather than its cause; every serious API exposes them.

## decode-note1

Low temperature is safe and repetitive; it approaches greedy. High temperature is adventurous and, past a point, incoherent — at T = 1.5 the tail is thick enough to derail the joke. There is no correct value, only a value that suits the task: code completion wants T near 0, brainstorming near 1. Temperature is a blunt instrument, though: it rescales the *whole* distribution and cannot say "keep the sensible options and delete the absurd ones". Truncation can — and the bars show the difference between a fixed k and a p that adapts. On a confident step top-p keeps a handful of tokens and top-k = 40 is already reaching into noise; on an uncertain step top-p opens up and top-k keeps forty either way.

## decode-why1

HuggingFace's `generate` is doing exactly what this block does — its `LogitsProcessor` classes *are* these `decode_step` functions. The notebook runs the identical rules on a Russian GPT-2; the outputs are in block 06.

## decode-p3

Now the same thing without the sampling noise: one real distribution, the model's prediction after a prompt, and the dials applied to it directly. Drag the temperature and watch the shape; then look at what each truncation rule keeps *of that shape*. Switch between a confident prompt and an uncertain one — that is where the three rules stop agreeing.

## decode-note2

Temperature changes contrast, not order. Top-k cuts at a fixed rank; top-p follows the cumulative mass; min-p cuts at p<sub>min</sub> × the top probability — the last two adapt, but to different things. After *Доктор говорит* half the mass sits on one token, yet top-p = 0.9 keeps over a thousand and min-p keeps two; after *Заходит мужик в бар* the top token is 1.5% and everything lets thousands in. min-p works exactly as far as the distribution has a head — and at 309 perplexity there is less head than the samples suggest.
<div class="scroll-x" style="margin-top:12px"><table id="dist-grid"></table></div>
