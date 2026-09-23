"""
Precompute artifacts for week 4 that take longer than ~5 minutes in Google Colab.

The rule is the same as in weeks 1–3:

    > 5 min in Colab  -> artifact, committed to week04_pretraining_transfer/artifacts/
    < 5 min in Colab  -> run live in the notebook

The pretrained body is bert-base-uncased (110M parameters), downloaded once from the
Hugging Face hub. Fully fine-tuned copies of it are ~220 MB each in fp16 — over
GitHub's file limit — so they are NOT committed. What is committed: every curve,
every number in the results tables, the tiny task heads (a single Linear each) and the
fine-tuned models' predictions on a fixed set of demo examples, so the class can read
the outputs without re-training. `python precompute.py` recreates everything.

Data comes from the hub through `datasets` (cached under ~/.cache/huggingface):
    fancyzhx/ag_news                       AG News — the same 120 000 / 7 600 split as week 1's CSV
    eriktks/conll2003  (parquet branch)    CoNLL-2003 (Tjong Kim Sang & De Meulder 2003), IOB2
    rajpurkar/squad                        SQuAD v1.1 (Rajpurkar et al. 2016)

Run (an M-series Mac or a GPU):
    python precompute.py                     demo sizes (the default): ~1 h on an 18 GB M-series Mac, peak ~7 GB
    python precompute.py --full              paper-scale sizes: ~3 h and ~13 GB at the peak — a GPU, or a Mac with nothing else open
    python precompute.py --only zero_shot features
    python precompute.py --only agnews_ft stability
    python precompute.py --only ner qa

Steps (and what they write):
    zero_shot   zero_shot.json           MLM zero-shot on the AG News test set, two label sets
    features    features_probe.json      pooler / [CLS] / mean-pool features + logreg; a linear probe per layer
    agnews_ft   agnews_transfer.json     head-only / top-2 / top-6 / full fine-tuning on AG News
    stability   ft_stability.json        full fine-tuning on 1 000 examples, 3 seeds x 2 learning rates
    ner         ner_head.pt, ner_curves.json, ner_predictions.json
    qa          qa_head.pt, qa_curves.json, qa_predictions.json

The two size tiers are in SIZES below, next to the measurements they come from. "demo" keeps every
experiment and every comparison and only cuts the number of training examples; the artifacts
record their own n_train, and the notebook reads it from there.

--smoke runs every step on a two-layer random BERT with a 2k WordPiece vocabulary
trained on the spot and on a few hundred examples, in a couple of minutes on a 2-core
CPU, so the notebook can be executed end-to-end before the real run. Smoke artifacts go
to artifacts_smoke/; never commit them.

The blocks between `# --- notebook: <name> ---` and `# --- end ---` are the same code as the
seminar notebook's definition cells — if you change one, change the other.
"""

import argparse
import json
import os
import random
import tempfile
import time
import warnings
from collections import Counter

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader

import evaluate
from datasets import Dataset, concatenate_datasets, load_dataset
import transformers
from transformers import (AutoModel, AutoModelForMaskedLM, AutoModelForQuestionAnswering,
                          AutoModelForSequenceClassification, AutoModelForTokenClassification, AutoTokenizer,
                          DataCollatorForTokenClassification, DataCollatorWithPadding, Trainer, TrainerCallback,
                          TrainingArguments)

warnings.filterwarnings("ignore")
transformers.logging.set_verbosity_error()      # no load reports: the MLM head being dropped is expected

# --- notebook: setup ---
SEED = 42


