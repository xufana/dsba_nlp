# design · Design it

## design-p1

One system, end to end, with the week's tools and nothing newer. There is no single right design; there is a short list of things a right design cannot skip.

## q-design · write

A bank wants to route incoming support messages — Russian, from chat and e-mail — to one of 40 teams. You have 2 000 labelled messages, a million unlabelled ones, and the router has to answer in under 100 ms on a CPU. Sketch the system: data, representation, model, metric, and what breaks first.

- the task: 40-way single-label classification — one message, one team
- a sparse baseline first: tf-idf over words and character n-grams, logistic regression; an hour of work
- Russian plus chat text: character n-grams or subwords for morphology and typos; stemming measured, not assumed
- stopwords stay: on short messages `не` can be most of the evidence
- the metric: macro-F1 or per-team recall, not accuracy — 40 teams are not balanced
- the shortcut check: signatures, team names, quoted replies and ticket ids inside the text
- the million unlabelled messages buy you word vectors or a tokenizer — not labels
- what breaks first: new product names (OOV), a team that splits in two, and noise in the 2 000 labels

> **Task.** One message in, one of 40 teams out: multi-class, single-label, so one softmax and a cross-entropy. If messages routinely belong to two teams, say so now — that is multi-label, a different loss and a different metric, and it changes the labelling instructions.
>
> **Data.** 2 000 labels over 40 classes is 50 per class on average and far fewer for the long tail. Look at the label counts before anything else; the rare teams are where the system will fail, and where the metric has to look. The million unlabelled messages cannot vote on a team, but they can train word vectors, a subword tokenizer and an idf table on the bank's own vocabulary — and they are the pool you sample from when you go back to label more.
>
> **Representation.** The strong sparse baseline first: tf-idf over words *and* character 3–5-grams, because the text is Russian (five surface forms per noun) and typed in a hurry (typos). That is the OOV answer from this lecture, and it runs in microseconds. Do not drop stopwords by habit: on a two-line message `не работает` is the signal, and on short texts the negation can be most of the evidence there is. Stemming is a bet; measure it on a held-out split, do not assume it. Mean-pooled embeddings trained on the million messages are the second experiment, not the first — they bring knowledge from unlabelled text, and they dilute the one decisive word; which effect wins with 50 labels per class is an empirical question.
>
> **Model.** Logistic regression on the sparse matrix. On text the features do most of the work, and this model is fast, calibrated — `predict_proba` is a number you can threshold to send low-confidence messages to a human queue — and readable: the top weights per team are a sanity check you can show to the team itself.
>
> **Metric.** Not accuracy. With 40 unbalanced teams, a model that routes everything to the two largest ones scores well on accuracy and is useless. Macro-F1, or recall per team with a floor for the small ones, on a split that is stratified by team.
>
> **What breaks first.** The shortcut: e-mail signatures, quoted earlier replies and team names *inside* the text — a model that learns "contains `отдел карт`" is classifying the thread, not the request; strip them, retrain and compare. Then OOV: new products and campaign names arrive weekly, and a word model is blind to them — this is what the character n-grams are for, and what a monthly refit of the vocabulary is for. Then the labels: 2 000 messages labelled by whoever was free will disagree with each other, and the ceiling of every model is set there, not in the representation. When all your models land within a point of each other, go read the labels.
> miss: if the design starts with an encoder or an LLM: it may end there, but it cannot start there. You have no baseline to beat, no latency budget left under 100 ms on a CPU, and 2 000 labels is enough for the sparse model to be strong. Build the cheap thing, then earn the expensive one.
