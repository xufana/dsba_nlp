# flow · where the loss comes from and where the gradient goes

## flow-sft

The loss is born at the end: cross-entropy at the answer's positions only. The gradient goes back through the logits into **every layer** of the model — and also through the prompt's positions: they carry no loss, but the answer's tokens attended to them, so their hidden states are on the gradient's path. Every weight of $π_θ$ gets a gradient; nothing else is in memory.

## flow-rm

The reward model is trained first, on its own: the SFT body with the vocabulary head swapped for one number. The gradient of $−\mathrm{log}\hspace{0.2em}σ(r_c − r_r)$ flows into both of its forward passes — the chosen and the rejected answer go through the same weights. After this stage it is frozen.

## flow-ppo

The reward is born **outside** the gradient: sampling a token is not differentiable, and the frozen reward model only hands over a number. That number, minus the KL to the reference, and the critic's values become the advantages $Â_t$ — constants for the loss. The gradient then enters $π_θ$ only through $\mathrm{log}\hspace{0.2em}π_θ$ of the tokens it sampled itself, recomputed with gradients; the critic gets its own regression loss. Two models of four are trained.

## flow-dpo

Four forward passes, one loss: $\mathrm{log}\hspace{0.2em}π$ of the chosen and of the rejected answer under the model being trained and under the frozen reference. The reference's two numbers are constants — they can be computed once, before training. The gradient reaches $π_θ$ through both answers: up through the chosen one, down through the rejected one, weighted by $σ(−\mathrm{margin})$.

## flow-grpo

Like PPO without the critic. The reward comes from a program — not differentiable, no weights; the advantages $A_i$ are constants computed from the group. The gradient enters $π_θ$ only through $\mathrm{log}\hspace{0.2em}π_θ$ of its own sampled tokens, every token of answer $i$ with the same weight $A_i$; the frozen reference adds only the KL term (and is often dropped: Olmo 3's RL run sets $β = 0$).

## flow-distill

The teacher is frozen and only produces targets: its written answers (sequence distillation) or its distribution at every position (logit distillation). The gradient goes into the student only. In on-policy distillation the student writes the answers itself — the sampling is again outside the gradient — and the teacher scores every position of them.

## weights-note

**Which share actually moved.** Every weight of $π_θ$ got a gradient at every stage — but between the released checkpoints {changed}% of the {numel} numbers differ from the {from} checkpoint. The rest are bit-for-bit the same in bf16: an update smaller than half a step of bf16 at that number's size rounds away. Look at the embeddings: {emb}%. A row of the embedding gets a gradient only when its token appears in a batch, and most of the 100 352 tokens never do in post-training data; `lm_head` gets a gradient in every row through the softmax — {head}%.

## weights-note-sft

**Which share actually moved.** Every weight of $π_θ$ got a gradient. Between the released base and SFT checkpoints {changed}% of the numbers differ — everything, embeddings included. (The *size* of that move is not shown: our measurement of it, 132% of the weights' norm, is too large for a fine-tune and is being checked.)
