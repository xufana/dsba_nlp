# design · Design it

## design-p1

One system, end to end, with this week's tools. There is no single right design; there is a short list of things a right design cannot skip.

## q-design · write

A messenger wants next-word suggestions above the keyboard: Russian, on the phone itself, no server, under 50 ms per keystroke, a few megabytes of model. Sketch it: what the model is, what unit it predicts, how it picks the suggestions, how you measure success, and what breaks first.

- the model is a language model: $P(\mathrm{next} | \mathrm{prefix})$ — small, not an LLM; a count model or a small recurrent one fits the budget
- the unit is a trade: words are what the user wants to see, but a word vocabulary over Russian is huge and full of unseen forms; subwords fix the OOV and complicate "show a word"
- decoding is neither sampling nor beam: the top few of one distribution, deterministic, filtered to whole words
- perplexity is for development; the product metric is acceptance — how often a suggestion is tapped, and how many keystrokes it saved
- personal names, slang and new words break first; a per-user vocabulary or an on-device update is the fix
- latency and memory bound everything: the softmax over the vocabulary is the expensive step

> **What it is.** A language model — $P(\text{next token} | \mathrm{prefix})$ — and a decision rule on top. The budget rules out anything large: a smoothed n-gram model is kilobytes per thousand n-grams and answers in microseconds, a small GRU or LSTM at a few megabytes answers in milliseconds on a phone. Start with the count model and make the network earn its place.
>
> **What unit.** The user wants to see a *word*, so the suggestion layer works in words; but a word vocabulary for Russian is enormous and half of it is seen once — the Zipf tail, five surface forms per noun. Predict in subwords (a small BPE vocabulary) and roll suggestions up to word boundaries; or predict words with a hard vocabulary cap and accept that the model is blind outside it. Either way the softmax over the vocabulary is the expensive step, in time and in memory, and the vocabulary size is a product decision, not a modelling one.
>
> **How it picks.** Not sampling: the user wants the three most likely words, every time, the same way. Not beam search either: there is no sequence to optimise, one token ahead is the product. Take the top of one distribution, drop pieces that do not complete a word, show three. Temperature and nucleus are for generation; this is ranking.
>
> **How you measure.** Perplexity during development — it is the training loss and it tells you whether a change helped the model. It is not the product's metric: the product's metric is *acceptance*, how often a suggestion is tapped, and keystrokes saved per message. A model with better perplexity can still suggest words nobody wants to tap, and the ranking of three candidates is what the user sees, not the whole distribution.
>
> **What breaks first.** Names — of contacts, places, products — and the user's own slang: all of them out of vocabulary, all of them the most-typed words on a given phone. The fix is a per-user layer: a small personal n-gram count or a cache of the user's own words, mixed into the model's distribution — interpolation again, between a global model and a personal one. Then the keyboard's language switching, then the prefix after a correction, where the context the model saw is not the text that is there.
> miss: if the design is "a small GPT": it may end there. It cannot start there under 50 ms on a phone, and the thing it would have to beat — a smoothed trigram with a personal cache — is a few lines of code and a few seconds of training.
