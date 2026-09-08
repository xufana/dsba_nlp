"""Preprocessing decisions, measured instead of asserted.

Twelve A/B experiments across four task families. Each one changes exactly one
preprocessing knob and holds everything else fixed — same split, same seed, same
model, same vectorizer settings — so the delta is attributable to the knob.

The point is that the same knob has opposite signs on different tasks.

Run from week01_text_representations/:
    uv run python scripts/preprocessing_grid.py                # all families
    uv run python scripts/preprocessing_grid.py --only clf ir  # a subset

Writes artifacts/preprocessing_grid.json, consumed by the notebook and by
demo/export_demo_data.py.
"""
import argparse
import io
import json
import os
import re
import ssl
import urllib.request
import warnings
import zipfile
from collections import Counter

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

SEED = 42
DATA_DIR = "data"
CACHE = os.path.join(DATA_DIR, "cache")
ART_DIR = "artifacts"
OUT = os.path.join(ART_DIR, "preprocessing_grid.json")

# nltk refuses proxied downloads by default; the corpora we need are public.
os.environ.setdefault("NLTK_ALLOW_PROXIED_URLOPEN", "1")


def log(msg):
    print(f"[grid] {msg}", flush=True)


# --------------------------------------------------------------------------
# data
# --------------------------------------------------------------------------

