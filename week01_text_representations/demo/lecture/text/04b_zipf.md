# zipf · Zipf's law and the distributional hypothesis

## zipf-p1

Count every word in the 120 000 headlines of AG News — {zipf_tokens} word occurrences — and sort the {zipf_types} distinct words by frequency. A handful of words are everywhere: {zipf_top}. The 100 most frequent words make up {zipf_top100} of all the text. At the other end the list never ends: {zipf_hapax_pct} of the distinct words occur exactly once.

This shape has a name. **Zipf's law**: the frequency of the r-th most frequent word is roughly proportional to $1/r$ — the second word is half as frequent as the first, the tenth a tenth as frequent. On log-log axes that is a straight line with slope −1; on these headlines the slope is {zipf_slope}. It holds for every language and almost every corpus anyone has counted.

## zipf-caption

Every distinct word of the AG News training set, by rank and count, both axes logarithmic. The dashed line has slope −1. (`39` among the top words is the debris of `&#39;`, an HTML apostrophe.)

## zipf-p2

For a representation built by counting, Zipf's law is the bill. The head of the curve is a few dozen function words: they dominate every count and say almost nothing about the topic, which is why idf downweights them and stopword lists exist. The tail is most of the vocabulary: words seen once or twice, each a column with almost no examples to learn its weight from. And the tail does not end when the data grows — a bigger corpus moves the curve to the right and brings new words with it, so there is always a word the training set never saw.

## q-zipf-double · pick

Take the first 60 000 headlines, then all 120 000 — twice the text. What happens to the vocabulary?

- [x] it keeps growing — by about a third — and the share of words seen only once stays the same
- [ ] it barely grows: almost every word was already in the first half
- [ ] it doubles, like the text
- [ ] it grows, but the words seen only once mostly disappear

> Measured on AG News: the first half has {half_types} distinct words, {half_hapax_pct} of them seen once; the full set has {zipf_types}, and still {zipf_hapax_pct} seen once. The second half brought {new_in_second} words the first half never had. That is Zipf's law from the other side: the tail is not a shortage of data that more data will fix. Some rare words become frequent, new rare words arrive to take their place, and the vocabulary grows more slowly than the text but does not stop. For a counting representation it means OOV words and one-example columns are permanent — the reason to look for a representation in which a word can borrow from other words.
> miss: if "it barely grows": that is true for the head — `the` and `of` were all there after a hundred headlines. The question was about the vocabulary, and the vocabulary is mostly tail.

## q-zipf-follows · pick

What follows from Zipf's law for a representation built by counting words? Tick all that apply.

- [x] a few dozen frequent words dominate every count and carry little about the topic
- [x] most columns belong to rare words, each with too few examples to learn a reliable weight
- [x] however big the training set, new texts keep bringing words it never saw
- [ ] ten times more data makes out-of-vocabulary words disappear
- [ ] the most frequent words carry most of the meaning

> The first three. The head is function words — the reason for idf and stopword lists. The tail is where the vocabulary lives and where the statistics are thin — the reason to share information between words instead of learning each one alone. And the tail grows with the corpus: more data turns some rare words into frequent ones and adds new rare ones, so OOV shrinks but never vanishes.
> miss: if "more data makes OOV disappear": the number of distinct words keeps growing as the corpus grows. More data moves the curve; it does not cut the tail.

## dist-p1

Zipf's law says that learning each word from its own occurrences runs out of data for most of the vocabulary. The way round is to let words share what is learned about them — and for that we need to know which words are alike, without anyone labelling them.

The answer is the **distributional hypothesis**: "you shall know a word by the company it keeps" (Firth 1957; Harris 1954 for the formal version). Words that occur in similar contexts tend to have similar meanings. The meaning of a word is not observable; its contexts are, in every sentence ever written. A rare word appears a few times, but each time among frequent, well-known words, and those contexts tell us which known words it resembles. Every method in the next block is this hypothesis turned into a loss.

## q-dist · write

Explain the distributional hypothesis. How does it motivate methods such as word2vec?

- words that occur in similar contexts tend to have similar meanings (Harris 1954; Firth 1957: "you shall know a word by the company it keeps")
- so meaning can be learned from raw text alone, without a dictionary or labels
- word2vec turns it into a training task: predict the context from the word (or the word from the context)
- words with similar contexts must make similar predictions, so their vectors end up close
- the catch: it captures substitutability, not meaning — `good` and `bad` share contexts and land close

> The hypothesis says that words which occur in similar contexts tend to have similar meanings. Its practical consequence is that the context of a word is *observable* while its meaning is not — so meaning can be learned from raw, unlabelled text.
>
> word2vec turns the hypothesis into a loss. Skip-gram asks every word to predict the words around it; CBOW asks the surrounding words to predict the word. Two words that keep the same company are asked to make the same predictions, and the only way gradient descent can satisfy that is to give them similar vectors. Nobody tells the model that `oil` and `petroleum` are related — they end up close because they are interchangeable in the same sentences.
>
> The hypothesis also explains the failures. It measures *substitutability*, not meaning: `good` and `bad`, `hot` and `cold` appear in the same contexts and land close, and the embedding cannot tell synonyms from antonyms. And it inherits whatever the corpus says about who does which job — the bias in embeddings is the hypothesis working exactly as intended.
> miss: if your answer described the architecture (two matrices, a softmax): that is how word2vec is built, not why it works. The why is the hypothesis — similar contexts, similar vectors — and the architecture is just the cheapest way to make it a loss.
