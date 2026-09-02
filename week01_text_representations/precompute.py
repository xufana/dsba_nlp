"""
Precompute artifacts for week 1 that take longer than ~5 minutes in Google Colab.

Everything else in the seminar notebook is trained live (with a fixed seed).
The rule for what lives here:

    > 5 min in Colab  -> artifact, committed to seminars/week01/artifacts/
    < 5 min in Colab  -> trained live in the notebook

Run:
    python precompute.py --data-dir ../data --out artifacts
    python precompute.py --data-dir ../data --out artifacts --only glove lda

Nothing here is required to *read* the notebook: every artifact has the code
that produced it sitting a few lines above the load, behind RECOMPUTE.
"""

import argparse
import json
import os
import re
import time

import numpy as np
import pandas as pd

SEED = 42
CLASS_NAMES = {0: "World", 1: "Sports", 2: "Business", 3: "Sci/Tech"}

# Words the seminar actually touches in the GloVe blocks. Anything outside the
# top-N vocab still needs to be reachable, so we pin these explicitly.
PINNED = """
king queen man woman prince princess royal mother father
paris france italy rome roma italia berlin germany tokyo japan moscow russia
head foot sock socks hand glove shoe
latte milk water coffee espresso cappuccino macchiato
doctor nurse programmer engineer teacher scientist secretary receptionist
homemaker housewife boss manager supervisor assistant midwife dentist
he she his her him hers himself herself
good bad best worst great terrible
oil stock market bank economy election government war peace
computer software internet google apple microsoft nasa space
football soccer basketball olympics championship coach player
""".split()


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def log(msg):
    print(f"[precompute] {msg}", flush=True)


def load_agnews(data_dir):
    train = pd.read_csv(os.path.join(data_dir, "ag_news_train.csv"), sep="\t")
    test = pd.read_csv(os.path.join(data_dir, "ag_news_test.csv"), sep="\t")
    return train, test


def tokenize(text):
    return re.findall(r"\w+", text.lower())


# --------------------------------------------------------------------------
# 1. GloVe subset
#    The full glove-twitter-100 download is 387 MB. On a slow connection that
#    alone blows the 5-minute budget, and students only ever touch a few
#    thousand words of it. We ship the top-N vocab plus the pinned words.
# --------------------------------------------------------------------------

def build_glove_subset(out_dir, top_n=60_000):
    import gensim.downloader as api

    log("loading glove-twitter-100 (387 MB, this is the slow one)")
    kv = api.load("glove-twitter-100")

    keep = list(kv.index_to_key[:top_n])
    keep_set = set(keep)
    added = [w for w in PINNED if w in kv.key_to_index and w not in keep_set]
    keep += added
    log(f"keeping {len(keep)} vectors ({len(added)} pinned words added beyond top-{top_n})")

    vectors = np.stack([kv[w] for w in keep]).astype(np.float32)
    path = os.path.join(out_dir, "glove_twitter_100_subset.npz")
    np.savez_compressed(path, words=np.array(keep, dtype=object), vectors=vectors)
    log(f"wrote {path} ({os.path.getsize(path) / 1e6:.0f} MB)")


# --------------------------------------------------------------------------
# 2. LDA topics, raw vs lemmatised
#    This is the "where you cannot skip preprocessing" demo. It lives in the
#    homework section of the notebook; fitting two LDA models on 20k docs is
#    a few minutes even subsampled, so it ships precomputed.
# --------------------------------------------------------------------------

