# answer

## answer-p1

The retriever has found something — from here on the prompt decides. The main source of hallucinations in RAG is a context that is not enough: the retriever brought the wrong thing or not all of it, and the model has to answer anyway. So the defence is built around the question "is the context enough?" — before generation, during, and after.

## sandbox-hint

The same question under three prompts: no context (closed book), the retrieved top-3, and the top-3 plus the line «Если в контексте нет ответа, явно скажи об этом». Every answer is the 3B model's, greedy; nothing is written by hand.

## bet-idk

The ten questions without an answer in the corpus, with the top-3 in the prompt. What does the line «Если в контексте нет ответа, явно скажи об этом» change?

## idk-note

Declined: {ctx}/{na} without the line, {idk}/{na} with it, {closed}/{na} with no context at all; the golden questions with the line: {gold}/{n} declined. The rest are answered from the model's own knowledge — borscht, the tax deduction — or invented: with a context about another paper, "Gemini 3 reached SOTA on 30 of 32 benchmarks". Declined here means the answer says the context has nothing and does not answer; every answer was read by hand.

## th-p1

The most obvious filter: do not answer if the best cosine is below a threshold. Below — the best dense cosine for every question: the golden ones, and the ones the corpus cannot answer. Move the threshold and try to find a value that breaks neither group.

## bet-th

Is there a threshold that keeps all the golden questions and stops all the questions without an answer?

## th-note

The lowest golden question scores {gmin}, the highest one without an answer {nmax}. {verdict}

## th-yes

On this corpus the groups do not overlap — by {gap}. A threshold in that gap would work for these questions, and nothing guarantees the next one: the gap moves when the encoder, the corpus or even the wording changes. A rough first filter, checked on your own data.

## th-no

The groups overlap, so every threshold either drops golden questions or lets through questions without an answer. And it moves when the encoder, the corpus or even the wording changes.

## thg-p1

Thirty questions of one corpus happened to separate. In general they do not, and the reason is in which questions arrive. A synthetic example with the shapes that show up in practice: well-formed questions the collection answers score high, off-topic ones score low — and a threshold between them looks perfect. Then real traffic adds two more groups: answerable questions written badly (typos, two keywords instead of a sentence), whose best cosine drops, and unanswerable questions *on the collection's topic*, whose best cosine is as high as a real hit's, because their neighbours are about the same thing.

## bet-thg

Add both groups. Is there still a threshold that refuses fewer than 10% of the answerable questions and lets through fewer than 10% of the unanswerable ones?

## thg-cap

Synthetic scores: each dot is a question's best cosine. Green rows have an answer in the collection, red ones do not. The shaded side of the threshold is refused.

## thg-note

With all four groups, the best threshold, {t}, still refuses {ref} of the answerable questions and lets through {pass} of the unanswerable ones. Switch the encoder: the same questions land on another scale, and the best threshold moves to {t2} — a threshold is tuned to one encoder, one collection and one kind of traffic. Judging whether the context answers the question needs to read both: the next stand.

## crag-p1

**CRAG**, corrective RAG: after getting the candidates, the LLM judges their relevance. If the context is irrelevant, the system switches to a *fallback* strategy — web search, another corpus, or refusing to answer. Here: the 3B model, one call, "yes" or "no" for the top-1 document.

## bet-crag

How many of the ten questions without an answer does the check let through?

## crag-note

"Yes" for {gy}/{n} golden questions and for {ny}/{na} questions without an answer. On the golden set that turns into Hit@10 {hit}: every "no" on a golden question is a refusal where the answer was there.

## card-before

LLM judge "is the context enough for an answer?" (expensive, but works), metadata filters. A similarity threshold only as a rough first filter and only after checking it on your data; more often it is better not to use it.

## card-during

Look at the logits: a low probability of the tokens is a signal of doubt (FLARE above). A logits processor forbids what must not be in the answer.

## card-after

Prompt chaining: first pick quotes from the context, then answer only from them; an explicit "I don't know" in the instruction; a groundedness check with a second call.
