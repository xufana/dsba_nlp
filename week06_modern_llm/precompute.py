"""
Precompute artifacts for week 6 that take longer than ~5 minutes in Google Colab.

The rule is the same as in weeks 1–5:

    > 5 min in Colab  -> artifact, committed to week06_modern_llm/artifacts/
    < 5 min in Colab  -> run live in the notebook

Nothing is trained this week except one encoder in `encoder`. Every other step is a
forward pass over checkpoints somebody else trained: a family of sizes (Pythia), a
family of years (gpt2 against SmolLM2), and one instruct model.

Data comes from the hub through `datasets` (cached under ~/.cache/huggingface):
    fancyzhx/ag_news                       AG News — the same 120 000 / 7 600 split as weeks 1, 4 and 5

Run (an M-series Mac or a GPU):
    python precompute.py                     demo sizes (the default)
    python precompute.py --full              all eight Pythia sizes, the whole test set: needs a 24 GB GPU
    python precompute.py --only scaling
    python precompute.py --only family serving
    python precompute.py --only instruct speculative encoder

Steps (and what they write):
    scaling      scaling.json            bits per byte on AG News for every Pythia size (the N axis) and for
                                         pythia-160m at training steps 1k … 143k (the D axis)
    family       family.json             gpt2 against SmolLM2-135M / 360M / 1.7B: bits per byte, and week 5's
                                         zero-shot scorer on AG News with the body swapped
    serving      serving.json            on this machine: prefill against decode by prompt length, the KV cache in
                                         bytes (measured and by formula), a GPU call's launch against its result, CPU <-> GPU
                                         transfer, the n × n crossover and the round-trip decoding loop — the notebook measures the same live and shows both
    instruct     instruct.json           SmolLM2-1.7B-Instruct restoring punctuation and case by instruction alone,
                                         scored like week 5's fine-tuned gpt2
    speculative  speculative.json        the 1.7B generating alone and with the 135M drafting for it
    encoder      encoder.json            ModernBERT-base fine-tuned on AG News with week 4's recipe

Every step records the device it ran on; the notebook reads it from the artifact and says so.

--smoke runs every step on two-layer random models with a 2k vocabulary trained on the
spot, on a few dozen texts, in about a minute on a 2-core CPU with no network — so the
notebook can be executed end-to-end before the real run. Smoke artifacts go to
artifacts_smoke/; never commit them.

The blocks between `# --- notebook: <name> ---` and `# --- end ---` are the same code as the
seminar notebook's definition cells — if you change one, change the other.
"""

import argparse
import json
import os
import re
import random
import tempfile
import time
from collections import Counter
from difflib import SequenceMatcher

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from datasets import Dataset, load_dataset
import transformers
from transformers import (AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding,
                          Trainer, TrainingArguments)

transformers.logging.set_verbosity_error()
transformers.logging.disable_progress_bar()

SEED = 42
CLASS_NAMES = ["World", "Sports", "Business", "Sci/Tech"]
CLASS_WORDS = [" world", " sports", " business", " technology"]       # week 5 §3.0: the verbalizer that won
N_DEMO = 20                                                   # examples whose outputs every artifact keeps verbatim

MODEL_OLD = "gpt2"
MODEL_NEW = "HuggingFaceTB/SmolLM2-135M"
FAMILY = [MODEL_OLD, MODEL_NEW, "HuggingFaceTB/SmolLM2-360M", "HuggingFaceTB/SmolLM2-1.7B"]
MODEL_CHAT = "HuggingFaceTB/SmolLM2-1.7B-Instruct"
MODEL_DRAFT = "HuggingFaceTB/SmolLM2-135M-Instruct"
ENCODER_NEW = "answerdotai/ModernBERT-base"

PYTHIA = ["70m", "160m", "410m", "1b", "1.4b", "2.8b", "6.9b", "12b"]         # EleutherAI/pythia-<size>: one corpus, one data order
PYTHIA_STEPS = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 143000]  # branches `step<k>` of every Pythia repo
PYTHIA_TOKENS_PER_STEP = 1024 * 2048                                          # 2 097 152 tokens per step; 143 000 steps = 299.9B (Biderman et al. 2023)
HALF_PRECISION = {"2.8b", "6.9b", "12b", "HuggingFaceTB/SmolLM2-1.7B", MODEL_CHAT}    # loaded in fp16: 2 bytes per parameter instead of 4

SYSTEM_PROMPT = "You restore punctuation and capitalisation. Return the same words in the same order, and nothing else."

SIZES = {
    "demo":  {"scaling_texts": 1000, "scaling_sizes": 6, "family_texts": 1000, "zero_shot": 2000, "instruct_test": 500,
              "speculative_prompts": 20, "encoder_train": 6000, "encoder_test": 7600, "epochs": 2, "lengths": [16, 64, 256, 960]},
    "full":  {"scaling_texts": 2000, "scaling_sizes": 8, "family_texts": 7600, "zero_shot": 7600, "instruct_test": 2000,
              "speculative_prompts": 50, "encoder_train": 6000, "encoder_test": 7600, "epochs": 2, "lengths": [16, 64, 256, 960]},
    "smoke": {"scaling_texts": 24, "scaling_sizes": 3, "family_texts": 24, "zero_shot": 24, "instruct_test": 8,
              "speculative_prompts": 2, "encoder_train": 64, "encoder_test": 32, "epochs": 1, "lengths": [8, 16, 32, 64]},
}