def seed_all(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def log(msg):
    print(msg, flush=True)


def n_params(module, trainable_only=False):
    return sum(p.numel() for p in module.parameters() if p.requires_grad or not trainable_only)


def show_params(label, module, **parts):
    """One line: `module`'s parameters, split into the named parts. What is left over is "other"."""
    total = n_params(module)
    counts = {name: sum(n_params(m) for m in (part if isinstance(part, (list, tuple)) else [part]))
              for name, part in parts.items()}
    counts["other"] = total - sum(counts.values())
    split = "   ".join(f"{name} {k:,} ({k / total:.1%})" for name, k in counts.items() if k)
    print(f"{label}: {total:,} parameters   |   {split}")


def check(label, ok):
    print(("✓ " if ok else "✗ ") + label)


IGNORE = -100          # the label PyTorch's cross_entropy skips — used for padding, special tokens, word continuations
CLASS_NAMES = ["World", "Sports", "Business", "Sci/Tech"]
NER_TAGS = ["O", "B-PER", "I-PER", "B-ORG", "I-ORG", "B-LOC", "I-LOC", "B-MISC", "I-MISC"]     # CoNLL-2003, BIO — 3.5
# --- end ---


# --- notebook: body ---
# PyTorch's fused attention kernel on Apple GPUs (MPS) cannot apply dropout, and BERT's attention has 10% of it
# in training — so there every `from_pretrained` below asks for the plain ("eager") implementation; on CUDA the fused one stays.
ATTN = "eager" if torch.backends.mps.is_available() and not torch.cuda.is_available() else None


def set_trainable(model, top_blocks):
    """Freeze the pretrained body inside `model` (whatever `AutoModelFor*` put it in: `model.base_model`),
    then unfreeze its top `top_blocks` encoder blocks. 0 -> only the head trains; "all" -> everything,
    embeddings included. The pooler sits above the last block, so it moves whenever any block does."""
    body = model.base_model
    for p in body.parameters():
        p.requires_grad = top_blocks == "all"
    if top_blocks != "all" and top_blocks > 0:
        for block in body.encoder.layer[len(body.encoder.layer) - top_blocks:]:
            for p in block.parameters():
                p.requires_grad = True
        if getattr(body, "pooler", None) is not None:
            for p in body.pooler.parameters():
                p.requires_grad = True
    return model
# --- end ---


# --- notebook: heads ---
class SequenceHead(nn.Module):
    """[B, L, d] -> [B, C].  One vector per text — the [CLS] position — then one Linear.
    Softmax (inside the loss) runs over C: "which class is this text"."""

    def __init__(self, d, n_classes, dropout=0.1):
        super().__init__()
        self.drop = nn.Dropout(dropout)
        self.linear = nn.Linear(d, n_classes)

    def forward(self, H, attention_mask=None):
        return self.linear(self.drop(H[:, 0]))                  # [B, d] -> [B, C]


class TokenHead(nn.Module):
    """[B, L, d] -> [B, L, C].  The same Linear at every position.
    Softmax runs over C, separately at each position: "which tag is this token"."""

    def __init__(self, d, n_classes, dropout=0.1):
        super().__init__()
        self.drop = nn.Dropout(dropout)
        self.linear = nn.Linear(d, n_classes)

    def forward(self, H, attention_mask=None):
        return self.linear(self.drop(H))                        # [B, L, d] -> [B, L, C]


class SpanHead(nn.Module):
    """[B, L, d] -> two [B, L].  A Linear with two outputs at every position: a start score and
    an end score. Softmax runs over L — over positions — "which token starts the answer"."""

    def __init__(self, d, dropout=0.0):
        super().__init__()
        self.drop = nn.Dropout(dropout)
        self.linear = nn.Linear(d, 2)

    def forward(self, H, attention_mask=None):
        start, end = self.linear(self.drop(H)).unbind(-1)       # [B, L, 2] -> [B, L], [B, L]
        return start, end


def sequence_loss(logits, labels):
    return F.cross_entropy(logits, labels)                                   # normalises over the last axis: C

def token_loss(logits, labels):
    return F.cross_entropy(logits.flatten(0, 1), labels.flatten(), ignore_index=IGNORE)   # over C, at every kept position

def span_loss(scores, labels):
    start, end = scores                                                      # each [B, L]
    return (F.cross_entropy(start, labels[:, 0]) + F.cross_entropy(end, labels[:, 1])) / 2   # over L: the "classes" are positions
# --- end ---


# --- notebook: train ---
TRAINER_DIR = os.path.join(tempfile.gettempdir(), "week04_trainer")     # Trainer wants a directory even when it saves nothing


class EpochTimer(TrainerCallback):
    """Seconds since the start of training at the end of every epoch — the "bill" column of the tables."""

    def on_train_begin(self, args, state, control, **kw):
        self.t0, self.seconds = time.time(), []

    def on_epoch_end(self, args, state, control, **kw):
        self.seconds.append(round(time.time() - self.t0, 1))


def train(model, train_ds, eval_ds, collator, compute_metrics=None, epochs=2, lr=2e-5, batch_size=32, seed=SEED, quiet=False):
    """One Trainer for every task. AdamW on the trainable parameters only, the learning rate warmed up
    linearly over the first 10% of the steps and decayed linearly to zero after — BERT's fine-tuning
    recipe, spelled out as TrainingArguments. `compute_metrics` runs on the eval set after every epoch.
    Returns the trainer (for predictions) and the curves: train loss, seconds and every eval metric, by epoch."""
    args = TrainingArguments(output_dir=TRAINER_DIR, per_device_train_batch_size=batch_size, per_device_eval_batch_size=64,
                             num_train_epochs=epochs, learning_rate=lr, weight_decay=0.01, warmup_steps=0.1,   # < 1: a fraction of the steps
                             lr_scheduler_type="linear", eval_strategy="epoch", logging_strategy="epoch", save_strategy="no",
                             report_to=[], seed=seed, disable_tqdm=quiet)
    timer = EpochTimer()
    trainer = Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=eval_ds, data_collator=collator,
                      compute_metrics=compute_metrics, callbacks=[timer])
    trainer.train()
    curves = {"epoch": [], "train_loss": [], "seconds": timer.seconds, "trainable_params": n_params(model, trainable_only=True)}
    for entry in trainer.state.log_history:                     # one training entry and one eval entry per epoch
        if "loss" in entry:
            curves["epoch"].append(int(round(entry["epoch"])))
            curves["train_loss"].append(round(entry["loss"], 4))
        for k, v in entry.items():
            if k.startswith("eval_") and not k.endswith(("_runtime", "_per_second")):
                curves.setdefault(k if k == "eval_loss" else k[len("eval_"):], []).append(v)
    return trainer, curves


