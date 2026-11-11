# query

## query-p1

It often happens that users ask questions not at all the way we expect: with typos, incompletely, illiterately — and we need to be able to handle it (because we have no choice). Three tricks to make the query look more like what lies in the index, or to search not once but as many times as needed.

## qe-p1

As a rule, we solve the problem of non-standard but complete queries by rephrasing the user's question. Left: the question searched as is; right: the 3B model's rephrasing, searched the same way.

## qe-note

Gold post: rank {a} with the question, rank {b} with the rephrasing. Over the golden set: MRR {m0} → {m1}.

## para-p1

Rephrasing is often enough on its own: typos, slang and transliteration are fixed, and the question meets the words of the documents. It also has edge cases. The model rephrases what it *understood*, and a name it does not know, a word cut short or a word written as it sounds becomes something else — confidently and grammatically.

## bet-para

Tick the rows where the rephrasing changed what the user meant.

## para-note

{right} of {n} rows labelled as the answer says. The rephrasing lost the meaning in {broken}: an unknown name read as an ordinary phrase, a cut-off word guessed wrong, a word written as it sounds («ованц» — «аванс»). On the other rows it fixed the spelling and BM25 found the post it could not find before. The fix that helps most queries is the one that hurts the rest, and nothing in the rephrased text says which case it is: log the rephrasing next to the original, and search with both.

## hyde-p1

**Idea:** instead of searching by the user's query directly, ask the LLM to generate a *hypothetical answer* — as if it were already in the knowledge base. The embedding of this hypothetical document is used as the search query.

**Contrast with QE:** QE fixes the *form* of the question (grammar, style), HyDE guesses the *semantics of the answer*. On short incomplete questions HyDE usually gives a bigger gain.

## f3-cap

HyDE adds one step: the LLM writes a plausible answer without any search, and the search uses that, not the question.

## bet-hyde

Our questions are complete, and bge-m3 was trained on question–passage pairs. Will HyDE beat searching with the question itself?

## hyde-note

MRR {m0} with the question, {m1} with the hypothetical answer; the gold post moved up on {up} of the questions and down on {down}. Read the hypothetical answers where it moved down: a 3B model that never read the post writes something generic — "improved performance on many tasks, including machine translation" — and the search follows the generic text away from the specific question.

## hyde-cost

The price of HyDE in production: one more LLM call per query, before the search even starts — latency and tokens. And it amplifies the model's guess, right or wrong.

## sq-p1

**SelfQuery.** Part of the query is not about meaning but about the fields of the collection: a date, a genre, an author. Such things are not searched by cosine, they are filtered. In production an LLM extracts the fields by the collection's schema; here, rules, so that you can see exactly what should come out. Two collections: our posts, and a collection made for it.

## f4-cap

SelfQuery: the constructor pulls the fields and the conditions out of the query, the translator turns them into the filter language of a particular store; the meaningful rest of the query is searched inside what the filter left.

## sq-hint

Write a query with a year or a range — «посты про Mamba за 2024», «после 2025», «до 2024 про LoRA». BM25 (lower case) over the rest of the query, with and without the filter.

## sq-gonzo-note

The posts have one field, the date, and people ask about content: {n} of the {total} golden questions mention a date at all. On this collection SelfQuery has almost nothing to extract.

## sq-songs-p1

A collection where the fields carry the question: songs with a genre, an artist and a year. «Рок до 90-х» is two filters and no meaning at all — a cosine over «рок до 90-х» finds songs that *mention* the nineties.

## sq-songs-hint

A synthetic collection of {n} songs. The constructor extracts the genre, the artist (by the first letters of the surname or the band's name) and the years; BM25 ranks the rest of the query inside what the filter left.

## flare-p1

**FLARE**, forward-looking active retrieval: do not search once before generation, but write a sentence as a draft, look at the probabilities of its tokens, and if the confidence fell below a threshold, go search with this sentence as the query and rewrite it. The threshold is a budget: at zero there is no search at all and the made-up details stay; near one there is a search for every sentence.

## f5-cap

FLARE: the model writes a sentence as a draft (y₁), its low-probability tokens are marked; the draft with a mask becomes the query q₂, the retriever returns D, the sentence is rewritten (y₂) — and so on for every next sentence.

## flare-tag

Scripted: the token probabilities and the retrieved documents are set in advance, on a synthetic shop FAQ.

## flare-note

Try θ = 0: no search at all, and the answer keeps plausible but made-up numbers — ordinary RAG without retrieval on demand. Try θ = 0.9: a search for every sentence, three retriever calls and three regenerations — expensive. The threshold is a budget.