def seed_all(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def log(msg):
    print(msg, flush=True)


def n_params(module):
    return sum(p.numel() for p in module.parameters())


# ----------------------------------------------------------------------------------------------------
# Shared with the notebook
# ----------------------------------------------------------------------------------------------------

# --- notebook: text ---
def target_text(text):
    """Week 5's clean-up: the original, minus AG News' line-break and entity artifacts ("\\", "#36;")
    and minus tokens that are punctuation only ("-", "&")."""
    text = text.replace("\\", " ").replace("#36;", "$")
    return " ".join(w for w in text.split() if re.search(r"[A-Za-z0-9]", w))


def strip_text(text):
    """What ASR hands you: lower case, no punctuation. Apostrophes stay — they are pronounced."""
    return re.sub(r"[^a-z0-9' ]", "", text.lower())
# --- end ---


# --- notebook: count ---
def decoder_params(vocab, d, layers, heads, kv_heads, hidden, head_dim=None, tied=True):
    """Parameters of a Llama-style decoder, from six numbers of its config.json."""
    hd = head_dim or d // heads
    attention = 2 * d * heads * hd + 2 * d * kv_heads * hd       # q and o are full size; k and v are kv_heads wide
    block = attention + 3 * d * hidden + 2 * d                   # + the three matrices of SwiGLU + two RMSNorm gains
    return layers * block + vocab * d * (1 if tied else 2) + d   # + the embedding (and the head, if not tied) + the final norm


def kv_cache_bytes(layers, kv_heads, head_dim, tokens, bytes_per_value=2):
    """K and V, in every layer, for every K/V head, for every token in the context. fp16 unless told otherwise."""
    return 2 * layers * kv_heads * head_dim * tokens * bytes_per_value
# --- end ---


# --- notebook: bpb ---
@torch.no_grad()
def bits_per_byte(model, tokenizer, texts, batch_size=16):
    """Next-token loss in bits per UTF-8 byte of text — the unit that survives a change of tokenizer.
    Every text starts from <bos>, so every byte of it is predicted by something."""
    start = tokenizer.bos_token_id if tokenizer.bos_token_id is not None else tokenizer.eos_token_id
    nats = 0.0
    for i in range(0, len(texts), batch_size):
        seqs = [[start] + tokenizer(t, add_special_tokens=False).input_ids for t in texts[i:i + batch_size]]
        width = max(map(len, seqs))
        ids = torch.tensor([s + [start] * (width - len(s)) for s in seqs], device=model.device)
        mask = torch.tensor([[1] * len(s) + [0] * (width - len(s)) for s in seqs], device=model.device)
        logits = model(input_ids=ids, attention_mask=mask).logits[:, :-1].float()
        nats += (F.cross_entropy(logits.transpose(1, 2), ids[:, 1:], reduction="none") * mask[:, 1:]).sum().item()
    return nats / np.log(2) / sum(len(t.encode()) for t in texts)
# --- end ---


# --- notebook: timing ---
def sync(device):
    """A GPU call returns when the work is *queued*, not when it is done. This waits for the queue to drain."""
    if device.type == "cuda":
        torch.cuda.synchronize()
    elif device.type == "mps":
        torch.mps.synchronize()


def ms(fn, device, repeat=10):
    """Median wall time of fn() in milliseconds: one warm-up call, the queue drained before and after every run."""
    fn()
    sync(device)
    times = []
    for _ in range(repeat):
        t = time.perf_counter()
        fn()
        sync(device)
        times.append(time.perf_counter() - t)
    return float(np.median(times)) * 1000
# --- end ---


# --- notebook: greedy ---
@torch.no_grad()
def greedy(model, ids, n_new, round_trip=False):
    """Greedy decoding with the cache, written out: one prefill pass over the prompt, then one pass per new token.
    round_trip=True takes the argmax on the CPU, the way a careless loop does: a row of logits the size of the
    vocabulary crosses to the CPU and one token id crosses back, at every step."""
    out = model(ids, use_cache=True)
    new = []
    for _ in range(n_new):
        logits = out.logits[:, -1]
        if round_trip:
            token = torch.tensor([[int(np.argmax(logits.float().cpu().numpy()))]], device=ids.device)
        else:
            token = logits.argmax(-1, keepdim=True)
        new.append(token)
        out = model(token, past_key_values=out.past_key_values, use_cache=True)
    return torch.cat(new, 1), out.past_key_values
# --- end ---


# --- notebook: norm ---
class RMSNorm(nn.Module):
    """Divide by the root mean square, multiply by a learned gain. No mean subtracted, no bias added."""
    def __init__(self, d, eps=1e-5):
        super().__init__()
        self.weight, self.eps = nn.Parameter(torch.ones(d)), eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight
# --- end ---


# --- notebook: swiglu ---
class SwiGLU(nn.Module):
    """Two parallel projections up — one is the value, the other, through SiLU, is its gate — and one projection down."""
    def __init__(self, d, hidden):
        super().__init__()
        self.gate_proj, self.up_proj = nn.Linear(d, hidden, bias=False), nn.Linear(d, hidden, bias=False)
        self.down_proj = nn.Linear(hidden, d, bias=False)

    def forward(self, x):
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))
# --- end ---