def predict(model, ds, collator, compute_metrics=None):
    """Run `model` over `ds` with no training at all: a Trainer built only for `.predict`."""
    args = TrainingArguments(output_dir=TRAINER_DIR, per_device_eval_batch_size=64, report_to=[], disable_tqdm=True)
    return Trainer(model=model, args=args, data_collator=collator, compute_metrics=compute_metrics).predict(ds)
# --- end ---


# --- notebook: agnews_features ---
def encode_agnews(tokenizer, ds, max_len=128):
    """text -> input_ids / attention_mask, unpadded: the collator pads every batch to its own longest text."""
    return ds.map(lambda batch: tokenizer(batch["text"], truncation=True, max_length=max_len), batched=True, remove_columns=["text"])


def accuracy_metric(p):
    return {"accuracy": round(float((p.predictions.argmax(-1) == p.label_ids).mean()), 4)}


@torch.no_grad()
def extract_features(body, ds, collator, device, batch_size=64):
    """Three summaries of every text from the frozen body: the pooler output, the raw [CLS]
    vector, and the mean of all token vectors — from the last layer. Plus the mean-pool from
    every layer (embeddings = layer 0), for the probe by depth."""
    body.to(device).eval()
    loader = DataLoader(ds.remove_columns("label"), batch_size=batch_size, collate_fn=collator)
    pooler, cls, mean, by_layer = [], [], [], []
    for batch in loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        out = body(**batch, output_hidden_states=True)
        m = batch["attention_mask"].unsqueeze(-1).float()                          # [B, L, 1]
        means = torch.stack([(h * m).sum(1) / m.sum(1) for h in out.hidden_states])  # [n_layers+1, B, d]
        by_layer.append(means.cpu())
        mean.append(means[-1].cpu())
        cls.append(out.last_hidden_state[:, 0].cpu())
        if out.pooler_output is not None:
            pooler.append(out.pooler_output.cpu())
    return {"pooler": torch.cat(pooler) if pooler else None, "cls": torch.cat(cls), "mean": torch.cat(mean),
            "by_layer": torch.cat(by_layer, dim=1)}


def logreg_accuracy(X_train, y_train, X_test, y_test):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    scaler = StandardScaler().fit(X_train)
    clf = LogisticRegression(max_iter=2000).fit(scaler.transform(X_train), y_train)
    return round(float(clf.score(scaler.transform(X_test), y_test)), 4)
# --- end ---


# --- notebook: zero_shot ---
@torch.no_grad()
def mask_probabilities(mlm, tokenizer, texts, prompt, device, batch_size=64):
    """For each text, the MLM's distribution over the vocabulary at the [MASK] of `prompt`: [N, V].
    The text goes first, the prompt second, and only the text is ever truncated — so the mask
    is never cut off."""
    mlm.to(device).eval()
    probs = []
    for i in range(0, len(texts), batch_size):
        enc = tokenizer(texts[i:i + batch_size], [prompt] * len(texts[i:i + batch_size]), truncation="only_first",
                        max_length=128, padding=True, return_tensors="pt").to(device)
        logits = mlm(**enc).logits                                             # [B, L, V]
        at_mask = (enc["input_ids"] == tokenizer.mask_token_id)                # exactly one True per row
        probs.append(logits[at_mask].softmax(-1).cpu())                        # [B, V]
    return torch.cat(probs)


def zero_shot_predict(probs, tokenizer, label_words):
    """Restrict the distribution to the label words and take the most probable one."""
    ids = tokenizer.convert_tokens_to_ids(label_words)
    assert tokenizer.unk_token_id not in ids, "every label word has to be a single token"
    return probs[:, ids].argmax(-1).numpy()
# --- end ---


