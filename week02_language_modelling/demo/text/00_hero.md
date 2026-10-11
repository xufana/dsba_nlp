# hero · generator =P(next token | prefix)× decoding rule

## lede

Last week the string was the input and the head barely mattered. Today the string is the *output*, and the question changes: how do you get a model to produce text at all? The honest answer is that nothing produces text. Every generator you have ever used — a 1950s n-gram model, the RNN we train today, the LLM in your browser — returns a probability distribution over the next token, and the text you see is a second decision on top: a rule that picks tokens out of that distribution, one at a time.

## hero-cap1

Autoregressive generation, explained by Michael Scott. Start a sentence, pick the next token, hope you find the joke along the way.

## hero-p1

Both factors are yours to choose, and both change the text you get. The field spent sixty years on the left factor and until about 2019 treated the right one as a footnote. We build the left factor three ways (counting, a recurrent network, an encoder–decoder), the right factor six ways, and watch what each one changes — on one corpus, one test set, one table.

The corpus is 124 000 Russian jokes. They are short, they have a fixed structure, they are impossible to model well, and everybody in the room can tell instantly whether the output is any good. That last property is worth more than any metric today :)

## hero-p2

A **language model** is a probability distribution over strings. That is the whole definition — nothing about neural networks, nothing about generation. Nobody can estimate that joint distribution directly: the number of possible 30-token sentences over an 8 000-token vocabulary is $8000^{30}$. So the first move — Shannon's, in 1948 — is the chain rule. Nothing is lost, it is an identity; but it changes the question from "how likely is this text" to "how likely is the *next token*, given everything so far", and *that* a model can answer one step at a time.
