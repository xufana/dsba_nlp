"""Export everything the week-4 interactive demo needs into one JSON bundle.

Run from week04_pretraining_transfer/demo/:
    uv run python export_demo_data.py
Writes demo_data.json (consumed by build_demo.py).

Every number the page shows is produced here by the notebook's own code: the
definition cells of week04_pretraining_transfer.ipynb are executed as they are
(found by a marker string, so cell order does not matter), then the notebook's
experiments are re-run on the notebook's data and artifacts. What the page runs
in the browser — the toy BPE / WordPiece trainers, the Unigram Viterbi, BERT's
WordPiece tokenizer, the zero-shot label-word argmax — is checked against the
Python results exported here, and the check is shown on the page.
"""
import base64
import contextlib
import io
import json
import logging
import os
import sys
import time
import warnings

os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, ".."))                      # the notebook's working directory
sys.path.insert(0, os.getcwd())

import numpy as np
import torch

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = os.path.join(HERE, "demo_data.json")
NB = "week04_pretraining_transfer.ipynb"


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


def f16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float16).tobytes()).decode()


def r4(a, nd=4):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# ------------------------------------------------------------ notebook cells
nb = json.load(open(NB, encoding="utf-8"))
CODE = ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]
ns = {"__name__": "__nb__"}


def run_cell(marker, cut=None, capture=False):
    """Execute the unique code cell containing `marker`, truncated before `cut` if given.
    With capture=True, return what the cell printed."""
    hits = [s for s in CODE if marker in s]
    assert len(hits) == 1, (marker, len(hits))
    src = hits[0]
    if cut:
        assert cut in src, (marker, cut)
        src = src[: src.index(cut)]
    src = "\n".join((l[: len(l) - len(l.lstrip())] + "pass") if l.lstrip().startswith(("!", "%")) else l for l in src.split("\n"))   # no shell / magics
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf) if capture else contextlib.nullcontext():
        exec(compile(src, f"<cell {marker[:30]}>", "exec"), ns)
    if capture:
        out = buf.getvalue()
        print(out, end="")
        return out


D = {"meta": {"exported": time.strftime("%Y-%m-%d %H:%M")}}

# ============================================================ 0. setup + data
run_cell("RECOMPUTE = False")
run_cell("def seed_all")
run_cell("fancyzhx/ag_news")
run_cell("def record(")
g = ns
device = g["device"]
D["meta"]["device"] = str(device)
ag_train, ag_test = g["ag_train"], g["ag_test"]
CLASS_NAMES, NER_TAGS, IGNORE = g["CLASS_NAMES"], g["NER_TAGS"], g["IGNORE"]
tfidf = g["tfidf"]
log(f"notebook setup on {device}; AG News train {len(ag_train)} test {len(ag_test)}")
D["data"] = {"nTrain": len(ag_train), "nTest": len(ag_test), "classes": CLASS_NAMES, "nerTags": NER_TAGS,
             "example": {"text": ag_train[0]["text"], "label": int(ag_train[0]["label"])},
             "tfidf": {"accuracy": float(tfidf.accuracy), "fit_s": float(tfidf.fit_s), "representation": str(tfidf.representation)},
             "nLive": g["N_LIVE"], "nLiveTest": g["N_LIVE_TEST"]}

# ============================================================ 1. tokenizers
out_bpe = run_cell("def word_frequencies", capture=True)
out_wp = run_cell('print("WordPiece")', capture=True)
out_enc = run_cell("def merge_replay", capture=True)
out_uni = run_cell("def unigram_seed", capture=True)
out_segs = run_cell("def all_segmentations", capture=True)
toy_words, bpe_merges, wp_merges, wp_vocab, uni_logp = g["toy_words"], g["bpe_merges"], g["wp_merges"], g["wp_vocab"], g["uni_logp"]
merge_replay, wordpiece_encode, viterbi, all_segmentations = g["merge_replay"], g["wordpiece_encode"], g["viterbi"], g["all_segmentations"]
split_wordpiece, split_bpe, glue = g["split_wordpiece"], g["split_bpe"], g["glue"]
test_words, disagree = g["test_words"], g["disagree"]
log(f"toy tokenizers: {len(toy_words)} words, {len(bpe_merges)} BPE merges, {len(wp_merges)} WordPiece merges, unigram {len(uni_logp)} pieces")


