# sft · supervised fine-tuning: the same loss, with a mask

## sft-p1

SFT is the cross-entropy of week 2 on dialogues, with one change. The model reads the whole conversation, but the loss is summed only over the tokens of the **answer** — every token of the prompt, the template's markers included, gets the label `IGNORE = -100`, the same value week 4 put on the padding and on the second pieces of words in NER. The model is not asked to predict what the user will write; it is asked to predict what the assistant writes, given everything before it.

The data is OLMo's own SFT mixture. One real dialogue, through SmolLM2-Instruct's template:

## bet-mask

Click every token the loss should count. Then reveal the mask.

## mask-note

Green is what the model is trained to write: the answer, and the `<|im_end|>` after it — the only reason a fine-tuned model ever *stops*. Everything else is context. Here **{loss} of {n}** tokens carry loss: the other {rest} are still computed — the answer cannot be read without them. That is the price of conditioning.

## mask-off-note

Forget the mask, and the model learns to write the user's side too: the distribution of *questions* and of the template's markers as much as of answers. Asked something, it may answer and then carry on with a new `user` turn of its own — and with {prompt} prompt tokens to {answer} answer tokens, most of what it learns is how users write.

## mask-score

You marked {picked} tokens, {hit} of them right; {missed} answer tokens missed, {extra} prompt tokens marked by mistake.

## trl-p1

We won't train live today — the loop is week 2's, with the `labels` of the cell above. This is how the same SFT looks with a library, TRL's `SFTTrainer`: our mask is its *prompt–completion* format, and our loop is its defaults. Hover a line.

## trl-note

TRL 1.14; 1.15 always runs its LM head through a Triton kernel — Linux only, fails on a Mac.

## collate-note

Why `group_by_length`: {n} dialogues of this mixture, mean {mean} tokens, in batches of {batch}. In a random order **{padRandom}%** of the batch is padding; sorted by length, **{padSorted}%**. Padding gets `IGNORE` in the labels and 0 in the attention mask — it carries no loss and reads nothing, but the forward pass still pays for it.

## policy-p1

Now that we have seen all of them, one word sorts the methods — and the recipes below. **Off-policy**: the tokens in the sum were written by someone else — the web, a human, a teacher model, pairs collected last month. **On-policy**: the model writes them itself during training, something judges them, and the gradient goes back into the same model that wrote them.

SFT is off-policy by construction. DPO on a fixed dataset is off-policy too, even when the pairs were sampled from the SFT model before training — *on-policy* in a dataset's name says who wrote the answers, not who writes them at the step. PPO and GRPO are on-policy: a fresh sample every step. Rejection sampling — R1's third stage — is the hybrid: on-policy data, off-policy loss.

## policy-p2

Why it matters: the model that samples its own answers stays close to its own distribution, while SFT pulls it towards someone else's text, token by token. That is why RL moves the weights least of the three stages, and why **RL forgets less than SFT** at equal gain on the new task (Shenfeld et al. 2025, *RL's Razor*).

## policy-s-sft

**SFT** — off-policy. The answers were written before training, by a human or a teacher model; the model only reads them.

## policy-s-dpo

**DPO** — off-policy. The pairs are a fixed dataset; even when both answers were sampled from the SFT model, they were sampled once, before the first step.

## policy-s-online

**Online DPO** — on-policy. The same loss, but every step the current model writes two answers and a judge picks the better one.

## policy-s-grpo

**PPO, GRPO** — on-policy. A fresh group of samples from the current model every step; the reward model or the checker weighs them.

## policy-s-rs

**Rejection sampling** — the hybrid. The model writes many answers, the checker keeps the right ones, and they become an SFT dataset: on-policy data, off-policy loss.
