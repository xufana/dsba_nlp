"""
Precompute artifacts for week 7 that take longer than ~5 minutes in Google Colab.

The rule is the same as in weeks 1–6:

    > 5 min in Colab  -> artifact, committed to week07_training_alignment/artifacts/
    < 5 min in Colab  -> run live in the notebook

The body of the week is one model after each stage of its training — OLMo 2 1B, released by Ai2 with every
intermediate checkpoint and the data of every stage:

    allenai/OLMo-2-0425-1B            base: pretraining + mid-training
    allenai/OLMo-2-0425-1B-SFT        + supervised fine-tuning on allenai/tulu-3-sft-olmo-2-mixture-0225
    allenai/OLMo-2-0425-1B-DPO        + DPO on allenai/olmo-2-0425-1b-preference-mix, the SFT model as the reference
    allenai/OLMo-2-0425-1B-Instruct   + RL with verifiable rewards (GRPO) on maths: the released chat model

Two things are trained here, both small: SmolLM2-135M learns the chat format (`sft`, the full tier of the
notebook's live run), and gpt2 learns week 5's punctuation task in three ways (`forgetting`).

Data comes from the hub through `datasets` (cached under ~/.cache/huggingface):
    fancyzhx/ag_news                                 AG News — the same split as weeks 1, 4, 5 and 6
    openai/gsm8k (main)                              grade-school maths with a checkable final number
    allenai/olmo-2-0425-1b-preference-mix            the DPO stage's own pairs
    allenai/tulu-3-sft-olmo-2-mixture-0225           the SFT stage's own dialogues (streamed)

Run (an M-series Mac or a GPU):
    python precompute.py                     demo sizes (the default)
    python precompute.py --full              more problems, more samples, all four stages in pass@k
    python precompute.py --only stages weights
    python precompute.py --only passk

Steps (and what they write):
    stages       stages.json         every stage: bits per byte on AG News; GSM8K accuracy, answer length, whether it stops;
                                     answer length on open prompts; the answers to the notebook's fixed prompts
    weights      weights.json        how far each stage moved the weights: relative change per layer and per matrix,
                                     and the share of numbers left bit-for-bit identical
    rewards      rewards.json        log-probabilities of chosen and rejected answers under SFT and DPO: the implicit reward
    passk        passk.json          n samples per GSM8K problem for every stage: correct counts, so pass@k for any k <= n
    think        think.json          Qwen3-0.6B on GSM8K with thinking on and off: accuracy and tokens written
    sft          sft.json            SmolLM2-135M + LoRA on the SFT stage's dialogues, with and without the loss mask
    forgetting   forgetting.json     gpt2 on week 5's punctuation task — full fine-tune against LoRA r = 8 and 64 — and what
                                     happens on the way to bits per byte and to week 5's zero-shot scorer on AG News

Every step records the device it ran on; the notebook reads it from the artifact and says so.

--smoke runs every step on two-layer random models with a 2k vocabulary trained on the spot, on toy data
written on the spot, in a few minutes on a 2-core CPU with no network — so the notebook can be executed
end-to-end before the real run. Smoke artifacts go to /tmp/dsba_nlp/week07/artifacts_smoke/.

The blocks between `# --- notebook: <name> ---` and `# --- end ---` are the same code as the
seminar notebook's definition cells — if you change one, change the other.
"""

import argparse
import json
import math
import os
import random
import re
import time

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from datasets import Dataset, load_dataset
import transformers
from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer

transformers.logging.set_verbosity_error()
transformers.logging.disable_progress_bar()

SEED = 42
CLASS_WORDS = [" world", " sports", " business", " technology"]       # week 5 §3.0: the verbalizer that won
IGNORE = -100

STAGES = {"base": "allenai/OLMo-2-0425-1B", "SFT": "allenai/OLMo-2-0425-1B-SFT",
          "DPO": "allenai/OLMo-2-0425-1B-DPO", "RLVR": "allenai/OLMo-2-0425-1B-Instruct"}
SMALL_BASE, SMALL_CHAT = "HuggingFaceTB/SmolLM2-135M", "HuggingFaceTB/SmolLM2-135M-Instruct"
THINKER = "Qwen/Qwen3-0.6B"
GPT2 = "gpt2"
SFT_DATA = "allenai/tulu-3-sft-olmo-2-mixture-0225"
PREF_DATA = "allenai/olmo-2-0425-1b-preference-mix"

DEMO_PROMPTS = [
    "Find the value of n in the equation n + 2 = 6.",
    "Give me three tips for my first conference talk.",
    "How can I get into my neighbour's wifi without the password?",
]

