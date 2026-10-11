# serve · Memory: the cache, with numbers

## serve-p1

Training is paid once. A served model pays two bills on every request, and week 5 left both open: the **memory** the cache takes, and the **time** a token takes. The model keeps $K$ and $V$ of every past token in every layer — exactly the tensor on the commented line of `Attention`: `[B, kv_heads, T, head_dim]`, twice, per layer.

## bet-cache

Llama-3-8B, 16-bit: at what context does the conversation weigh more than the model? Set T, then reveal.

## serve-p2

**SmolLM2 has two and a half times GPT-2's layers and a smaller cache** — 11 520 numbers per token against 18 432. Ungrouped it would be 34 560. Grouping the keys and values saves a third of the attention's *parameters* and two thirds of the *cache*, and the cache is the bill that grows with every token of every user.

**Llama-3-8B: 128 KB per token.** 1 GiB at 8 192 tokens. At the 131 072 of Llama 3.1 — the same shapes — 16 GiB, and the weights themselves, in 16 bits, are 15 GiB. At full context *the conversation weighs more than the model*. This is the second number behind every "128k context" on a model card, next to θ: the position scheme makes the long context *representable*, the K/V grouping makes it *storable*. On a GPU that serves a language model the cache, not the weights and not the arithmetic, is the first thing to cap how many requests share it.

## serve-p3

One pass over a 64-token prompt, or 64 passes to write 64 tokens. With the cache those are two different *regimes*, and a served model lives in both on every request: **prefill** — the prompt goes through in one pass, all positions in parallel, and leaves the cache behind; its cost is the time to the first token. **Decode** — one token per pass, each pass reading the whole cache; its cost is the time *between* tokens.

## bet-prefill

In tokens per second, how much faster is prefill than decode at a prompt of 256 tokens, SmolLM2 on the T4?

## bet-decode

And does a decode step get slower as the prompt grows from 16 to 960?

## serve-p4

Prefill pushes hundreds of tokens through the stack in one batched pass and the GPU does them in parallel; decode pushes *one*, and pays the full price of walking thirty layers for it — launching every kernel, reading every weight — to produce a single row. That is why providers price input and output tokens differently. Two numbers a user feels come straight from this table: **time to first token** is the prefill; **tokens per second** after that is the decode. A long system prompt costs the first and is nearly free in the second — and if a thousand users share the same system prompt, its cache can be computed once and shared: *prefix caching*.

## serve-p5

Every notebook of this course has had the line `.to(device)` in it, and we have never said what it does. It **copies**. A model on a GPU lives in the GPU's memory; a Python list of token ids lives in the CPU's. Three things about that cost time and are in no FLOP count.

**The GPU does not do what you say when you say it.** A line like `b = a @ a` on a GPU tensor *queues* the multiplication and returns. Python moves on; the work happens later. The moment you need a value on the CPU — `.item()`, `.cpu()`, `print(b)` — Python stops and waits for the whole queue. So a naive timer measures the wrong thing, and `sync` exists to make ours honest.

## bet-queue

How long does the Python line take to return — against how long the product takes to exist?

## queue-note

On a GPU the two numbers differ by orders of magnitude; on a CPU they are the same number, because there is no queue. Every timing in week 5 that ended in `generate` was honest by accident — `generate` hands back token ids, and that forces the wait. A timing of a bare forward pass is not.

## serve-p6

**The copy costs by the byte, and a small tensor is cheaper to compute where it already is.** A matrix product at growing sizes, on the CPU, on the GPU, and on the GPU *with the round trip* — the matrix sent there and the result brought back.

## bet-xover

From which size does the GPU win — and does the answer change when you count the trip? Click two sizes on the axis.

## serve-p7

At the small sizes the CPU wins outright: a GPU operation has a fixed cost of launching — tens of microseconds whatever the size — and a 16 × 16 product is over before the launch is. At the large sizes the GPU wins by a wide margin, and the round trip takes some of it back. A batch of token ids is kilobytes, a batch of logits is not — `[64, 262, 50 257]` floats is a 3.4 GB tensor. On an M-series Mac there is no bus to cross — the CPU and the GPU share one memory — but there is still a copy into memory the GPU manages, and still the wait.