def fetch(url, name):
    """Download once into data/cache/."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        log(f"downloading {name}")
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(url, timeout=120, context=ctx) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    return path


def load_agnews():
    train = pd.read_csv(f"{DATA_DIR}/ag_news_train.csv", sep="\t")
    test = pd.read_csv(f"{DATA_DIR}/ag_news_test.csv", sep="\t")
    return train.text.tolist(), train.label.tolist(), test.text.tolist(), test.label.tolist()


def load_movie_reviews():
    """2 000 full-length film reviews, balanced pos/neg (Pang & Lee 2004)."""
    import nltk
    nltk.download("movie_reviews", quiet=True)
    from nltk.corpus import movie_reviews as mr

    docs, y = [], []
    for cat in mr.categories():
        for fid in mr.fileids(cat):
            docs.append(mr.raw(fid))
            y.append(1 if cat == "pos" else 0)
    return split(docs, y, test_size=0.25)


def load_sms_spam():
    """5 574 SMS messages, 13% spam (UCI SMS Spam Collection)."""
    path = fetch("https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip",
                 "sms_spam.zip")
    with zipfile.ZipFile(path) as z:
        raw = z.read("SMSSpamCollection").decode("utf-8", errors="replace")
    docs, y = [], []
    for line in raw.strip().split("\n"):
        label, _, text = line.partition("\t")
        docs.append(text)
        y.append(1 if label == "spam" else 0)
    return split(docs, y, test_size=0.25)


def load_sentence_polarity():
    """10 662 one-sentence film-review snippets, balanced (Pang & Lee 2005).

    The same task as the reviews above on much shorter documents, which is the
    variable that turns out to matter.
    """
    import nltk
    nltk.download("sentence_polarity", quiet=True)
    from nltk.corpus import sentence_polarity as sp

    docs, y = [], []
    for cat in sp.categories():
        for sent in sp.sents(categories=cat):
            docs.append(" ".join(sent))
            y.append(1 if cat == "pos" else 0)
    return split(docs, y, test_size=0.25)


def load_authorship(size=50):
    """Passages from two novelists, held-out book each (nltk gutenberg).

    Both are prose, so verse formatting cannot give the answer away, and the
    split is by book: passages from the same book would leak topic and
    vocabulary into the test set.
    """
    import nltk
    nltk.download("gutenberg", quiet=True)
    from nltk.corpus import gutenberg

    books = {
        0: (["austen-emma.txt", "austen-persuasion.txt"], ["austen-sense.txt"]),
        1: (["chesterton-ball.txt", "chesterton-brown.txt"], ["chesterton-thursday.txt"]),
    }

    def passages(fid, size=size):
        words = gutenberg.words(fid)
        return [" ".join(words[i:i + size]) for i in range(0, len(words) - size, size)]

    Xtr, ytr, Xte, yte = [], [], [], []
    for author, (train_books, test_books) in books.items():
        for fid in train_books:
            p = passages(fid)
            Xtr += p
            ytr += [author] * len(p)
        for fid in test_books:
            p = passages(fid)
            Xte += p
            yte += [author] * len(p)
    return Xtr, ytr, Xte, yte


def load_nfcorpus():
    """NFCorpus from BEIR: 3 633 medical documents, 323 test queries with graded
    relevance judgements."""
    path = fetch("https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/"
                 "datasets/nfcorpus.zip", "nfcorpus.zip")
    with zipfile.ZipFile(path) as z:
        corpus = {}
        for line in z.read("nfcorpus/corpus.jsonl").decode().splitlines():
            d = json.loads(line)
            corpus[d["_id"]] = (d.get("title", "") + " " + d.get("text", "")).strip()
        queries = {}
        for line in z.read("nfcorpus/queries.jsonl").decode().splitlines():
            d = json.loads(line)
            queries[d["_id"]] = d["text"]
        qrels = {}
        rows = z.read("nfcorpus/qrels/test.tsv").decode().splitlines()[1:]
        for row in rows:
            qid, did, score = row.split("\t")
            if int(score) > 0:
                qrels.setdefault(qid, {})[did] = int(score)
    queries = {q: t for q, t in queries.items() if q in qrels}
    return corpus, queries, qrels


def split(docs, y, test_size=0.25):
    from sklearn.model_selection import train_test_split
    Xtr, Xte, ytr, yte = train_test_split(docs, y, test_size=test_size,
                                          random_state=SEED, stratify=y)
    return Xtr, ytr, Xte, yte


# --------------------------------------------------------------------------
# the knobs
# --------------------------------------------------------------------------

TOKEN = re.compile(r"(?u)\b\w\w+\b")          # sklearn's default pattern


def _stop():
    import nltk
    nltk.download("stopwords", quiet=True)
    from nltk.corpus import stopwords
    return set(stopwords.words("english"))


def make_analyzer(kind):
    """Return a callable text -> token list. `plain` is sklearn's default."""
    from nltk.stem import PorterStemmer, WordNetLemmatizer

    if kind == "plain":
        return lambda t: TOKEN.findall(t.lower())

    if kind == "no_stopwords":
        stop = _stop()
        return lambda t: [w for w in TOKEN.findall(t.lower()) if w not in stop]

    if kind == "only_stopwords":
        stop = _stop()
        return lambda t: [w for w in TOKEN.findall(t.lower()) if w in stop]

    if kind == "stemmed":
        stemmer = PorterStemmer()
        cache = {}
        def stem(t):
            out = []
            for w in TOKEN.findall(t.lower()):
                if w not in cache:
                    cache[w] = stemmer.stem(w)
                out.append(cache[w])
            return out
        return stem

    if kind == "lemmatised":
        import nltk
        nltk.download("wordnet", quiet=True)
        lem = WordNetLemmatizer()
        cache = {}
        def lemma(t):
            out = []
            for w in TOKEN.findall(t.lower()):
                if w not in cache:
                    cache[w] = lem.lemmatize(w)
                out.append(cache[w])
            return out
        return lemma

    # Words, numbers and punctuation runs as separate tokens, case preserved:
    # FREE, free, 150, !!! and £ are five different features.
    if kind == "raw_case_punct":
        pat = re.compile(r"[A-Za-z]+|[0-9]+|[£$€!?*#]+")
        return lambda t: pat.findall(t)

    if kind == "cleaned":
        pat = re.compile(r"[a-z]+")
        return lambda t: pat.findall(t.lower())

    raise ValueError(kind)


# --------------------------------------------------------------------------
# scoring
# --------------------------------------------------------------------------

def classify(Xtr, ytr, Xte, yte, analyzer, metric="accuracy", n_train=None):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, f1_score

    if n_train is not None and n_train < len(Xtr):
        rng = np.random.RandomState(SEED)
        idx = rng.choice(len(Xtr), size=n_train, replace=False)
        Xtr = [Xtr[i] for i in idx]
        ytr = [ytr[i] for i in idx]

    vec = TfidfVectorizer(analyzer=analyzer, min_df=2)
    A = vec.fit_transform(Xtr)
    B = vec.transform(Xte)
    clf = LogisticRegression(max_iter=2000, random_state=SEED).fit(A, ytr)
    pred = clf.predict(B)
    score = (accuracy_score(yte, pred) if metric == "accuracy"
             else f1_score(yte, pred, average="macro"))
    return float(score), int(A.shape[1])


