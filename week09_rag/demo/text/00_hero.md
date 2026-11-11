# hero

## lede

A retriever, a generator, and five places between them that we can influence. Every stand on this page runs the seminar notebook's pipeline on one corpus: search, cosines and metrics are computed in the browser or read from the seminar's artifacts, and the answers are what the 3B model actually wrote.

## thesis

RAG is not "connect a database to the model" but a pipeline of six blocks, where each one can be broken and each one can be improved separately.

## hero-p1

We work with a dataset built from a Telegram channel, [gonzo_ML](https://t.me/gonzo_ML), which I parsed in advance: posts about papers, mostly in Russian, often with English quotes inside. Some are a full review, some are one word.

Next to it, the "golden set": question–context pairs on which we count "hits". In my case the "context" is also the answer. The catch, which section 07 measures: the contexts are retold, not copied. So each question keeps the post it is about, and a hit is a document from that post.

## corpus-note

{posts} posts from {from} to {to}; the default splitter cuts at 4000 characters, so the index holds {docs} documents. Most posts are short — the long ones are where the answers are.

## golden-note

{n} golden questions about {posts} posts, two or three questions per post, plus {na} questions the corpus cannot answer: six from machine learning the channel never covered, four from elsewhere. They are checked by searching the dump for their key terms.
