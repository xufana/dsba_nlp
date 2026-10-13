"""The few numbers the lecture page (demo/lecture/) needs that the browser cannot compute -> artifacts/lecture_data.json.

    uv run python export_lecture_data.py

Everything is read from the seminar's own artifact (artifacts/demo_data.json: the TfidfVectorizer vocabulary of the
AG News training set, the four toy documents) and from the same libraries the notebook calls (nltk's Porter stemmer,
tiktoken's cl100k_base). Nothing is trained; the script runs in seconds.
"""
import json
import os

import tiktoken
from nltk.stem import PorterStemmer

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
D = json.load(open("artifacts/demo_data.json", encoding="utf-8"))
VOCAB = set(D["model"]["vocab"])             # sklearn's analyzer over the training set, every surface form it kept
ps = PorterStemmer()
STEMS = {ps.stem(w) for w in VOCAB}          # what the stemmer would have turned the training words into
enc = tiktoken.get_encoding("cl100k_base")


def char_wb(word, lo=3, hi=5):
    """sklearn's analyzer="char_wb": the word padded with one space each side, every n-gram of length lo..hi."""
    w = f" {word} "
    return [w[i:i + n] for n in range(lo, hi + 1) for i in range(len(w) - n + 1)]


SEEN = set()
for w in VOCAB:
    SEEN.update(char_wb(w))


def ft_subwords(word, lo=3, hi=5):
    """fastText's pieces: the word wrapped in < >, every n-gram of length lo..hi (min_n=3, max_n=5 as in the notebook)."""
    w = f"<{word}>"
    return [w[i:i + n] for n in range(lo, hi + 1) for i in range(len(w) - n + 1)]


# three ways a word can be new: a misspelling, a name nobody had used, a rare derivation of a known stem
WORDS = [("recieved", "a misspelling"), ("lumorix", "a new brand name"), ("unbelievability", "a rare form of a known word")]
rows = []
for w, kind in WORDS:
    assert w not in VOCAB, f"{w} is in the training vocabulary; pick another example"
    grams = char_wb(w)
    seen = [g for g in grams if g in SEEN]
    stem = ps.stem(w)
    rows.append({
        "w": w, "kind": kind,
        "inVocab": False,
        "stem": stem, "stemKnown": stem in STEMS,
        "stemOf": sorted(v for v in VOCAB if ps.stem(v) == stem)[:4],
        "ngrams": grams, "ngramsSeen": len(seen), "ngramsTotal": len(grams),
        "bpe": [enc.decode([t]) for t in enc.encode(w)],
        "ft": ft_subwords(w), "ftN": len(ft_subwords(w)),
    })
    print(f"{w:16s} stem {stem!r:14s} known stem {stem in STEMS!s:5s}  char n-grams seen {len(seen)}/{len(grams)}  bpe {rows[-1]['bpe']}")

# stemming vs lemmatisation, by the real tools: Porter, WordNet (with and without the part of speech), Snowball for Russian
from nltk.stem import SnowballStemmer, WordNetLemmatizer
wl, ru = WordNetLemmatizer(), SnowballStemmer("russian")
NORM_EN = [("studies", "v"), ("went", "v"), ("better", "a"), ("was", "v"), ("meeting", "n"),
           ("university", "n"), ("universe", "n"), ("organization", "n"), ("organ", "n")]
norm_en = [{"w": w, "pos": pos, "stem": ps.stem(w), "lemma": wl.lemmatize(w, pos), "lemmaNoPos": wl.lemmatize(w)} for w, pos in NORM_EN]
NORM_RU = [["кот", "кота", "коту", "котом", "коты"], ["шёл", "иду", "пошла"]]
norm_ru = [[{"w": w, "stem": ru.stem(w)} for w in group] for group in NORM_RU]
for r in norm_en:
    print(f"{r['w']:14s} stem {r['stem']:10s} lemma {r['lemma']:12s} no POS {r['lemmaNoPos']}")

# Zipf's law on the AG News training texts: words = lowercase runs of \w, as in the notebook's OOV cell
import math, re
from collections import Counter
import numpy as np
import pandas as pd
train = pd.read_csv("data/ag_news_train.csv", sep="\t")
freq = Counter(w for t in train.text for w in re.findall(r"\w+", t.lower()))
counts = np.array(sorted(freq.values(), reverse=True))
ranks = np.arange(1, len(counts) + 1)
# log-spaced ranks so the chart has a few hundred points, not 60 000
pick = np.unique(np.round(np.logspace(0, math.log10(len(counts)), 300)).astype(int)) - 1
fit = np.polyfit(np.log10(ranks[9:len(counts) // 10]), np.log10(counts[9:len(counts) // 10]), 1)  # middle of the curve
top = [w for w, _ in freq.most_common(10)]
# the same counts on the first half of the training set: what doubling the corpus does to the tail
half = Counter(w for t in train.text[: len(train) // 2] for w in re.findall(r"\w+", t.lower()))
half_stats = {"tokens": sum(half.values()), "types": len(half), "hapax": sum(1 for c in half.values() if c == 1)}
newWords = sum(1 for w in freq if w not in half)
zipf = {
    "tokens": int(counts.sum()), "types": int(len(counts)),
    "hapax": int((counts == 1).sum()),
    "top100share": float(counts[:100].sum() / counts.sum()),
    "slope": float(fit[0]),
    "top": top,
    "points": [[int(ranks[i]), int(counts[i])] for i in pick],
    "half": half_stats, "newInSecondHalf": newWords,
}
print(f"half: {half_stats}, words new in the second half: {newWords:,}")
print(f"zipf: {zipf['tokens']:,} tokens, {zipf['types']:,} types, hapax {zipf['hapax'] / zipf['types']:.0%}, top-100 cover {zipf['top100share']:.0%}, slope {zipf['slope']:.2f}, top {top}")

out = {
    "toy": D["toy"],
    "vocabSize": len(VOCAB),
    "oovRate": D["oov"]["oovTokens"] / D["oov"]["testTokens"],   # the seminar's measurement: word-level OOV on the test set
    "oovExamples": D["oov"]["examples"][:6],
    "oov": rows,
    "normEn": norm_en,
    "normRu": norm_ru,
    "zipf": zipf,
}
json.dump(out, open("artifacts/lecture_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"artifacts/lecture_data.json  {os.path.getsize('artifacts/lecture_data.json') / 1e3:.1f} kB")