# --- notebook: ner_features ---
def encode_ner(tokenizer, ds, max_len=160, label_continuations=False):
    """Words -> WordPiece tokens, and word tags -> token labels. A word can become several tokens
    (`Blackburn` -> `black`, `##burn`); `word_ids()` says which word each token came from.
    The first token of a word gets the word's tag; the continuations get IGNORE — or, with
    `label_continuations=True`, the tag as well (the notebook measures what that does)."""
    def align(batch):
        enc = tokenizer(batch["tokens"], is_split_into_words=True, truncation=True, max_length=max_len)
        enc["labels"], enc["word_ids"] = [], []
        for i, tags in enumerate(batch["ner_tags"]):
            labels, previous = [], None
            for word_id in enc.word_ids(i):
                if word_id is None:                                   # [CLS], [SEP]
                    labels.append(IGNORE)
                elif word_id != previous:                             # first token of a word
                    labels.append(tags[word_id])
                else:                                                 # a continuation
                    labels.append(tags[word_id] if label_continuations else IGNORE)
                previous = word_id
            enc["labels"].append(labels)
            enc["word_ids"].append(enc.word_ids(i))
        return enc
    return ds.map(align, batched=True, remove_columns=ds.column_names)


seqeval = evaluate.load("seqeval")


def ner_metrics(p):
    """Entity-level F1 — an entity counts only if its type AND both boundaries match — next to plain
    token accuracy, which is what "99% correct" usually hides. Positions labelled IGNORE are dropped,
    so both are per *word* (first token), and seqeval reads the BIO tags the way the shared task did."""
    pred, gold = p.predictions.argmax(-1), p.label_ids
    tags_pred = [[NER_TAGS[q] for q, g in zip(pr, gr) if g != IGNORE] for pr, gr in zip(pred, gold)]
    tags_gold = [[NER_TAGS[g] for g in gr if g != IGNORE] for gr in gold]
    r = seqeval.compute(predictions=tags_pred, references=tags_gold)
    return {"entity_f1": round(r["overall_f1"], 4), "token_acc": round(r["overall_accuracy"], 4),
            **{f"f1_{t}": round(r[t]["f1"], 4) for t in ["PER", "ORG", "LOC", "MISC"] if t in r}}


def ner_predictions(logits, features):
    """[N, L, C] logits -> one tag per *word* (read off the word's first token)."""
    out = []
    for row, word_ids in zip(logits.argmax(-1), features["word_ids"]):
        tags, previous = [], None
        for j, word_id in enumerate(word_ids):
            if word_id is not None and word_id != previous:
                tags.append(NER_TAGS[row[j]])
            previous = word_id
        out.append(tags)
    return out
# --- end ---


# --- notebook: qa_features ---
def encode_qa(tokenizer, ds, max_len=384, stride=128):
    """question + context -> [CLS] question [SEP] context [SEP], with the context cut into
    overlapping windows when it does not fit. Each window becomes one row; the label is the
    (start, end) *token* position of the answer inside that window, or (0, 0) — the [CLS]
    position — when the answer is not in this window. `offset_mapping` (kept for the context
    tokens only) is what turns a predicted token span back into text."""
    def windows(batch):
        enc = tokenizer([q.strip() for q in batch["question"]], batch["context"], truncation="only_second",
                        max_length=max_len, stride=stride, return_overflowing_tokens=True, return_offsets_mapping=True)
        sample = enc.pop("overflow_to_sample_mapping")
        enc["example_id"], enc["start_positions"], enc["end_positions"] = [], [], []
        for i, offsets in enumerate(enc["offset_mapping"]):
            j = sample[i]
            seq_ids = enc.sequence_ids(i)                              # None = special, 0 = question, 1 = context
            context_tokens = [k for k, s in enumerate(seq_ids) if s == 1]
            first, last = context_tokens[0], context_tokens[-1]
            answers = batch["answers"][j]
            start = end = 0
            if answers["text"]:
                answer_start = answers["answer_start"][0]
                answer_end = answer_start + len(answers["text"][0])
                if offsets[first][0] <= answer_start and offsets[last][1] >= answer_end:   # the answer is inside this window
                    start = next(k for k in context_tokens if offsets[k][1] > answer_start)
                    end = next(k for k in reversed(context_tokens) if offsets[k][0] < answer_end)
            enc["example_id"].append(batch["id"][j])
            enc["start_positions"].append(start)
            enc["end_positions"].append(end)
            enc["offset_mapping"][i] = [o if s == 1 else None for o, s in zip(offsets, seq_ids)]
        return enc
    return ds.map(windows, batched=True, remove_columns=ds.column_names)


def best_span(start_scores, end_scores, offsets, max_answer_tokens=30):
    """The highest-scoring (start, end) pair with start <= end, both inside the context, and the
    answer no longer than `max_answer_tokens`. Returns the score and the character span."""
    best, best_span_ = -1e9, None
    starts = np.argsort(start_scores)[::-1][:20]                 # only the 20 best starts and ends are worth checking
    ends = np.argsort(end_scores)[::-1][:20]
    for s in starts:
        for e in ends:
            if offsets[s] is None or offsets[e] is None or e < s or e - s + 1 > max_answer_tokens:
                continue
            if start_scores[s] + end_scores[e] > best:
                best, best_span_ = start_scores[s] + end_scores[e], (offsets[s][0], offsets[e][1])
    return best, best_span_