# --- notebook: rope ---
def rope(x, theta, first=0):
    """Rotate [B, heads, T, head_dim] by position, positions first, first + 1, …
    Hugging Face's pairing: coordinate j turns with coordinate j + head_dim / 2 (week 5 §1.4 paired 2i with 2i + 1)."""
    T, hd = x.shape[-2:]
    angle = torch.arange(first, first + T, device=x.device)[:, None] * theta ** (-torch.arange(0, hd, 2, device=x.device) / hd)
    cos, sin = angle.cos().repeat(1, 2), angle.sin().repeat(1, 2)                  # [T, head_dim]
    x1, x2 = x.chunk(2, dim=-1)
    return x * cos + torch.cat([-x2, x1], -1) * sin
# --- end ---


# --- notebook: attention ---
class Attention(nn.Module):
    """Causal self-attention with grouped queries: `heads` query heads read from `kv_heads` key/value heads."""
    def __init__(self, d, heads, kv_heads, theta):
        super().__init__()
        self.heads, self.kv_heads, self.theta, hd = heads, kv_heads, theta, d // heads
        self.q_proj, self.o_proj = nn.Linear(d, heads * hd, bias=False), nn.Linear(heads * hd, d, bias=False)
        self.k_proj, self.v_proj = nn.Linear(d, kv_heads * hd, bias=False), nn.Linear(d, kv_heads * hd, bias=False)

    def forward(self, x):
        B, T, _ = x.shape
        q = self.q_proj(x).view(B, T, self.heads, -1).transpose(1, 2)              # [B, heads, T, hd]
        k = self.k_proj(x).view(B, T, self.kv_heads, -1).transpose(1, 2)           # [B, kv_heads, T, hd] — what the cache keeps
        v = self.v_proj(x).view(B, T, self.kv_heads, -1).transpose(1, 2)
        q, k = rope(q, self.theta), rope(k, self.theta)                            # positions enter here, in every layer, and nowhere else
        share = self.heads // self.kv_heads                                        # each K/V head serves `share` query heads
        out = F.scaled_dot_product_attention(q, k.repeat_interleave(share, 1), v.repeat_interleave(share, 1), is_causal=True)
        return self.o_proj(out.transpose(1, 2).reshape(B, T, -1))
# --- end ---


# --- notebook: decoder ---
class Block(nn.Module):
    def __init__(self, d, heads, kv_heads, hidden, theta, eps):
        super().__init__()
        self.input_layernorm, self.self_attn = RMSNorm(d, eps), Attention(d, heads, kv_heads, theta)
        self.post_attention_layernorm, self.mlp = RMSNorm(d, eps), SwiGLU(d, hidden)

    def forward(self, x):
        x = x + self.self_attn(self.input_layernorm(x))              # pre-norm: the residual stream itself is never normalised
        return x + self.mlp(self.post_attention_layernorm(x))


class Decoder(nn.Module):
    """A 2024 decoder. The attribute names are Hugging Face's Llama names, so a checkpoint's weights load as they are."""
    def __init__(self, vocab, d, layers, heads, kv_heads, hidden, theta, eps):
        super().__init__()
        self.embed_tokens = nn.Embedding(vocab, d)
        self.layers = nn.ModuleList(Block(d, heads, kv_heads, hidden, theta, eps) for _ in range(layers))
        self.norm = RMSNorm(d, eps)

    def forward(self, ids):
        x = self.embed_tokens(ids)
        for layer in self.layers:
            x = layer(x)
        return self.norm(x) @ self.embed_tokens.weight.T             # the head is the embedding, transposed (week 3 §4.5)
# --- end ---


# --- notebook: moe ---
class MoE(nn.Module):
    """`n_experts` feed-forwards and a router. Every token goes through its `top_k` best experts,
    mixed by the router's softmax over those k. Returns the output and which experts each token used."""
    def __init__(self, d, hidden, n_experts, top_k):
        super().__init__()
        self.router, self.top_k = nn.Linear(d, n_experts, bias=False), top_k
        self.experts = nn.ModuleList(SwiGLU(d, hidden) for _ in range(n_experts))

    def forward(self, x):
        weights, chosen = self.router(x).topk(self.top_k, dim=-1)                   # both [B, T, top_k]
        weights = weights.softmax(-1)
        out = torch.zeros_like(x)
        for e, expert in enumerate(self.experts):
            share = (weights * (chosen == e)).sum(-1)                               # [B, T]: this expert's weight for every token, 0 if not chosen
            rows = share > 0
            out[rows] += expert(x[rows]) * share[rows][:, None]                     # only the tokens that chose it pay for it
        return out, chosen
# --- end ---


# --- notebook: memory ---
PEAK = 0.0


