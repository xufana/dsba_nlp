# intro · the page

## lede

Information retrieval as questions: what the task is, what "relevant" means and how a ranking is scored, how a word index and a vector index find documents, how two rankings are merged and a second model reorders them, and why a language model that answers from documents is, first of all, a search engine. Commit before you open.

## intro-p1

Every block: the theses on top, the full explanation under **In detail**, the questions after. Your answers stay in this browser.

## rail-note

Answer first, then open.

## s-task

**The task:** a query $q$ against a fixed collection $D$ → a **ranking** of what already exists.

Score every document $s(q, d)$ → sort → return the top $k$.

## task-p1

**The task.** A collection of documents $D$, fixed in advance and large; a query $q$, which arrives at run time and is short. Return the documents of $D$ in order of how well they answer $q$. Not one label, not a generated text: a **ranking** of what already exists. Whatever the method, the mechanics are the same: give every document a score $s(q, d)$, sort, return the top $k$.

## task-more

Classification reads one object and outputs one of a fixed set of labels. Retrieval reads a query and a whole collection and outputs an order over the collection; the label set is the collection itself, and it changes when a document is added.

## task-caption

One object → one label, or a query and a whole collection → an order over it.

## task-p1b

Three things make it a problem of its own:

- the collection is too large to look at every document with an expensive model for every query: whatever is computed per document must be computed *before* the query arrives;
- the query and the documents are written differently: a short question against long documents, in other words — they often share few of the words that matter;
- "relevant" is a judgement about a pair (query, document), made by a person; there is no label on a document alone.

## s-why

Why it is a problem of its own:

- the collection is **huge** → per-document work happens *before* the query
- query and document are **written differently**
- relevance is a **judgement about a pair**, made by a person

## mismatch-more

A question from a golden set over {n_posts} posts of the Russian Telegram channel gonzo_ML, word by word against the post that answers it ({ex_post_words} words). Green — the word occurs in the post; orange — only another form of it (the same first five letters); grey — absent. The words the question is *about* are in the third group. Word matching over whitespace tokens did not put this post into its top 10. On this corpus a question has a median of {q_words_median} words, a post {doc_words_median}.

## mismatch-caption

A gonzo_ML question against its post: the words the question is *about* are not in the post.

## task-vocab

The vocabulary for the rest of the page: the **collection** and its **documents** (a page, a paragraph, a chunk of a post); the **query**; the **index** — whatever is precomputed over the collection so that search is fast; the **retriever** — the function from a query to a ranked list; **relevance judgements** (qrels) — the pairs labelled relevant.

## q-is-ir · pick

Which of these are retrieval problems in this sense — a query against a fixed collection, a ranked list out? Tick all that apply, then Check.

- [x] a web search engine
- [x] finding the ten past support tickets most similar to a new one
- [ ] deciding whether an incoming email is spam
- [x] choosing the passages to put into a language model's prompt before it answers
- [ ] translating a product description into English
- [x] a shop's search box: "red running shoes, size 42"

> Search, similar tickets, a shop's search box and the passages for a prompt all rank items of a collection that exists before the query does. Spam is one label per email: there is no collection to rank. Translation produces new text.
> miss: if the prompt's passages were left out: a model that answers "from documents" first has to find them, and that step is retrieval with the same index, the same ranking and the same metrics.

## task-p2

Retrieval also has to *know when it has nothing*. A web engine can always show something; a system that answers from a company's documents must notice that the answer is not in the collection. A ranking does not say that by itself: there is always a first document.

## s-nothing

A ranking always has a **first document** — even when the answer is not in the collection.

## noanswer-more

A question the channel cannot answer, against the same {n_posts} posts, ranked by the cosine of bge-m3 vectors. The list is full and the scores look like any other: the nearest "documents" are one-line posts, which sit close to everything.
## noanswer-caption

A question the channel cannot answer still gets a confident top 3.