def qa_answers(start_logits, end_logits, features, examples):
    """Model outputs on every window -> one text answer per example (the best window wins)."""
    best = {}
    for start_scores, end_scores, offsets, example_id in zip(start_logits, end_logits, features["offset_mapping"], features["example_id"]):
        score, span = best_span(start_scores[:len(offsets)], end_scores[:len(offsets)], offsets)
        if span is not None and score > best.get(example_id, (-1e9, None))[0]:
            best[example_id] = (score, span)
    return {i: ("" if i not in best else context[best[i][1][0]:best[i][1][1]]) for i, context in zip(examples["id"], examples["context"])}


squad_metric = evaluate.load("squad")                                # the official SQuAD script: exact match and token F1,
                                                                     # each the max over the human answers, then averaged

def qa_metrics_for(features, examples):
    """`compute_metrics` for the Trainer needs the windows and the examples the logits came from — so it
    is built per eval set. The Trainer hands over (start_logits, end_logits) in the dataset's order."""
    references = [{"id": i, "answers": a} for i, a in zip(examples["id"], examples["answers"])]

    def metrics(p):
        start_logits, end_logits = p.predictions
        answers = qa_answers(start_logits, end_logits, features, examples)
        r = squad_metric.compute(predictions=[{"id": i, "prediction_text": a} for i, a in answers.items()], references=references)
        return {"exact_match": round(r["exact_match"], 2), "f1": round(r["f1"], 2)}
    return metrics
# --- end ---


# ----------------------------------------------------------------------------------------------
# precompute-only code from here on
# ----------------------------------------------------------------------------------------------

def get_device():
    return torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")


def make_smoke_model(cfg, ag_train):
    """A two-layer random BERT with a WordPiece vocabulary trained on 5 000 AG News texts, saved in
    the Hugging Face format so that `from_pretrained(path)` works for it exactly as for the real one."""
    from tokenizers import Tokenizer, models, pre_tokenizers, trainers, normalizers
    from transformers import BertConfig, BertForMaskedLM, BertTokenizerFast
    path = os.path.join(cfg.out, "tiny-bert")
    if os.path.exists(os.path.join(path, "config.json")):
        return path
    tok = Tokenizer(models.WordPiece(unk_token="[UNK]"))
    tok.normalizer = normalizers.BertNormalizer(lowercase=True)
    tok.pre_tokenizer = pre_tokenizers.BertPreTokenizer()
    texts = ag_train["text"][:5000] + ["world sports business technology politics"] * 50   # the zero-shot label words must be single tokens
    tok.train_from_iterator(texts, trainers.WordPieceTrainer(
        vocab_size=2000, special_tokens=["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"], show_progress=False))
    tokenizer = BertTokenizerFast(tokenizer_object=tok, unk_token="[UNK]", pad_token="[PAD]", cls_token="[CLS]",
                                  sep_token="[SEP]", mask_token="[MASK]")
    config = BertConfig(vocab_size=tokenizer.vocab_size, hidden_size=64, num_hidden_layers=2, num_attention_heads=2,
                        intermediate_size=128, max_position_embeddings=512)
    seed_all()
    BertForMaskedLM(config).save_pretrained(path)
    tokenizer.save_pretrained(path)
    return path


def save_json(cfg, name, obj):
    os.makedirs(cfg.out, exist_ok=True)
    obj = {"sizes": cfg.sizes, **obj}
    with open(os.path.join(cfg.out, name), "w") as f:
        json.dump(obj, f, indent=1)
    log(f"wrote {cfg.out}/{name}")


def save_head(cfg, name, head):
    os.makedirs(cfg.out, exist_ok=True)
    torch.save({k: v.half() for k, v in head.state_dict().items()}, os.path.join(cfg.out, name))
    log(f"wrote {cfg.out}/{name}")


def free(*objects):
    del objects
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()


def head(n):
    return lambda ds: ds.select(range(min(n, len(ds))))


def step_zero_shot(cfg, tokenizer, device):
    test = head(cfg.n_zero_shot)(load_dataset("fancyzhx/ag_news")["test"])
    mlm = AutoModelForMaskedLM.from_pretrained(cfg.model)
    prompt = "This news is about [MASK]."
    probs = mask_probabilities(mlm, tokenizer, test["text"], prompt, device)
    gold = np.array(test["label"])
    out = {"prompt": prompt, "n": len(test), "label_sets": {}}
    for name, words in [("v1", ["world", "sports", "business", "technology"]),
                        ("v2", ["politics", "sports", "business", "technology"])]:
        pred = zero_shot_predict(probs, tokenizer, words)
        per_class = {CLASS_NAMES[c]: round(float((pred[gold == c] == c).mean()), 4) for c in range(4)}
        out["label_sets"][name] = {"words": words, "accuracy": round(float((pred == gold).mean()), 4), "per_class": per_class}
        log(f"zero-shot {words}: acc {out['label_sets'][name]['accuracy']}  per class {per_class}")
    # the words the model actually puts in the mask for "World" news
    world = probs[torch.tensor(gold == 0)]
    top = Counter()
    for row in world:
        top.update(tokenizer.convert_ids_to_tokens(row.topk(20).indices.tolist()))
    out["top_words_world"] = top.most_common(25)
    save_json(cfg, "zero_shot.json", out)


