# prefix · Classify 7 600 texts with no labels at all

## prefix-p1

Volume: the test set. Labels: none — we are not allowed to train. Baseline to beat: TF-IDF at 0.92 (which *was* allowed to train), and week 4's zero-shot through `[MASK]` at 0.47. First instinct: write `This news is about` after the text, let GPT-2 generate, read the word. That is the generator — one pass per output token, then a parser for whatever it wrote. Look again: we do not need the model to *say* anything. We need to know which of four continuations it finds most likely. That is the scorer: four forward passes, zero generated tokens, and the answer is always one of the four.

## bet-zs

Accuracy on 7 600 texts? Random is 0.25.

## prefix-p2

Now build the verbalizer yourself. Every candidate word below was scored against every one of the 7 600 texts by the notebook's `score`; the argmax runs here. Pick one or more words per class, switch between the summed and the per-token score, and watch what a three-token word does.

## prefix-note1

Below TF-IDF, and that is the right answer, not a disappointing one. The scorer guarantees the *form* of the answer — always one of four — and nothing about its *content*: a 124M model that has never seen a label does not know what we mean by *Business*. The follow-up: *ten million texts a day*. Use these answers as labels, train week 4's Linear on them, and serve one pass of an encoder. The decoder's job was to *make the labels*, not to serve.

## prefix-p3

Three tasks, one card each. Then we run them both ways — a body with a head, and a decoder with the task in the prefix — and the two tables say who was right. Every line on the card is a word we already own. Fill it here; `estimate` from the notebook puts a number on "passes per day" before anything is trained. The **follow-up** line is what an interview actually sounds like: *and if there are no labels? and if the categories change every week? and at ten times the volume?*

## prefix-p4



## prefix-p5

Before you choose a body for 3.1, type any sentence: the label set of the encoder way — four cases times eight punctuations, 32 labels — is applied to every word by `word_label`, running here. Words it cannot express are marked.

## prefix-p6

For 3.2 the noise is synthetic, six kinds of it, and the kinds are the whole point. Corrupt a query yourself: pick the operation and the position.

## prefix-note2

Four of the six keep the word count — a letter substituted, dropped, inserted, two letters swapped. Two do not: a word split in two, two words merged. Hold that for block 05.

## prefix-p7

For 3.3 the decoder has to *write* the entities, and there are two natural formats. Write one yourself for the sentence below; the notebook's parser turns it back into BIO tags and counts what it could not match.

## prefix-note3

An entity whose words are *not in the sentence* — rewritten, invented — has nowhere to go: it is **unmatched**. The head cannot make this mistake, because a tag has to sit on a word.

## prefix-p8

Six systems, one minute each. Not "encoder or decoder" — *which week of this course solves it*, with which body, at how many passes per item.

## zs-note

On the {n_live} live texts `Sci/Tech` was chosen {n_scitech} times and `World` {n_world}. `Sci/Tech` is three tokens; `World` is one. A sum of three log-probabilities is smaller than a sum of one almost by construction — the argmax was decided by tokenization, not by the text. The per-token fix loses {per_token_loss} points and flips the failure (now `Sci/Tech` takes almost everything: the two tokens after `Sci` are nearly free). One-token words — a **verbalizer** — buy {verbalizer_gain} points: {verbalizer_acc}, above week 4's mask and far below TF-IDF.

## card-note

Guaranteed to be <b>{guaranteed}</b>: that line decides the reveal. {why}

## wl-line

{unx} of {n_words} words cannot be expressed by the {n_labels} labels · on the {n_live} live texts: {live_pct} of {live_words} words · on the {n_test} test texts: {test_pct}

## noise-short

'{w}' has 2 letters or fewer: add_noise leaves it alone

## noise-line

{op} at position {k} of '{w}' → {n_out} words from {n_in} {tail}

## lr-score-picked

{n_picked} of {n_q} picked

## lr-score-final

{n_right} of {n_q} agree with the answers

## card-why-nothing

A generator's output is nothing in particular — measure fidelity, not only accuracy.

## card-why-label

A label set has a ceiling — measure what it cannot express before training.

## card-why-substring

Two pointers cannot invent; a generator usually copies, and nothing forces it to.

## card-why-copy

A copy is safe and cannot correct anything.

## card-note-empty

Fill the card; the two tables in block 05 say who was right.

## card-est-empty

pick <b>passes</b> to get the numbers

## noise-changed

— the word count changed: a label per input word has nowhere to say it

## noise-same

— one label per word can still point at it

## ner-parsed

{n_ents} entities parsed · <b style="color:var(--bad)">{unmatched} unmatched</b> · {n_wrong} not the gold span (dashed){suffix}

## ner-model-wrote

this is what the model wrote
