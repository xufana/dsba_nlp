# parked · not built (outside text/)

Taken out of lecture 1 on 2026-10-13: the bins (sequence labelling, seq2seq, retrieval, language modelling) are not
explained by then. Intended for the week 4 lecture, after the theory on task heads; copy the chunk into that
week's demo/lecture/text/ and place it with {{quiz:q-tasks}}.

## q-tasks · sort

Twelve products. Which task is each one, as the model sees it — what goes in, what comes out? Several have two honest answers; pick the one you would build first.

bins: regression · classification · sequence labelling · generation · retrieval · language modelling

- salary prediction by job description → regression
- a spam filter for a mailbox → classification
- autocomplete in a phone keyboard → language modelling
- web search over a billion pages → retrieval
- finding names and dates in scanned contracts → sequence labelling
- German → English translation → generation
- a dashboard of customer sentiment over time → classification
- a chatbot answering support questions → language modelling | generation
- deduplicating near-identical news articles → retrieval
- routing a support ticket to one of 40 teams → classification
- summarising a meeting transcript → generation | language modelling
- splitting a text into sentences → sequence labelling | classification
- detecting the language a tweet is written in → classification

> The product name tells you nothing; the shape of the input and the output tells you everything, but knowing the task you're trying to solve is crucial. One text in, one label out: classification, and that covers spam, sentiment, routing and language detection — four products, one model family, which is why one of the seminars spent a whole day on it. One label *per token*: sequence labelling — NER, and sentence splitting if you treat every character as "boundary or not" (a classifier per position; both bins are right). Text in, a different text out: seq2seq — translation, summarisation. A query in, the nearest documents out: retrieval — search, and deduplication is search for the nearest neighbour of every document. A prefix in, a distribution over the next token out: language modelling — autocomplete, and the chatbot, which is an LLM conditioned on the dialogue; underneath a real one there is retrieval too.
>
> miss: if the chatbot and the summariser went into separate bins from autocomplete: fair, they feel different. But all three are the same object, `P(next token | prefix)` — see the next week.