def step_features(cfg, tokenizer, device):
    ds = load_dataset("fancyzhx/ag_news")
    ag_train, ag_test = ds["train"], ds["test"]
    ag_train = head(cfg.n_features)(ag_train.shuffle(seed=SEED))
    ag_test = head(cfg.n_test)(ag_test)
    body = AutoModel.from_pretrained(cfg.model, add_pooling_layer=True, attn_implementation=ATTN)
    collator = DataCollatorWithPadding(tokenizer)
    t = time.time()
    ftr = extract_features(body, encode_agnews(tokenizer, ag_train), collator, device)
    fte = extract_features(body, encode_agnews(tokenizer, ag_test), collator, device)
    seconds = time.time() - t
    y_train, y_test = np.array(ag_train["label"]), np.array(ag_test["label"])
    out = {"n_train": len(ag_train), "n_test": len(ag_test), "encode_seconds": round(seconds), "summary": {}, "by_layer": []}
    for name in ["pooler", "cls", "mean"]:
        if ftr[name] is None:
            continue
        acc = logreg_accuracy(ftr[name].numpy(), y_train, fte[name].numpy(), y_test)
        out["summary"][name] = acc
        log(f"{name:7s} + logreg: {acc}")
    for layer in range(ftr["by_layer"].shape[0]):
        acc = logreg_accuracy(ftr["by_layer"][layer].numpy(), y_train, fte["by_layer"][layer].numpy(), y_test)
        out["by_layer"].append(acc)
        log(f"layer {layer:2d} mean-pool + logreg: {acc}")
    save_json(cfg, "features_probe.json", out)


def step_agnews_ft(cfg, tokenizer, device):
    ds = load_dataset("fancyzhx/ag_news")
    ag_train, ag_test = ds["train"], ds["test"]
    ag_train = head(cfg.n_ft)(ag_train.shuffle(seed=SEED))
    ag_test = head(cfg.n_test)(ag_test)
    collator = DataCollatorWithPadding(tokenizer)
    tr, te = encode_agnews(tokenizer, ag_train), encode_agnews(tokenizer, ag_test)
    out = {"n_train": len(ag_train), "n_test": len(ag_test), "epochs": cfg.epochs, "runs": {}}
    for name, top_blocks, lr in [("head only", 0, 1e-3), ("top 2 blocks", 2, 5e-5), ("top 6 blocks", 6, 3e-5), ("everything", "all", 2e-5)]:
        seed_all()
        model = set_trainable(AutoModelForSequenceClassification.from_pretrained(cfg.model, num_labels=4, attn_implementation=ATTN), top_blocks)
        log(f"--- {name}: {n_params(model, trainable_only=True):,} trainable parameters, lr {lr}")
        trainer, curves = train(model, tr, te, collator, accuracy_metric, epochs=cfg.epochs, lr=lr, batch_size=cfg.batch_size, quiet=True)
        curves.update({"top_blocks": top_blocks, "lr": lr, "total_params": n_params(model)})
        out["runs"][name] = curves
        log(f"    accuracy by epoch {curves['accuracy']}  seconds {curves['seconds']}")
        free(trainer, model)
    save_json(cfg, "agnews_transfer.json", out)


def step_stability(cfg, tokenizer, device):
    ds = load_dataset("fancyzhx/ag_news")
    ag_train, ag_test = ds["train"], ds["test"]
    ag_test = head(cfg.n_test)(ag_test)
    collator = DataCollatorWithPadding(tokenizer)
    te = encode_agnews(tokenizer, ag_test)
    out = {"n_train": cfg.n_stability, "n_test": len(ag_test), "epochs": 3, "runs": []}
    for lr in [2e-5, 1e-4]:
        for seed in [1, 2, 3]:
            seed_all(seed)
            tr = encode_agnews(tokenizer, head(cfg.n_stability)(ag_train.shuffle(seed=seed)))
            model = set_trainable(AutoModelForSequenceClassification.from_pretrained(cfg.model, num_labels=4, attn_implementation=ATTN), "all")
            log(f"--- lr {lr}, seed {seed}")
            trainer, curves = train(model, tr, te, collator, accuracy_metric, epochs=3, lr=lr, batch_size=16, seed=seed, quiet=True)
            out["runs"].append({"lr": lr, "seed": seed, "accuracy": curves["accuracy"], "train_loss": curves["train_loss"]})
            log(f"    accuracy by epoch {curves['accuracy']}")
            free(trainer, model)
    save_json(cfg, "ft_stability.json", out)


