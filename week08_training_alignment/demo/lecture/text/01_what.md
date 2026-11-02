# what · What alignment is

## what-p1

After pretraining the model can **continue text** — the way text continues on the internet. It knows a lot, but:

- it does not necessarily answer a question: it may continue it with ten more questions, like a forum thread;
- it writes the useful, the toxic and the made-up with the same readiness;
- it does not know which answer we consider good.

**Alignment** is the training after pretraining that moves the distribution of answers from "how it happens on the internet" to "how we want it". The usual target is HHH: *helpful, honest, harmless*.

## what-p2

An analogy. Pretraining is a person who has read the whole library. Alignment is their first job, where they are told how to talk to clients, what is allowed and what is not, and that an honest "I don't know" is better than a confident invention. Almost no new knowledge is added — the behaviour changes.

It happens in stages, and the stages differ in one thing: **what signal says which answer is good**. Supervised fine-tuning (SFT) shows the answer — "write this". Preference optimisation compares two answers — "this one is better than that one". RL on verifiable tasks runs a check — "right" or "wrong". Safety data, Constitutional AI and red teaming are fed into the preference stage.

## pipeline-caption

Each stage gets less data than the one before it, and a narrower signal: trillions of tokens of text, then tens or hundreds of thousands of demonstrations, comparisons and checked answers.

## q-where-from · sort

Where does each of these come from in an assistant — pretraining, or the stages after it?

bins: pretraining · alignment

- it knows that the capital of Australia is Canberra → pretraining
- it answers a question instead of continuing it with more questions → alignment
- it can write a Python function → pretraining
- it stops after the answer instead of writing the user's next message → alignment
- it translates between French and English → pretraining
- it declines to give instructions for making a weapon → alignment
- it says "I'm not sure" instead of inventing a citation → alignment

> Knowledge and skills come from the library: facts, code, languages are all in the pretraining text, and a base model can already show them with the right prompt — a few-shot prompt with translations gets you translations. What alignment adds is *when and how* to use them: answer instead of continue, stop at the end of the turn, decline, admit uncertainty. That is behaviour, and that is why it takes thousands of examples rather than trillions of tokens.
> miss: if "stops after the answer" went to pretraining: a forum thread on the web does not stop after one reply. The end-of-turn token is something the model is taught to write, and it is taught in SFT.

## what-p3

The practical consequence is the one people miss most often: if the model lacks a *fact*, post-training is the wrong tool. A fact the model needs goes into the prompt, or into a document retrieved for the prompt. Teaching it through fine-tuning mostly teaches a style of answering — we will see in the next block what that does to hallucinations.

## q-new-fact · pick

Your company wants its assistant to know the 2026 price list, 300 products. What do you do?

- [ ] SFT on a few thousand questions about prices with the right answers
- [ ] preference optimisation: pairs where the correct price is chosen
- [x] put the price list, or the relevant part of it, into the prompt
- [ ] RL with a checker that compares the price to the list

> The prompt — or retrieval, if the list does not fit. It is exact, it updates the day the prices change, and you can check where an answer came from. Every training-based option tries to put knowledge into weights through a stage designed to change behaviour: you pay for a training run per price change, and SFT on facts the model did not know teaches it to answer confidently whatever it knows (Gekhman et al. 2024) — which is exactly what you do not want for prices.
> miss: if SFT: it will learn the *format* of a price answer long before it learns the prices, and between the two it will produce confident wrong numbers.