def gpu_gb():
    """What the GPU holds *right now*, in GB — reserved, cache included, so it is comparable to the device's total.
    Apple's backend has no peak counter, so PEAK is sampled here by whoever calls this."""
    global PEAK
    now = (torch.mps.driver_allocated_memory() / 1e9 if torch.backends.mps.is_available() else
           torch.cuda.memory_reserved() / 1e9 if torch.cuda.is_available() else 0.0)
    PEAK = max(PEAK, now)
    return now


def free():
    """Give the allocator's cache back. `del` the model first — this cannot reach the caller's names."""
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()
# --- end ---


# --- notebook: generation ---
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
def generate(model, tokenizer, prompts, max_new_tokens, batch_size=32, **kwargs):
    """Greedy, batched, left-padded. Returns the text after the prompt, up to <eos>."""
    model.eval()
    outs = []
    for i in chunks("generate", len(prompts), batch_size):
        enc = tokenizer(prompts[i:i + batch_size], return_tensors="pt", padding=True, padding_side="left").to(model.device)
        ids = model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tokenizer.pad_token_id, **kwargs)
        outs += tokenizer.batch_decode(ids[:, enc.input_ids.shape[1]:], skip_special_tokens=True)
    return [o.strip() for o in outs]


@torch.no_grad()
def score(model, tokenizer, prefixes, continuations, batch_size=64):
    """Week 5's scorer, unchanged: log P(continuation | prefix) for every prefix × continuation, as an array
    [n_prefixes, n_continuations, 2] — the sum over the continuation's tokens and the mean per token.
    One forward pass per pair; the unembedding runs only at the positions the continuation is read from."""
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
        lp = model.lm_head(h[rows, cols]).float().log_softmax(-1).gather(1, want[:, None]).squeeze(1).cpu().numpy()
        j = 0
        for k, (a, b) in zip(order[i:i + batch_size], chunk):
            out[k] = lp[j:j + len(b)].sum(), lp[j:j + len(b)].mean()
            j += len(b)
    return out.reshape(len(prefixes), len(continuations), 2)
# --- end ---


