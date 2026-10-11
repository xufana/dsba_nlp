"""
Precompute artifacts for week 5 that take longer than ~5 minutes in Google Colab.

The rule is the same as in weeks 1–4:

    > 5 min in Colab  -> artifact, committed to week05_decoder_only/artifacts/
    < 5 min in Colab  -> run live in the notebook

The body is gpt2 (124M). Fine-tuned copies are ~500 MB each — over GitHub's file
limit — so they are NOT committed: --push sends them to the Hugging Face hub under
HUB_PREFIX, but nothing in the notebook needs them. What is committed: every number in
the two tables (quality and cost), every error breakdown, and the models' outputs on a
fixed set of demo examples, so the class can read the outputs without the weights.
`python precompute.py` recreates everything.

Data comes from the hub through `datasets` (cached under ~/.cache/huggingface):
    fancyzhx/ag_news                       AG News — the same 120 000 / 7 600 split as weeks 1 and 4
    eriktks/conll2003  (parquet branch)    CoNLL-2003, IOB2 — the same as week 4
    rajpurkar/squad                        SQuAD v1.1 — the same as week 4

Run (an M-series Mac or a GPU):
    python precompute.py                     demo sizes (the default)
    python precompute.py --full              paper-scale sizes: needs a GPU
    python precompute.py --push              also push the fine-tuned gpt2 copies to the hub (needs `hf auth login`)
    python precompute.py --only depth zero_shot
    python precompute.py --only punct typos ner qa
    python precompute.py --only rope
    python precompute.py --only demo

Steps (and what they write):
    depth       depth.json               logit lens: agreement and perplexity by layer, top tokens by layer
    zero_shot   zero_shot_gpt2.json      the decoder as a scorer on the AG News test set, three verbalizers
    punct       punct.json               punctuation + case: BERT token classification vs gpt2 rewriting
    typos       typos.json               typos: BERT detection + dictionary vs gpt2 rewriting
    ner         ner.json                 CoNLL-2003 generated in two output formats (inline / list)
    qa          qa.json                  SQuAD generated, two prompt orders (context-question / question-context)
    rope        rope.json                loss by position past the training window: gpt2 (learned table) vs
                                         pythia-160m (RoPE), extrapolated and linearly interpolated
    demo        lens.json, attention.json, zero_shot_pool.json   tensors the demo slices in the browser: the logit
                                         lens at every position of one text, one prompt's attention, and the scorer
                                         over a pool of candidate label words

Every step records its own timing (ms per 1 000 items, batch 32) on the machine it ran on;
the notebook reads `device` from the artifact and says so. Every step also prints its own
seconds and GPU peak while it runs — the run is long and the numbers are the budget.

The KV-cache A/B is *not* here: it is 71 s and 0.06 GB on an M4, so it runs live in the
notebook (`use_cache=False` against `True`, 64 to 896 new tokens). gpt2 has 1 024 positions
and the prompt takes 33 of them, so 1 024 new tokens does not fit — 896 is the last length.

--smoke runs every step on two-layer random models with 2k vocabularies trained on the
spot, on a few hundred examples and with synthetic CoNLL / SQuAD look-alikes, in a couple
of minutes on a 2-core CPU with no network — so the notebook can be executed end-to-end
before the real run. Smoke artifacts go to /tmp/dsba_nlp/week05/artifacts_smoke/.

The blocks between `# --- notebook: <name> ---` and `# --- end ---` are the same code as the
seminar notebook's definition cells — if you change one, change the other.
"""

import argparse
import json
import os
import random
import re
import string
import tempfile
import time
from collections import Counter, defaultdict
from difflib import SequenceMatcher

import numpy as np
import pandas as pd
import torch
from datasets import Dataset, load_dataset
from seqeval.metrics import f1_score as entity_f1
import transformers
from transformers import (AutoModelForCausalLM, AutoModelForTokenClassification, AutoTokenizer, BertConfig,
                          BertTokenizerFast, DataCollatorForSeq2Seq, DataCollatorForTokenClassification, GPT2Config,
                          GPT2TokenizerFast, Trainer, TrainerCallback, TrainingArguments)

transformers.logging.set_verbosity_error()
transformers.logging.disable_progress_bar()

SEED = 42
IGNORE = -100
CLASS_NAMES = ["World", "Sports", "Business", "Sci/Tech"]
NER_TAGS = ["O", "B-PER", "I-PER", "B-ORG", "I-ORG", "B-LOC", "I-LOC", "B-MISC", "I-MISC"]
HUB_PREFIX = "xufana/dsba-week05-"
N_DEMO = 20                                                   # examples whose outputs every artifact keeps verbatim
N_TIMING = 200                                                # items behind every "ms / 1 000 items"

# Padded-length caps, read off the token-length distributions rather than chosen. The collators pad to the longest
# item in the batch, so a cap only bounds the *worst* batch — but that is the batch that decides whether the step
# fits. Cut at p99.9: fewer than one item in a thousand loses a token.
#
#   task                        mean   p95   p99   p99.9   max    was    cap
#   punct/typos, BERT pieces      46    68    96     157   245    256    192
#   punct/typos, gpt2 pairs      100   160   235     367   613    384    320
#   ner, gpt2 pairs               45   102   127     169   315    384    192
#   qa, gpt2 pairs               184   326   436     536   750    768    576
MAX_WORD_LEN = 192                                            # BERT token classification, words in
MAX_PAIR_LEN = 320                                            # `stripped => original`, `noisy => clean`
MAX_NER_LEN = 192
MAX_QA_LEN = 576
PAD_MULTIPLE = 16                                             # a handful of distinct shapes instead of one per batch

# Batch sizes are half of what they were. Week 4 measured the trade on this same Mac: bert-base on 384-token SQuAD,
# batch 16 -> 10.8 GB at 11.6 examples/s, batch 8 -> 6.5 GB at 11.3 — 40% of the memory for 3% of the throughput.
BS_WORDS = 16                                                 # BERT token classification (was 32)
BS_PAIRS = 8                                                  # gpt2 rewriting (was 16)
BS_QA = 4                                                     # gpt2 on SQuAD prompts (was 8)

SIZES = {
    "demo":  {"depth": 1000, "zero_shot": 7600, "punct_train": 20_000, "punct_test": 2000, "typos_train": 20_000, "typos_test": 2000,
              "ner_train": 8000, "ner_test": 3453, "qa_train": 5000, "qa_dev": 2000, "rope_streams": 20, "rope_len": 3072, "epochs": 2},
    "full":  {"depth": 2000, "zero_shot": 7600, "punct_train": 120_000, "punct_test": 7600, "typos_train": 120_000, "typos_test": 7600,
              "ner_train": 14_041, "ner_test": 3453, "qa_train": 30_000, "qa_dev": 2000, "rope_streams": 50, "rope_len": 3072, "epochs": 2},
    "smoke": {"depth": 40, "zero_shot": 60, "punct_train": 200, "punct_test": 60, "typos_train": 200, "typos_test": 60,
              "ner_train": 120, "ner_test": 40, "qa_train": 120, "qa_dev": 40, "rope_streams": 2, "rope_len": 96, "epochs": 1},
}


