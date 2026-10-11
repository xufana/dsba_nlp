# cost · What is wasted, and the cache

## cost-p1

One forward pass over 64 tokens returns 64 distributions, and 64 training signals. Generating 64 tokens is 64 forward passes, because token $t$ has to exist before token ${t+1}$ can be predicted. This is `Transformer.greedy` from week 3, as we wrote it: the decoder re-reads the growing prefix at every step.

## cost-note1

At step $t$ the only new thing is the token we just appended. Every other position's keys and values in every layer were computed at step ${t−1}$ and have not changed — the causal mask guarantees they cannot. So keep them: the model stores $K$ and $V$ per layer, and every new token adds one row to each. Nothing about the maths changes; we stop repeating it.

## bet-kv-one

One pass over a 53-token prompt against generating 64 tokens after it — how many times slower?

## bet-kv-ratio

`use_cache=False` against `True` at 896 new tokens — the ratio? By token-passes it should be about 500.

## cost-p2

Three numbers per item, and they are all you need to fill a card in block 04: **passes per item** — an encoder with a head: 1; a decoder as a scorer: one per candidate; a decoder as a generator: one per output token. **Tokens read** — the input, once; a scorer reads it once per candidate; a generator also reads back what it wrote, one token per step. **Tokens written** — 0 for a head, $T_{\mathit{out}}$ for a generator. The cost table's fourth column — milliseconds per 1 000 items — is measured, not derived.

## kv-note

Count token-passes and the cache should buy a factor of P + T/2 — about {predicted_896} at 896 tokens. Measured on the M4: {ratio_64} at 64, {ratio_896} at 896. The uncached run pushes hundreds of positions through the network in one batched pass, which the GPU does in parallel; the cached step is one token, and what it pays for is launching kernels, not arithmetic — a one-token step cost {step_ms} ms, the whole {prompt_tokens}-token pass {pass_ms} ms. The quadratic term is real, and it shows only when the prefix is long. Both numbers move by tens of percent between runs on MPS. The bill for the cache — memory, per token, per layer — is next week.