# --- notebook: chat ---
def chat_prompt(tokenizer, text):
    """The task as an instruction: a system turn, a user turn, and the header of the assistant's turn left open."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": text}]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
# --- end ---


# Week 5's word-level scoring of a rewrite, copied so the two weeks' numbers are the same metric.
CASES = ["lower", "Cap", "CAPS", "other"]
PUNCTS = ["", ",", ".", "?", "!", ":", ";", "other"]


def word_label(word):
    tail = re.search(r"[^A-Za-z0-9']*$", word).group()
    inner = word[:len(word) - len(tail)]
    punct = tail if tail in PUNCTS else "other"
    if re.sub(r"[^A-Za-z0-9']", "", inner) != inner:
        punct = "other"
    letters = re.sub(r"[^A-Za-z]", "", inner)
    if letters == letters.lower():
        case = "lower"
    elif letters == letters.upper() and len(letters) > 1:
        case = "CAPS"
    elif letters == letters[:1].upper() + letters[1:].lower():
        case = "Cap"
    else:
        case = "other"
    return f"{case}|{punct}"


def align_words(pred, gold, key=lambda w: w):
    p, g = pred.split(), gold.split()
    paired = [None] * len(g)
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, [key(w) for w in p], [key(w) for w in g], autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            paired[j1:j2] = p[i1:i2]
    return paired


def word_scores(preds, golds, key=lambda w: w):
    rows = []
    for pred, gold in zip(preds, golds):
        for pw, gw in zip(align_words(pred, gold, key), gold.split()):
            rows.append({"gold": gw, "pred": pw, "label": word_label(gw), "correct": pw == gw,
                         "changed": pw is not None and key(pw) != key(gw), "dropped": pw is None})
    return pd.DataFrame(rows)


def breakdown(df):
    df = df.assign(case=df.label.str.split("|").str[0], punct=df.label.str.split("|").str[1].replace("", "none"))
    return {"accuracy": round(df.correct.mean(), 4), "changed": round(df.changed.mean(), 4), "dropped": round(df.dropped.mean(), 4),
            "n_words": len(df),
            "by_case": {"words": df.groupby("case").size().to_dict(), "accuracy": df.groupby("case").correct.mean().round(4).to_dict()},
            "by_punct": {"words": df.groupby("punct").size().to_dict(), "accuracy": df.groupby("punct").correct.mean().round(4).to_dict()}}


# ----------------------------------------------------------------------------------------------------
# Data and models
# ----------------------------------------------------------------------------------------------------

def load_agnews(smoke):
    if smoke:                                                         # the CSV from week 1 — no network in smoke mode
        w1 = os.path.join(os.path.dirname(__file__), "..", "week01_text_representations", "data")
        return {split: Dataset.from_pandas(pd.read_csv(f"{w1}/ag_news_{split}.csv", sep="\t")) for split in ["train", "test"]}
    return load_dataset("fancyzhx/ag_news")


CHATML = ("{% for m in messages %}<|im_start|>{{ m['role'] }}\n{{ m['content'] }}<|im_end|>\n{% endfor %}"
          "{% if add_generation_prompt %}<|im_start|>assistant\n{% endif %}")


def smoke_models(out_dir, agnews):
    """Two-layer random stand-ins for every checkpoint the week touches, with one 2k BPE vocabulary trained on the spot,
    saved where the notebook can load them. Returns {real name: local directory}."""
    from tokenizers import ByteLevelBPETokenizer
    from transformers import BertConfig, GPT2Config, GPT2TokenizerFast, GPTNeoXConfig, LlamaConfig
    texts = agnews["train"]["text"][:5000]
    bpe = ByteLevelBPETokenizer()
    bpe.train_from_iterator(texts, vocab_size=2000, special_tokens=["<|endoftext|>", "<|im_start|>", "<|im_end|>"])
    tok = GPT2TokenizerFast(tokenizer_object=bpe._tokenizer, eos_token="<|endoftext|>", bos_token="<|endoftext|>", unk_token="<|endoftext|>")
    tok.chat_template = CHATML
    V = len(tok)

    def llama(d, layers, heads, kv_heads):
        return LlamaConfig(vocab_size=V, hidden_size=d, intermediate_size=d * 8 // 3, num_hidden_layers=layers, num_attention_heads=heads,
                           num_key_value_heads=kv_heads, max_position_embeddings=512, rms_norm_eps=1e-5, tie_word_embeddings=True,
                           rope_parameters={"rope_type": "default", "rope_theta": 100000.0}, bos_token_id=0, eos_token_id=0, pad_token_id=0)

    def neox(d):
        return GPTNeoXConfig(vocab_size=V, hidden_size=d, num_hidden_layers=2, num_attention_heads=2, intermediate_size=4 * d,
                             max_position_embeddings=512, bos_token_id=0, eos_token_id=0)

    configs = {MODEL_OLD: GPT2Config(vocab_size=V, n_positions=512, n_embd=48, n_layer=2, n_head=4, bos_token_id=0, eos_token_id=0),
               MODEL_NEW: llama(48, 3, 6, 2), FAMILY[2]: llama(72, 3, 6, 2), FAMILY[3]: llama(96, 3, 6, 2),
               MODEL_CHAT: llama(96, 3, 6, 2), MODEL_DRAFT: llama(48, 2, 6, 2),
               "EleutherAI/pythia-70m": neox(32), "EleutherAI/pythia-160m": neox(48), "EleutherAI/pythia-410m": neox(64)}
    local = {}
    for name, config in configs.items():
        local[name] = os.path.join(out_dir, "tiny_" + re.sub(r"[^a-z0-9]+", "_", name.split("/")[-1].lower()))
        if not os.path.exists(local[name]):
            seed_all()
            tok.save_pretrained(local[name])
            AutoModelForCausalLM.from_config(config).save_pretrained(local[name])
    local[ENCODER_NEW] = os.path.join(out_dir, "tiny_encoder")
    if not os.path.exists(local[ENCODER_NEW]):
        tok.save_pretrained(local[ENCODER_NEW])
        AutoModelForSequenceClassification.from_config(BertConfig(vocab_size=V, hidden_size=48, num_hidden_layers=2, num_attention_heads=2,
                                                                  intermediate_size=96, max_position_embeddings=512, num_labels=4,
                                                                  pad_token_id=0)).save_pretrained(local[ENCODER_NEW])
    return local


def load_lm(name, device, local=None, revision=None):
    """A causal LM and its tokenizer. `local` maps hub names to smoke stand-ins; the big ones come in half precision."""
    half = (name in HALF_PRECISION or name.split("-")[-1] in HALF_PRECISION) and device.type != "cpu"
    path = (local or {}).get(name, name)
    tok = AutoTokenizer.from_pretrained(path)
    tok.pad_token = tok.pad_token or tok.eos_token
    kwargs = {} if local or revision is None else {"revision": revision}
    model = AutoModelForCausalLM.from_pretrained(path, dtype=torch.float16 if half else torch.float32, **kwargs)
    return model.to(device).eval(), tok


# ----------------------------------------------------------------------------------------------------
# Steps
# ----------------------------------------------------------------------------------------------------

def step_scaling(cfg, device, agnews, out, local):
    """Both axes of a scaling law without a training step: the same test texts through every size of one family
    (N), and through one size at checkpoints along its training run (D)."""
    texts = [target_text(t) for t in agnews["test"]["text"][:cfg["scaling_texts"]]]
    art = {"sizes": cfg["name"], "n_texts": len(texts), "device": str(device), "family": "EleutherAI/pythia", "corpus": "the Pile",
           "tokens_per_step": PYTHIA_TOKENS_PER_STEP, "by_size": [], "by_step": []}
    for size in PYTHIA[:cfg["scaling_sizes"]]:
        t = time.time()
        model, tok = load_lm(f"EleutherAI/pythia-{size}", device, local)
        art["by_size"].append({"name": f"pythia-{size}", "params": n_params(model),
                               "params_non_embedding": n_params(model) - n_params(model.get_input_embeddings()) - n_params(model.get_output_embeddings()),
                               "bits_per_byte": round(bits_per_byte(model, tok, texts), 4)})
        log(f"    pythia-{size}: {art['by_size'][-1]['bits_per_byte']:.3f} bits/byte, {time.time() - t:.0f}s, gpu {gpu_gb():.1f} GB")
        del model
        free()
    steps = PYTHIA_STEPS if cfg["name"] != "smoke" else PYTHIA_STEPS[:3]
    for k, step in enumerate(steps):
        name = "EleutherAI/pythia-160m" if not local else f"EleutherAI/pythia-{PYTHIA[k % 3]}"      # smoke: three random models stand in for three steps
        model, tok = load_lm(name, device, local, revision=f"step{step}")
        art["by_step"].append({"step": step, "tokens_seen": step * PYTHIA_TOKENS_PER_STEP, "bits_per_byte": round(bits_per_byte(model, tok, texts), 4)})
        log(f"    pythia-160m at step {step:,}: {art['by_step'][-1]['bits_per_byte']:.3f} bits/byte")
        del model
        free()
    json.dump(art, open(f"{out}/scaling.json", "w"), indent=1)


def step_family(cfg, device, agnews, out, local):
    """The same two measurements on gpt2 and on three sizes of SmolLM2: bits per byte, and week 5's zero-shot scorer."""
    texts = [target_text(t) for t in agnews["test"]["text"]]
    gold = np.array(agnews["test"]["label"][:cfg["zero_shot"]])
    art = {"sizes": cfg["name"], "n_bpb": cfg["family_texts"], "n_zero_shot": cfg["zero_shot"], "device": str(device),
           "prompt": "<text> This news is about", "words": CLASS_WORDS, "models": {}}
    for name in FAMILY:
        t = time.time()
        model, tok = load_lm(name, device, local)
        s = score(model, tok, [x + " This news is about" for x in texts[:cfg["zero_shot"]]], CLASS_WORDS)
        pred = s[:, :, 0].argmax(1)
        art["models"][name.split("/")[-1]] = {
            "params": n_params(model), "bits_per_byte": round(bits_per_byte(model, tok, texts[:cfg["family_texts"]]), 4),
            "bytes_per_token": round(sum(len(x.encode()) for x in texts[:200]) / sum(len(tok(x).input_ids) for x in texts[:200]), 3),
            "tokens_per_word": [len(tok(w).input_ids) for w in CLASS_WORDS],
            "zero_shot": {"accuracy": round(float((pred == gold).mean()), 4),
                          "per_class": {c: round(float((pred[gold == k] == k).mean()), 4) for k, c in enumerate(CLASS_NAMES) if (gold == k).any()}}}
        log(f"    {name}: {art['models'][name.split('/')[-1]]['bits_per_byte']:.3f} bits/byte, zero-shot "
            f"{art['models'][name.split('/')[-1]]['zero_shot']['accuracy']:.3f}, {time.time() - t:.0f}s, gpu {gpu_gb():.1f} GB")
        del model
        free()
    json.dump(art, open(f"{out}/family.json", "w"), indent=1)