def seed_all(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def log(msg):
    print(msg, flush=True)




def n_params(module, trainable_only=False):
    return sum(p.numel() for p in module.parameters() if p.requires_grad or not trainable_only)


# ----------------------------------------------------------------------------------------------------
# Shared definitions — the same code as the notebook's definition cells.
# ----------------------------------------------------------------------------------------------------

# --- notebook: text ---
def target_text(text):
    """The text we ask the models to restore: the original, minus AG News' line-break and entity artifacts ("\\", "#36;")
    and minus tokens that are punctuation only ("-", "&")."""
    text = text.replace("\\", " ").replace("#36;", "$")
    return " ".join(w for w in text.split() if re.search(r"[A-Za-z0-9]", w))


def strip_text(text):
    """What ASR hands you: lower case, no punctuation. Apostrophes stay — they are pronounced."""
    return re.sub(r"[^a-z0-9' ]", "", text.lower())
# --- end ---


# --- notebook: punct ---
CASES = ["lower", "Cap", "CAPS", "other"]
PUNCTS = ["", ",", ".", "?", "!", ":", ";", "other"]
PUNCT_LABELS = [f"{c}|{p}" for c in CASES for p in PUNCTS]           # 4 × 8 — the encoder's whole vocabulary of answers


def word_label(word):
    """`case|punct` for one original word. "other" on either side means the label set cannot express the word."""
    tail = re.search(r"[^A-Za-z0-9']*$", word).group()               # trailing punctuation: ",", ".", ")", '."'
    inner = word[:len(word) - len(tail)]
    punct = tail if tail in PUNCTS else "other"
    if re.sub(r"[^A-Za-z0-9']", "", inner) != inner:                 # punctuation inside or in front: U.S., Wal-Mart, (Reuters), 3.5
        punct = "other"
    letters = re.sub(r"[^A-Za-z]", "", inner)
    if letters == letters.lower():
        case = "lower"
    elif letters == letters.upper() and len(letters) > 1:
        case = "CAPS"
    elif letters == letters[:1].upper() + letters[1:].lower():
        case = "Cap"
    else:
        case = "other"                                                # iPhone, McDonald's, eBay
    return f"{case}|{punct}"


def apply_label(stripped, label):
    """The encoder's answer, rebuilt: the stripped word with the case and the trailing punctuation the label names."""
    case, punct = label.split("|")
    word = {"lower": stripped, "Cap": stripped[:1].upper() + stripped[1:], "CAPS": stripped.upper(), "other": stripped}[case]
    return word + (punct if punct != "other" else "")
# --- end ---


# --- notebook: align ---
def align_words(pred, gold, key=lambda w: w):
    """For every gold word, the predicted word standing in its place (None if the prediction has no such place).
    Words are paired by `key` with difflib, so a wrong case or a missing comma does not break the pairing."""
    p, g = pred.split(), gold.split()
    paired = [None] * len(g)
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, [key(w) for w in p], [key(w) for w in g], autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            paired[j1:j2] = p[i1:i2]
    return paired


def word_scores(preds, golds, key=lambda w: w):
    """Per gold word: is the paired prediction exactly right, and did the model change the word itself (fidelity)."""
    rows = []
    for pred, gold in zip(preds, golds):
        for pw, gw in zip(align_words(pred, gold, key), gold.split()):
            rows.append({"gold": gw, "pred": pw, "label": word_label(gw), "correct": pw == gw,
                         "changed": pw is not None and key(pw) != key(gw)})
    return pd.DataFrame(rows)
# --- end ---


# --- notebook: typos ---
OPS = ["sub", "del", "ins", "swap", "split", "merge"]


def add_noise(text, rate, rng):
    """Corrupt a share of the words. Returns the noisy text, one op per *gold* word ("none" if untouched), and one
    flag per *noisy* word (was it produced by an op) — the detector's labels. split and merge change the word count."""
    words, noisy, ops, flags = text.split(), [], [], []
    i = 0
    while i < len(words):
        w = words[i]
        op = rng.choice(OPS) if len(w) > 2 and rng.random() < rate else "none"
        k = rng.randrange(1, len(w) - 1) if len(w) > 2 else 0          # never the first letter — the dictionary trick needs it
        c = rng.choice(string.ascii_lowercase)
        if op == "merge" and i + 1 == len(words):
            op = "none"
        if op == "none":
            out = [w]
        elif op == "sub":
            out = [w[:k] + c + w[k + 1:]]
        elif op == "del":
            out = [w[:k] + w[k + 1:]]
        elif op == "ins":
            out = [w[:k] + c + w[k:]]
        elif op == "swap":
            out = [w[:k] + w[k + 1] + w[k] + w[k + 2:]]
        elif op == "split":
            out = [w[:k], w[k:]]
        else:
            out = [w + words[i + 1]]
            ops.append("merge")
            i += 1
        noisy += out
        ops.append(op)
        flags += [op != "none"] * len(out)
        i += 1
    return " ".join(noisy), ops, flags
# --- end ---


# --- notebook: dictionary ---
def nearest_word(word, buckets):
    """The closest dictionary word of the same first letter and about the same length — week 1's edit distance, cheap."""
    cands = [c for n in (len(word) - 1, len(word), len(word) + 1) for c in buckets.get((word[:1], n), [])]
    return max(cands, key=lambda c: SequenceMatcher(None, word, c).ratio(), default=word)
# --- end ---


# --- notebook: ner ---
def bio_spans(tags):
    """[(start, end, type)] from a BIO tag sequence; end is exclusive."""
    spans, start = [], None
    for i, t in enumerate(tags + ["O"]):
        if start is not None and not t.startswith("I-"):
            spans.append((start, i, tags[start][2:]))
            start = None
        if t.startswith("B-"):
            start = i
    return spans


def to_inline(words, tags):
    """`[LOC Germany] 's representative to the [ORG European Union]` — a copy of the sentence with brackets."""
    out, i = [], 0
    for start, end, typ in bio_spans(tags):
        out += words[i:start] + [f"[{typ} {' '.join(words[start:end])}]"]
        i = end
    return " ".join(out + words[i:])


def to_list(words, tags):
    """`Germany: LOC; European Union: ORG` — only the entities, in order. `none` when there are none."""
    return "; ".join(f"{' '.join(words[s:e])}: {t}" for s, e, t in bio_spans(tags)) or "none"
# --- end ---


# --- notebook: ner_parse ---
def parse_inline(text, words):
    """Back from the bracketed copy to BIO over the *original* words. An entity whose words are not in the sentence
    (rewritten, invented) is unmatched: it gets no tags and is counted."""
    plain, ents, cur = [], [], None                                   # plain: the generated words without brackets
    for tok in text.split():
        if re.fullmatch(r"\[(PER|ORG|LOC|MISC)", tok):
            cur = (tok[1:], len(plain))
            continue
        closing = tok.endswith("]")
        plain.append(tok.rstrip("]"))
        if closing and cur:
            ents.append((cur[1], len(plain), cur[0]))
            cur = None
    tags, unmatched = ["O"] * len(words), 0
    pairs = {}                                                        # generated index -> original index, where the words agree
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, plain, words, autojunk=False).get_opcodes():
        if tag == "equal":
            pairs.update(zip(range(i1, i2), range(j1, j2)))
    for s, e, typ in ents:
        if all(i in pairs for i in range(s, e)) and e > s:
            for k, i in enumerate(range(s, e)):
                tags[pairs[i]] = ("B-" if k == 0 else "I-") + typ
        else:
            unmatched += 1
    return tags, unmatched


def parse_list(text, words):
    """Back from `span: TYPE; ...` to BIO: each span is looked up as a contiguous piece of the sentence."""
    tags, unmatched = ["O"] * len(words), 0
    if text.strip() == "none":
        return tags, 0
    for item in text.split(";"):
        span, _, typ = item.rpartition(":")
        span, typ = span.strip().split(), typ.strip()
        hits = [i for i in range(len(words) - len(span) + 1) if span and words[i:i + len(span)] == span and tags[i] == "O"]
        if typ in ("PER", "ORG", "LOC", "MISC") and hits:
            for k in range(len(span)):
                tags[hits[0] + k] = ("B-" if k == 0 else "I-") + typ
        else:
            unmatched += 1
    return tags, unmatched
