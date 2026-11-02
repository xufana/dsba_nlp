# rnn · Learning instead of counting

## rnn-p1

Counting has a ceiling and we just hit it. The reason is not the amount of data; it is that a count-based model treats every prefix as an unrelated symbol. *Штирлиц открыл* and *Мюллер открыл* share nothing — even though whatever follows one probably follows the other. The **recurrent** network drops the window: instead of looking at the last $n − 1$ tokens, it maintains a state vector $h_t$ that is updated once per token and is supposed to summarise *everything so far*: $h_t = f(h_{t-1}, x_t)$, $P(w_{t+1} | w_{≤t}) = \mathrm{softmax}(W h_t)$.

## q-rnn-h · pick

What is $h_t$, for the task?

- [x] a fixed-size summary of the whole prefix — the thing the next-token softmax reads; the role the $n − 1$ window played, without the window
- [ ] the embedding of the current token
- [ ] the probability distribution over the next token
- [ ] a copy of the tokens seen so far

> The condition of the conditional. The n-gram model conditioned on the last two tokens because those were the only prefix it could index; the RNN conditions on $h_t$, 256 numbers that are a function of every token so far. Same chain rule, same next-token prediction — the context is unbounded in principle, and in practice bounded by how much 256 numbers can hold and how far a gradient can travel. The distribution is one matrix multiply away, $\mathrm{softmax}(W h_t)$; the embedding of the current token is one of the two inputs to the update, not the state.
> miss: if "a copy of the tokens": it cannot be — the size is fixed and the prefix is not. It is a *compression* of the prefix, and what the compression keeps is learned from the loss.

## q-rnn-shared · point

The same network, unrolled over four steps. Click what is the same at every step.

<div data-fig="rnn-unrolled"></div>

- [ ] x: the inputs
- [ ] h: the states
- [x] f: the update and the output matrix
- [ ] y: the predicted distributions

> The weights: one $f$ — one embedding table, one recurrent cell, one output matrix — applied at every position. That is what makes the length free: a joke of 30 pieces and one of 300 go through the same parameters, and a prefix of any length ends in a state of the same size. It is also why the gradient has to travel *back through time*: the same matrix is multiplied in at every step, so the loss at the last token reaches the first through a chain of those multiplications — which is the subject of the optional block below.
> miss: if the states: each $h_t$ is a different vector — same *shape*, different numbers. Sharing is about parameters, not activations.

## rnn-p2

Why should a network do better than counting? Because of embeddings. Bengio et al. (2003) built the first neural language model by concatenating the embeddings of the last $n − 1$ words and putting a network on top — the same Markov assumption, but now *cat* and *dog* share statistics through their vectors. The recurrent network keeps that and drops the window.

## q-rnn-why · pick

Why can the network generalise where counting could not?

- [x] prefixes become vectors, and similar prefixes — *Штирлиц открыл*, *Мюллер открыл* — get similar states through shared embeddings and weights, so what is learned about one transfers to the other
- [ ] it has more parameters than the count table
- [ ] it reads the whole text at once
- [ ] it is trained for more epochs

> Through similarity. Last week's embeddings put *Штирлиц* and *Мюллер* near each other; the shared update then maps the two prefixes to nearby states, and the output layer, which never saw one of them, still produces a sensible distribution. Counting has no notion that two prefixes are alike; every cell is its own island. That, not the parameter count, is the mechanism — and it is why the RNN writes jokes that are *not in the corpus* while the 5-gram recited. Perplexity does not always show that difference: at a small scale a well-smoothed trigram can match a small network. The neural win arrives with data and size, and so does the habit of running the strong simple baseline first.
> miss: if "reads the whole text at once": that is next week's model. The RNN reads strictly left to right, one token per step.

## rnn-p3

Everything so far generates text from nothing but a prefix. The moment you want to generate text *from an input* — translate a sentence, summarise a document, answer a question — you need one more idea: condition the language model on a second sequence. The **encoder–decoder** (Sutskever et al. 2014; Cho et al. 2014) does it in the most direct way: one network reads the input into a vector, a second one generates from it.

## q-rnn-s2s · pick

An encoder–decoder (seq2seq) for translation is

- [x] the same language model, with its initial state set to a summary of the source sentence instead of zeros
- [ ] two language models, one per language, trained together
- [ ] a language model with a vocabulary that covers both languages
- [ ] an RNN that reads the input twice, forwards and backwards

> One RNN, the encoder, reads the German and boils it down to a fixed-size vector. A second RNN, the decoder, is a language model exactly like the one above, except its $h_0$ is that vector. So the decoder generates English, but it starts from a summary of the German: same chain rule, same next-token prediction, same decoding rules — one extra input. The bidirectional reading is a detail of the *encoder*, and a real one; the two languages do get separate tokenizers; but the architecture is "a conditioned language model", and that is all translation, summarisation and dialogue ever were.
> miss: if "two language models": the encoder is not a language model — it predicts nothing, it only produces the state. Only the decoder has a softmax.

## q-bottleneck · pick

Everything the decoder knows about the German has to pass through the encoder's final state — 256 numbers, whether the caption has three words or twenty. What happens to translation quality (BLEU) as the source sentence gets longer, and what does a wider state change?

- [x] BLEU falls as the source gets longer, at every width; a wider state lifts the whole line, but the slope stays — the failure is architectural
- [ ] flat lines: the bottleneck is a textbook story, not a measurable one
- [ ] BLEU rises with length, because longer sentences give more context
- [ ] only the narrowest model drops; at 256 the problem is gone