def bm25_ndcg(corpus, queries, qrels, analyzer, k=10, k1=0.9, b=0.4):
    """BM25 with BEIR's default parameters, scored with nDCG@10."""
    import scipy.sparse as sp

    doc_ids = list(corpus)
    docs = [analyzer(corpus[d]) for d in doc_ids]
    df = Counter()
    for d in docs:
        df.update(set(d))
    vocab = {w: i for i, w in enumerate(df)}
    N = len(docs)
    idf = np.zeros(len(vocab), dtype=np.float32)
    for w, i in vocab.items():
        idf[i] = np.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5))

    lens = np.array([len(d) for d in docs], dtype=np.float32)
    avgdl = lens.mean()
    rows, cols, vals = [], [], []
    for j, d in enumerate(docs):
        for w, tf in Counter(d).items():
            i = vocab[w]
            rows.append(j)
            cols.append(i)
            vals.append(idf[i] * tf * (k1 + 1) / (tf + k1 * (1 - b + b * lens[j] / avgdl)))
    M = sp.csr_matrix((vals, (rows, cols)), shape=(N, len(vocab)), dtype=np.float32)

    ndcgs = []
    for qid, qtext in queries.items():
        q = [vocab[w] for w in analyzer(qtext) if w in vocab]
        if not q:
            ndcgs.append(0.0)
            continue
        scores = np.asarray(M[:, q].sum(axis=1)).ravel()
        top = np.argsort(-scores)[:k]
        rel = qrels[qid]
        gains = [rel.get(doc_ids[i], 0) for i in top]
        dcg = sum((2 ** g - 1) / np.log2(r + 2) for r, g in enumerate(gains))
        ideal = sorted(rel.values(), reverse=True)[:k]
        idcg = sum((2 ** g - 1) / np.log2(r + 2) for r, g in enumerate(ideal))
        ndcgs.append(dcg / idcg if idcg else 0.0)
    return float(np.mean(ndcgs)), len(vocab)


def lda_coherence(docs, analyzer, n_topics=8, top_n=10):
    """Fit LDA and score its topics with NPMI coherence on the same corpus."""
    from gensim.corpora import Dictionary
    from gensim.models import CoherenceModel
    from sklearn.decomposition import LatentDirichletAllocation
    from sklearn.feature_extraction.text import CountVectorizer

    vec = CountVectorizer(analyzer=analyzer, min_df=5, max_df=0.5)
    X = vec.fit_transform(docs)
    lda = LatentDirichletAllocation(n_components=n_topics, random_state=SEED,
                                    learning_method="batch", max_iter=15).fit(X)
    names = np.array(vec.get_feature_names_out())
    topics = [list(names[np.argsort(-row)[:top_n]]) for row in lda.components_]

    texts = [analyzer(d) for d in docs]
    dic = Dictionary(texts)
    cm = CoherenceModel(topics=topics, texts=texts, dictionary=dic, coherence="c_npmi")
    return float(cm.get_coherence()), topics, int(X.shape[1])


# --------------------------------------------------------------------------
# the experiments
# --------------------------------------------------------------------------

def row(family, dataset, task, knob, metric, base, var, base_name, var_name,
        n_train, dims, note, eps, chance=None):
    """One A/B result. `eps` is the smallest delta worth calling a difference."""
    delta = var - base
    return {
        "family": family, "dataset": dataset, "task": task, "knob": knob,
        "metric": metric, "baselineName": base_name, "variantName": var_name,
        "baseline": round(base, 4), "variant": round(var, 4), "delta": round(delta, 4),
        "verdict": "helps" if delta > eps else "hurts" if delta < -eps else "no change",
        "nTrain": n_train, "dims": dims, "note": note, "eps": eps,
        "chance": None if chance is None else round(chance, 4),
    }


def chance_score(ytr, yte, metric="accuracy"):
    """What always predicting the majority class scores, on the same metric."""
    from sklearn.dummy import DummyClassifier
    from sklearn.metrics import accuracy_score, f1_score

    d = DummyClassifier(strategy="most_frequent").fit(np.zeros((len(ytr), 1)), ytr)
    pred = d.predict(np.zeros((len(yte), 1)))
    return float(accuracy_score(yte, pred) if metric == "accuracy"
                 else f1_score(yte, pred, average="macro"))


