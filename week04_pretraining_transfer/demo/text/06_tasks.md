# tasks · NER and QA

## tasks-p1

The dial was measured on one task, with the head that reads one vector. Now the two tasks where the head reads all of $H$ — and for each, the two ends of the dial: head only, and everything.

**CoNLL-2003**: 14 000 Reuters sentences from 1996, every word tagged as a person, an organisation, a location, miscellaneous, or nothing. `B-` begins an entity, `I-` continues it, `O` is outside — **BIO tagging**, 9 labels. *Werner Zwingmann* is `B-PER I-PER`, and if two persons stand next to each other, the second one gets a `B-` — which is the only reason the `B` exists at all. One label per word; BERT sees WordPieces. `word_ids()` says which word every token came from: the first token of a word carries the tag; the continuations get `-100`, and the cross-entropy skips them.

## tasks-note1

`DataCollatorForTokenClassification` pads `input_ids` with `[PAD]`, `attention_mask` with 0 and `labels` with `-100`. The cross-entropy inside `BertForTokenClassification` skips every position labelled `-100` — `ignore_index=-100` is PyTorch's default, which is why the whole ecosystem uses that number. Not 0: 0 is `O`, a real tag, and the model would be trained to say `O` on padding and on every second piece of a word. That's it — the head never has to know what a word is.

## bet-ner

Token accuracy will be above 90%. What's the entity-level F1, where an entity counts only if its type *and both boundaries* are right?

## ner-note

That gap is the reason the field reports entity F1 and not token accuracy. Most words are `O`; a model that says `O` everywhere gets 83% token accuracy on CoNLL and finds nothing. And an entity with one wrong boundary — `B-PER I-PER` predicted as `B-PER O` — is one wrong token, one *whole* wrong entity. Token accuracy is a metric for the head; entity F1 is a metric for the task.

## tasks-note2

**Head only gets you most of the way.** The frozen body already separates names from non-names. **Labelling the continuations costs F1** with the same head, the same body, the same data — `B-PER B-PER B-PER` is three persons in a row to anything that reads BIO. **Fine-tuning the body** is worth the points that come from `ORG` and `MISC` — the types that depend on context. A dashed outline marks a word where the two models disagree.

## tasks-p2

**SQuAD v1.1**: 100 000 questions about Wikipedia paragraphs, where the answer is always a *span of the paragraph*. The label is a *character* offset. The question and the paragraph are two segments — `token_type_ids`, at last doing its job. And paragraphs are long: the paragraph is cut into *overlapping windows*, each window one training example, with the label pointing at the answer if it's inside and at `[CLS]` if it isn't.

## fig-qa-note

`Linear(768, 2)` at every position gives two numbers per token: a start score and an end score. `unbind(-1)` splits them into two rows of length $L$, and each row is its own softmax over the *positions*. The answer is the best pair with start ≤ end, both inside the context, at most 30 tokens apart (`best_span`) — not two independent argmaxes, or "the end before the start" is a real answer the model can give you.

## tasks-note3

The label decodes back to the answer text in the window that contains it, and to nothing in the others. If that round trip fails on your own data, nothing downstream can work — check it before you train, always.

## tasks-note4

The plain collator pads `input_ids`, `token_type_ids` and `attention_mask` to the longest row of the batch. The labels here are two integers per window — `start_positions`, `end_positions` — so there is nothing to pad and nothing to ignore: a window without the answer is labelled (0, 0), the `[CLS]` position, and that is a real target, not a skipped one.

## bet-qa

NER got most of the way on frozen features. Will QA? Token F1 on the dev questions:

## qa-note

It will not. And this is the most useful negative result of the day: **the same frozen body that hands NER <span data-ner-f1></span> F1 hands QA almost nothing.** "Is this token a name" is a property of the token that the MLM objective happened to need; "does this token start the answer to *that* question" is a relation between two segments that nothing in pretraining asked for. The vectors don't contain it, and a Linear can only read what's there. So for QA the body has to move — the head is the same 1 538 numbers in both rows.

## tasks-note5

❓ The model *always* answers. Give it a question whose answer is not in the paragraph and it will still pick the best-scoring span. SQuAD 2.0 lets position 0 — `[CLS]` — win the two softmaxes. Why does that work with the head we have, without adding a single parameter?

## fig-ner-note-label

**Labelled continuations, measured:** the same head, body and data give entity F1 {f1_labelled} against {f1_ignored} with −100 — {d_pts} points. The extra labels aren't extra information — they're the same tag repeated, and a `B-` on a continuation reads as a new entity to anything that reads BIO.

## fig-ner-note-ids

`word_ids()` from the fast tokenizer says which word every token came from — `None` for the specials, the same id repeated for `z ##wing ##mann`. The first token of a word carries the word's tag; the continuations get −100 and the cross-entropy skips them. *sheepmeat* shows the same rule on an `O` word: three tokens, one label, two skips. The 9-cell row above each token is the head's output there; the green cell is the target.

## fig-qa-note-scores

<b>{question}</b> · {win}argmax start <b>{start_tok}</b> ({p_start}), argmax end <b>{end_tok}</b> ({p_end}) → `best_span`: <b>{span}</b>{decoded}{tail}. Grey bars: question and special positions, excluded by `best_span`. Each row is its own softmax over the positions.

## ner-live-note

per type: PER {per} · ORG {org} · LOC {loc} · MISC {misc} — on {n_test} test sentences, one epoch of {n} sentences is barely past the all-O model (83% token accuracy, F1 0).

## fig-qa-note-window

window 1 of {n}

## fig-qa-note-decoded

decoded from the offsets: <b>{pred}</b>

## fig-qa-note-gold

gold: {gold}

## fig-qa-note-noanswer

<span style="color:var(--bad)">the answer is not in the paragraph — and the two rows still have peaks</span>