def build_lda_topics(train, out_dir, n_docs=20_000, n_topics=8, n_top_words=10):
    from sklearn.decomposition import LatentDirichletAllocation
    from sklearn.feature_extraction.text import CountVectorizer
    import nltk

    nltk.download("wordnet", quiet=True)
    nltk.download("stopwords", quiet=True)
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer

    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(train), size=min(n_docs, len(train)), replace=False)
    docs = train.text.iloc[idx].tolist()

    lemmatizer = WordNetLemmatizer()
    stop = set(stopwords.words("english"))

    def clean(text):
        toks = [t for t in tokenize(text) if t not in stop and len(t) > 2]
        return " ".join(lemmatizer.lemmatize(t) for t in toks)

    log("lemmatising for the LDA comparison")
    docs_clean = [clean(d) for d in docs]

    out = {}
    for tag, corpus, kwargs in [
        ("raw", docs, {}),
        ("lemmatised", docs_clean, {}),
    ]:
        log(f"fitting LDA on the {tag} corpus")
        vec = CountVectorizer(min_df=10, max_df=0.5, **kwargs)
        X = vec.fit_transform(corpus)
        lda = LatentDirichletAllocation(
            n_components=n_topics, random_state=SEED, learning_method="online", max_iter=10
        )
        lda.fit(X)
        vocab = np.array(vec.get_feature_names_out())
        topics = [
            vocab[np.argsort(-comp)[:n_top_words]].tolist() for comp in lda.components_
        ]
        out[tag] = {"topics": topics, "vocab_size": int(X.shape[1])}

    path = os.path.join(out_dir, "lda_topics.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    log(f"wrote {path}")


# --------------------------------------------------------------------------
# 3. t-SNE grid over perplexity
#    Four fits at ~1 min each. The point of the demo is that the "clusters"
#    change shape with perplexity, so all four have to exist at once.
# --------------------------------------------------------------------------

def build_tsne_grid(out_dir, n_words=1000, perplexities=(2, 5, 30, 100)):
    from sklearn.manifold import TSNE

    src = os.path.join(out_dir, "glove_twitter_100_subset.npz")
    if not os.path.exists(src):
        log("glove subset missing, run --only glove first; skipping t-SNE")
        return

    data = np.load(src, allow_pickle=True)
    words = data["words"][:n_words]
    vectors = data["vectors"][:n_words]

    grids = {}
    for p in perplexities:
        log(f"t-SNE perplexity={p}")
        t = time.time()
        emb = TSNE(
            n_components=2, perplexity=p, init="pca",
            learning_rate="auto", random_state=SEED,
        ).fit_transform(vectors)
        grids[str(p)] = emb.astype(np.float32)
        log(f"  {time.time() - t:.0f}s")

    path = os.path.join(out_dir, "tsne_grid.npz")
    np.savez_compressed(path, words=words, **grids)
    log(f"wrote {path}")


# --------------------------------------------------------------------------
# 4. LLM predictions
#    Instructor key. Two prompts that differ only in the order the classes are
#    listed, three repeats each at temperature 0, so the notebook can show
#    both prompt sensitivity and non-determinism without spending money live.
#
#    Also the LLM line of the learning curve: it is flat by construction, but
#    students should see it measured rather than asserted.
# --------------------------------------------------------------------------

PROMPT_A = """Classify the news headline into exactly one category.
Categories: World, Sports, Business, Sci/Tech
Answer with the category name and nothing else.

Headline: {text}
Category:"""

PROMPT_B = """Classify the news headline into exactly one category.
Categories: Sci/Tech, Business, Sports, World
Answer with the category name and nothing else.

Headline: {text}
Category:"""


def build_llm_predictions(test, out_dir, n=200, repeats=3, model="gpt-4o-mini",
                          workers=8):
    try:
        import openai
    except ImportError:
        log("openai package not installed; skipping LLM block")
        return
    if not os.environ.get("OPENAI_API_KEY"):
        log("OPENAI_API_KEY not set; skipping LLM block")
        return

    from concurrent.futures import ThreadPoolExecutor

    client = openai.OpenAI(max_retries=5)
    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(test), size=n, replace=False)
    sample = test.iloc[idx].reset_index(drop=True)

    jobs = [(prompt_name, template, rep, i, row)
            for prompt_name, template in [("A", PROMPT_A), ("B", PROMPT_B)]
            for rep in range(repeats)
            for i, row in sample.iterrows()]

    def one(job):
        prompt_name, template, rep, i, row = job
        t = time.time()
        resp = client.chat.completions.create(
            model=model,
            max_tokens=16,
            temperature=0,
            messages=[{"role": "user", "content": template.format(text=row.text)}],
        )
        return {
            "idx": int(idx[i]),
            "prompt": prompt_name,
            "repeat": rep,
            "gold": int(row.label),
            "raw": (resp.choices[0].message.content or "").strip(),
            "latency_s": round(time.time() - t, 3),
            "in_tokens": resp.usage.prompt_tokens,
            "out_tokens": resp.usage.completion_tokens,
        }

    # The calls are independent, so they run in parallel. Each row still times
    # its own call, which is the number the notebook reports; contention adds a
    # little to it, so treat the latency column as an upper bound.
    log(f"{len(jobs)} calls to {model}, {workers} at a time")
    rows = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for k, row in enumerate(pool.map(one, jobs), 1):
            rows.append(row)
            if k % 200 == 0:
                log(f"  {k}/{len(jobs)}")

    df = pd.DataFrame(rows)
    path = os.path.join(out_dir, "llm_predictions.csv")
    df.to_csv(path, index=False)
    log(f"wrote {path} ({len(df)} calls, {df.in_tokens.sum():,} in / "
        f"{df.out_tokens.sum():,} out tokens)")