# --- notebook: serving ---
def measure_serving(model, tok, device, texts, lengths, n_new=32):
    """Prefill against decode at several prompt lengths, and the cache they leave behind."""
    stream = torch.tensor([tok(" ".join(texts)).input_ids[:max(lengths)]], device=device)
    rows = []
    for P in lengths:
        ids = stream[:, :P]
        with torch.no_grad():
            prefill = ms(lambda: model(ids, use_cache=True), device, repeat=5)
            total = ms(lambda: greedy(model, ids, n_new), device, repeat=3)
            cache = model(ids, use_cache=True).past_key_values
        layer = cache.layers[0].keys
        rows.append({"prompt tokens": P, "prefill, ms": round(prefill, 2), "prefill, tokens/s": round(P / prefill * 1000),
                     "decode, ms/token": round((total - prefill) / n_new, 2), "decode, tokens/s": round(n_new / (total - prefill) * 1000, 1),
                     "cache shape, one layer": list(layer.shape),
                     "cache, KB": round(sum(l.keys.numel() + l.values.numel() for l in cache.layers) * layer.element_size() / 1024, 1)})
    return rows
# --- end ---


# --- notebook: transfer ---
def measure_transfer(device, sizes=(1_000, 100_000, 10_000_000)):
    """The same vector on both sides, and what it costs to carry it across."""
    rows = []
    for n in sizes:
        x = torch.randn(n)
        g = x.to(device)
        rows.append({"floats": n, "MB": n * 4 / 1e6, "CPU -> GPU, ms": round(ms(lambda: x.to(device), device), 3),
                     "GPU -> CPU, ms": round(ms(lambda: g.cpu(), device), 3),
                     "x * 2 on CPU, ms": round(ms(lambda: x * 2, device), 3), "x * 2 on GPU, ms": round(ms(lambda: g * 2, device), 3)})
    return rows


def measure_matmul(device, sizes=(16, 64, 256, 1024, 2048)):
    """An n × n product where the data is, where the GPU is, and on the GPU with the trip there and back."""
    rows = []
    for n in sizes:
        x = torch.randn(n, n)
        g = x.to(device)
        rows.append({"n": n, "x @ x on CPU, ms": round(ms(lambda: x @ x, device), 3), "on GPU, ms": round(ms(lambda: g @ g, device), 3),
                     "on GPU, there and back, ms": round(ms(lambda: (x.to(device) @ x.to(device)).cpu(), device), 3)})
    return rows
