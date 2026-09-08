"""Export everything the interactive HTML demo needs into one JSON bundle.

Run from week01_text_representations/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).
"""
import base64
import json
import os
import re
import warnings
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

SEED = 42
DATA_DIR = "../data"
ART_DIR = "../artifacts"
OUT_DIR = "."
CLASS_NAMES = ["World", "Sports", "Business", "Sci/Tech"]

os.makedirs(OUT_DIR, exist_ok=True)
train = pd.read_csv(f"{DATA_DIR}/ag_news_train.csv", sep="\t")
test = pd.read_csv(f"{DATA_DIR}/ag_news_test.csv", sep="\t")

D = {"classNames": CLASS_NAMES}


def f16(a):
    """float array -> base64 of float16."""
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float16).tobytes()).decode()


def u16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.uint16).tobytes()).decode()


# ---------------------------------------------------------------- 0. disputed
DISPUTED_IDX = [7239, 6007, 6082, 4302, 6325, 4200,
                5955, 7262, 3895, 2295, 1708, 6674]

# ---------------------------------------------- the real model (blocks B, F, G)
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

print("fitting the reference tf-idf model ...")
vec = TfidfVectorizer(min_df=4, max_df=0.95)
Xtr = vec.fit_transform(train.text)
Xte = vec.transform(test.text)
clf = LogisticRegression(max_iter=1000, random_state=SEED).fit(Xtr, train.label)
pred = clf.predict(Xte)
print(f"  acc={accuracy_score(test.label, pred):.4f}  dim={Xtr.shape[1]:,}")

feature_names = np.array(vec.get_feature_names_out())

D["disputed"] = [
    {"i": int(i), "text": test.text.iloc[i], "gold": int(test.label.iloc[i]),
     "model": int(pred[i])}
    for i in DISPUTED_IDX
]

# top features per class (block 5.1)
D["topFeatures"] = [
    [{"w": feature_names[j], "c": round(float(clf.coef_[c, j]), 3)}
     for j in np.argsort(-clf.coef_[c])[:15]]
    for c in range(4)
]

# the exported model itself (block F: live classifier + coef x tfidf)
D["model"] = {
    "vocab": [str(w) for w in feature_names],
    "idf": f16(vec.idf_),
    "coef": f16(clf.coef_.ravel()),
    "intercept": [float(x) for x in clf.intercept_],
    "acc": round(float(accuracy_score(test.label, pred)), 4),
}
print(f"  model bundle: vocab {len(feature_names):,}")

# a handful of predictions the JS re-implementation must reproduce exactly
CHECK = ["Apple sued over patent dispute in federal court",
         "Russia and Ukraine agree on grain shipping corridor",
         "Oil prices soar to an all-time record high"]
D["checkProbs"] = [{"text": t,
                    "p": [round(float(x), 6) for x in
                          clf.predict_proba(vec.transform([t]))[0]]}
                   for t in CHECK]

# 20 mistakes, read by hand (block 8)
wrong = np.where(pred != test.label.values)[0]
sample = np.random.RandomState(SEED).choice(wrong, size=20, replace=False)
D["mistakes"] = [{"gold": int(test.label.iloc[i]), "pred": int(pred[i]),
                  "text": test.text.iloc[i]} for i in sample]

# ------------------------------------------------------------- 1. tokenization
import nltk
for pkg in ("punkt_tab", "wordnet", "stopwords", "omw-1.4"):
    nltk.download(pkg, quiet=True)
from nltk.tokenize import wordpunct_tokenize, word_tokenize
from nltk.stem import WordNetLemmatizer, PorterStemmer
from nltk.corpus import stopwords

from string import punctuation


def tokenize_naive(text):
    for p in punctuation:
        text = text.replace(p, " ")
    return text.strip().split()


def tokenize_regex(text):
    return re.findall(r"\w+", text)


HARD_CASES = [
    "Contact alex.smith_92@hse.ru for details.",
    "See http://news.com.com/Nokia+joins?tag=nl.e433 for more.",
    "Shares fell 3.5% to $41.20 on Tuesday.",
    "Don't miss #Athens2004 -- it's must-see TV!",
    "Version 2.6.1 ships Q4 2004.",
]
D["tokenizerCases"] = [
    {"text": c,
     "naive": tokenize_naive(c),
     "regex": tokenize_regex(c),
     "wordpunct": wordpunct_tokenize(c),
     "word_tok": word_tokenize(c)}
    for c in HARD_CASES
]