> On German–English captions with a 256-number state, BLEU falls from {bleu_short} on the shortest sentences to {bleu_long} on the longest — the longer the German, the more has to squeeze through the same 256 numbers. Widening 64 → 128 → 256 raised BLEU at every length and did not remove the slope: you can buy your way *partly* out with dimensions, not all the way, because the failure is the architecture, not the size. The translations show the fingerprint: the nouns survive, the details do not — *a man in a red shirt* becomes *a man in a blue shirt*. Bahdanau et al. (2015) opens with exactly this decay and proposes to let the decoder look back at *all* encoder states; that flattens the curve, and it is next week.
> miss: if "only the narrowest drops": the opposite — the 64-wide line was flat because it was near the floor at every length. You need a model good enough to have something to lose.

## rnn-p4

Training a decoder has one choice the architecture does not make for you: what it reads as its previous token during training — the reference translation, or its own guess.

## q-tf · pick

Teacher forcing. During training, the decoder's input at step $t$ is

- [x] the gold token $t − 1$, whatever the decoder predicted; at generation time it is the decoder's own previous output — a mismatch called exposure bias
- [ ] its own previous prediction, as at generation time
- [ ] the encoder's state, again
- [ ] a random token, for regularisation

> The gold prefix, always. That is what makes training fast and stable: every position is an independent next-token classification with a guaranteed-correct prefix, and the whole target trains in parallel. At generation there is no gold prefix, the decoder feeds on its own output, and the first wrong token produces a prefix it never saw in training — the error compounds down the sequence. Scheduled sampling and sequence-level training were proposed for this; in practice attention and transformers reduced the drift enough that the field mostly stopped worrying.
> miss: if "its own prediction": that is what you would do at test time, and doing it during training makes every step depend on the previous one — slow, and unstable early on, when the predictions are noise.

## optional-p1

The reason the plain RNN is living on borrowed time. Not NLP — it is the arithmetic of the recurrence — but it is the reason the LSTM exists, and the reason one training trick survived into every transformer.

## q-grad · pick

To learn that the beginning of a joke matters for its end, the gradient of the loss at the last token has to reach the first token. On the way it is

- [x] multiplied by the Jacobian $∂h_t / ∂h_{t-1}$ at every step — thirty steps, thirty multiplications; a typical factor below one and it vanishes, above one and it explodes
- [ ] passed through one matrix, the same at every step, so it arrives unchanged
- [ ] routed through the embedding table
- [ ] averaged over the positions, so it arrives diluted but intact

> A product. Thirty factors, each the Jacobian of one update; a plain $\mathrm{tanh}$ recurrence does both — vanish and explode — depending on the weights (Bengio et al. 1994; Pascanu et al. 2013). Measured on jokes, averaged over fifty of them: 40 steps back, the plain RNN's gradient is about {rnn_decay} times smaller than at the last position; the LSTM's, about {lstm_decay} times. Whatever happened at the start of the joke, the loss at the end cannot teach the plain RNN anything about it.
> miss: if "one matrix, unchanged": it *is* one matrix — multiplied in thirty times. One matrix applied repeatedly is exactly how you get a power, and powers either vanish or blow up.

## q-lstm · pick

What the LSTM changes:

- [x] its cell state has an *additive* path through time, $c_t = f_t ⊙ c_{t-1} + i_t ⊙ \mover{c}{~}_t$, so the gradient can pass through the forget gate unchanged instead of being multiplied by a weight matrix at every step
- [ ] it has more layers
- [ ] its state is bigger, so it can hold more
- [ ] it uses a different softmax

> Addition instead of multiplication along the time axis. The forget gate can sit near one, and then $∂c_t / ∂c_{t-1}$ is near one too: the gradient travels through the cell state without passing a weight matrix at each step. That is the whole trick, and it is measurable — the decay above. The gates cost 4× the recurrent parameters, cheap next to the 8 000-way output layer, and GRU gets the same effect with three gates instead of four and lands in the same place in practice.
> miss: if "bigger state": compare them at the same state size and the difference stays. What changed is the *path* the gradient takes, not the size of the state.

## optional-p2

Two practical consequences: how to read a small gap between the cells on a real corpus, and the one training trick from the RNN era that every transformer still uses.

## q-close · pick

On a corpus of short texts — jokes — a plain RNN, an LSTM and a GRU land close in perplexity. Does that make them equivalent?

- [x] no — jokes are short and the dependencies that pick the next piece are mostly local, so this corpus did not test the thing the cells differ on
- [ ] yes: on this task they are interchangeable, pick the cheapest
- [ ] no — the LSTM would win with more epochs
- [ ] yes, and the gradient plot is therefore irrelevant

> The close perplexities did not mean the cells are equivalent; they meant the corpus did not demand long memory. The gradient plot shows the plain RNN's blindness is real; the perplexity shows that on *short* jokes it costs little. The moment the task needs a dependency thirty steps back — a longer text, a matching bracket, an agreement across a clause — the plain RNN cannot learn it at all, while the LSTM still can. Pick the cheapest only after you have checked what the data asks of the memory.
> miss: if "interchangeable": that is the conclusion of someone who ran one benchmark. A tie on one corpus is a fact about the corpus.

## q-clip · pick

Gradient clipping, `clip_grad_norm_`, fixes

- [x] the occasional exploding batch: any gradient above a threshold is rescaled to the threshold — a trick from the RNN era that survived into transformer training unchanged
- [ ] vanishing gradients
- [ ] overfitting
- [ ] slow convergence on long sequences

> The explosion side. Every few dozen steps one batch produces a gradient ten or a hundred times larger than usual — one exploding path through the recurrence — and a single such step at a normal learning rate can wreck the weights. Clipping rescales it and costs nothing. It does not help the vanishing side, which is what the gates are for; and it is in every transformer training loop today for the same reason it was in every RNN loop.
> miss: if "vanishing": clipping only ever makes a gradient *smaller*. It cannot restore one that arrived as zero.