# --- end ---


# --- notebook: squad ---
def normalize_answer(s):
    """The official SQuAD normalisation: lower case, no punctuation, no articles, single spaces."""
    s = "".join(ch for ch in s.lower() if ch not in set(string.punctuation))
    return " ".join(w for w in s.split() if w not in {"a", "an", "the"})


def squad_scores(pred, golds):
    """Exact match and token F1 of one prediction against the human answers — the best over the answers."""
    p = normalize_answer(pred).split()
    em, f1 = 0.0, 0.0
    for gold in golds:
        g = normalize_answer(gold).split()
        em = max(em, float(p == g))
        common = sum((Counter(p) & Counter(g)).values())
        if common:
            prec, rec = common / len(p), common / len(g)
            f1 = max(f1, 2 * prec * rec / (prec + rec))
    return em, f1
# --- end ---


# --- notebook: pairs ---
def encode_pairs(tokenizer, prompts, targets, max_len=MAX_PAIR_LEN):
    """`prompt target<eos>` as one sequence, the loss only on the target: prompt positions are IGNORE."""
    ids, labels = [], []
    for p, t in zip(prompts, targets):
        a = tokenizer(p).input_ids
        b = tokenizer(" " + t).input_ids + [tokenizer.eos_token_id]
        ids.append((a + b)[:max_len])
        labels.append(([IGNORE] * len(a) + b)[:max_len])
    return Dataset.from_dict({"input_ids": ids, "labels": labels})
# --- end ---


# --- notebook: generation ---
PEAK = 0.0                  # the largest GPU reading any progress line has seen, in GB — reset per step


def gpu_gb():
    """What the GPU holds *right now*, in GB — reserved, cache included, so it is comparable to the device's total.
    Apple's backend has no peak counter, so PEAK is sampled here by whoever calls this."""
    global PEAK
    now = (torch.mps.driver_allocated_memory() / 1e9 if torch.backends.mps.is_available() else
           torch.cuda.memory_reserved() / 1e9 if torch.cuda.is_available() else 0.0)
    PEAK = max(PEAK, now)
    return now


def free():
    """Give the allocator's cache back. `del` the model first — this cannot reach the caller's names,
    and an `empty_cache()` with the model still referenced frees nothing."""
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()


def chunks(tag, n, size):
    """`range(0, n, size)`, plus one rewritten line with the rate, the estimate and the GPU — these loops run for minutes."""
    t0 = time.time()
    for done, i in enumerate(range(0, n, size)):
        yield i
        seen = min(i + size, n)
        if done % 10 == 9 or seen == n:
            rate = seen / max(time.time() - t0, 1e-9)
            print(f"\r  {tag} {seen:,}/{n:,}  {rate:,.0f}/s  eta {(n - seen) / rate:4.0f}s  gpu {gpu_gb():4.1f} GB   ",
                  end="", flush=True)
    print(flush=True)


@torch.no_grad()
def generate(model, tokenizer, prompts, max_new_tokens, batch_size=32):
    """Greedy, batched, left-padded. Returns the text after the prompt, up to <eos>."""
    model.eval()
    outs = []
    for i in chunks("generate", len(prompts), batch_size):
        enc = tokenizer(prompts[i:i + batch_size], return_tensors="pt", padding=True, padding_side="left").to(model.device)
        ids = model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tokenizer.eos_token_id)
        outs += tokenizer.batch_decode(ids[:, enc.input_ids.shape[1]:], skip_special_tokens=True)
    return [o.strip() for o in outs]


@torch.no_grad()
def score(model, tokenizer, prefixes, continuations, batch_size=64):
    """log P(continuation | prefix) for every prefix × continuation, as an array [n_prefixes, n_continuations, 2]:
    the sum over the continuation's tokens and the mean per token. One forward pass per pair, batched, right-padded.

    The unembedding runs only at the positions the continuation is read from. Over the whole sequence it would be
    a [64, 262, 50257] tensor of logits — 3.4 GB, twice that with the log_softmax — and on 7 600 AG News texts
    that is what filled 14.3 GB of Apple GPU memory and pushed the machine into swap."""
    model.eval()
    body = model.transformer if hasattr(model, "transformer") else model.model
    pre = [tokenizer(p).input_ids for p in prefixes]
    con = [tokenizer(c).input_ids for c in continuations]
    pairs = [(a, b) for a in pre for b in con]
    order = sorted(range(len(pairs)), key=lambda k: len(pairs[k][0]))          # like lengths together: less padding per batch
    out = np.zeros((len(pairs), 2))
    for i in chunks("score", len(pairs), batch_size):
        chunk = [pairs[k] for k in order[i:i + batch_size]]
        seqs = [a + b for a, b in chunk]
        width = max(map(len, seqs))
        ids = torch.tensor([s + [tokenizer.eos_token_id] * (width - len(s)) for s in seqs], device=model.device)
        mask = torch.tensor([[1] * len(s) + [0] * (width - len(s)) for s in seqs], device=model.device)
        h = body(input_ids=ids, attention_mask=mask).last_hidden_state                             # [B, width, d]
        rows = torch.tensor([k for k, (a, b) in enumerate(chunk) for _ in b], device=model.device)
        cols = torch.tensor([t for a, b in chunk for t in range(len(a) - 1, len(a) + len(b) - 1)], device=model.device)
        want = torch.tensor([t for a, b in chunk for t in b], device=model.device)                  # logits at t predict token t+1
        lp = model.lm_head(h[rows, cols]).log_softmax(-1).gather(1, want[:, None]).squeeze(1).cpu().numpy()
        j = 0
        for k, (a, b) in zip(order[i:i + batch_size], chunk):
            out[k] = lp[j:j + len(b)].sum(), lp[j:j + len(b)].mean()
            j += len(b)
    return out.reshape(len(prefixes), len(continuations), 2)
# --- end ---


# --- notebook: train ---
TRAINER_DIR = os.path.join(tempfile.gettempdir(), "week05_trainer")


class EpochTimer(TrainerCallback):
    """Seconds by epoch, and one rewritten line while it trains — `disable_tqdm` silences the Trainer's own bar."""
    def on_train_begin(self, args, state, control, **kw):
        self.t0, self.seconds = time.time(), []

    def on_step_end(self, args, state, control, **kw):
        if state.global_step % 20 == 0 or state.global_step == state.max_steps:
            share = state.global_step / max(state.max_steps, 1)
            done = time.time() - self.t0
            print(f"\r  step {state.global_step:,}/{state.max_steps:,}  {share:3.0%}  {done:4.0f}s  "
                  f"eta {done / max(share, 1e-9) - done:4.0f}s  gpu {gpu_gb():4.1f} GB   ", end="", flush=True)

    def on_epoch_end(self, args, state, control, **kw):
        self.seconds.append(round(time.time() - self.t0, 1))
        print(flush=True)


def train(model, train_ds, collator, epochs=2, lr=5e-5, batch_size=16, seed=SEED, quiet=True):
    """One Trainer for every fine-tune today: AdamW, 10% linear warm-up, linear decay. Returns seconds by epoch."""
    args = TrainingArguments(output_dir=TRAINER_DIR, per_device_train_batch_size=batch_size, num_train_epochs=epochs,
                             learning_rate=lr, weight_decay=0.01, warmup_steps=0.1, lr_scheduler_type="linear",
                             logging_strategy="no", save_strategy="no", report_to=[], seed=seed, disable_tqdm=quiet,
                             dataloader_pin_memory=False,          # unsupported on MPS, and it warns once per Trainer
                             train_sampling_strategy="group_by_length")   # batch width near the mean length, not the max
                                                                   # (transformers 5.x: `group_by_length` is gone)
    timer = EpochTimer()
    trainer = Trainer(model=model, args=args, train_dataset=train_ds, data_collator=collator, callbacks=[timer])
    if quiet:
        trainer.remove_callback(transformers.PrinterCallback)
    trainer.train()
    seconds = timer.seconds
    del trainer                               # AdamW keeps two fp32 copies of every parameter
    free()
    return seconds