# --- end ---


def step_serving(cfg, device, agnews, out, local):
    texts = [target_text(t) for t in agnews["test"]["text"][:400]]
    n = 512 if cfg["name"] == "smoke" else 4096
    a = torch.randn(n, n, device=device)
    a @ a; sync(device)
    t = time.perf_counter()
    a @ a
    returned = time.perf_counter() - t
    sync(device)
    art = {"sizes": cfg["name"], "device": str(device), "torch": torch.__version__,
           "launch": {"n": n, "returned, ms": round(returned * 1000, 3), "existed, ms": round((time.perf_counter() - t) * 1000, 3)},
           "transfer": measure_transfer(device), "matmul": measure_matmul(device, (16, 64, 256) if cfg["name"] == "smoke" else (16, 64, 256, 1024, 2048)),
           "models": {}}
    for name in [MODEL_OLD, MODEL_NEW]:
        model, tok = load_lm(name, device, local)
        ids = torch.tensor([tok(" ".join(texts)).input_ids[:64]], device=device)
        art["models"][name.split("/")[-1]] = {
            "by_length": measure_serving(model, tok, device, texts, cfg["lengths"]),
            "64 tokens, argmax on the GPU, ms": round(ms(lambda: greedy(model, ids, 64), device, repeat=3), 1),
            "64 tokens, argmax on the CPU, ms": round(ms(lambda: greedy(model, ids, 64, round_trip=True), device, repeat=3), 1)}
        log(f"    {name}: {art['models'][name.split('/')[-1]]['by_length'][-1]}")
        del model
        free()
    json.dump(art, open(f"{out}/serving.json", "w"), indent=1)


def step_instruct(cfg, device, agnews, out, local):
    """Week 5 §4.1 without the fine-tune: the task stated as an instruction to a model nobody trained for it."""
    test_texts = [target_text(t) for t in agnews["test"]["text"][:cfg["instruct_test"]]]
    test_x = [strip_text(t) for t in test_texts]
    model, tok = load_lm(MODEL_CHAT, device, local)
    prompts = [chat_prompt(tok, x) for x in test_x]
    max_new = 8 if cfg["name"] == "smoke" else 160
    t = time.time()
    preds = generate(model, tok, prompts, max_new_tokens=max_new, batch_size=16)
    seconds = time.time() - t
    art = {"sizes": cfg["name"], "model": MODEL_CHAT, "params": n_params(model), "n_test": len(test_texts), "device": str(device),
           "system": SYSTEM_PROMPT, "prompt": prompts[0], "ms_per_1000": round(seconds / len(prompts) * 1e6, 1),
           **breakdown(word_scores(preds, test_texts, key=strip_text)),
           "demo": [{"input": test_x[i], "gold": test_texts[i], "pred": preds[i]} for i in range(min(N_DEMO, len(preds)))]}
    log(f"    word accuracy {art['accuracy']:.3f}, changed {art['changed']:.3f}, dropped {art['dropped']:.3f}, {seconds:.0f}s")
    json.dump(art, open(f"{out}/instruct.json", "w"), indent=1)


def step_speculative(cfg, device, agnews, out, local):
    """The big model alone, and the big model checking a small model's drafts. Greedy both ways, so the text is the same."""
    model, tok = load_lm(MODEL_CHAT, device, local)
    draft, _ = load_lm(MODEL_DRAFT, device, local)
    texts = [strip_text(target_text(t)) for t in agnews["test"]["text"][:cfg["speculative_prompts"]]]
    max_new = 8 if cfg["name"] == "smoke" else 160
    rows = []
    with torch.no_grad():                                         # warm-up: the first assisted call pays for set-up, not for decoding
        model.generate(**tok(chat_prompt(tok, texts[0]), return_tensors="pt").to(device), max_new_tokens=4, do_sample=False,
                       pad_token_id=tok.pad_token_id, assistant_model=draft)
    for x in texts:
        enc = tok(chat_prompt(tok, x), return_tensors="pt").to(device)
        with torch.no_grad():
            sync(device); t = time.perf_counter()
            alone = model.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id)
            sync(device); t_alone = time.perf_counter() - t
            t = time.perf_counter()
            assisted = model.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id, assistant_model=draft)
            sync(device); t_assisted = time.perf_counter() - t
            P = enc.input_ids.shape[1]
            agree = (draft(alone).logits[:, P - 1:-1].argmax(-1) == alone[:, P:]).float().mean().item()   # the draft, shown the target's text
        n = alone.shape[1] - P
        rows.append({"new tokens": n, "alone, s": round(t_alone, 3), "with a draft, s": round(t_assisted, 3), "draft agrees": round(agree, 3),
                     "same text": bool(alone.shape == assisted.shape and (alone == assisted).all())})
    df = pd.DataFrame(rows)
    art = {"sizes": cfg["name"], "target": MODEL_CHAT, "draft": MODEL_DRAFT, "params_target": n_params(model), "params_draft": n_params(draft),
           "device": str(device), "n_prompts": len(rows), "new_tokens": int(df["new tokens"].sum()),
           "alone_tokens_per_s": round(df["new tokens"].sum() / df["alone, s"].sum(), 1),
           "draft_tokens_per_s": round(df["new tokens"].sum() / df["with a draft, s"].sum(), 1),
           "same_text_share": round(float(df["same text"].mean()), 3),
           "draft_agreement": round(float((df["draft agrees"] * df["new tokens"]).sum() / df["new tokens"].sum()), 3), "rows": rows}
    log(f"    alone {art['alone_tokens_per_s']} tokens/s, with a draft {art['draft_tokens_per_s']} tokens/s, "
        f"draft agrees on {art['draft_agreement']:.0%} of tokens, same text on {art['same_text_share']:.0%}")
    json.dump(art, open(f"{out}/speculative.json", "w"), indent=1)