**The loop decides how often you pay.** A generation loop has to choose a token at every step. The choice can be made on the GPU — `argmax` there, and the id never leaves — or the careless way: bring the logits to the CPU, choose with numpy, send the id back. Same tokens, same model.

## bet-rt

How much slower is the round trip — a few percent, or a few times?

## serve-p8

Three rules that come out of this, and they hold for every model: **keep the loop on one side** — choose, stop and count on the GPU; cross once, at the end. **Time with a sync, or do not time.** **Small work belongs where the data already is** — a GPU is for tensors big enough to pay for the launch.

## serve-p9

The compute bill is $2N$ per token, and the law of block 01 says the loss falls with $N$. So far those were the same $N$. A **mixture of experts** pulls them apart. The feed-forward is $8d^2$ of $10.67d^2$ — three quarters of every block. MoE keeps the attention as it is and replaces the feed-forward by $E$ feed-forwards of the same size and a tiny *router* — one linear layer that scores the $E$ experts for each token. The token goes through its top $k$ only, and their outputs are mixed with the router's softmax over those $k$. The model *owns* $E$ feed-forwards per block and *runs* $k$.

## serve-note1

The router in our demo is random — nobody trained it — so read the *mechanics* and not the assignment. In a trained MoE the assignment does mean something, and usually not what the word "expert" suggests: Mixtral's authors looked for experts specialised by topic and found routing that follows syntax and position far more than subject.

## serve-note2

Look at the loop in `MoE.forward`: the tokens of a batch scatter to different experts in uneven piles — <span id="moe-hist"></span> — and have to be gathered back. Eight small products instead of one big one, and the biggest pile sets the pace of the whole layer. The previous block just told you what small scattered work costs on a GPU. **Memory pays for everything you own:** all eight experts sit on the GPU; the saving is in arithmetic, not in gigabytes.

## bet-moe

Mistral 7B is 7.24B parameters. Mixtral 8x7B is the same model with 8 experts per block, 2 active. How many parameters does it own? <input type="text" id="moe-guess" placeholder="B" style="width:110px;display:inline-block;margin-left:8px">

## serve-p10

The name "8x7B" is not the size: the attention, the embeddings and the norms are shared, so eight experts cost 6.4 times the model, not eight. gpt-oss-20b the other way round: 20.9B owned, 3.6B active — the memory bill of a 21B model, the per-token compute of a 3.6B one. "Active parameters" is a number with a definition behind it: OpenAI does not count the input embedding, because looking up a row is not a multiplication. On the bill of the claim: MoE grows $N$ — the thing the scaling law rewards — while $N_{\text{active}}$, the thing every token pays for, stays put.

## serve-p11

"Context length" on a model card is one number. Three different things have to allow it. **Positions** — the model must be able to *represent* position 100 000: a table cannot; a rotation can, with a θ chosen for it. **Memory** — the cache grows linearly with the context, by the token. **Compute** — every token attends to every earlier token: the number of (query, key) pairs grows with the *square* of the context.

## serve-note3

The third limit has no fix that keeps full attention. What models do is stop using full attention in every layer: at 8 192 tokens, full attention scores 67.1M pairs per head per layer, a window of 128 scores 1.05M, and ModernBERT's mix — full in every third layer — comes to 23.1M on average, 2.9 times cheaper, with a global look at the whole sequence still happening every third layer. Gemma 3 interleaves five windowed layers with one global one.

## serve-p12

**Or stop paying by the pair.** The square comes from one place: a softmax has to see every score $q_t·k_s$ before it can normalise, so the $T×T$ matrix has to exist. **Linear attention** (Katharopoulos et al. 2020) replaces $\mathit{exp}(q_t·k_s)$ by $φ(q_t)·φ(k_s)$ for a positive feature map φ — and then the brackets move:

## serve-p13

$S_t$ and $z_t$ are running sums, so the layer is a recurrence with a state of $d_{\mathit{head}}^2+d_{\mathit{head}}$ numbers per head, whatever $T$ is. The transformer has become an RNN (week 2), and two of the three limits move at once: the cache becomes a state that does not grow with the context, and the pairs become $T·d_{\mathit{head}}^2$ instead of $T^2·d_{\mathit{head}}$.

## bet-lin-state

SmolLM2's shapes — 3 K/V heads of 64. From what context on is the state *smaller* than the KV cache?

