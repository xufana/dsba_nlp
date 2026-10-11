# prep · To clean or not to clean

## prep-p1

The usual advice is “clean your text”. The usual advice is wrong roughly half the time.

## prep-p2

LDA (Latent Dirichlet Allocation) is a bag of words with no notion of synonymy or morphology. Feed it raw text and end up with the topics that are described primarly by the most frequent words like <span class="mono">the</span>, <span class="mono">and</span>, <span class="mono">for</span>. Let's compare:

## prep-why1

`gensim.models.LdaModel` is the other standard implementation and gives you coherence scores (`CoherenceModel`) to pick the number of topics; `BERTopic` is the modern embedding-based alternative. All of them are bags of words, so the preprocessing decision above applies to every one.

## prep-note1

<span class="mono">39</span> is a mangled <span class="mono">&amp;#39;</span> and <span class="mono">quot</span> a mangled <span class="mono">&amp;quot;</span>. Here preprocessing is not a tuning knob — it is the difference between a model that works and a model that models punctuation. Same for lexical search (<span class="mono">cats</span> will not find <span class="mono">cat</span>), dictionary methods, and small data. Question: would you also try lemmatization here for this task?

## prep-p3

**Bet:** <span class="mono">nltk</span>’s English stoplist has 198 entries. Is <span class="mono">not</span> one of them?

## prep-why2

The two lists disagree, and neither is documented at the point of use. If dropping stopwords matters for your task, own the list: start from one of these, print it, and delete what carries your signal.

## prep-note2

<span class="mono">not good</span> becomes <span class="mono">good</span>; <span class="mono">never recommend</span> becomes <span class="mono">recommend</span>. That is the mechanism. Whether it costs you accuracy is a different question, and the grid below answers it with numbers instead of folklore.

## prep-p4

Twelve A/B experiments over six datasets and four task families. Each one flips a single knob and holds everything else fixed — same split, same seed, same model, same vectorizer — so the difference belongs to the knob and to nothing else.

**Bet on every row before you reveal.** Three answers per row: the cleaning *helps*, it *hurts*, or it changes *nothing* (under half a point). The rows are ordered so that the same knob comes back on a different task.

## prep-why3

The comparison is only worth anything if the two runs differ in exactly one place: same train/test split, same random seed, same classifier, same `min_df`. Retrieval rows are scored with nDCG@10 over BM25, topic rows with NPMI coherence — different metrics, same discipline. Full code: `preprocessing_grid.py`.

## preproc-note

**Read the columns, not the rows.**
<span class="mono">drop stopwords</span> appears four times in the classification block and
gives four different answers: nothing on AG News topics, <span style="color:var(--good)">+1.0</span>
points on 700-word reviews, <span style="color:var(--bad)">−1.2</span> on 21-word sentences
of the *same task*, <span style="color:var(--bad)">−2.2</span> on authorship — where that
same list, used *alone*, still reaches 0.873. Document length is doing most of that work:
one lost negation is nothing in 700 words and a large share of the evidence in 21.
<span class="mono">Porter stemming</span> appears three times: it buys
<span style="color:var(--good)">+1.4</span> points on 500 labelled documents, nothing on
120 000 of them, and <span style="color:var(--good)">+1.5</span> nDCG in retrieval, where a
query and a document have to share a surface form to match at all.
Two rows contradict the textbook outright: shouting and punctuation do not help spam detection
here, and lemmatising *lowers* topic coherence, because WordNet without POS tags turns
<span class="mono">has</span> into <span class="mono">ha</span> and <span class="mono">us</span>
into <span class="mono">u</span>. None of this is a property of a method. Every row is a property
of the pair — what the task needs, and what the representation can still recover once you have
thrown something away.