# --- end ---


# ----------------------------------------------------------------------------------------------------
# Data
# ----------------------------------------------------------------------------------------------------

def load_agnews(smoke):
    if smoke:                                                         # the CSV from week 1 — no network in smoke mode
        w1 = os.path.join(os.path.dirname(__file__), "..", "week01_text_representations", "data")
        return {split: Dataset.from_pandas(pd.read_csv(f"{w1}/ag_news_{split}.csv", sep="\t")) for split in ["train", "test"]}
    return load_dataset("fancyzhx/ag_news")


def load_conll(smoke):
    if smoke:
        rng = random.Random(SEED)
        names, orgs, places = ["Werner Zwingmann", "Tim Cook", "Ana Gomes"], ["European Union", "Apple", "Reuters"], ["Germany", "Moscow", "Britain"]
        rows = []
        for _ in range(SIZES["smoke"]["ner_train"] + SIZES["smoke"]["ner_test"]):
            n, o, p = rng.choice(names).split(), rng.choice(orgs).split(), rng.choice(places).split()
            words = n + ["said", "on", "Wednesday"] + o + ["will", "buy", "sheepmeat", "from"] + p + ["."]
            tags = ["B-PER"] + ["I-PER"] * (len(n) - 1) + ["O"] * 3 + ["B-ORG"] + ["I-ORG"] * (len(o) - 1) + ["O"] * 4 + ["B-LOC"] + ["I-LOC"] * (len(p) - 1) + ["O"]
            rows.append({"tokens": words, "tags": tags})
        ds = Dataset.from_list(rows)
        return {"train": ds.select(range(SIZES["smoke"]["ner_train"])), "test": ds.select(range(SIZES["smoke"]["ner_train"], len(ds)))}
    ds = load_dataset("eriktks/conll2003", revision="refs/convert/parquet")
    names = ds["train"].features["ner_tags"].feature.names
    return {split: ds[split].map(lambda ex: {"tags": [names[t] for t in ex["ner_tags"]]}) for split in ["train", "test"]}


def load_squad(smoke, agnews=None):
    if smoke:
        rng = random.Random(SEED)
        rows = []
        for text in agnews["train"]["text"][:SIZES["smoke"]["qa_train"] + SIZES["smoke"]["qa_dev"]]:
            words = target_text(text).split()[:40]
            k = rng.randrange(1, max(2, len(words) - 2))
            answer = " ".join(words[k:k + 2])
            context = " ".join(words)
            rows.append({"context": context, "question": f"What follows {words[k - 1]}?",
                         "answers": {"text": [answer], "answer_start": [context.index(answer)]}})
        ds = Dataset.from_list(rows)
        return {"train": ds.select(range(SIZES["smoke"]["qa_train"])), "validation": ds.select(range(SIZES["smoke"]["qa_train"], len(ds)))}
    return load_dataset("rajpurkar/squad")


# ----------------------------------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------------------------------

def smoke_models(out_dir, agnews):
    """Two-layer random GPT-2 and BERT with 2k vocabularies trained on the spot, saved where the notebook can load them."""
    from tokenizers import ByteLevelBPETokenizer, Tokenizer, models, pre_tokenizers, trainers
    texts = agnews["train"]["text"][:5000]
    gpt_dir, bert_dir = os.path.join(out_dir, "tiny_gpt2"), os.path.join(out_dir, "tiny_bert")
    if not os.path.exists(gpt_dir):
        bpe = ByteLevelBPETokenizer()
        bpe.train_from_iterator(texts, vocab_size=2000, special_tokens=["<|endoftext|>"])
        tok = GPT2TokenizerFast(tokenizer_object=bpe._tokenizer, eos_token="<|endoftext|>", bos_token="<|endoftext|>", unk_token="<|endoftext|>")
        tok.save_pretrained(gpt_dir)
        AutoModelForCausalLM.from_config(GPT2Config(vocab_size=len(tok), n_positions=512, n_embd=64, n_layer=2, n_head=2)).save_pretrained(gpt_dir)
    if not os.path.exists(bert_dir):
        wp = Tokenizer(models.WordPiece(unk_token="[UNK]"))
        wp.pre_tokenizer = pre_tokenizers.BertPreTokenizer()
        wp.train_from_iterator(texts, trainers.WordPieceTrainer(vocab_size=2000, special_tokens=["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"]))
        tok = BertTokenizerFast(tokenizer_object=wp, do_lower_case=True)
        tok.save_pretrained(bert_dir)
        AutoModelForTokenClassification.from_config(BertConfig(vocab_size=len(tok), hidden_size=64, num_hidden_layers=2, num_attention_heads=2,
                                                               intermediate_size=128, max_position_embeddings=512)).save_pretrained(bert_dir)
    return gpt_dir, bert_dir


def load_gpt(name, device):
    tok = AutoTokenizer.from_pretrained(name)
    tok.pad_token = tok.eos_token
    return AutoModelForCausalLM.from_pretrained(name).to(device), tok


def ms_per_1000(fn, n_items):
    t = time.time()
    fn()
    return round((time.time() - t) / n_items * 1000 * 1000, 1)


def encode_words(tokenizer, sentences, labels, label_ids):
    """Token classification input: words in, one label on the first piece of each word, IGNORE on the rest.
    Words past MAX_WORD_LEN pieces are cut — under 0.1% of AG News sentences reach it."""
    enc = tokenizer(sentences, is_split_into_words=True, truncation=True, max_length=MAX_WORD_LEN)
    out = []
    for i, labs in enumerate(labels):
        prev, row = None, []
        for wid in enc.word_ids(i):
            row.append(IGNORE if wid is None or wid == prev else label_ids[labs[wid]])
            prev = wid
        out.append(row)
    return Dataset.from_dict({"input_ids": enc.input_ids, "attention_mask": enc.attention_mask, "labels": out})


@torch.no_grad()
def predict_words(model, tokenizer, sentences, id2label, batch_size=32):
    """One label per word from a token classifier: the argmax at the word's first piece."""
    model.eval()
    out = []
    for i in chunks("predict_words", len(sentences), batch_size):
        enc = tokenizer(sentences[i:i + batch_size], is_split_into_words=True, truncation=True, max_length=MAX_WORD_LEN,
                        padding=True, pad_to_multiple_of=PAD_MULTIPLE, return_tensors="pt")
        pred = model(**enc.to(model.device)).logits.argmax(-1).cpu()
        for k, sent in enumerate(sentences[i:i + batch_size]):
            prev, labs = None, []
            for j, wid in enumerate(enc.word_ids(k)):
                if wid is not None and wid != prev:
                    labs.append(id2label[pred[k, j].item()])
                prev = wid
            out.append(labs + [id2label[0]] * (len(sent) - len(labs)))          # words past max_length get the first label
    return out


ROPE_MODEL = "EleutherAI/pythia-160m"                         # RoPE, 12 x 768 like gpt2, trained at 2 048 positions


# --- notebook: rope ---
def token_streams(tokenizer, texts, n, length):
    """`n` streams of `length + 1` tokens: the texts concatenated, so every position up to `length` is a real one."""
    ids, streams = [], []
    for t in texts:
        ids += tokenizer(" " + t).input_ids
        while len(ids) >= length + 1 and len(streams) < n:
            streams.append(torch.tensor(ids[:length + 1]))
            ids = ids[length + 1:]
        if len(streams) == n:
            return streams
    raise ValueError(f"only {len(streams)} streams of {length} tokens in {len(texts)} texts")