lem, stem = WordNetLemmatizer(), PorterStemmer()
D["morph"] = [
    {"word": w, "stem": stem.stem(w), "n": lem.lemmatize(w),
     "v": lem.lemmatize(w, "v"), "a": lem.lemmatize(w, "a")}
    for w in ["studies", "goes", "going", "went", "better", "was", "cats", "people"]
]

stop = sorted(stopwords.words("english"))
D["stopwords"] = stop

# subword tokenization
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    D["bpe"] = {
        "pairs": [
            {"en": en, "ru": ru,
             "enTok": [enc.decode([t]) for t in enc.encode(en)],
             "ruTok": [enc.decode([t]) for t in enc.encode(ru)]}
            for en, ru in [
                ("Oil prices soar to an all-time record high.",
                 "Цены на нефть взлетели до рекордного уровня."),
                ("The unbelievability of it all.",
                 "Невероятность всего происходящего."),
            ]],
        "words": [{"w": w, "pieces": [enc.decode([t]) for t in enc.encode(w)]}
                  for w in ["unbelievability", "tokenization", "Sci-Tech",
                            "1,234.56", "нефть"]],
    }
except Exception as e:                                   # pragma: no cover
    print("  tiktoken unavailable:", e)
    D["bpe"] = None

# ---------------------------------------------------------------- 2. LDA / OOV
with open(f"{ART_DIR}/lda_topics.json") as f:
    D["lda"] = json.load(f)

train_vocab = set()
for t in train.text:
    train_vocab.update(re.findall(r"\w+", t.lower()))
test_tokens = [w for t in test.text for w in re.findall(r"\w+", t.lower())]
oov = [w for w in test_tokens if w not in train_vocab]
D["oov"] = {"trainTypes": len(train_vocab), "testTokens": len(test_tokens),
            "oovTokens": len(oov), "oovTypes": len(set(oov)),
            "examples": sorted(set(oov))[:12]}

# -------------------------------------------------------------- 3. toy corpus
D["toy"] = ["oil prices rise today", "oil prices fall today",
            "the team wins the game today", "the team loses the game today"]
D["orderPair"] = ["oil prices fall stocks rise", "stocks fall oil prices rise"]

# ----------------------------------------------------------- results table
D["results"] = [
    {"rep": "counts, words 1-1", "head": "LogisticRegression", "acc": 0.9093,
     "f1": 0.9092, "vec_s": 2.1, "fit_s": 12.5, "lat": None, "note": "dim=29,350"},
    {"rep": "tf-idf, words 1-1", "head": "LogisticRegression", "acc": 0.9179,
     "f1": 0.9177, "vec_s": 2.3, "fit_s": 3.8, "lat": None, "note": "dim=29,350"},
    {"rep": "tf-idf, words 1-2", "head": "LogisticRegression", "acc": 0.9195,
     "f1": 0.9193, "vec_s": 7.0, "fit_s": 15.5, "lat": None, "note": "dim=196,911"},
    {"rep": "tf-idf, chars 3-5", "head": "LogisticRegression", "acc": 0.9162,
     "f1": 0.9160, "vec_s": 24.2, "fit_s": 66.0, "lat": None, "note": "dim=177,100"},
    {"rep": "tf-idf, words 1-1", "head": "LinearSVC", "acc": 0.9195, "f1": 0.9193,
     "vec_s": None, "fit_s": 11.0, "lat": None, "note": "head swap"},
    {"rep": "tf-idf, words 1-1", "head": "MultinomialNB", "acc": 0.9014, "f1": 0.9012,
     "vec_s": None, "fit_s": 0.1, "lat": None, "note": "head swap"},
    {"rep": "tf-idf, words 1-1", "head": "SGDClassifier", "acc": 0.9192, "f1": 0.9190,
     "vec_s": None, "fit_s": 1.5, "lat": None, "note": "head swap"},
    {"rep": "word2vec, mean pooling", "head": "LogisticRegression", "acc": 0.8899,
     "f1": 0.8897, "vec_s": 8.1, "fit_s": 2.1, "lat": None, "note": "dim=100"},
    {"rep": "word2vec, idf-weighted", "head": "LogisticRegression", "acc": 0.8900,
     "f1": 0.8898, "vec_s": 8.6, "fit_s": 2.6, "lat": None, "note": "dim=100"},
    {"rep": "zero-shot LLM", "head": "LLM", "acc": 0.8200, "f1": 0.8206,
     "vec_s": None, "fit_s": None, "lat": 609,
     "note": "200 examples, no training data"},
]

