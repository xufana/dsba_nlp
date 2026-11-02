# adapters · Adapters

## adapters-p1

Adapters (Houlsby et al., 2019): after each attention and feed-forward layer a small trainable block is added — a skip connection around two fully connected layers that go down to a small dimension $m$ (≈ 64) and back up. Only the adapters, the norms and the head are trained, and the quality reaches fine-tuning.

The cost is that the adapters are *extra layers*: they are computed after the layer they sit on, never in parallel with it.

## bet-latency

Where do adapters slow the model down more — a large batch of long texts, or one short request?

## latency-note

At batch 32 × 512 tokens adapters add {big}%; at one request of 128 tokens, **{small}%**. A large batch keeps the GPU busy with the big matrices, and the two small extra layers hide inside; one short request is all latency, and every extra layer is another step the GPU waits for. That is the case of a chat service — and the reason for the next block.
