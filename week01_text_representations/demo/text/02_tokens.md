# tokens · Where the vocabulary comes from

## tokens-p1

First, we need to split the text into parts in a way that will represent the text, its meaning and properties. It is called tokenization. Tokenization splits a string into units. The set of units becomes your vocabulary, and the vocabulary decides what kind of data the model can possibly represent.

## tokens-note1

**Read what each one did.** Only <span class="mono">word\_tokenize</span> keeps <span class="mono">alex.smith\_92</span> and <span class="mono">hse.ru</span> intact; the others shred an identifier into five pieces no downstream model can put back. <span class="mono">regex</span> keeps <span class="mono">smith\_92</span> because <span class="mono">\_</span> is a word character while <span class="mono">naive</span> splits it because <span class="mono">\_</span> is in <span class="mono">string.punctuation</span> — nobody designed that disagreement. <span class="mono">3.5%</span> becomes <span class="mono">3</span>, <span class="mono">5</span>; on a financial corpus that is the signal being deleted. And <span class="mono">Don’t</span> → <span class="mono">Do</span> + <span class="mono">n’t</span> is not a split at all: it is a rewrite. It is not a tokenization error, it is a design choice. The tokenizer’s design choices are the model’s design choices, and we'll talk about it later in more detail during the course (I believe, week 4 or 5?)

## tokens-why1

`word_tokenize` is the one that rewrites rather than splits. For production text pick by what your downstream step needs: `spaCy` for linguistically-aware splitting, `regex` for speed, a trained subword tokenizer for anything that feeds a neural model.

## tokens-p2

But first, stemming & lemmatization. Why? Cuz we need to shrink the vocabulary a bit and get rid of the noise. The textbook table says <span class="mono">went → go</span> and <span class="mono">better → good</span>. **Bet first:** does <span class="mono">nltk</span>’s lemmatizer reproduce it?

## tokens-why2

Real lemmatization needs POS tags, so in practice you run a tagger first — `nltk.pos_tag`, or `spaCy`, which gives you `token.lemma_` already tagged. For Russian: `pymorphy3` or `spaCy`'s `ru_core_news_*`.

## morph-note

It does not. <span class="mono">went → went</span>, <span class="mono">better → better</span>, and <span class="mono">was → wa</span>, which is not a word in any language. The default is <span class="mono">pos='n'</span>: the lemmatizer assumes every token is a noun and strips what looks like a plural. The textbook table describes lemmatization *with* part-of-speech tags. The column you usually see in a tutorial is lemmatization *without* them — a different operation, and on this corpus roughly an expensive stemmer with worse coverage. So, overall it works as intended, depending on the library you're using and other nuances. This is also a part of a design choice (sometimes you'll need it, sometimes you'll lose the important information using it)

## tokens-p3

Everything above draws the word boundary by hand. Modern systems learn it from data instead. **Bet:** the same sentence in English and Russian — which costs more tokens, and by what factor?

## tokens-why3

`tiktoken` only *uses* OpenAI's tokenizers. To train your own, or to load one from the Hub: `tokenizers` (`BpeTrainer`, `WordPiece`, `Unigram`) or `sentencepiece`; to load a model's tokenizer, `transformers.AutoTokenizer`.

## tokens-note2

Russian costs two to three times more tokens for the same content, and somebody pays for that per API call, forever. Numbers, whitespace and casing split in ways nobody designed deliberately — they fell out of training-data statistics. **Open question:** is it the alphabet, the morphology, or the corpus? How would you test which? Don't be sad if you don't have an answer, it is also a part of a biiig lecture about the tokenizers and their influence on the system.

## tok-wordtok-note

nltk’s Treebank tokenizer is a Python library — it runs only on the five precomputed strings above.
