# hero · solver = body × head × dial

## lede

Last week we built a transformer from scratch and trained it on 29 000 German captions. It worked, it beat the LSTM, and it took 15 epochs on a GPU to translate captions — and nothing else. Every task we've touched in this course so far started from zero: zero weights, zero knowledge of English, one dataset.

## hero-p1

This week we stop doing that. The body we built last week is the same body, but somebody (Google, 2018) already trained it on 3.3 billion words, and we are going to take those weights and *not* train them, or train them a little, and see how far that gets us. On three tasks, not one.

And here is the thing that I want you to walk out with: the part of the model that is actually *about the task* is tiny. Embarrassingly tiny. We'll count.

## hero-p2

**One pretrained representation, and the task lives in the head** — its *output shape*, the *point where it attaches*, and the *axis the softmax runs along*. That last one is the whole difference between NER and question answering, and it's one word in the code.