@torch.no_grad()
def nll_by_position(model, streams):
    """Mean next-token loss at every target position 1..L, averaged over the streams — bucket it however you like."""
    total = np.zeros(len(streams[0]) - 1)
    for s in streams:
        logits = model(s[None, :-1].to(model.device)).logits[0].float()
        total += torch.nn.functional.cross_entropy(logits, s[1:].to(model.device), reduction="none").cpu().numpy()
    return (total / len(streams)).round(4).tolist()


def ppl_by_bucket(nll, bucket):
    """Perplexity per bucket of positions: [1, bucket], [bucket + 1, 2 bucket], ..."""
    nll = np.asarray(nll)
    return {int(i * bucket + bucket): float(np.exp(nll[i * bucket:(i + 1) * bucket].mean())) for i in range(len(nll) // bucket)}
# --- end ---


# ----------------------------------------------------------------------------------------------------
# Steps
# ----------------------------------------------------------------------------------------------------

def step_depth(cfg, gpt, tok, agnews, out):
    texts = [target_text(t) for t in agnews["test"]["text"][:cfg["depth"]]]
    body = gpt.transformer if hasattr(gpt, "transformer") else gpt.model
    n_layers = len(body.h)
    agree, nll, count = np.zeros(n_layers + 1), np.zeros(n_layers + 1), 0
    tops = {}
    with torch.no_grad():
        for i in chunks("depth", len(texts), 16):
            enc = tok(texts[i:i + 16], return_tensors="pt", padding=True, truncation=True, max_length=128).to(gpt.device)
            hs = gpt(**enc, output_hidden_states=True).hidden_states          # 0: embeddings, k: after block k; the last one is already through ln_f
            mask = enc.attention_mask[:, 1:].bool()
            targets = enc.input_ids[:, 1:]
            final = None
            for k in range(n_layers, -1, -1):
                h = hs[k] if k == n_layers else body.ln_f(hs[k])
                logits = gpt.lm_head(h)[:, :-1]
                if final is None:
                    final = logits.argmax(-1)
                agree[k] += ((logits.argmax(-1) == final) & mask).sum().item()
                nll[k] += (-logits.log_softmax(-1).gather(-1, targets.unsqueeze(-1)).squeeze(-1) * mask).sum().item()
                if i == 0:
                    tops[k] = [tok.decode(t) for t in logits[0, 4].topk(5).indices]      # one position of the first text, five guesses
            count += mask.sum().item()
    json.dump({"sizes": cfg["name"], "n_texts": len(texts), "n_tokens": count, "layers": list(range(n_layers + 1)),
               "agreement": (agree / count).round(4).tolist(), "perplexity": np.exp(nll / count).round(2).tolist(),
               "top5_by_layer": tops, "probe_text": texts[0], "probe_position": 5}, open(f"{out}/depth.json", "w"), indent=1)


def step_zero_shot(cfg, gpt, tok, agnews, out):
    test = agnews["test"].select(range(cfg["zero_shot"]))
    prefixes = [target_text(t) + " This news is about" for t in test["text"]]
    gold = np.array(test["label"])
    verbalizers = {"class names": [" World", " Sports", " Business", " Sci/Tech"],
                   "one token each": [" world", " sports", " business", " technology"]}
    t = time.time()
    res = {}
    for name, words in verbalizers.items():
        s = score(gpt, tok, prefixes, words)
        for how, col in [("sum", 0), ("per token", 1)]:
            pred = s[:, :, col].argmax(1)
            res[f"{name}, {how}"] = {"words": words, "tokens_per_word": [len(tok(w).input_ids) for w in words],
                                     "accuracy": round((pred == gold).mean(), 4),
                                     "per_class": {c: round((pred[gold == k] == k).mean(), 4) for k, c in enumerate(CLASS_NAMES)}}
    seconds = time.time() - t
    json.dump({"sizes": cfg["name"], "n": len(test), "prompt": "<text> This news is about", "results": res,
               "device": str(gpt.device), "ms_per_1000": round(seconds / len(test) / 2 * 1000 * 1000, 1),
               "passes_per_item": 4}, open(f"{out}/zero_shot_gpt2.json", "w"), indent=1)


def breakdown(df):
    """Word accuracy overall and by the gold word's case and punctuation category."""
    df = df.assign(case=df.label.str.split("|").str[0], punct=df.label.str.split("|").str[1].replace("", "none"))
    return {"accuracy": round(df.correct.mean(), 4), "changed": round(df.changed.mean(), 4), "n_words": len(df),
            "by_case": {"words": df.groupby("case").size().to_dict(), "accuracy": df.groupby("case").correct.mean().round(4).to_dict()},
            "by_punct": {"words": df.groupby("punct").size().to_dict(), "accuracy": df.groupby("punct").correct.mean().round(4).to_dict()}}


def step_punct(cfg, gpt, tok, agnews, out, bert_name, device, push):
    seed_all()
    train_texts = [target_text(t) for t in agnews["train"].shuffle(seed=SEED)["text"][:cfg["punct_train"]]]
    test_texts = [target_text(t) for t in agnews["test"]["text"][:cfg["punct_test"]]]
    train_x, test_x = [strip_text(t) for t in train_texts], [strip_text(t) for t in test_texts]
    art = {"sizes": cfg["name"], "n_train": len(train_texts), "n_test": len(test_texts), "device": str(device), "labels": PUNCT_LABELS}

    labels = [[word_label(w) for w in t.split()] for t in test_texts]
    flat = [l for row in labels for l in row]
    art["ceiling"] = {"unexpressible": round(np.mean(["other" in l for l in flat]), 4),
                      "by_label": {k: round(v / len(flat), 4) for k, v in Counter(flat).most_common()}}

    # encoder: token classification, one of 32 labels on the first piece of every word
    label_ids = {l: i for i, l in enumerate(PUNCT_LABELS)}
    btok = AutoTokenizer.from_pretrained(bert_name)
    enc_model = AutoModelForTokenClassification.from_pretrained(bert_name, num_labels=len(PUNCT_LABELS), ignore_mismatched_sizes=True).to(device)
    train_ds = encode_words(btok, [t.split() for t in train_x], [[word_label(w) for w in t.split()] for t in train_texts], label_ids)
    seconds = train(enc_model, train_ds, DataCollatorForTokenClassification(btok, pad_to_multiple_of=PAD_MULTIPLE),
                    epochs=cfg["epochs"], lr=5e-5, batch_size=BS_WORDS)
    pred_labels = predict_words(enc_model, btok, [t.split() for t in test_x], PUNCT_LABELS)
    enc_preds = [" ".join(apply_label(w, l) for w, l in zip(x.split(), labs)) for x, labs in zip(test_x, pred_labels)]
    art["encoder"] = {**breakdown(word_scores(enc_preds, test_texts, key=strip_text)), "seconds": seconds, "params": n_params(enc_model),
                      "passes_per_item": 1, "ms_per_1000": ms_per_1000(lambda: predict_words(enc_model, btok, [t.split() for t in test_x[:N_TIMING]], PUNCT_LABELS), N_TIMING)}
    del enc_model
    free()

    # decoder: rewrite. `stripped => original`
    prompts = [x + " =>" for x in train_x]
    seconds = train(gpt, encode_pairs(tok, prompts, train_texts), DataCollatorForSeq2Seq(tok, pad_to_multiple_of=PAD_MULTIPLE),
                    epochs=cfg["epochs"], lr=5e-5, batch_size=BS_PAIRS)
    test_prompts = [x + " =>" for x in test_x]
    max_new = 8 if cfg["name"] == "smoke" else 160
    dec_preds = generate(gpt, tok, test_prompts, max_new_tokens=max_new)
    art["decoder"] = {**breakdown(word_scores(dec_preds, test_texts, key=strip_text)), "seconds": seconds, "params": n_params(gpt),
                      "passes_per_item": "T_out", "ms_per_1000": ms_per_1000(lambda: generate(gpt, tok, test_prompts[:N_TIMING], max_new_tokens=max_new), N_TIMING)}
    art["demo"] = [{"input": test_x[i], "gold": test_texts[i], "encoder": enc_preds[i], "decoder": dec_preds[i]} for i in range(N_DEMO)]
    json.dump(art, open(f"{out}/punct.json", "w"), indent=1)
    if push:
        gpt.push_to_hub(HUB_PREFIX + "punct")
        tok.push_to_hub(HUB_PREFIX + "punct")


def step_typos(cfg, gpt, tok, agnews, out, bert_name, device, push):
    seed_all()
    rng = random.Random(SEED)
    train_texts = [target_text(t) for t in agnews["train"].shuffle(seed=SEED)["text"][:cfg["typos_train"]]]
    test_texts = [target_text(t) for t in agnews["test"]["text"][:cfg["typos_test"]]]
    train_noisy = [add_noise(t, 0.1, rng) for t in train_texts]
    test_noisy = [add_noise(t, 0.1, rng) for t in test_texts]
    art = {"sizes": cfg["name"], "n_train": len(train_texts), "n_test": len(test_texts), "device": str(device), "rate": 0.1}

    def by_op(preds):
        rows = [{"op": op, "correct": pw == gw}
                for pred, gold, (_, ops, _) in zip(preds, test_texts, test_noisy)
                for pw, gw, op in zip(align_words(pred, gold), gold.split(), ops)]
        df = pd.DataFrame(rows)
        return {"accuracy": round(df.correct.mean(), 4),
                "by_op": {"words": df.groupby("op").size().to_dict(), "accuracy": df.groupby("op").correct.mean().round(4).to_dict()}}

    # encoder: detect the wrong words, then the nearest dictionary word
    btok = AutoTokenizer.from_pretrained(bert_name)
    enc_model = AutoModelForTokenClassification.from_pretrained(bert_name, num_labels=2, ignore_mismatched_sizes=True).to(device)
    train_ds = encode_words(btok, [n.split() for n, _, _ in train_noisy], [["wrong" if f else "ok" for f in flags] for _, _, flags in train_noisy], {"ok": 0, "wrong": 1})
    seconds = train(enc_model, train_ds, DataCollatorForTokenClassification(btok, pad_to_multiple_of=PAD_MULTIPLE),
                    epochs=cfg["epochs"], lr=5e-5, batch_size=BS_WORDS)
    vocab = Counter(w for t in train_texts for w in t.split())
    buckets = defaultdict(list)
    for w, _ in vocab.most_common(30_000):
        buckets[(w[:1], len(w))].append(w)
    flags = predict_words(enc_model, btok, [n.split() for n, _, _ in test_noisy], ["ok", "wrong"])
    gold_flags = [f for _, _, fl in test_noisy for f in fl]
    pred_flags = [f == "wrong" for row in flags for f in row]
    tp = sum(p and g for p, g in zip(pred_flags, gold_flags))
    enc_preds = [" ".join(nearest_word(w, buckets) if f == "wrong" else w for w, f in zip(n.split(), fl)) for (n, _, _), fl in zip(test_noisy, flags)]
    art["encoder"] = {**by_op(enc_preds), "detection_precision": round(tp / max(sum(pred_flags), 1), 4), "detection_recall": round(tp / max(sum(gold_flags), 1), 4),
                      "seconds": seconds, "params": n_params(enc_model), "passes_per_item": 1,
                      "ms_per_1000": ms_per_1000(lambda: predict_words(enc_model, btok, [n.split() for n, _, _ in test_noisy[:N_TIMING]], ["ok", "wrong"]), N_TIMING)}
    del enc_model
    free()

    # decoder: rewrite. `noisy => clean`
    seconds = train(gpt, encode_pairs(tok, [n + " =>" for n, _, _ in train_noisy], train_texts),
                    DataCollatorForSeq2Seq(tok, pad_to_multiple_of=PAD_MULTIPLE), epochs=cfg["epochs"], lr=5e-5, batch_size=BS_PAIRS)
    test_prompts = [n + " =>" for n, _, _ in test_noisy]
    max_new = 8 if cfg["name"] == "smoke" else 160
    dec_preds = generate(gpt, tok, test_prompts, max_new_tokens=max_new)
    art["decoder"] = {**by_op(dec_preds), "seconds": seconds, "params": n_params(gpt), "passes_per_item": "T_out",
                      "ms_per_1000": ms_per_1000(lambda: generate(gpt, tok, test_prompts[:N_TIMING], max_new_tokens=max_new), N_TIMING)}
    art["demo"] = [{"input": test_noisy[i][0], "ops": test_noisy[i][1], "gold": test_texts[i], "encoder": enc_preds[i], "decoder": dec_preds[i]} for i in range(N_DEMO)]
    json.dump(art, open(f"{out}/typos.json", "w"), indent=1)
    if push:
        gpt.push_to_hub(HUB_PREFIX + "typos")
        tok.push_to_hub(HUB_PREFIX + "typos")


def step_ner(cfg, gpt_name, device, conll, out, push):
    train_ds, test_ds = conll["train"].select(range(cfg["ner_train"])), conll["test"].select(range(cfg["ner_test"]))
    art = {"sizes": cfg["name"], "n_train": len(train_ds), "n_test": len(test_ds), "device": str(device), "formats": {}}
    gold_tags = list(test_ds["tags"])
    n_gold = sum(len(bio_spans(t)) for t in gold_tags)
    for fmt, encode, parse in [("inline", to_inline, parse_inline), ("list", to_list, parse_list)]:
        seed_all()
        gpt, tok = load_gpt(gpt_name, device)
        prompts = [" ".join(w) + " =>" for w in train_ds["tokens"]]
        targets = [encode(w, t) for w, t in zip(train_ds["tokens"], train_ds["tags"])]
        seconds = train(gpt, encode_pairs(tok, prompts, targets, max_len=MAX_NER_LEN),
                        DataCollatorForSeq2Seq(tok, pad_to_multiple_of=PAD_MULTIPLE), epochs=cfg["epochs"], lr=5e-5, batch_size=BS_PAIRS)
        test_prompts = [" ".join(w) + " =>" for w in test_ds["tokens"]]
        max_new = 8 if cfg["name"] == "smoke" else (120 if fmt == "inline" else 60)
        preds = generate(gpt, tok, test_prompts, max_new_tokens=max_new)
        parsed = [parse(p, w) for p, w in zip(preds, test_ds["tokens"])]
        pred_tags = [t for t, _ in parsed]
        unmatched = sum(u for _, u in parsed)
        pred_spans = [set(bio_spans(t)) for t in pred_tags]
        gold_spans = [set(bio_spans(t)) for t in gold_tags]
        n_pred = sum(len(s) for s in pred_spans) + unmatched
        wrong_type = sum(1 for ps, gs in zip(pred_spans, gold_spans) for (s, e, t) in ps if any((s, e) == (gs_s, gs_e) and t != gt for gs_s, gs_e, gt in gs))
        art["formats"][fmt] = {"entity_f1": round(entity_f1(gold_tags, pred_tags), 4),
                               "f1_by_type": {typ: round(entity_f1([[x if x.endswith(typ) else "O" for x in t] for t in gold_tags],
                                                                   [[x if x.endswith(typ) else "O" for x in t] for t in pred_tags]), 4) for typ in ["PER", "ORG", "LOC", "MISC"]},
                               "n_gold_entities": n_gold, "n_pred_entities": n_pred, "unmatched": unmatched, "unmatched_share": round(unmatched / max(n_pred, 1), 4),
                               "wrong_type": wrong_type, "wrong_type_share": round(wrong_type / max(n_pred, 1), 4),
                               "tokens_written_mean": round(float(np.mean([len(tok(p).input_ids) for p in preds])), 1),
                               "seconds": seconds, "params": n_params(gpt), "passes_per_item": "T_out",
                               "ms_per_1000": ms_per_1000(lambda: generate(gpt, tok, test_prompts[:N_TIMING], max_new_tokens=max_new), min(N_TIMING, len(test_prompts))),
                               "demo": [{"words": test_ds["tokens"][i], "gold": gold_tags[i], "generated": preds[i], "pred": pred_tags[i]} for i in range(N_DEMO)]}
        if push:
            gpt.push_to_hub(HUB_PREFIX + "ner-" + fmt)
            tok.push_to_hub(HUB_PREFIX + "ner-" + fmt)
        del gpt, tok                          # the next format loads its own copy — two gpt2 + AdamW do not fit a T4
        free()
    json.dump(art, open(f"{out}/ner.json", "w"), indent=1)


def step_qa(cfg, gpt_name, device, squad, out, push):
    train_ds, dev_ds = squad["train"].select(range(cfg["qa_train"])), squad["validation"].select(range(cfg["qa_dev"]))
    art = {"sizes": cfg["name"], "n_train": len(train_ds), "n_dev": len(dev_ds), "device": str(device), "orders": {}}
    orders = {"context, question": lambda c, q: f"{c}\nQuestion: {q}\nAnswer:", "question, context": lambda c, q: f"Question: {q}\n{c}\nAnswer:"}
    for name, prompt in orders.items():
        seed_all()
        gpt, tok = load_gpt(gpt_name, device)
        prompts = [prompt(c, q) for c, q in zip(train_ds["context"], train_ds["question"])]
        targets = [a["text"][0] for a in train_ds["answers"]]
        max_len = 128 if cfg["name"] == "smoke" else MAX_QA_LEN
        seconds = train(gpt, encode_pairs(tok, prompts, targets, max_len=max_len),
                        DataCollatorForSeq2Seq(tok, pad_to_multiple_of=PAD_MULTIPLE), epochs=cfg["epochs"], lr=5e-5, batch_size=BS_QA)
        dev_prompts = [prompt(c, q) for c, q in zip(dev_ds["context"], dev_ds["question"])]
        preds = generate(gpt, tok, dev_prompts, max_new_tokens=6 if cfg["name"] == "smoke" else 24, batch_size=16)
        scores = np.array([squad_scores(p, a["text"]) for p, a in zip(preds, dev_ds["answers"])])
        not_substring = np.mean([normalize_answer(p) not in normalize_answer(c) for p, c in zip(preds, dev_ds["context"])])
        art["orders"][name] = {"exact_match": round(100 * scores[:, 0].mean(), 2), "f1": round(100 * scores[:, 1].mean(), 2),
                               "not_substring": round(float(not_substring), 4), "seconds": seconds, "params": n_params(gpt), "passes_per_item": "T_out",
                               "tokens_read_mean": round(float(np.mean([len(tok(p).input_ids) for p in dev_prompts])), 1),
                               "ms_per_1000": ms_per_1000(lambda: generate(gpt, tok, dev_prompts[:N_TIMING], max_new_tokens=24, batch_size=16), min(N_TIMING, len(dev_prompts))),
                               "demo": [{"context": dev_ds["context"][i], "question": dev_ds["question"][i], "gold": dev_ds["answers"][i]["text"], "pred": preds[i]} for i in range(N_DEMO)]}
        if push:
            gpt.push_to_hub(HUB_PREFIX + "qa-" + ("cq" if name.startswith("context") else "qc"))
            tok.push_to_hub(HUB_PREFIX + "qa-" + ("cq" if name.startswith("context") else "qc"))
        del gpt, tok                          # same here
        free()
    json.dump(art, open(f"{out}/qa.json", "w"), indent=1)


# ----------------------------------------------------------------------------------------------------

def step_rope(cfg, gpt_name, device, agnews, out, smoke):
    """Loss by position for a learned table (gpt2, 1 024 rows) and for RoPE (pythia-160m, trained at 2 048):
    the RoPE model run past its window as trained (extrapolation) and with positions squeezed into the window
    (linear interpolation, /u/kaiokendev 2023, Chen et al. 2023) — no fine-tuning either way."""
    from transformers import GPTNeoXConfig, GPTNeoXForCausalLM
    texts = [target_text(t) for t in agnews["test"]["text"]]
    length = cfg["rope_len"]
    art = {"sizes": cfg["name"], "n_streams": cfg["rope_streams"], "stream_len": length, "device": str(device), "models": {}}

    gpt, tok = load_gpt(gpt_name, device)
    window = gpt.config.n_positions
    streams = token_streams(tok, texts, cfg["rope_streams"], min(length, window))
    t = time.time()
    nll = nll_by_position(gpt, streams)
    try:                                                            # on CPU: MPS raises asynchronously, at the *next* op
        gpt.cpu()(torch.zeros(1, window + 1, dtype=torch.long))
        error = None
    except Exception as e:                                          # the table has no row for position `window`
        error = f"{type(e).__name__}: {str(e).splitlines()[0][:160]}"
    art["models"]["gpt2, learned table"] = {"name": gpt_name, "positions": "learned", "window": window, "params": n_params(gpt),
                                            "nll_by_position": nll, "error_past_window": error}
    log(f"    gpt2: {len(streams)} streams x {min(length, window)} tokens, {time.time() - t:.0f}s;  past the window: {error}")
    del gpt
    free()

    if smoke:
        rtok = tok
        rcfg = GPTNeoXConfig(vocab_size=len(tok), hidden_size=64, num_hidden_layers=2, num_attention_heads=2, intermediate_size=128,
                             max_position_embeddings=length // 2, rope_parameters={"rope_type": "default", "rope_theta": 10000.0, "partial_rotary_factor": 0.25})
        base = GPTNeoXForCausalLM(rcfg)
    else:
        rtok = AutoTokenizer.from_pretrained(ROPE_MODEL)
        rcfg = GPTNeoXConfig.from_pretrained(ROPE_MODEL)
        base = None
    window = rcfg.max_position_embeddings
    streams = token_streams(rtok, texts, cfg["rope_streams"], length)
    factor = length / window
    for label, rope in [("pythia-160m, RoPE, extrapolated", {"rope_type": "default"}),
                        (f"pythia-160m, RoPE, interpolated x{factor:g}", {"rope_type": "linear", "factor": factor}),
                        (f"pythia-160m, RoPE, YaRN x{factor:g}", {"rope_type": "yarn", "factor": factor, "original_max_position_embeddings": window})]:
        t = time.time()
        rcfg.rope_parameters = {k: v for k, v in rcfg.rope_parameters.items() if k in ("rope_theta", "partial_rotary_factor")} | rope
        model = (GPTNeoXForCausalLM(rcfg) if smoke else GPTNeoXForCausalLM.from_pretrained(ROPE_MODEL, config=rcfg)).to(device).eval()
        if smoke and base is not None:
            model.load_state_dict(base.state_dict())
        inv0 = model.gpt_neox.rotary_emb.inv_freq[0].item()
        art["models"][label] = {"name": ROPE_MODEL, "positions": "RoPE", "window": window, "params": n_params(model),
                                "rope": rcfg.rope_parameters, "inv_freq_0": inv0, "nll_by_position": nll_by_position(model, streams)}
        log(f"    {label}: inv_freq[0] {inv0:.4f}, {time.time() - t:.0f}s, gpu {gpu_gb():.1f} GB")
        del model
        free()
    json.dump(art, open(f"{out}/rope.json", "w"), indent=1)


POOL_WORDS = [" World", " Sports", " Business", " Sci/Tech", " world", " sports", " business", " technology", " politics", " news",
              " war", " government", " sport", " football", " games", " money", " economy", " markets", " finance", " companies",
              " science", " computers", " tech", " software", " internet", " health", " entertainment", " people", " international",
              " stocks", " baseball", " military"]


def step_demo(cfg, gpt, tok, agnews, out):
    """Three tensors for the demo page. lens: top-5 guesses at every layer for every position of one text.
    attention: every layer and head for one prompt + 20 generated tokens, as uint8. pool: the scorer's summed
    log-prob for every text x every candidate label word, so a verbalizer can be assembled in the browser."""
    import base64
    body = gpt.transformer if hasattr(gpt, "transformer") else gpt.model
    n_layers = len(body.h)
    texts = [target_text(t) for t in agnews["test"]["text"][:cfg["zero_shot"]]]

    # --- logit lens, every position of the first text
    enc = tok(texts[0], return_tensors="pt").to(gpt.device)
    with torch.no_grad():
        hs = gpt(**enc, output_hidden_states=True).hidden_states
        layers = []
        for k in range(n_layers + 1):
            probs = gpt.lm_head(hs[k] if k == n_layers else body.ln_f(hs[k]))[0].softmax(-1)      # [T, V]
            p, ix = probs.topk(5, -1)
            layers.append([[(tok.decode(t), round(float(q), 4)) for t, q in zip(ix[i], p[i])] for i in range(ix.shape[0])])
    ids = enc.input_ids[0].tolist()
    json.dump({"sizes": cfg["name"], "text": texts[0], "tokens": [tok.decode(t) for t in ids], "n_layers": n_layers,
               "top5": [[layers[k][i] for k in range(n_layers + 1)] for i in range(len(ids))]},        # [T, layers, 5]
              open(f"{out}/lens.json", "w"), ensure_ascii=False)
    log(f"    lens: {len(ids)} positions x {n_layers + 1} layers")

    # --- attention on one prompt, as in the notebook's 1.3
    prompt = " ".join(texts[1].split()[:20])
    enc = tok(prompt, return_tensors="pt").to(gpt.device)
    with torch.no_grad():
        ids = gpt.generate(**enc, max_new_tokens=20, do_sample=False, pad_token_id=tok.eos_token_id)
        att = torch.stack(gpt(ids, output_attentions=True).attentions)[:, 0]                       # [layers, heads, T, T]
    P, T = enc.input_ids.shape[1], ids.shape[1]
    u8 = (att.clamp(0, 1) * 255).round().to(torch.uint8).cpu().numpy()
    json.dump({"sizes": cfg["name"], "prompt": prompt, "tokens": [tok.decode(t) for t in ids[0].tolist()], "n_prompt": P, "T": T,
               "shape": list(u8.shape), "dtype": "uint8", "scale": 255,
               "to_prompt": [round(float(a[:, P:, :P].sum(-1).mean()), 4) for a in att.cpu()],
               "to_first": [round(float(a[:, P:, 0].mean()), 4) for a in att.cpu()],
               "data": base64.b64encode(u8.tobytes()).decode()}, open(f"{out}/attention.json", "w"))
    log(f"    attention: {u8.shape}, {u8.nbytes / 1e3:.0f} KB raw")

    # --- the scorer over a pool of label words
    prefixes = [t + " This news is about" for t in texts]
    gold = agnews["test"]["label"][:len(texts)]
    words = POOL_WORDS if cfg["name"] != "smoke" else POOL_WORDS[:6]
    t = time.time()
    s = score(gpt, tok, prefixes, words)                                                          # [N, W, 2]
    sums = s[:, :, 0]
    n_tok = [len(tok(w).input_ids) for w in words]
    check = (sums[:, [words.index(w) for w in [" world", " sports", " business", " technology"]]].argmax(1) == np.array(gold)).mean() \
        if all(w in words for w in [" world", " sports", " business", " technology"]) else None
    json.dump({"sizes": cfg["name"], "n": len(texts), "prompt": "<text> This news is about", "words": words, "tokens_per_word": n_tok,
               "gold": [int(g) for g in gold], "class_names": CLASS_NAMES, "sum_logprob": np.round(sums, 3).tolist(),
               "check_one_token_each": None if check is None else round(float(check), 4), "device": str(gpt.device),
               "seconds": round(time.time() - t, 1)}, open(f"{out}/zero_shot_pool.json", "w"))
    log(f"    pool: {len(texts)} texts x {len(words)} words, {time.time() - t:.0f}s; one-token-each accuracy from the pool: {check}")


STEPS = ["depth", "zero_shot", "punct", "typos", "ner", "qa", "rope", "demo"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--only", nargs="+", choices=STEPS, default=STEPS)
    ap.add_argument("--cpu", action="store_true", help="ignore the GPU (when the machine is short of memory)")
    args = ap.parse_args()
    tier = "full" if args.full else "smoke" if args.smoke else "demo"
    cfg = {"name": tier, **SIZES[tier]}
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join("/tmp/dsba_nlp", os.path.basename(here)[:6], "artifacts_smoke") if args.smoke else os.path.join(here, "artifacts")
    os.makedirs(out, exist_ok=True)
    device = torch.device("cpu" if args.cpu else "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    budget = (torch.mps.recommended_max_memory() / 1e9 if device.type == "mps" else
              torch.cuda.get_device_properties(0).total_memory / 1e9 if device.type == "cuda" else 0.0)
    log(f"tier {tier}, device {device}, steps {args.only}" + (f", GPU budget {budget:.1f} GB" if budget else ""))

    agnews = load_agnews(args.smoke)
    gpt_name, bert_name = smoke_models(out, agnews) if args.smoke else ("gpt2", "bert-base-uncased")
    for step in args.only:
        t, _ = time.time(), globals().__setitem__("PEAK", 0.0)
        log(f"--- {step}  ({', '.join(f'{k} {v:,}' for k, v in SIZES[tier].items() if k.startswith(step[:4]) or k == 'epochs')})")
        if step in ("depth", "zero_shot", "demo"):
            gpt, tok = load_gpt(gpt_name, device)
            if step == "demo":
                gpt.config._attn_implementation = "eager"                     # attention weights are read
                gpt, tok = AutoModelForCausalLM.from_pretrained(gpt_name, attn_implementation="eager").to(device), tok
            {"depth": step_depth, "zero_shot": step_zero_shot, "demo": step_demo}[step](cfg, gpt, tok, agnews, out)
        elif step == "punct":
            gpt, tok = load_gpt(gpt_name, device)
            step_punct(cfg, gpt, tok, agnews, out, bert_name, device, args.push)
        elif step == "typos":
            gpt, tok = load_gpt(gpt_name, device)
            step_typos(cfg, gpt, tok, agnews, out, bert_name, device, args.push)
        elif step == "ner":
            step_ner(cfg, gpt_name, device, load_conll(args.smoke), out, args.push)
        elif step == "qa":
            step_qa(cfg, gpt_name, device, load_squad(args.smoke, agnews), out, args.push)
        elif step == "rope":
            step_rope(cfg, gpt_name, device, agnews, out, args.smoke)
        gpu_gb()
        log(f"    {step}: {time.time() - t:.0f}s, GPU peak {PEAK:.1f} GB")
        free()


if __name__ == "__main__":
    main()