# ------------------------------------------------------------ 5.2 the shortcut
MARKER = re.compile(r"\(([A-Za-z .'\-]{2,30})\)")
train_marker = train.text.str.extract(MARKER, expand=False)
ct = pd.crosstab(train_marker, train.label.map(lambda i: CLASS_NAMES[i]))
ct = ct.assign(total=ct.sum(axis=1)).sort_values("total", ascending=False).head(12)
D["shortcut"] = {
    "coverage": round(float(train_marker.notna().mean()), 4),
    "crosstab": [{"src": str(idx), **{c: int(r[c]) for c in CLASS_NAMES},
                  "total": int(r["total"])} for idx, r in ct.iterrows()],
    "firstDoc": train.text.iloc[0],
}


def quick_eval(tr_texts, te_texts):
    v = TfidfVectorizer(min_df=4, max_df=0.95)
    A, B = v.fit_transform(tr_texts), v.transform(te_texts)
    c = LogisticRegression(max_iter=1000, random_state=SEED).fit(A, train.label)
    return round(float(accuracy_score(test.label, c.predict(B))), 4), A.shape[1]


def marker_only(s):
    m = MARKER.search(s)
    return "SRC_" + m.group(1).replace(" ", "_") if m else "SRC_NONE"


def strip_source(t):
    t = re.sub(r"\([A-Za-z .'\-]{2,30}\)\s*", " ", t, count=1)
    t = re.sub(r"^\s*[A-Za-z .'\-]{2,30}\s+-\s+", " ", t)
    return t.strip()


print("shortcut experiments ...")
acc_m, dim_m = quick_eval(train.text.map(marker_only), test.text.map(marker_only))
acc_s, dim_s = quick_eval(train.text.map(strip_source), test.text.map(strip_source))
D["shortcut"].update({
    "markerOnlyAcc": acc_m, "markerOnlyDim": dim_m,
    "rawAcc": D["model"]["acc"], "strippedAcc": acc_s, "strippedDim": dim_s,
    "majority": round(float((test.label == train.label.mode()[0]).mean()), 4),
    "stripExample": strip_source(train.text.iloc[0]),
})
print(f"  marker only {acc_m}  stripped {acc_s}")

# ------------------------------------------------------------------- 7. LLM
llm_path = f"{ART_DIR}/llm_predictions.csv"
if os.path.exists(llm_path):
    llm = pd.read_csv(llm_path)
    name2id = {v.lower().replace("/", "").replace("-", ""): k
               for k, v in enumerate(CLASS_NAMES)}

    def parse(raw):
        key = str(raw).strip().lower().replace("/", "").replace("-", "").replace(" ", "")
        return name2id.get(key, -1)

    llm["pred"] = llm["raw"].map(parse)
    by = (llm.groupby(["prompt", "repeat"])
            .apply(lambda g: (g.pred == g.gold).mean()).round(4))
    per_example = llm[llm.prompt == "A"].groupby("idx")["pred"].nunique()
    D["llm"] = {
        "calls": int(len(llm)), "examples": int(llm.idx.nunique()),
        "byPrompt": [{"prompt": p, "repeat": int(r), "acc": float(v)}
                     for (p, r), v in by.items()],
        "unstable": round(float((per_example > 1).mean()), 4),
        "medianLatencyMs": int(llm.latency_s.median() * 1000),
    }
else:
    D["llm"] = None

# ------------------------------------- block B: in-browser logreg on tf-idf
print("building the browser training set ...")
N_TRAIN, N_TEST, VOCAB_B = 6000, 2000, 4000
rng = np.random.RandomState(SEED)
tr_idx = rng.choice(len(train), N_TRAIN, replace=False)
te_idx = rng.choice(len(test), N_TEST, replace=False)
sub_tr, sub_te = train.iloc[tr_idx], test.iloc[te_idx]

vec_b = TfidfVectorizer(min_df=3, max_df=0.95, max_features=VOCAB_B)
vec_b.fit(sub_tr.text)
vocab_b = list(vec_b.get_feature_names_out())
idx_b = {w: i for i, w in enumerate(vocab_b)}


def encode(texts):
    """Each doc -> list of vocabulary ids (duplicates kept: that is the tf)."""
    flat, offs = [], [0]
    tokpat = vec_b.build_analyzer()
    for t in texts:
        ids = [idx_b[w] for w in tokpat(t) if w in idx_b]
        flat.extend(ids)
        offs.append(len(flat))
    return flat, offs