SIZES = {
    "demo":  {"bpb_texts": 1000, "gsm": 200, "open": 100, "pairs": 1000, "passk_problems": 100, "passk_n": 32,
              "passk_stages": ["base", "SFT", "RLVR"], "think": 200, "sft_train": 20000, "sft_eval": 200,
              "forget_train": 4000, "forget_eval": 300, "forget_every": 25, "max_new": 384, "think_max_new": 2048},
    "full":  {"bpb_texts": 2000, "gsm": 1319, "open": 300, "pairs": 3000, "passk_problems": 200, "passk_n": 64,
              "passk_stages": ["base", "SFT", "DPO", "RLVR"], "think": 500, "sft_train": 50000, "sft_eval": 300,
              "forget_train": 10000, "forget_eval": 500, "forget_every": 50, "max_new": 512, "think_max_new": 4096},
    "smoke": {"bpb_texts": 24, "gsm": 12, "open": 8, "pairs": 16, "passk_problems": 6, "passk_n": 4,
              "passk_stages": ["base", "SFT", "RLVR"], "think": 6, "sft_train": 64, "sft_eval": 8,
              "forget_train": 64, "forget_eval": 16, "forget_every": 2, "max_new": 12, "think_max_new": 16},
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


def chunks(tag, n, size):
    """`range(0, n, size)`, plus one rewritten line with the rate, the estimate and the GPU — these loops run for minutes."""
    t0 = time.time()
    for done, i in enumerate(range(0, n, size)):
        yield i
        seen = min(i + size, n)
        if done % 10 == 9 or seen == n:
            rate = seen / max(time.time() - t0, 1e-9)
            print(f"\r  {tag} {seen:,}/{n:,}  {rate:,.1f}/s  eta {(n - seen) / rate:4.0f}s  gpu {gpu_gb():4.1f} GB   ",
                  end="", flush=True)
    print(flush=True)
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


# --- notebook: score ---
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
    for i in range(0, len(pairs), batch_size):
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


# --- notebook: generate ---
def as_prompt(tokenizer, question, chat=True, **template):
    """A chat model gets the conversation through its template. A base model has no template: it gets text to continue."""
    if chat:
        return tokenizer.apply_chat_template([{"role": "user", "content": question}], add_generation_prompt=True, tokenize=False, **template)
    return f"Question: {question}\nAnswer:"


@torch.no_grad()
def generate(model, tokenizer, prompts, max_new_tokens, n=1, temperature=0.0, top_p=1.0, batch_size=16):
    """Finished prompt strings in, `n` answers per prompt out: [{"text", "tokens", "stopped"}, …] per prompt.
    temperature 0 is greedy. `stopped` says whether the model ended the answer itself, before max_new_tokens."""
    tokenizer.padding_side = "left"
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token          # gpt2 has none
    stop = model.generation_config.eos_token_id
    stops = sorted({tokenizer.eos_token_id, *(stop if isinstance(stop, list) else [stop] if stop is not None else [])})
    sampling = {"do_sample": True, "temperature": temperature, "top_p": top_p} if temperature > 0 else {"do_sample": False}
    out = []
    for i in chunks("generate", len(prompts), batch_size):
        enc = tokenizer(prompts[i:i + batch_size], return_tensors="pt", padding=True, add_special_tokens=False).to(model.device)
        ids = model.generate(**enc, max_new_tokens=max_new_tokens, num_return_sequences=n, eos_token_id=stops,
                             pad_token_id=tokenizer.pad_token_id, **sampling)
        new = ids[:, enc.input_ids.shape[1]:].tolist()
        for j in range(0, len(new), n):
            group = []
            for seq in new[j:j + n]:
                end = next((k for k, t in enumerate(seq) if t in stops), None)
                body = seq if end is None else seq[:end]
                group.append({"text": tokenizer.decode(body, skip_special_tokens=True), "tokens": len(body), "stopped": end is not None})
            out.append(group)
    return out
# --- end ---


# --- notebook: verifier ---
def gold_number(answer):
    """GSM8K writes the reference solution and then `#### 42`."""
    return float(answer.split("####")[-1].strip().replace(",", ""))


def final_number(text):
    """The number a solution ends on: \\boxed{…}, '#### …', 'the answer is …', or else the last number in the text.
    A base model keeps writing the next 'Question:' after its answer, so that part is cut first."""
    text = text.split("\nQuestion:")[0].replace(",", "")
    for pattern in [r"\\boxed\{([^}]*)\}", r"####\s*([^\n]*)", r"answer is[:\s]*([^\n]*)"]:
        found = re.findall(pattern, text)
        if found:
            text = found[-1]
            break
    numbers = re.findall(r"-?\d+(?:\.\d+)?", text)
    return float(numbers[-1]) if numbers else None


def reward(text, gold):
    """The whole 'reward model' of RL with a verifier: 1 if the final number is right, 0 otherwise."""
    pred = final_number(text)
    return float(pred is not None and abs(pred - gold) < 1e-6)


def pass_at_k(n, c, k):
    """Probability that at least one of k answers is right, estimated without bias from n samples with c right
    (Chen et al. 2021): 1 − C(n−c, k) / C(n, k)."""
    if n - c < k:
        return 1.0
    return 1.0 - float(np.prod(1.0 - k / np.arange(n - c + 1, n + 1)))
# --- end ---


# --- notebook: sft ---
def sft_example(tokenizer, messages, max_len=512, mask=True):
    """One conversation -> input_ids and labels. With mask=True the loss is only on the last answer:
    every token of the prompt (template included) gets IGNORE, exactly like the padding of week 4's NER."""
    prompt = tokenizer.apply_chat_template(messages[:-1], add_generation_prompt=True, tokenize=False)
    full = tokenizer.apply_chat_template(messages, tokenize=False)
    a = tokenizer(prompt, add_special_tokens=False).input_ids
    b = tokenizer(full[len(prompt):], add_special_tokens=False).input_ids
    ids = (a + b)[:max_len]
    labels = ([IGNORE] * len(a) if mask else a) + b
    return {"input_ids": ids, "labels": labels[:max_len]}


def batches(examples, batch_size, pad_id, device):
    """Right-padded batches; padding gets IGNORE in the labels, so it never carries loss, and 0 in the attention mask.
    The mask is built from lengths: a pad id can also be a real token of the template (SmolLM2 pads with <|im_end|>)."""
    for i in range(0, len(examples), batch_size):
        chunk = examples[i:i + batch_size]
        width = max(len(e["input_ids"]) for e in chunk)
        pad = [width - len(e["input_ids"]) for e in chunk]
        ids = torch.tensor([e["input_ids"] + [pad_id] * p for e, p in zip(chunk, pad)], device=device)
        mask = torch.tensor([[1] * len(e["input_ids"]) + [0] * p for e, p in zip(chunk, pad)], device=device)
        labels = torch.tensor([e["labels"] + [IGNORE] * p for e, p in zip(chunk, pad)], device=device)
        yield ids, mask, labels


def train_sft(model, examples, pad_id, epochs=1, lr=2e-4, batch_size=16, every=None, on_step=None):
    """The whole of supervised fine-tuning: next-token cross-entropy on the labels, AdamW, a linear decay.
    Only parameters with requires_grad train — with LoRA that is the adapters. Returns the loss per step."""
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=lr, weight_decay=0.0)
    total = epochs * math.ceil(len(examples) / batch_size)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: 1 - s / total)
    losses = []
    model.train()
    for _ in range(epochs):
        for ids, attn, labels in batches(examples, batch_size, pad_id, model.device):
            loss = model(input_ids=ids, attention_mask=attn, labels=labels).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(params, 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            losses.append(loss.item())
            if every and on_step and len(losses) % every == 0:
                model.eval(); on_step(len(losses)); model.train()
    model.eval()
    return losses
# --- end ---


# --- notebook: logprob ---
@torch.no_grad()
def answer_logprob(model, prefixes, answers, batch_size=8):
    """log P(answer | prefix) for token-id lists, summed over the answer's tokens; and the answer's length.
    Like `score`, the unembedding runs only where an answer token is predicted — the vocabulary is 100k wide."""
    body = model.model
    out = np.zeros((len(prefixes), 2))
    order = sorted(range(len(prefixes)), key=lambda k: len(prefixes[k]) + len(answers[k]))
    for i in range(0, len(order), batch_size):
        idx = order[i:i + batch_size]
        seqs = [prefixes[k] + answers[k] for k in idx]
        width = max(map(len, seqs))
        ids = torch.tensor([s + [0] * (width - len(s)) for s in seqs], device=model.device)
        mask = torch.tensor([[1] * len(s) + [0] * (width - len(s)) for s in seqs], device=model.device)
        h = body(input_ids=ids, attention_mask=mask).last_hidden_state
        for row, k in enumerate(idx):
            a, b = len(prefixes[k]), len(answers[k])
            logits = model.lm_head(h[row, a - 1:a + b - 1]).float()
            out[k] = logits.log_softmax(-1).gather(1, torch.tensor(answers[k], device=model.device)[:, None]).sum().item(), b
    return out
# --- end ---


# ----------------------------------------------------------------------------------------------------
# Data and models
# ----------------------------------------------------------------------------------------------------

def run_dtype(device):
    """Half precision wherever it is safe: bf16 on Apple and on Ampere+, fp16 on older CUDA (T4), fp32 on the CPU."""
    if device.type == "mps" or (device.type == "cuda" and torch.cuda.is_bf16_supported(including_emulation=False)):
        return torch.bfloat16
    return torch.float16 if device.type == "cuda" else torch.float32


def load_lm(name, device, local=None):
    path = (local or {}).get(name, name)
    tok = AutoTokenizer.from_pretrained(path)
    tok.pad_token = tok.pad_token or tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(path, dtype=run_dtype(device) if not local else torch.float32)
    return model.to(device).eval(), tok


def load_agnews(smoke, local):
    if smoke:
        return local["data"]["ag_news"]
    return load_dataset("fancyzhx/ag_news")


def load_gsm8k(smoke, local):
    return local["data"]["gsm8k"] if smoke else load_dataset("openai/gsm8k", "main")["test"]


def load_pairs(smoke, local, n):
    ds = local["data"]["pref"] if smoke else load_dataset(PREF_DATA, split="train")
    return ds.shuffle(seed=SEED).select(range(min(len(ds), 4 * n)))


def load_dialogues(smoke, local, n, max_chars=2000):
    """Single-turn dialogues of the SFT stage's mixture, short enough for a 512-token window, in a fixed shuffled order."""
    stream = local["data"]["sft"] if smoke else load_dataset(SFT_DATA, split="train", streaming=True).shuffle(seed=SEED, buffer_size=20_000)
    out = []
    for row in stream:
        m = row["messages"]
        if len(m) == 2 and m[0]["role"] == "user" and m[1]["role"] == "assistant" and len(m[0]["content"]) + len(m[1]["content"]) < max_chars:
            out.append({"messages": m, "source": row.get("source", "")})
        if len(out) == n:
            break
    return out


# ----------------------------------------------------------------------------------------------------
# Smoke: random stand-ins and toy data, no network
# ----------------------------------------------------------------------------------------------------

CHATML = ("{% for m in messages %}<|im_start|>{{ m['role'] }}\n{{ m['content'] }}<|im_end|>\n{% endfor %}"
          "{% if add_generation_prompt %}<|im_start|>assistant\n{% if enable_thinking is defined and not enable_thinking %}"
          "<think>\n\n</think>\n\n{% endif %}{% endif %}")
WORDS = ("the market rose after the company reported strong quarterly results while the team won its match and "
         "scientists announced a new space mission as officials met to discuss the election and oil prices fell").split()


def toy_text(rng, n):
    return " ".join(rng.choice(WORDS) for _ in range(n)).capitalize() + "."


def smoke_world(out_dir):
    """Toy versions of every dataset and two-layer random versions of every model, saved where the notebook can
    load them. Returns {"data": {...}, real model name: local directory}."""
    from tokenizers import ByteLevelBPETokenizer
    from transformers import BertConfig, GPT2Config, GPT2TokenizerFast, LlamaConfig, Olmo2Config, Qwen3Config
    rng = random.Random(SEED)
    data_dir = os.path.join(out_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    ag = [{"text": toy_text(rng, rng.randint(12, 30)), "label": rng.randint(0, 3)} for _ in range(400)]
    gsm = []
    for _ in range(40):
        a, b = rng.randint(1, 20), rng.randint(1, 20)
        gsm.append({"question": f"Tom has {a} apples and buys {b} more. How many apples does he have?",
                    "answer": f"He has {a} + {b} = {a + b} apples.\n#### {a + b}"})
    chat = lambda u, a: [{"role": "user", "content": u}, {"role": "assistant", "content": a}]
    sft = [{"messages": chat(toy_text(rng, 8) + "?", toy_text(rng, 20)), "source": rng.choice(["tulu_v3.9_wildchat", "persona_math"])}
           for _ in range(200)]
    pref = [{"chosen": chat(q, toy_text(rng, 15)), "rejected": chat(q, toy_text(rng, 9)), "source": rng.choice(["ultrafeedback", "wildchat"])}
            for q in [toy_text(rng, 8) + "?" for _ in range(80)]]
    web = [{"text": toy_text(rng, rng.randint(30, 80)), "score": rng.uniform(0, 5)} for _ in range(60)]
    for name, rows in [("ag_train", ag[:300]), ("ag_test", ag[300:]), ("gsm8k", gsm), ("sft", sft), ("pref", pref), ("web", web)]:
        pd.DataFrame(rows).to_json(f"{data_dir}/{name}.jsonl", orient="records", lines=True)
    js = lambda name: load_dataset("json", data_files=f"{data_dir}/{name}.jsonl", split="train")
    world = {"data": {"ag_news": {"train": js("ag_train"), "test": js("ag_test")}, "gsm8k": js("gsm8k"),
                      "sft": js("sft"), "pref": js("pref"), "web": js("web")}}

    bpe = ByteLevelBPETokenizer()
    bpe.train_from_iterator([r["text"] for r in ag] + [r["question"] + r["answer"] for r in gsm], vocab_size=2000,
                            special_tokens=["<|endoftext|>", "<|im_start|>", "<|im_end|>", "<pad>"])
    tok = GPT2TokenizerFast(tokenizer_object=bpe._tokenizer, eos_token="<|endoftext|>", bos_token="<|endoftext|>",
                            unk_token="<|endoftext|>", pad_token="<pad>")
    tok.chat_template = CHATML
    V = len(tok)
    olmo = Olmo2Config(vocab_size=V, hidden_size=64, intermediate_size=128, num_hidden_layers=2, num_attention_heads=4,
                       num_key_value_heads=4, max_position_embeddings=512, tie_word_embeddings=False,
                       pad_token_id=V - 1, eos_token_id=0, bos_token_id=None)
    llama = LlamaConfig(vocab_size=V, hidden_size=48, intermediate_size=128, num_hidden_layers=2, num_attention_heads=6,
                        num_key_value_heads=2, max_position_embeddings=512, tie_word_embeddings=True, bos_token_id=0, eos_token_id=0)
    qwen = Qwen3Config(vocab_size=V, hidden_size=64, intermediate_size=128, num_hidden_layers=2, num_attention_heads=4,
                       num_key_value_heads=2, head_dim=16, max_position_embeddings=512, tie_word_embeddings=True, eos_token_id=0)
    gpt2 = GPT2Config(vocab_size=V, n_positions=512, n_embd=48, n_layer=2, n_head=4, bos_token_id=0, eos_token_id=0)

    def save(name, model):
        world[name] = os.path.join(out_dir, "tiny_" + re.sub(r"[^a-z0-9]+", "_", name.split("/")[-1].lower()))
        if not os.path.exists(world[name]):
            tok.save_pretrained(world[name])
            model.save_pretrained(world[name])

    seed_all()
    stage = AutoModelForCausalLM.from_config(olmo)
    for k, name in enumerate(STAGES.values()):                 # each stage a small move from the one before it, like the real ones
        if k:
            with torch.no_grad():
                for p in stage.parameters():
                    touched = torch.rand_like(p) < (0.3 if k == 3 else 1.0)
                    p.add_(touched * torch.randn_like(p) * [0, 0.05, 0.01, 0.005][k])
        save(name, stage)
    seed_all()
    small = AutoModelForCausalLM.from_config(llama)
    save(SMALL_BASE, small)
    save(SMALL_CHAT, small)
    save(THINKER, AutoModelForCausalLM.from_config(qwen))
    seed_all()
    g = AutoModelForCausalLM.from_config(gpt2)
    save(GPT2, g)
    save("xufana/dsba-week05-punct", g)
    save("HuggingFaceFW/fineweb-edu-classifier", AutoModelForSequenceClassification.from_config(
        BertConfig(vocab_size=V, hidden_size=48, num_hidden_layers=2, num_attention_heads=2, intermediate_size=96,
                   max_position_embeddings=512, num_labels=1, pad_token_id=V - 1)))
    return world


# ----------------------------------------------------------------------------------------------------
# Steps
# ----------------------------------------------------------------------------------------------------

def step_stages(cfg, device, out, local):
    """The same measurements on every stage. A base model gets 'Question: … Answer:' (it has no template);
    the others get their chat template."""
    smoke = local is not None
    texts = [target_text(t) for t in load_agnews(smoke, local)["test"]["text"][:cfg["bpb_texts"]]]
    gsm = load_gsm8k(smoke, local).select(range(cfg["gsm"]))
    golds = [gold_number(a) for a in gsm["answer"]]
    opens = [p["chosen"][0]["content"] for p in load_pairs(smoke, local, cfg["open"]).select(range(cfg["open"]))]
    art = {"sizes": cfg["name"], "device": str(device), "dtype": str(run_dtype(device)), "n_bpb": len(texts), "n_gsm": len(golds),
           "n_open": len(opens), "max_new_tokens": cfg["max_new"], "prompts": DEMO_PROMPTS, "stages": {}}
    for stage, name in STAGES.items():
        model, tok = load_lm(name, device, local)
        chat = stage != "base"
        row = {"model": name, "params": n_params(model), "bits_per_byte": round(bits_per_byte(model, tok, texts), 4)}
        answers = generate(model, tok, [as_prompt(tok, q, chat) for q in gsm["question"]], cfg["max_new"])
        row["gsm8k"] = {"accuracy": round(float(np.mean([reward(a[0]["text"], g) for a, g in zip(answers, golds)])), 4),
                        "tokens": round(float(np.mean([a[0]["tokens"] for a in answers])), 1),
                        "stopped": round(float(np.mean([a[0]["stopped"] for a in answers])), 4)}
        answers = generate(model, tok, [as_prompt(tok, q, chat) for q in opens], cfg["max_new"])
        row["open"] = {"tokens": round(float(np.mean([a[0]["tokens"] for a in answers])), 1),
                       "stopped": round(float(np.mean([a[0]["stopped"] for a in answers])), 4)}
        row["demo"] = [a[0]["text"] for a in generate(model, tok, [as_prompt(tok, q, chat) for q in DEMO_PROMPTS], 160)]
        art["stages"][stage] = row
        log(f"    {stage}: bpb {row['bits_per_byte']}, gsm8k {row['gsm8k']}, open {row['open']}")
        del model
        free()
    json.dump(art, open(f"{out}/stages.json", "w"), indent=1)


def stage_tensors(name, local):
    """{parameter name: (file, key)} for a checkpoint on disk, read lazily — two 1.5B checkpoints never sit in memory whole."""
    from huggingface_hub import snapshot_download
    from safetensors import safe_open
    path = (local or {}).get(name) or snapshot_download(name, allow_patterns=["*.safetensors", "*.json"])
    index = {}
    for f in sorted(os.listdir(path)):
        if f.endswith(".safetensors"):
            with safe_open(os.path.join(path, f), "pt") as h:
                index.update({k: os.path.join(path, f) for k in h.keys()})
    return index


def matrix_kind(key):
    for kind in ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj", "embed_tokens", "lm_head"]:
        if kind in key:
            return kind
    return "norm"


def step_weights(cfg, device, out, local):
    """Distance between consecutive stages, tensor by tensor, on the CPU: ‖B − A‖ / ‖A‖ and the share of numbers
    that are bit-for-bit the same in the stored dtype."""
    from safetensors import safe_open
    names = list(STAGES)
    index = {s: stage_tensors(STAGES[s], local) for s in names}
    art = {"sizes": cfg["name"], "pairs": {}}
    for a, b in [("base", "SFT"), ("SFT", "DPO"), ("DPO", "RLVR"), ("base", "RLVR")]:
        rows, num, den, same, total = [], 0.0, 0.0, 0, 0
        for key in sorted(index[a]):
            with safe_open(index[a][key], "pt") as ha, safe_open(index[b][key], "pt") as hb:
                x, y = ha.get_tensor(key), hb.get_tensor(key)
            eq = int((x == y).sum())
            x, y = x.float(), y.float()
            d, n = (y - x).norm().item() ** 2, x.norm().item() ** 2
            layer = re.search(r"layers\.(\d+)\.", key)
            rows.append({"key": key, "layer": int(layer.group(1)) if layer else -1, "kind": matrix_kind(key),
                         "relative": round(math.sqrt(d / max(n, 1e-30)), 6), "same": round(eq / x.numel(), 6), "numel": x.numel(),
                         "d2": d, "n2": n})
            num, den, same, total = num + d, den + n, same + eq, total + x.numel()
        art["pairs"][f"{a} -> {b}"] = {"relative": round(math.sqrt(num / den), 6), "same": round(same / total, 6), "tensors": rows}
        log(f"    {a} -> {b}: relative {math.sqrt(num / den):.4f}, identical {same / total:.2%}")
    json.dump(art, open(f"{out}/weights.json", "w"), indent=1)


def step_rewards(cfg, device, out, local):
    """The DPO stage's own pairs, scored by the SFT model (DPO's reference) and by the DPO model. The implicit reward of
    an answer is β · (log π_DPO − log π_SFT); its sign per pair does not depend on β."""
    smoke = local is not None
    tok = AutoTokenizer.from_pretrained((local or {}).get(STAGES["SFT"], STAGES["SFT"]))
    prefixes, chosen, rejected, sources = [], [], [], []
    for row in load_pairs(smoke, local, cfg["pairs"]):
        prompt = tok.apply_chat_template(row["chosen"][:-1], add_generation_prompt=True, tokenize=False)
        p = tok(prompt, add_special_tokens=False).input_ids
        c = tok(row["chosen"][-1]["content"] + tok.eos_token, add_special_tokens=False).input_ids
        r = tok(row["rejected"][-1]["content"] + tok.eos_token, add_special_tokens=False).input_ids
        if len(p) + max(len(c), len(r)) <= 1024:
            prefixes.append(p); chosen.append(c); rejected.append(r); sources.append(row["source"])
        if len(prefixes) == cfg["pairs"]:
            break
    art = {"sizes": cfg["name"], "device": str(device), "n": len(prefixes), "source": sources,
           "len_chosen": [len(c) for c in chosen], "len_rejected": [len(r) for r in rejected]}
    for stage in ["SFT", "DPO", "RLVR"]:
        model, _ = load_lm(STAGES[stage], device, local)
        art[stage] = {"chosen": answer_logprob(model, prefixes, chosen)[:, 0].round(3).tolist(),
                      "rejected": answer_logprob(model, prefixes, rejected)[:, 0].round(3).tolist()}
        log(f"    {stage}: mean log P chosen {np.mean(art[stage]['chosen']):.1f}, rejected {np.mean(art[stage]['rejected']):.1f}")
        del model
        free()
    json.dump(art, open(f"{out}/rewards.json", "w"), indent=1)


def step_passk(cfg, device, out, local):
    """n samples at temperature 0.8 per GSM8K problem, for each stage. Keeping the count of right answers per problem
    is enough for pass@k at every k <= n."""
    smoke = local is not None
    gsm = load_gsm8k(smoke, local).select(range(cfg["passk_problems"]))
    golds = [gold_number(a) for a in gsm["answer"]]
    n = cfg["passk_n"]
    art = {"sizes": cfg["name"], "device": str(device), "n_problems": len(golds), "n": n, "temperature": 0.8,
           "max_new_tokens": cfg["max_new"], "stages": {}}
    for stage in cfg["passk_stages"]:
        model, tok = load_lm(STAGES[stage], device, local)
        t = time.time()
        answers = generate(model, tok, [as_prompt(tok, q, stage != "base") for q in gsm["question"]], cfg["max_new"],
                           n=n, temperature=0.8, batch_size=max(1, 64 // n))
        art["stages"][stage] = {"correct": [int(sum(reward(a["text"], g) for a in group)) for group, g in zip(answers, golds)],
                                "tokens": round(float(np.mean([a["tokens"] for g in answers for a in g])), 1),
                                "seconds": round(time.time() - t, 1)}
        log(f"    {stage}: pass@1 {np.mean(art['stages'][stage]['correct']) / n:.3f}")
        del model
        free()
    json.dump(art, open(f"{out}/passk.json", "w"), indent=1)


def step_think(cfg, device, out, local):
    """Qwen3-0.6B with its thinking switched on and off — one model, two templates. Sampling as its card recommends
    (thinking: T 0.6, top-p 0.95; not thinking: T 0.7, top-p 0.8)."""
    smoke = local is not None
    gsm = load_gsm8k(smoke, local).select(range(cfg["think"]))
    golds = [gold_number(a) for a in gsm["answer"]]
    model, tok = load_lm(THINKER, device, local)
    art = {"sizes": cfg["name"], "device": str(device), "model": THINKER, "n": len(golds), "modes": {}}
    for mode, on, temp, top_p, budget in [("thinking", True, 0.6, 0.95, cfg["think_max_new"]), ("no thinking", False, 0.7, 0.8, cfg["max_new"])]:
        seed_all()
        t = time.time()
        answers = [a[0] for a in generate(model, tok, [as_prompt(tok, q, enable_thinking=on) for q in gsm["question"]], budget,
                                          temperature=temp, top_p=top_p, batch_size=16)]
        art["modes"][mode] = {"accuracy": round(float(np.mean([reward(a["text"].split("</think>")[-1], g) for a, g in zip(answers, golds)])), 4),
                              "tokens": [a["tokens"] for a in answers], "stopped": round(float(np.mean([a["stopped"] for a in answers])), 4),
                              "max_new_tokens": budget, "seconds": round(time.time() - t, 1), "demo": answers[0]["text"][:3000]}
        log(f"    {mode}: accuracy {art['modes'][mode]['accuracy']}, mean tokens {np.mean(art['modes'][mode]['tokens']):.0f}")
    json.dump(art, open(f"{out}/think.json", "w"), indent=1)


def stops_and_bpb(model, tok, questions, texts, max_new):
    answers = [a[0] for a in generate(model, tok, [as_prompt(tok, q) for q in questions], max_new)]
    return {"stopped": round(float(np.mean([a["stopped"] for a in answers])), 4),
            "tokens": round(float(np.mean([a["tokens"] for a in answers])), 1),
            "bits_per_byte": round(bits_per_byte(model, tok, texts), 4), "demo": [a["text"] for a in answers[:5]]}


def step_sft(cfg, device, out, local):
    """The notebook's live run at full size: SmolLM2-135M (base) + LoRA r = 16 on the SFT stage's dialogues, one epoch —
    once with the loss on the answers only, once on every token. The template is the -Instruct model's (same vocabulary)."""
    from peft import LoraConfig, get_peft_model
    smoke = local is not None
    dialogues = load_dialogues(smoke, local, cfg["sft_train"] + cfg["sft_eval"])
    train, held = dialogues[:cfg["sft_train"]], dialogues[cfg["sft_train"]:]
    questions = [d["messages"][0]["content"] for d in held]
    texts = [target_text(t) for t in load_agnews(smoke, local)["test"]["text"][:300]]
    chat_tok = AutoTokenizer.from_pretrained((local or {}).get(SMALL_CHAT, SMALL_CHAT))
    art = {"sizes": cfg["name"], "device": str(device), "n_train": len(train), "n_eval": len(held), "lora_r": 16, "runs": {}}
    for run, mask in [("answers only", True), ("every token", False)]:
        seed_all()
        model, _ = load_lm(SMALL_BASE, device, local)
        model = model.float()
        if run == "answers only":
            art["before"] = stops_and_bpb(model, chat_tok, questions, texts, cfg["max_new"])
        model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, target_modules="all-linear", task_type="CAUSAL_LM"))
        examples = [sft_example(chat_tok, d["messages"], mask=mask) for d in train]
        t = time.time()
        losses = train_sft(model, examples, chat_tok.pad_token_id, lr=2e-4, batch_size=16)
        art["runs"][run] = {"seconds": round(time.time() - t, 1), "loss": [round(x, 4) for x in losses],
                            "share_with_loss": round(float(np.mean([np.mean([l != IGNORE for l in e["labels"]]) for e in examples])), 4),
                            **stops_and_bpb(model, chat_tok, questions, texts, cfg["max_new"])}
        log(f"    {run}: {art['runs'][run]['seconds']:.0f}s, stopped {art['runs'][run]['stopped']}, bpb {art['runs'][run]['bits_per_byte']}")
        del model
        free()
    model, _ = load_lm(SMALL_CHAT, device, local)
    art["official instruct"] = stops_and_bpb(model, chat_tok, questions, texts, cfg["max_new"])
    json.dump(art, open(f"{out}/sft.json", "w"), indent=1)


def step_forgetting(cfg, device, out, local):
    """Week 5's punctuation task on gpt2, three ways: every weight, LoRA r = 64, LoRA r = 8. Along the way: the task's own
    held-out loss, bits per byte on AG News, and week 5's zero-shot scorer on AG News."""
    from peft import LoraConfig, get_peft_model
    smoke = local is not None
    ag = load_agnews(smoke, local)
    train_texts = [target_text(t) for t in ag["train"].shuffle(seed=SEED)["text"][:cfg["forget_train"]]]
    eval_texts = [target_text(t) for t in ag["test"]["text"][:cfg["forget_eval"]]]
    labels = np.array(ag["test"]["label"][:cfg["forget_eval"]])
    art = {"sizes": cfg["name"], "device": str(device), "n_train": len(train_texts), "n_eval": len(eval_texts), "runs": {}}
    for run, r in [("every weight", None), ("LoRA r = 64", 64), ("LoRA r = 8", 8)]:
        seed_all()
        model, tok = load_lm(GPT2, device, local)
        model = model.float()
        pair = lambda t: {"input_ids": (a := tok(strip_text(t) + " =>").input_ids) + (b := tok(" " + t).input_ids + [tok.eos_token_id]),
                          "labels": [IGNORE] * len(a) + b}
        train, held = [pair(t) for t in train_texts], [pair(t) for t in eval_texts[:100]]
        if r:
            model = get_peft_model(model, LoraConfig(r=r, lora_alpha=2 * r, target_modules=["c_attn", "c_proj", "c_fc"],
                                                     fan_in_fan_out=True, task_type="CAUSAL_LM"))
        curve = []

        def measure(step):
            with torch.no_grad():
                task = np.mean([model(input_ids=ids, attention_mask=m, labels=l).loss.item()
                                for ids, m, l in batches(held, 16, tok.eos_token_id, model.device)])
            base = model.get_base_model() if r else model
            pred = score(base, tok, [t + " This news is about" for t in eval_texts], CLASS_WORDS)[:, :, 0].argmax(1)
            curve.append({"step": step, "task loss": round(float(task), 4), "bits_per_byte": round(bits_per_byte(base, tok, eval_texts), 4),
                          "zero-shot": round(float((pred == labels).mean()), 4)})

        measure(0)
        lr = 5e-5 if r is None else 5e-4
        losses = train_sft(model, train, tok.eos_token_id, lr=lr, batch_size=16, every=cfg["forget_every"], on_step=measure)
        art["runs"][run] = {"lr": lr, "trainable": sum(p.numel() for p in model.parameters() if p.requires_grad), "curve": curve, "loss": losses}
        log(f"    {run}: {curve[0]} -> {curve[-1]}")
        del model
        free()
    json.dump(art, open(f"{out}/forgetting.json", "w"), indent=1)


STEPS = {"stages": step_stages, "weights": step_weights, "rewards": step_rewards, "passk": step_passk,
         "think": step_think, "sft": step_sft, "forgetting": step_forgetting}


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
    out = os.path.join("/tmp/dsba_nlp", os.path.basename(here)[:6], "artifacts_smoke") if args.smoke else os.path.join(here, "artifacts")
    os.makedirs(out, exist_ok=True)
    device = torch.device("cpu" if args.cpu else "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    log(f"tier {tier}, device {device}, steps {args.only}")

    local = smoke_world(out) if args.smoke else None
    for step in args.only:
        t, _ = time.time(), globals().__setitem__("PEAK", 0.0)
        log(f"--- {step}")
        STEPS[step](cfg, device, out, local)
        gpu_gb()
        log(f"    {step}: {time.time() - t:.0f}s, GPU peak {PEAK:.1f} GB")
        free()


if __name__ == "__main__":
    main()