def merge_counts(word_freq, merges, split):
    """Replay the training and record, for every merge, the pair count and the two unit counts at that step
    (what the page prints next to each merge). Same loop as the notebook's merge_train, without the search."""
    from collections import Counter
    words = Counter({split(w): f for w, f in word_freq.items()})
    rows = []
    for a, b in merges:
        pairs, units = Counter(), Counter()
        for word, freq in words.items():
            for u in word:
                units[u] += freq
            for x, y in zip(word, word[1:]):
                pairs[(x, y)] += freq
        rows.append([a, b, pairs[(a, b)], units[a], units[b]])
        new_words = Counter()
        for word, freq in words.items():
            out, j = [], 0
            while j < len(word):
                if j < len(word) - 1 and (word[j], word[j + 1]) == (a, b):
                    out.append(glue(a, b)); j += 2
                else:
                    out.append(word[j]); j += 1
            new_words[tuple(out)] += freq
        words = new_words
    return rows


ll_curve = [[int(l.split()[1]), int(l.split("log-likelihood")[1].replace(",", ""))] for l in out_uni.split("\n") if l.startswith("vocabulary")]
D["tok"] = {
    "toyWords": [[w, int(f)] for w, f in toy_words.items()],          # insertion order = first occurrence, as in Python
    "nToyTexts": 2000, "nWordTokens": int(sum(toy_words.values())),
    "bpeMerges": merge_counts(toy_words, bpe_merges, split_bpe),
    "wpMerges": merge_counts(toy_words, wp_merges, split_wordpiece),
    "minCount": 10,
    "testWords": list(test_words.keys()),
    "nTestWords": len(test_words), "nDisagree": len(disagree),
    "disagree": [{"word": w, "replay": merge_replay(split_wordpiece(w), wp_merges), "longest": wordpiece_encode(w, wp_vocab)} for w in disagree[:12]],
    "uniLogp": {p: round(v, 6) for p, v in uni_logp.items()},
    "uniSeed": len(g["unigram_seed"](toy_words)), "uniVocab": 1500, "llCurve": ll_curve, "maxPiece": g["MAX_PIECE"],
    "uniExamples": [{"word": w, "n": len(all_segmentations(w, uni_logp)), "viterbi": viterbi(w, uni_logp)[0], "score": round(viterbi(w, uni_logp)[1], 4)}
                    for w in ["unbelievable", "microsoft", "tokenization"]],
    "cellOut": {"bpe": out_bpe, "wp": out_wp, "enc": out_enc, "uni": out_uni, "segs": out_segs},
}
# encodings the page must reproduce (replay vs longest-match, on a fixed word list)
CHECK_WORDS = ["tokenization", "unbelievable", "1991", "tougher", "middleweight", "reuters", "microsoft", "stocks", "government", "xylophone"]
D["tok"]["encodeCheck"] = [{"word": w, "bpe": merge_replay(split_bpe(w), bpe_merges), "replay": merge_replay(split_wordpiece(w), wp_merges),
                            "longest": wordpiece_encode(w, wp_vocab), "viterbi": viterbi(w, uni_logp)[0]} for w in CHECK_WORDS]

# --- the zoo, and BERT's own WordPiece for the browser
out_zoo = run_cell("zoo = {name: AutoTokenizer", capture=True)
zoo = g["zoo"]
ZOO_TEXTS = ["Unbelievably, the tokenization of 'Sci/Tech' costs 3.5% more in 2004.", "Цены на нефть взлетели до рекордного уровня."]
D["zoo"] = {"names": list(zoo), "texts": ZOO_TEXTS, "tokens": [[tk.tokenize(t) for tk in zoo.values()] for t in ZOO_TEXTS], "cellOut": out_zoo}
bert_tok = zoo["bert-base-uncased"]
vocab = bert_tok.get_vocab()
id2tok = [None] * len(vocab)
for t, i in vocab.items():
    id2tok[i] = t