def family_clf():
    """One knob — drop the stoplist — on four tasks and two document lengths."""
    rows = []
    plain, nostop = make_analyzer("plain"), make_analyzer("no_stopwords")
    onlystop = make_analyzer("only_stopwords")

    log("AG News · topic classification")
    Xtr, ytr, Xte, yte = load_agnews()
    b, db = classify(Xtr, ytr, Xte, yte, plain)
    v, dv = classify(Xtr, ytr, Xte, yte, nostop)
    rows.append(row("classification", "AG News", "topic, 4 classes · 38-word headlines",
                    "drop stopwords", "accuracy", b, v, "every token", "stoplist removed",
                    len(Xtr), [db, dv], "The topic is carried by content words, and there "
                    "are 120 000 labels to learn them from. The stoplist is neither "
                    "signal nor much noise.", 0.005, chance_score(ytr, yte)))

    log("Movie reviews · sentiment on long documents")
    Xtr, ytr, Xte, yte = load_movie_reviews()
    b, db = classify(Xtr, ytr, Xte, yte, plain)
    v, dv = classify(Xtr, ytr, Xte, yte, nostop)
    rows.append(row("classification", "Movie reviews", "sentiment, 2 classes · 700-word "
                    "reviews", "drop stopwords", "accuracy", b, v, "every token",
                    "stoplist removed", len(Xtr), [db, dv],
                    "The textbook warning is that not good becomes good. In a 700-word "
                    "review dozens of sentiment words vote, one lost negation changes "
                    "little, and the denoising wins.", 0.005, chance_score(ytr, yte)))

    log("Sentence polarity · sentiment on short documents")
    Xtr, ytr, Xte, yte = load_sentence_polarity()
    b, db = classify(Xtr, ytr, Xte, yte, plain)
    v, dv = classify(Xtr, ytr, Xte, yte, nostop)
    rows.append(row("classification", "Sentence polarity", "sentiment, 2 classes · "
                    "21-word sentences", "drop stopwords", "accuracy", b, v,
                    "every token", "stoplist removed", len(Xtr), [db, dv],
                    "Same task, same knob, one twentieth of the document length. Here a "
                    "single not is a large share of the evidence, and the warning is "
                    "real.", 0.005, chance_score(ytr, yte)))

    log("SMS spam · casing and punctuation")
    Xtr, ytr, Xte, yte = load_sms_spam()
    b, db = classify(Xtr, ytr, Xte, yte, make_analyzer("raw_case_punct"), metric="macro_f1")
    v, dv = classify(Xtr, ytr, Xte, yte, make_analyzer("cleaned"), metric="macro_f1")
    rows.append(row("classification", "SMS spam", "spam, 13% positive · 15-word messages",
                    "lowercase, strip digits and punctuation", "macro F1", b, v,
                    "FREE, free, 150, !!! and £ all distinct", "letters only, lowercased",
                    len(Xtr), [db, dv],
                    "Folklore says shouting and punctuation are the signal. They are "
                    "real, but redundant: free, txt, claim and win already separate the "
                    "classes, and splitting each word across casings costs more than the "
                    "casing is worth.", 0.005, chance_score(ytr, yte, "macro_f1")))

    log("Authorship · function words")
    Xtr, ytr, Xte, yte = load_authorship()
    b, db = classify(Xtr, ytr, Xte, yte, plain)
    v, dv = classify(Xtr, ytr, Xte, yte, nostop)
    o, do = classify(Xtr, ytr, Xte, yte, onlystop)
    rows.append(row("classification", "Gutenberg", "authorship, Austen vs Chesterton · "
                    "50-word passages", "drop stopwords", "accuracy", b, v, "every token",
                    "stoplist removed", len(Xtr), [db, dv],
                    "Held-out novel per author, so plot words cannot give it away. "
                    "Style lives in exactly the words the stoplist deletes.", 0.005,
                    chance_score(ytr, yte)))
    rows.append(row("classification", "Gutenberg", "authorship, Austen vs Chesterton · "
                    "50-word passages", "keep ONLY stopwords", "accuracy", b, o,
                    "every token", f"stoplist only, {do} features", len(Xtr), [db, do],
                    "The knob that did nothing on AG News is, inverted, almost the whole "
                    "task here: a few hundred function words against a 50/50 chance "
                    "baseline.", 0.005, chance_score(ytr, yte)))
    return rows


def family_scarcity():
    rows = []
    plain, stemmed = make_analyzer("plain"), make_analyzer("stemmed")
    Xtr, ytr, Xte, yte = load_agnews()

    for n in (500, None):
        log(f"AG News · stemming at n={n or len(Xtr)}")
        b, db = classify(Xtr, ytr, Xte, yte, plain, n_train=n)
        v, dv = classify(Xtr, ytr, Xte, yte, stemmed, n_train=n)
        rows.append(row("data size", "AG News", "topic, 4 classes", "Porter stemming",
                        "accuracy", b, v, "surface forms", "stemmed", n or len(Xtr),
                        [db, dv],
                        "Stemming merges forms the classifier has not seen enough of."
                        if n else "With enough labels the classifier learns each form "
                        "separately, and stemming only destroys distinctions.", 0.005,
                        chance_score(ytr, yte)))
    return rows


