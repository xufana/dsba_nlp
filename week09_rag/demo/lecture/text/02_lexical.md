# lexical · words and the inverted index

## s-index

**Inverted index:** word → the documents that contain it. A query reads only its own words' lists → milliseconds over billions of documents.

## lex-p1

**The inverted index.** Turn every document into a bag of terms (lecture 1), and store the bag the other way round: for every term, the list of documents that contain it, with the counts — its **postings list**. A query of three words reads three postings lists and touches only the documents that share a word with it; a collection of a billion pages answers in milliseconds. This structure, not the scoring formula, is why lexical search scales.

## invidx-caption

A query reads one postings list per word.

## s-bm25

**BM25** — a sum over the query's words of three parts:

## lex-p2

**Scoring: BM25** (Robertson et al., 1994). A document's score is a sum over the query's words; each word contributes three things, coloured in the formula:

## s-bm25parts

- <span class="c-idf">**idf** — rare words decide</span>: «KAN» matters, «и» does not
- <span class="c-k1">**$k_1$, saturation** — every repeat helps less; the total stays below $k_1 + 1$</span>
- <span class="c-b">**$b$, length** — the same count means less in a long document</span>

## lex-p3

- <span class="c-idf">**idf** — how rare the word is.</span> A word in few documents decides the ranking («KAN», «E-1043»); a word in every document («и», "the") adds almost nothing.
- <span class="c-k1">**saturation, $k_1$** — how many times the word occurs.</span> More occurrences help, but each adds less than the previous one, and the total never exceeds $k_1 + 1$: a document that repeats the word fifty times does not beat one that answers the question.
- <span class="c-b">**length, $b$** — how long the document is.</span> The count is compared with what is expected at that length: twice in a tweet means more than twice in a book. $b = 0$ ignores length, $b = 1$ corrects for it fully.

The defaults $k_1 ≈ 1.2–2$, $b = 0.75$ have survived thirty years; BM25 is still the baseline every neural retriever is compared with.

## bm25-caption

<span class="c-k1">$k_1$ — how soon the curve flattens; its ceiling is $k_1 + 1$.</span> <span class="c-b">$b$ — how far the 3× longer document falls below the average one.</span> The dashed line is a raw count, as in tf-idf.

## q-bm25 · sort

What does each setting do to BM25?

bins: like binary presence · like raw tf · no length penalty · full length penalty

- $k_1 = 0$ → like binary presence
- $k_1 → ∞$ → like raw tf
- $b = 0$ → no length penalty
- $b = 1$ → full length penalty

> $k_1 = 0$: the fraction becomes $1$ for any count above zero — a term is either there or not. $k_1 → ∞$: the saturation never sets in, the score is proportional to tf, tf-idf again. $b$ only scales the length term: at $0$ every document is treated as average length, at $1$ the count is divided by the full ratio $|d| / \mathrm{avgdl}$.
> miss: if $b = 0$ went to "full length penalty": $b$ is the *weight* of the length correction; zero means it is off.

## s-lexwhat

- catches **exact strings**: codes, article numbers, names, fresh terms
- misses **synonyms and paraphrases**: «вернуть деньги» vs «возврат средств» — no shared word
- **tokenisation decides which words exist**: lower-casing alone moved MRR {bm25_split} → {bm25_lower} on gonzo_ML

## lex-p4

**What it catches and what it misses.** BM25 finds a document only through shared words. That is its strength where the exact string matters — an error code, an article number, a rare name, a term too fresh for any embedding model: each is one postings list away, and idf makes it decisive. And it is blind to synonyms and paraphrases: "how do I get my money back" and "refund policy" share no word, so the score is zero. Everything before the index decides which words exist — lower-casing, punctuation, stemming or lemmatisation (a dozen forms per word in Russian). On {n_posts} posts of a Russian Telegram channel about ML, with {n_golden} questions about them, lower-casing and dropping punctuation alone moved BM25's MRR from {bm25_split} to {bm25_lower}: the default tokenizer of a popular library splits on spaces only, so «LoRA,» and «lora» were two different words.

## q-lexical · sort

For which queries is word matching enough, and which need the meaning?

bins: words are enough · needs the meaning

- «ошибка E-1043 при запуске» → words are enough
- «как вернуть деньги за сломанный товар» against a document titled «Возврат средств за повреждённую покупку» → needs the meaning
- «артикул 77-123-09» → words are enough
- «почему модель забывает начало длинного текста» → needs the meaning
- «Mamba-2 SSD» → words are enough
- "a cheap laptop for students" against product pages that say "budget notebook" → needs the meaning

> Codes, article numbers and named methods are exact strings: the documents contain them verbatim, and idf makes them decisive because they are rare. The refund question, the forgetting question and the laptop share almost no terms with the documents that answer them — that is vocabulary mismatch, and only a representation of meaning bridges it.
> miss: if «Mamba-2 SSD» went to meaning: a fresh technical name is exactly what an embedding model may have never seen, while a postings list has it.

## s-expand

If the words do not match, **add words**: pseudo-relevance feedback, HyDE, doc2query — all of them trust a first guess.

## lex-expand

**If the words do not match, add words** — briefly, since modern retrievers mostly bridge the gap with vectors (next block). On the query side, *pseudo-relevance feedback* runs the query, takes the characteristic words of the top results and searches again; *HyDE* (Gao et al., 2023) asks a language model to write a plausible answer and searches with it. On the document side, *doc2query* (Nogueira et al., 2019) appends to every passage the questions a model generated for it. All of them trust a first guess: a wrong first page or an invented answer pulls the search further off topic.
