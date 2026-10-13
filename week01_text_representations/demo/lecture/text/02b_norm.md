# norm · Stemming and lemmatization

## norm-p1

A bag of words gives every surface form its own column. `study`, `studies`, `studied`, `studying` are four columns, and what the model learns about one of them says nothing about the others — the one-hot problem again, one level up. In English it is a nuisance. In Russian, where a noun has a dozen forms, it splits the statistics of every word a dozen ways, and most forms are seen a handful of times. **Normalisation** maps the forms of a word onto one key before anything is counted.

## norm-p2

There are two ways to do it. **Stemming** cuts endings off by rules, with no dictionary: Porter's algorithm (1980) is a cascade of suffix rules. It is fast and works on any string, including words nobody has seen — but the stem is not necessarily a word, and the rules know nothing about meaning. **Lemmatization** maps a word to its dictionary form, the **lemma**, using a dictionary and the word's part of speech: `went` → `go`, `better` → `good`. It needs a morphological analyser for each language, and without the part of speech it has to guess.

## norm-caption

Porter's stemmer and the WordNet lemmatizer, run on these words. The last column is the same lemmatizer without the part of speech. For Russian, the Snowball stemmer.

## norm-p3

Read the table row by row. The stemmer merges `university` and `universe` into `univers`, and `organization` into `organ` — two different words in one column. It cannot touch `went` or `better`, whose forms share no ending to cut; a lemmatizer can, because it looks the word up. Without the part of speech the lemmatizer falls back to treating every word as a noun and leaves `went` alone, and `was` loses its `s` like a plural. In Russian the stemmer does well on the regular forms of `кот` and gives three different stems to `шёл`, `иду`, `пошла` — three forms of one verb, `идти`, that only a dictionary knows belong together.

## q-norm-sort · sort

Stemming, lemmatization, or both?

bins: stemming · lemmatization · both

- cuts endings off by rules, with no dictionary → stemming
- needs to know the part of speech to do it right → lemmatization
- turns `went` into `go` → lemmatization
- can produce a string that is not a word, like `studi` → stemming
- puts `cats` and `cat` into one column → both
- works on a word nobody has seen before → stemming
- shrinks the vocabulary → both

> Stemming is string surgery: rules over endings, fast, language-specific only in its rule set, and indifferent to whether the result is a word or whether two merged words mean the same thing. Lemmatization is a lookup: it returns a real dictionary form and handles irregular forms, at the price of a dictionary, a morphological analyser and the part of speech of each token. Both serve the same purpose — fewer columns, pooled statistics — and both lose whatever the form carried.
> miss: if "works on an unseen word" went to lemmatization: a lemmatizer can only return a lemma for a word its dictionary knows. An unseen word comes back unchanged; a stemmer still cuts its ending.

## norm-p4

Normalisation is a bet that what it merges is not what the task needs. It shrinks the vocabulary and pools the statistics of rare forms, which pays off when there is little labelled data to learn each form on its own, and in search, where a query and a document have to share a form to match at all — `treating diabetes` never meets `treatment of diabetic` without it. It loses whatever the form carried — tense, number, and sometimes the meaning, when two words collapse into one stem. With plenty of data the model learns each form on its own and the gain disappears. **Preprocessing is chosen by the representation and the task, not by habit.**

## q-norm-when · pick

Where would you expect stemming or lemmatization to help? Tick all that apply.

- [x] a topic classifier trained on 500 labelled documents
- [x] keyword search: the query says `cats`, the document says `cat`
- [x] the same classifier on Russian texts rather than English
- [ ] a topic classifier trained on 120 000 labelled documents
- [ ] a model whose tokenizer already splits words into subwords
- [ ] telling whether a sentence is about the past or the future

> Help where forms are many and data is scarce: 500 documents cannot teach a model every form of every word, so pooling them is real regularisation, and Russian has far more forms per word than English. In search it is not even a trade-off — without a shared form there is no match. With 120 000 documents each frequent form has enough examples of its own, and the gain shrinks to nothing. A subword tokenizer already shares the stem between forms, so a separate normaliser adds little. And when the task *is* the form — tense, number, style — normalisation deletes the signal.
> miss: if you ticked the 120 000 documents: normalisation rarely hurts a big topic classifier, but it rarely helps either. The data does the pooling for you.

## norm-p5

Stemming is one step of a longer list that usually goes under "clean your text": lowercasing, removing **stopwords** (the most frequent function words — `the`, `and`, `of`, and, in most lists, `not`), stripping punctuation and numbers, removing markup. The usual advice is to do all of them, and the usual advice is wrong roughly half the time. Every step deletes something. For one task that something is noise, for another it is the signal: casing, function words and punctuation are noise for a topic and the very thing that tells two authors apart or a company from a fruit. And a text is not always long enough to spare it — in a long review one deleted word changes little, in a one-line message it can be most of the evidence there is.

## q-prep · sort

For each pair: does the preprocessing step help, hurt, or make no real difference?

bins: helps · hurts · no real difference

- removing stopwords, before a topic model (LDA) → helps
- removing stopwords, for the sentiment of one-sentence reviews → hurts
- removing stopwords, to tell which of five authors wrote a novel → hurts
- lowercasing, for finding company names in news → hurts
- stemming, for keyword search over medical articles → helps
- stemming, for a topic classifier with 120 000 labelled documents → no real difference
- removing HTML tags and `&quot;` debris, before anything → helps
- stripping numbers and punctuation, for financial news where `3.5%` is the point → hurts
- lemmatization, before training word vectors on a small Russian corpus → helps
- stemming the text before feeding it to a pretrained LLM → hurts

> A preprocessing step is a bet that what it deletes is not what the task needs. Read the rows by what got deleted. A topic model counts words and has no notion of function words, so without a stoplist every topic starts with `the` and `and` — there deletion is the difference between topics and noise. In a one-sentence review `not` may be most of the evidence, and the stoplist deletes it; in authorship attribution function words *are* the signal, because how often a writer says `upon` or `whilst` is style. Lowercasing merges `Apple` and `apple`, which is exactly the distinction NER needs. Stemming lets `treating` meet `treatment` in search, where a shared form is the only way to match; with 120 000 labelled documents a classifier learns every frequent form on its own and the gain disappears. Markup debris is never signal. A number is the content of a financial headline. On a small Russian corpus lemmatization pools a dozen forms into one word with enough contexts to learn from. And a pretrained LLM was trained on raw text: stems it never saw are worse input than the words it knows.
> miss: if every "removing stopwords" row went to "helps": that is the habit the block is about. The same step flips sign with the task and with the length of the text.