## bet-lin-time

The arithmetic says linear wins at every T &gt; d<sub>head</sub>. One layer on the M4, T from 512 to 8 192: does the clock agree?

## bet-lin-swap

SmolLM2's attention was trained with a softmax. Put φ(x) = elu(x) + 1 into our Attention on its trained weights — nothing retrained. Bits per byte: 1.28 → ?

## cache-check

kv_cache_bytes in the browser matches the notebook · measured {bytes} bytes at {T} tokens, formula {formula}

## cache-note

Llama-3-8B: 128 KB per token, 15 GiB of weights — the cache catches the weights at <b>{tx}</b> tokens, inside the 131 072 that Llama 3.1 put on the same shapes. At full context the conversation weighs 16 GiB and the model 15. Without grouping — all 32 heads — it would be 64 GiB, for one user. Nine users: 24 GiB minus 15 of weights leaves 9; at 1 GiB of cache per user at 8 192 tokens, that is nine conversations at once, whatever the card could compute.

## serving-note

On the {device}: prefill {prefill} tokens/s against decode {decode} at a prompt of 256 — <b>{ratio}×</b>. The decode step goes {dec_first} → {dec_last} ms from 16 to 960 tokens of prompt: {trend}. On the M4 the same ratio is {live_ratio}×; the live numbers move run to run. The cache column grows linearly with the prompt, by the formula above, to the byte.

## xover-note

On the {device}: the GPU alone wins from <b>n = {win}</b>; counting the trip there and back, from <b>n = {win_trip}</b>. At 16 × 16 the CPU is {cpu_faster}× faster — the product is over before the launch is. At 2 048 the GPU is {gpu_faster}× faster, and the trip takes {trip_pct}% of that time back. The transfer table prices the copy: 40 MB crosses in {ms_artifact} ms on the {device} and {ms_live} ms on the M4, where there is no bus — only a copy into memory the GPU manages.

## rt-note

Whatever the ratio is on your machine, read what it is made of: a row of 49 152 logits is 200 KB — cheap to carry — and what the round trip really adds is a forced wait and two small copies at every step, 64 times. A loop that also *prints* each token as it goes, logs a tensor, or checks a stopping condition in Python pays the same toll. None of it is in 2N per token.

## moe-note

{verdict} <b>{owned}B owned, {active}B run</b> — the two numbers in Mistral's announcement, rebuilt from Mistral 7B's config: {ffn}B of the 7.24B are feed-forwards, and only they are multiplied by eight. gpt-oss-20b: about {expert}B per expert and {shared}B shared by our assumption; the model card says 19.1B in the experts (0.60B each — we were right), 0.64B in the attention and 1.16B in the two embedding tables — 1.8B shared, because OpenAI does not count the input embedding as *active*. Either way: the memory bill of a 21B model, the per-token compute of a 3.6B one.

## lin-note

<b>{cross} tokens.</b> The state of one layer is {state} numbers, the cache {per_token} per token; past {cross} tokens of context the recurrent form holds *less* than the cache, and at 8 192 it holds {ratio_8k} times less. <b>The arithmetic wins, the clock does not:</b> T · d² is {fewer}× fewer multiplications than T² · d at {T}, and our `linear_attention` is {slower}× *slower* than the softmax there on the M4 ({ms_softmax} against {ms_linear} ms). `cumsum` over a \[T, 64, 64\] tensor is memory traffic, and `scaled_dot_product_attention` is a fused kernel somebody spent years on — a FLOP count is not a time. Every linear-attention model in use ships a chunked, fused kernel for exactly this sum (Yang et al. 2024 put *hardware-efficient* in the title). <b>The weights do not transfer:</b> {bpb_softmax} → {bpb_linear} bits/byte on the same {n_texts} texts. The trained q and k were shaped for an exponential; elu + 1 is not one. Linear attention is a different model, trained from scratch or distilled — the third way to pay the compute bill for context: not full attention everywhere, not a window, but a state.

## moe-none

No guess typed.

## moe-right

<b>{g}B — right.</b>

## moe-said

You said {g}B.

## serving-trend-cache

the longer cache shows

## serving-trend-flat

flat — at these lengths the step is paying for thirty layers of kernel launches, not for reading the cache