def step_encoder(cfg, device, agnews, out, local):
    """Week 4's `everything` fine-tune, the body swapped for a 2024 encoder: 6 000 texts, two epochs, lr 2e-5, 128 tokens."""
    seed_all()
    path = (local or {}).get(ENCODER_NEW, ENCODER_NEW)
    tok = AutoTokenizer.from_pretrained(path)
    tok.pad_token = tok.pad_token or tok.eos_token
    encode = lambda ds: ds.map(lambda b: tok(b["text"], truncation=True, max_length=128), batched=True, remove_columns=["text"])
    train_ds = encode(agnews["train"].shuffle(seed=SEED).select(range(cfg["encoder_train"])))
    test_ds = encode(agnews["test"].select(range(cfg["encoder_test"])))
    model = AutoModelForSequenceClassification.from_pretrained(path, num_labels=4).to(device)
    args = TrainingArguments(output_dir=os.path.join(tempfile.gettempdir(), "week06_trainer"), per_device_train_batch_size=16,
                             per_device_eval_batch_size=64, num_train_epochs=cfg["epochs"], learning_rate=2e-5, weight_decay=0.01,
                             warmup_steps=0.1, lr_scheduler_type="linear", eval_strategy="epoch", logging_strategy="no", save_strategy="no",
                             report_to=[], seed=SEED, disable_tqdm=True, dataloader_pin_memory=False, use_cpu=device.type == "cpu")
    trainer = Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=test_ds, data_collator=DataCollatorWithPadding(tok),
                      compute_metrics=lambda p: {"accuracy": round(float((p.predictions.argmax(-1) == p.label_ids).mean()), 4)})
    trainer.remove_callback(transformers.PrinterCallback)
    t = time.time()
    trainer.train()
    seconds = round(time.time() - t, 1)                              # the two evaluations on the test set included
    accuracy = [h["eval_accuracy"] for h in trainer.state.log_history if "eval_accuracy" in h]
    log(f"    accuracy by epoch {accuracy}, {seconds:.0f}s, gpu {gpu_gb():.1f} GB")
    t = time.time()
    trainer.predict(test_ds.select(range(min(1000, len(test_ds)))))
    art = {"sizes": cfg["name"], "model": ENCODER_NEW, "params": n_params(model), "n_train": len(train_ds), "n_test": len(test_ds),
           "epochs": cfg["epochs"], "lr": 2e-5, "max_len": 128, "accuracy": accuracy, "seconds": seconds, "device": str(device),
           "ms_per_1000": round((time.time() - t) / min(1000, len(test_ds)) * 1e6, 1),
           "config": {k: v for k, v in model.config.to_dict().items() if k in ("num_hidden_layers", "hidden_size", "intermediate_size",
                      "num_attention_heads", "max_position_embeddings", "global_attn_every_n_layers", "local_attention", "hidden_activation",
                      "vocab_size")}}
    json.dump(art, open(f"{out}/encoder.json", "w"), indent=1)


STEPS = {"scaling": step_scaling, "family": step_family, "serving": step_serving, "instruct": step_instruct,
         "speculative": step_speculative, "encoder": step_encoder}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--only", nargs="+", choices=list(STEPS), default=list(STEPS))
    ap.add_argument("--cpu", action="store_true", help="ignore the GPU (when the machine is short of memory)")
    args = ap.parse_args()
    tier = "full" if args.full else "smoke" if args.smoke else "demo"
    cfg = {"name": tier, **SIZES[tier]}
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "artifacts_smoke" if args.smoke else "artifacts")
    os.makedirs(out, exist_ok=True)
    device = torch.device("cpu" if args.cpu else "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    log(f"tier {tier}, device {device}, steps {args.only}")

    agnews = load_agnews(args.smoke)
    local = smoke_models(out, agnews) if args.smoke else None
    for step in args.only:
        t, _ = time.time(), globals().__setitem__("PEAK", 0.0)
        log(f"--- {step}")
        STEPS[step](cfg, device, agnews, out, local)
        gpu_gb()
        log(f"    {step}: {time.time() - t:.0f}s, GPU peak {PEAK:.1f} GB")
        free()


if __name__ == "__main__":
    main()