NER_DEMO = [
    "Germany 's representative to the European Union 's veterinary committee Werner Zwingmann said on Wednesday consumers should buy sheepmeat from countries other than Britain .",
    "Apple opened its first store in Moscow on Tuesday , chief executive Tim Cook told Reuters .",
    "The Hague court ruled against Shell in a case brought by Friends of the Earth Netherlands .",
]


def step_ner(cfg, tokenizer, device):
    ds = load_dataset("eriktks/conll2003", revision="refs/convert/parquet")   # the repo is a loading script; the parquet conversion lives on this branch
    assert ds["train"].features["ner_tags"].feature.names == NER_TAGS
    ner_train, ner_test = ds["train"], ds["test"]
    tr_s, te_s = head(cfg.n_ner)(ner_train), head(cfg.n_test)(ner_test)
    collator = DataCollatorForTokenClassification(tokenizer)
    te = encode_ner(tokenizer, te_s)
    out = {"n_train": len(tr_s), "n_test": len(te_s), "runs": {}}
    for name, top_blocks, lr, epochs, label_cont in [("head only", 0, 1e-3, cfg.epochs, False),
                                                      ("head only, continuations labelled", 0, 1e-3, cfg.epochs, True),
                                                      ("everything", "all", 3e-5, cfg.epochs + 1, False)]:
        seed_all()
        tr = encode_ner(tokenizer, tr_s, label_continuations=label_cont)
        model = set_trainable(AutoModelForTokenClassification.from_pretrained(cfg.model, num_labels=len(NER_TAGS), attn_implementation=ATTN), top_blocks)
        log(f"--- {name}: {n_params(model, trainable_only=True):,} trainable parameters")
        trainer, curves = train(model, tr, te, collator, ner_metrics, epochs=epochs, lr=lr, batch_size=cfg.batch_size, quiet=True)
        curves.update({"top_blocks": top_blocks, "lr": lr, "label_continuations": label_cont})
        out["runs"][name] = curves
        log(f"    entity F1 by epoch {curves['entity_f1']}  token acc {curves['token_acc']}")
        if name == "head only":
            save_head(cfg, "ner_head.pt", model.classifier)
        if name == "everything":
            demo = concatenate_datasets([
                Dataset.from_dict({"tokens": [s.split() for s in NER_DEMO], "ner_tags": [[0] * len(s.split()) for s in NER_DEMO]},
                                  features=te_s.select_columns(["tokens", "ner_tags"]).features),
                te_s.select(range(5)).select_columns(["tokens", "ner_tags"])])
            feats = encode_ner(tokenizer, demo)
            pred = ner_predictions(trainer.predict(feats).predictions, feats)
            save_json(cfg, "ner_predictions.json", {"model": name, "sentences": [
                {"words": row["tokens"], "gold": [NER_TAGS[t] for t in row["ner_tags"]], "pred": p} for row, p in zip(demo, pred)]})
        free(trainer, model)
    save_json(cfg, "ner_curves.json", out)


QA_DEMO = {
    "context": "The Higher School of Economics was founded in 1992 in Moscow. Its DSBA programme is taught in English "
               "and was launched together with the University of London in 2019. The NLP course runs in the autumn "
               "of the fourth year.",
    "questions": ["When was HSE founded?", "In what language is DSBA taught?", "Which university partners with DSBA?",
                  "When does the NLP course run?"],
}