# --------------------------------------------------------------------------
# 5. Reference results table
#    Students fill their own copy live. This one is the fallback if a laptop
#    dies mid-seminar, and the record of what the numbers were when the
#    notebook was written.
# --------------------------------------------------------------------------

def build_reference_results(train, test, out_dir):
    from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, f1_score

    configs = [
        ("counts, words", CountVectorizer(min_df=4)),
        ("tf-idf, words 1-1", TfidfVectorizer(min_df=4, max_df=0.95)),
        ("tf-idf, words 1-2", TfidfVectorizer(min_df=4, max_df=0.95, ngram_range=(1, 2))),
        ("tf-idf, chars 3-5", TfidfVectorizer(min_df=4, analyzer="char_wb", ngram_range=(3, 5))),
    ]

    rows = []
    for name, vec in configs:
        t = time.time()
        Xtr = vec.fit_transform(train.text)
        Xte = vec.transform(test.text)
        vec_s = time.time() - t

        t = time.time()
        clf = LogisticRegression(max_iter=1000, random_state=SEED).fit(Xtr, train.label)
        fit_s = time.time() - t

        pred = clf.predict(Xte)
        rows.append({
            "representation": name,
            "dim": int(Xtr.shape[1]),
            "accuracy": round(accuracy_score(test.label, pred), 4),
            "macro_f1": round(f1_score(test.label, pred, average="macro"), 4),
            "vectorize_s": round(vec_s, 1),
            "fit_s": round(fit_s, 1),
        })
        log(f"{name}: acc={rows[-1]['accuracy']}")

    path = os.path.join(out_dir, "reference_results.csv")
    pd.DataFrame(rows).to_csv(path, index=False)
    log(f"wrote {path}")


# --------------------------------------------------------------------------

STEPS = {
    "glove": lambda a, tr, te: build_glove_subset(a.out),
    "lda": lambda a, tr, te: build_lda_topics(tr, a.out),
    "tsne": lambda a, tr, te: build_tsne_grid(a.out),
    "llm": lambda a, tr, te: build_llm_predictions(te, a.out),
    "results": lambda a, tr, te: build_reference_results(tr, te, a.out),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="../data")
    ap.add_argument("--out", default="artifacts")
    ap.add_argument("--only", nargs="*", choices=sorted(STEPS), default=None)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    train, test = load_agnews(args.data_dir)
    log(f"AG News: {len(train)} train / {len(test)} test")

    for name in (args.only or STEPS):
        log(f"=== {name} ===")
        STEPS[name](args, train, test)

    log("done")


if __name__ == "__main__":
    main()