tr_flat, tr_offs = encode(sub_tr.text)
te_flat, te_offs = encode(sub_te.text)
D["trainB"] = {
    "vocab": vocab_b,
    "idf": f16(vec_b.idf_),
    "trIds": u16(tr_flat), "trOffs": u16(np.diff(tr_offs)),
    "trY": [int(x) for x in sub_tr.label],
    "teIds": u16(te_flat), "teOffs": u16(np.diff(te_offs)),
    "teY": [int(x) for x in sub_te.label],
    "nTrain": N_TRAIN, "nTest": N_TEST,
}
print(f"  vocab {len(vocab_b)}, {len(tr_flat):,} train tokens")

# ------------------------------------- block C: in-browser skip-gram word2vec
print("building the skip-gram corpus ...")
N_SG_DOCS, VOCAB_C = 5000, 1500
sg_texts = train.text.iloc[rng.choice(len(train), N_SG_DOCS, replace=False)]
sg_docs = [re.findall(r"\w+", t.lower()) for t in sg_texts]
cnt = Counter(w for d in sg_docs for w in d)
sg_vocab = [w for w, _ in cnt.most_common(VOCAB_C)]
sg_idx = {w: i for i, w in enumerate(sg_vocab)}
sg_flat, sg_lens = [], []
for d in sg_docs:
    ids = [sg_idx[w] for w in d if w in sg_idx]
    if len(ids) >= 4:
        sg_flat.extend(ids)
        sg_lens.append(len(ids))
D["trainC"] = {
    "vocab": sg_vocab,
    "freq": [int(cnt[w]) for w in sg_vocab],
    "ids": u16(sg_flat), "lens": u16(sg_lens),
    "stopIds": [sg_idx[w] for w in stop if w in sg_idx],
    "sampleDoc": sg_docs[0][:18],
}
print(f"  vocab {len(sg_vocab)}, {len(sg_flat):,} tokens, {len(sg_lens)} docs")

# reference neighbours from the notebook's full word2vec run (for comparison)
D["w2vReference"] = None

# ----------------------------------------------------- block D: GloVe subset
print("packing GloVe ...")
blob = np.load(f"{ART_DIR}/glove_twitter_100_subset.npz", allow_pickle=True)
gw = [str(w) for w in blob["words"]]
gv = blob["vectors"]
KEEP = 8000
must = ["king", "queen", "man", "woman", "paris", "france", "italy", "rome",
        "sock", "foot", "head", "doctor", "nurse", "programmer", "engineer",
        "oil", "petroleum", "basketball", "olympic", "microsoft", "stocks"]
keep = list(range(min(KEEP, len(gw))))
seen = set(keep)
for w in must:
    if w in gw and gw.index(w) not in seen:
        keep.append(gw.index(w))
        seen.add(gw.index(w))
keep.sort()
gw2 = [gw[i] for i in keep]
gv2 = gv[keep]

# 2D layout for the map: PCA of the normalized vectors
gn = gv2 / np.linalg.norm(gv2, axis=1, keepdims=True)
c = gn - gn.mean(0)
U, S, Vt = np.linalg.svd(c[:4000], full_matrices=False)
xy = c @ Vt[:2].T
D["glove"] = {"words": gw2, "dim": int(gv2.shape[1]),
              "vecs": f16(gv2.ravel()), "xy": f16(xy.ravel()),
              "basis": f16(Vt[:2].ravel()), "mean": f16(gn.mean(0))}
print(f"  {len(gw2):,} vectors")

tg = np.load(f"{ART_DIR}/tsne_grid.npz", allow_pickle=True)
D["tsne"] = {"words": [str(w) for w in tg["words"]],
             "grids": {k: f16(tg[k].ravel()) for k in ["2", "5", "30", "100"]}}

# ------------------------------------------- preprocessing grid (block 02)
# Twelve A/B experiments over four task families; see scripts/preprocessing_grid.py.
grid_path = f"{ART_DIR}/preprocessing_grid.json"
if os.path.exists(grid_path):
    with open(grid_path) as f:
        grid = json.load(f)
    D["preproc"] = {"rows": grid["rows"], "topics": grid.get("topics", {})}
    print(f"preprocessing grid: {len(grid['rows'])} rows")
else:
    print(f"no {grid_path} — run scripts/preprocessing_grid.py; the demo block will be empty")
    D["preproc"] = {"rows": [], "topics": {}}

# ------------------------------------------------------------------- write
path = f"{OUT_DIR}/demo_data.json"
with open(path, "w") as f:
    json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
print(f"\nwrote {path}  ({os.path.getsize(path) / 1e6:.1f} MB)")