assert all(t is not None for t in id2tok)
D["bert"] = {"vocab": id2tok, "special": {"cls": bert_tok.cls_token_id, "sep": bert_tok.sep_token_id, "pad": bert_tok.pad_token_id,
                                          "mask": bert_tok.mask_token_id, "unk": bert_tok.unk_token_id}}
# texts the JS tokenizer must reproduce, tokens and character offsets
check_texts = [ag_test[i]["text"] for i in range(24)] + ZOO_TEXTS + ["Héllo wörld — naïve café, 東京, 3.5%!!", "She went to the [MASK] to buy some milk."]
D["bert"]["check"] = []
for t in check_texts:
    enc = bert_tok(t, return_offsets_mapping=True, add_special_tokens=False)
    D["bert"]["check"].append({"text": t, "tokens": bert_tok.convert_ids_to_tokens(enc["input_ids"]), "offsets": enc["offset_mapping"]})
log("zoo + BERT vocabulary exported")

# ============================================================ 2. BERT
run_cell("def set_trainable")
out_body = run_cell("body = AutoModel.from_pretrained", capture=True)
body, tokenizer, cfg, D_MODEL = g["body"], g["tokenizer"], g["cfg"], g["D"]
n_params, show_params = g["n_params"], g["show_params"]
blocks = body.encoder.layer
D["body"] = {
    "config": {"layers": cfg.num_hidden_layers, "heads": cfg.num_attention_heads, "d": cfg.hidden_size, "ffn": cfg.intermediate_size,
               "vocab": cfg.vocab_size, "maxPos": cfg.max_position_embeddings, "act": cfg.hidden_act},
    "params": {"total": n_params(body), "token_emb": n_params(body.embeddings.word_embeddings), "position_emb": n_params(body.embeddings.position_embeddings),
               "segment_emb": n_params(body.embeddings.token_type_embeddings), "encoder": n_params(body.encoder), "pooler": n_params(body.pooler),
               "block": n_params(blocks[0]), "block_attention": n_params(blocks[0].attention), "block_ffn": n_params(blocks[0].intermediate) + n_params(blocks[0].output),
               "emb_ln": n_params(body.embeddings.LayerNorm)},
    "cellOut": out_body,
}
run_cell("pos = body.embeddings.position_embeddings", cut="plt.figure")
sim = g["sim"][:128, :128].numpy()
D["body"]["posSim"] = {"n": 128, "values": f16(sim), "min": float(sim.min()), "max": float(sim.max())}

# --- MLM
run_cell("def mask_probabilities")
out_guess = run_cell("def guesses_at", capture=True)
mlm, guesses_at = g["mlm"], g["guesses_at"]
D["mlm"] = {"guesses": [], "cellOut": out_guess}
for text, word in [("She went to the [MASK] to buy some milk.", "[MASK]"), ("She went to the banana to buy some milk.", "banana"), ("She went to the store to buy some milk.", "store")]:
    s = guesses_at(text, word)
    D["mlm"]["guesses"].append({"text": text, "word": word, "top": [[p.split()[0], float(p.split()[1])] for p in s.split(", ")]})
log("MLM guesses done")

# --- zero-shot: the notebook's live cell (1 000 texts), then the whole test set over a list of candidate label words
out_zs = run_cell('PROMPT = "This news is about', capture=True)
out_zs2 = run_cell('label_words = ["politics"', capture=True)
PROMPT, mask_probabilities, zero_shot_predict = g["PROMPT"], g["mask_probabilities"], g["zero_shot_predict"]
zs = g["zs"]
CANDIDATES = ["world", "politics", "sports", "sport", "business", "technology", "tech", "science", "money", "economy", "finance", "war",
              "football", "baseball", "games", "computers", "internet", "software", "health", "music", "entertainment", "china", "iraq",
              "america", "government", "markets", "stocks", "oil", "energy", "space", "research", "religion", "terrorism", "security",
              "education", "crime", "weather", "travel", "news", "people"]