def family_ir():
    log("NFCorpus · BM25 retrieval")
    corpus, queries, qrels = load_nfcorpus()
    rows = []
    b, db = bm25_ndcg(corpus, queries, qrels, make_analyzer("plain"))
    v, dv = bm25_ndcg(corpus, queries, qrels, make_analyzer("stemmed"))
    rows.append(row("retrieval", "NFCorpus", f"BM25 over {len(corpus):,} docs, "
                    f"{len(queries)} queries", "Porter stemming", "nDCG@10", b, v,
                    "surface forms", "stemmed", len(corpus), [db, dv],
                    "A query says 'treating diabetes', the document says 'treatment of "
                    "diabetic'. Without stemming they share nothing.", 0.005))
    v2, dv2 = bm25_ndcg(corpus, queries, qrels, make_analyzer("no_stopwords"))
    rows.append(row("retrieval", "NFCorpus", f"BM25 over {len(corpus):,} docs, "
                    f"{len(queries)} queries", "drop stopwords", "nDCG@10", b, v2,
                    "every token", "stoplist removed", len(corpus), [db, dv2],
                    "BM25 already discounts terms that appear everywhere, so the "
                    "stoplist mostly saves index space.", 0.005))
    return rows


def family_topics(n_docs=20000):
    log("AG News · LDA topic quality")
    Xtr, _, _, _ = load_agnews()
    rng = np.random.RandomState(SEED)
    docs = [Xtr[i] for i in rng.choice(len(Xtr), size=n_docs, replace=False)]

    rows, topics = [], {}
    base, topics["raw"], d0 = lda_coherence(docs, make_analyzer("plain"))
    nost, topics["no_stopwords"], d1 = lda_coherence(docs, make_analyzer("no_stopwords"))
    rows.append(row("topic modelling", "AG News", f"LDA, 8 topics, {n_docs:,} docs",
                    "drop stopwords", "NPMI coherence", base, nost, "every token",
                    "stoplist removed", n_docs, [d0, d1],
                    "Raw topics are led by the, and, for — the model spends its "
                    "capacity on grammar.", 0.01))

    stop = _stop()
    lem = make_analyzer("lemmatised")
    lem_nostop = lambda t: [w for w in lem(t) if w not in stop]
    lemm, topics["lemmatised"], d2 = lda_coherence(docs, lem_nostop)
    rows.append(row("topic modelling", "AG News", f"LDA, 8 topics, {n_docs:,} docs",
                    "lemmatise (stoplist removed in both)", "NPMI coherence", nost, lemm,
                    "surface forms", "lemmatised", n_docs, [d1, d2],
                    "The expected win is that one concept stops being scattered across "
                    "eight surface forms. What actually arrives is ha, u and wa: "
                    "WordNet without POS tags mangles frequent words, and the mangled "
                    "forms are frequent enough to lead topics.", 0.01))
    return rows, topics


FAMILIES = {"clf": family_clf, "scarcity": family_scarcity,
            "ir": family_ir, "topics": family_topics}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", choices=list(FAMILIES), default=list(FAMILIES))
    args = ap.parse_args()

    os.makedirs(ART_DIR, exist_ok=True)
    out = json.load(open(OUT)) if os.path.exists(OUT) else {"rows": [], "topics": {}}

    produced, topics = [], out.get("topics", {})
    for name in args.only:
        res = FAMILIES[name]()
        if isinstance(res, tuple):
            res, topics = res
        produced += res
        for r in res:
            print(f"  {r['dataset']:14s} {r['knob']:42s} "
                  f"{r['baseline']:.4f} -> {r['variant']:.4f}  {r['delta']:+.4f}  "
                  f"{r['verdict']}")

    fam_of = {"clf": "classification", "scarcity": "data size",
              "ir": "retrieval", "topics": "topic modelling"}
    touched = {fam_of[n] for n in args.only}
    rows = [r for r in out["rows"] if r["family"] not in touched] + produced
    order = ["classification", "data size", "retrieval", "topic modelling"]
    rows.sort(key=lambda r: order.index(r["family"]))

    json.dump({"rows": rows, "topics": topics, "seed": SEED}, open(OUT, "w"), indent=1)
    log(f"wrote {OUT}  ({len(rows)} rows)")


if __name__ == "__main__":
    main()
