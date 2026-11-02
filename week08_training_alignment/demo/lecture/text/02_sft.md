# sft · Supervised fine-tuning

## sft-p1

**The idea.** Pairs "instruction → reference answer", and the usual next-token loss — computed **only on the tokens of the answer**. The model reads the whole dialogue through a chat template: special markers say where the system prompt, the user's turn and the assistant's turn begin and end. All of it is context, and only the assistant's answer is a target: every other position gets the label that the loss ignores. The model is not asked to predict what the user will write; it is asked to predict what the assistant writes, given everything before it.

**What it is for.** The dialogue format, following instructions, style, basic refusals. It is the cheap way to give the model a "character" — LIMA (Zhou et al. 2023) got a usable assistant out of 1 000 carefully chosen examples.

## q-sft-mask · point

One training dialogue through a chat template. Which parts carry the loss? Click all that do, then Check.

<div data-fig="sft-mask"></div>

- [ ] sys: system prompt
- [ ] user: the user's turn
- [ ] head: the marker that opens the assistant's turn
- [x] ans: the answer
- [x] end: the marker that closes the assistant's turn

> The answer and the marker after it. The opening marker is part of the prompt: at inference *we* write it, and the model takes over after it. The closing marker is the model's to write — it is how a fine-tuned model knows to **stop**, and if it is masked out, the model answers and then rolls on into a new turn of its own.
> miss: if the user's turn was ticked: then the model learns the distribution of questions as much as of answers, and on most dialogues there are more prompt tokens than answer tokens.

## sft-p2

**The problems.** Each comes from the same fact: SFT can only say "write this".

- Good demonstrations are expensive: writing a reference answer is harder than choosing the better of two.
- It only teaches how to do it, never how *not* to: there is no negative signal.
- It imitates the surface. If the data contains facts the model did not know after pretraining, it is taught to answer confidently without anything to back the answer — and that provokes hallucinations (Gekhman et al. 2024).
- The ceiling is the quality of the annotators.
- **Exposure bias**: the model trains on perfect prefixes — the reference answer up to position $t$ — and generates on its own. After its first mistake it is continuing a prefix unlike any in the training data.

## q-sft-faults · pick

You fine-tune on 10 000 answers written by domain experts. Some of the answers use facts the base model has never seen. What should you expect? Tick all that apply.

- [x] it answers in the experts' confident style, also where it has nothing to back the answer
- [x] it never learns which answers are bad — it saw only good ones
- [x] once it makes a mistake mid-answer, it handles the rest worse than the experts' answers would suggest
- [ ] it forgets the chat format
- [ ] it cannot be trained without a reward model

> The first three. The style is the easiest thing in the data to learn, and it is learned everywhere, including on questions the model cannot answer — that is how SFT on new facts turns into confident invention. No rejected answers means no signal against anything. And every training prefix was the expert's, so the model has never practised continuing from its own error — exposure bias. The format is exactly what SFT teaches best, and it needs no reward model: that is the whole appeal.
> miss: if you skipped the first one: the experts are right, so it is tempting to think more right answers can only help. They help the format; for knowledge the model lacks they train the confidence without the knowledge.