ids = tokenizer.convert_tokens_to_ids(CANDIDATES)
assert tokenizer.unk_token_id not in ids, [w for w, i in zip(CANDIDATES, ids) if i == tokenizer.unk_token_id]
t = time.time()
probs_all = mask_probabilities(mlm, tokenizer, ag_test["text"], PROMPT, device)      # [7600, V]
log(f"zero-shot: {len(ag_test)} texts through the MLM in {time.time() - t:.0f}s")
gold_all = np.array(ag_test["label"])
cand = probs_all[:, ids].numpy()                                                        # [7600, n_candidates]
top_world = zs["top_words_world"]


def zs_eval(words):
    pred = zero_shot_predict(probs_all, tokenizer, words)
    return {"words": words, "accuracy": round(float((pred == gold_all).mean()), 4), "per_class": [round(float((pred[gold_all == c] == c).mean()), 4) for c in range(4)]}


D["zeroShot"] = {
    "prompt": PROMPT, "n": len(ag_test), "candidates": CANDIDATES, "probs": f16(cand), "gold": gold_all.tolist(),
    "python": {"v1": zs_eval(["world", "sports", "business", "technology"]), "v2": zs_eval(["politics", "sports", "business", "technology"])},
    "artifact": zs, "topWorld": top_world, "cellOut": out_zs + out_zs2,
    "live": {"n": g["N_LIVE_TEST"]},
}
del probs_all
log("zero-shot exported")

# --- features: pooler / [CLS] / mean, and by layer (the notebook's live cell) + the artifact
run_cell("def encode_agnews")
out_feat = run_cell("live_train = ag_train.shuffle", capture=True)
probe = g["probe"]
live_feat = {}
for line in out_feat.split("\n"):
    for name in ["pooler", "cls", "mean"]:
        if line.startswith(name + " ") and "logreg" in line:
            live_feat[name] = float(line.split(":")[-1])
run_cell("live_by_layer = [", cut="plt.figure")
D["features"] = {"live": {"n": g["N_LIVE"], "nTest": g["N_LIVE_TEST"], "summary": live_feat, "byLayer": g["live_by_layer"]}, "artifact": probe, "cellOut": out_feat}
log(f"features: live {live_feat}, artifact {probe['summary']}")

# ============================================================ 3. the head
run_cell("class SequenceHead")
out_heads = run_cell('heads = {"sequence', capture=True)
heads = g["heads"]
D["heads"] = {"counts": {k: n_params(h) for k, h in heads.items()}, "body": n_params(body), "cellOut": out_heads}
out_inspect = run_cell("import inspect", capture=True)
D["heads"]["librarySource"] = out_inspect
run_cell("class EpochTimer")
# the load report goes through transformers' logger: catch it
tlog = logging.getLogger("transformers")
buf = io.StringIO(); h = logging.StreamHandler(buf); h.setLevel(logging.WARNING); tlog.addHandler(h)
out_untrained = run_cell("set_verbosity_warning()", capture=True)
tlog.removeHandler(h)
report = buf.getvalue()
D["heads"]["loadReport"] = report
D["heads"]["untrained"] = {"accuracy": g["acc"], "n": g["N_LIVE_TEST"], "cellOut": out_untrained}
out_train = run_cell("trainer, curves = train(model, live_tr", capture=True)
curves = g["curves"]
D["heads"]["headOnlyLive"] = {"n": g["N_LIVE"], "epochs": 1, "lr": 1e-3, "trainable": curves["trainable_params"], "accuracy": curves["accuracy"][-1], "seconds": curves["seconds"][-1]}
log(f"head only, live: {D['heads']['headOnlyLive']}")
del g["model"], g["trainer"]

# ============================================================ 4. the dial
run_cell("agnews_transfer.json")
D["transfer"] = json.load(open(f"{g['ART_DIR']}/agnews_transfer.json"))
D["stability"] = json.load(open(f"{g['ART_DIR']}/ft_stability.json"))

