# why · Why learn NLP in 2026?

## why-p1

A fair question. An LLM will classify these headlines without any of the code in the seminar. So why does this course exist?

## q-why · write

Why are we still doing NLP in 2026, when an LLM classifies, translates and summarises out of the box? List your reasons or the things that make working with texts complicated.

- to keep the semantics is a hard thing to do for texts
- turn a string into an object where the operation you care about is cheap
- every representation bought something and paid for something; there is no winner
- choosing one is an engineering decision with a price: latency, memory, labelled data, predictability

> Because the thing we have been solving for seventy years was never "build a model". It was: **turn a string into an object where the operation you care about is cheap and is keeping the properties of the language** That is the whole field. TF-IDF, LSA, word2vec, a contextual encoder, a prompt to an LLM — each is one answer to that question, and every answer bought something and paid for something. No new method fully replaced the one before it.
>
> So the job is not to know the newest model. It is to choose a representation on purpose — with a price in latency, memory, labelled data and predictability — and to be able to explain the choice.
> miss: if your answer is a list of applications (chatbots, translation, search), you listed the operations and skipped the object. The applications are what the course is *for*; the representation is what it is *about*. Keep in mind the difference between "how" and the task formulation.