def step_qa(cfg, tokenizer, device):
    ds = load_dataset("rajpurkar/squad")
    qa_train, qa_dev = ds["train"].shuffle(seed=SEED), ds["validation"]       # train is ordered by article; a subset should not be one article
    tr_e, de_e = head(cfg.n_qa)(qa_train), head(cfg.n_qa_dev)(qa_dev)
    collator = DataCollatorWithPadding(tokenizer)
    tr, de = encode_qa(tokenizer, tr_e), encode_qa(tokenizer, de_e)
    log(f"{len(tr_e)} train questions -> {len(tr)} windows;  {len(de_e)} dev questions -> {len(de)} windows")
    out = {"n_train": len(tr_e), "n_train_windows": len(tr), "n_dev": len(de_e), "runs": {}}
    for name, top_blocks, lr, epochs in [("head only", 0, 1e-3, 1), ("everything", "all", 3e-5, cfg.epochs)]:
        seed_all()
        model = set_trainable(AutoModelForQuestionAnswering.from_pretrained(cfg.model, attn_implementation=ATTN), top_blocks)
        log(f"--- {name}: {n_params(model, trainable_only=True):,} trainable parameters")
        trainer, curves = train(model, tr, de, collator, qa_metrics_for(de, de_e), epochs=epochs, lr=lr,
                                batch_size=cfg.qa_batch_size, quiet=True)
        curves.update({"top_blocks": top_blocks, "lr": lr})
        out["runs"][name] = curves
        log(f"    EM by epoch {curves['exact_match']}  F1 {curves['f1']}")
        if name == "head only":
            save_head(cfg, "qa_head.pt", model.qa_outputs)
        if name == "everything":
            demo = concatenate_datasets([
                Dataset.from_dict({"id": [f"demo{i}" for i in range(len(QA_DEMO["questions"]))], "title": [""] * len(QA_DEMO["questions"]),
                                   "context": [QA_DEMO["context"]] * len(QA_DEMO["questions"]), "question": QA_DEMO["questions"],
                                   "answers": [{"text": [], "answer_start": []}] * len(QA_DEMO["questions"])}, features=de_e.features),
                de_e.select(range(8))])
            feats = encode_qa(tokenizer, demo)
            start_logits, end_logits = trainer.predict(feats).predictions
            answers = qa_answers(start_logits, end_logits, feats, demo)
            save_json(cfg, "qa_predictions.json", {"model": name, "examples": [
                {"question": e["question"], "context": e["context"], "gold": e["answers"]["text"], "pred": answers[e["id"]]} for e in demo]})
        free(trainer, model)
    save_json(cfg, "qa_curves.json", out)


# Sizes. The "full" tier is the paper-scale run. Measured on an 18 GB M-series Mac (bert-base on MPS with
# eager attention and dropout on — see ATTN — 8 optimizer steps per setting, 2026-09-23):
#     AG News, batch 32, 128 tokens:  head only 122 ex/s (1.1 GB)    everything 40 ex/s (6.7 GB)
#                                     (fused attention, no dropout: top 2 106 ex/s, top 6 66 ex/s)
#     SQuAD windows, 384 tokens, everything:  batch 16  11.6 ex/s, 10.8 GB    batch 8  11.3 ex/s, 6.5 GB
#                                             batch 32  12 ex/s and 12.9 GB with fused attention; ~19 GB with eager
# torch.mps.recommended_max_memory() on that Mac is 14.3 GB, so the QA step of the full tier is the one
# that does not fit; the whole tier is ~3 h even where it does. The "demo" tier keeps every experiment
# and every comparison on fewer examples: ~1 h in total, ~7 GB at the peak. Both tiers use the same test
# sets (the full AG News test set, all of CoNLL test), so the rows stay comparable with week 1.
SIZES = {
    "demo": dict(n_zero_shot=7600, n_features=10000, n_test=7600, n_ft=6000, n_stability=1000, n_ner=8000,
                 n_qa=5000, n_qa_dev=2000, epochs=2, batch_size=32, qa_batch_size=8),
    "full": dict(n_zero_shot=7600, n_features=20000, n_test=7600, n_ft=30000, n_stability=1000, n_ner=14041,
                 n_qa=30000, n_qa_dev=10570, epochs=2, batch_size=32, qa_batch_size=32),
    "smoke": dict(n_zero_shot=64, n_features=200, n_test=64, n_ft=128, n_stability=32, n_ner=64,
                  n_qa=48, n_qa_dev=16, epochs=1, batch_size=16, qa_batch_size=16),
}

STEPS = {"zero_shot": step_zero_shot, "features": step_features, "agnews_ft": step_agnews_ft,
         "stability": step_stability, "ner": step_ner, "qa": step_qa}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="+", default=list(STEPS), choices=list(STEPS))
    ap.add_argument("--model", default="bert-base-uncased")
    ap.add_argument("--out", default=None)
    ap.add_argument("--smoke", action="store_true", help="tiny random BERT, a few hundred examples: checks the code")
    ap.add_argument("--full", action="store_true", help="paper-scale sizes (SIZES['full']); the default is SIZES['demo']")
    cfg = ap.parse_args()
    cfg.out = cfg.out or ("artifacts_smoke" if cfg.smoke else "artifacts")
    cfg.sizes = "smoke" if cfg.smoke else "full" if cfg.full else "demo"
    for k, v in SIZES[cfg.sizes].items():
        setattr(cfg, k, v)
    device = get_device()
    log(f"device: {device}   model: {cfg.model}   out: {cfg.out}   sizes: {cfg.sizes} {SIZES[cfg.sizes]}")
    if cfg.smoke:
        cfg.model = make_smoke_model(cfg, load_dataset("fancyzhx/ag_news")["train"])
    tokenizer = AutoTokenizer.from_pretrained(cfg.model)
    for name in cfg.only:
        log(f"\n===== {name} =====")
        t = time.time()
        STEPS[name](cfg, tokenizer, device)
        log(f"===== {name}: {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