# ============================================================ 5. NER
run_cell("eriktks/conll2003")
run_cell("def encode_ner")
out_align = run_cell("words, tags = ner_train[4]", capture=True)
ner_train, ner_test, encode_ner = g["ner_train"], g["ner_test"], g["encode_ner"]
ex = ner_train[4]
enc = tokenizer(ex["tokens"], is_split_into_words=True)
f_first = encode_ner(tokenizer, ner_train.select([4]))[0]
f_cont = encode_ner(tokenizer, ner_train.select([4]), label_continuations=True)[0]
D["ner"] = {
    "nTrain": len(ner_train), "nTest": len(ner_test),
    "example": {"words": ex["tokens"], "tags": ex["ner_tags"], "tokens": enc.tokens(), "wordIds": enc.word_ids(), "labels": f_first["labels"], "labelsCont": f_cont["labels"]},
    "sentences": [{"words": ner_train[i]["tokens"], "tags": ner_train[i]["ner_tags"]} for i in [0, 4, 7, 12, 30, 55, 100, 210, 333, 500]],
    "cellOut": out_align,
}
out_ner_live = run_cell("ner_model = AutoModelForTokenClassification", capture=True)
ner_live = g["ner_live"]
D["ner"]["live"] = {"n": g["N_LIVE"], "nTest": g["N_LIVE_TEST"], **{k: v[-1] for k, v in ner_live.items() if isinstance(v, list) and v}, "trainable": ner_live["trainable_params"]}
log(f"NER live: {D['ner']['live']}")
del g["ner_model"], g["ner_trainer"]
D["ner"]["artifact"] = json.load(open(f"{g['ART_DIR']}/ner_curves.json"))
D["ner"]["predictions"] = json.load(open(f"{g['ART_DIR']}/ner_predictions.json"))

# ============================================================ 5.2 QA
run_cell("rajpurkar/squad")
run_cell("e = next(x for x in qa_train.select")
out_win = run_cell("windows from one question", capture=True)
run_cell("def encode_qa")
out_lab = run_cell("f = encode_qa(tokenizer, Dataset.from_dict", capture=True)
e, encode_qa, Dataset = g["e"], g["encode_qa"], g["Dataset"]
qa_train, qa_dev = g["qa_train"], g["qa_dev"]
one = Dataset.from_dict({k: [v] for k, v in e.items()})


def windows_for(max_len, stride):
    f = encode_qa(tokenizer, one, max_len=max_len, stride=stride)
    out = []
    for w in f:
        out.append({"n": len(w["input_ids"]), "start": w["start_positions"], "end": w["end_positions"],
                    "tokens": tokenizer.convert_ids_to_tokens(w["input_ids"]), "offsets": w["offset_mapping"]})
    return out


D["qa"] = {
    "nTrain": len(qa_train), "nDev": len(qa_dev),
    "dev0": {"question": qa_dev[0]["question"], "answers": qa_dev[0]["answers"], "context": qa_dev[0]["context"]},
    "example": {"id": e["id"], "question": e["question"], "context": e["context"], "answer": e["answers"]["text"][0], "answerStart": e["answers"]["answer_start"][0]},
    "windowsCheck": {f"{ml}/{st}": windows_for(ml, st) for ml, st in [(128, 32), (64, 16), (96, 48), (384, 128)]},
    "cellOut": out_win + out_lab,
}
out_qa_live = run_cell("qa_model = AutoModelForQuestionAnswering", capture=True)
qa_live = g["qa_live"]
D["qa"]["live"] = {"n": g["N_LIVE"], "nDev": g["N_LIVE_TEST"] // 2, "windows": len(g["live_qa_tr"]), **{k: v[-1] for k, v in qa_live.items() if isinstance(v, list) and v}, "trainable": qa_live["trainable_params"]}
log(f"QA live: {D['qa']['live']}")
D["qa"]["artifact"] = json.load(open(f"{g['ART_DIR']}/qa_curves.json"))
D["qa"]["predictions"] = json.load(open(f"{g['ART_DIR']}/qa_predictions.json"))

# ============================================================ 6. the results table
run_cell("ner_curves.json")
run_cell("qa_curves.json")
D["results"] = g["results"]

json.dump(D, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
log(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)")
