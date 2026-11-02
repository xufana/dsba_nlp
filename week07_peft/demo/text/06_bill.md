# bill · What fewer parameters save

## bill-p1

The point of training 0.24% of the parameters is to pay less. Pay for what?

## bet-speed

LoRA trains {pct} of the parameters full fine-tuning trains. How much faster is one training step?

## speed-note

{lora} steps per second against {ft} — **{faster}% faster**. The forward pass still goes through all 124M frozen weights, and the backward pass still has to carry the gradient through every layer down to the lowest adapter. What LoRA skips is computing the gradients *of* the frozen weights and the optimizer update — a small part of the step.

## bill-p2

What it does save is memory. Full fine-tuning with Adam keeps, for every parameter, the weight, its gradient and two optimizer moments — 16 bytes per parameter in fp32. LoRA keeps the frozen weights in 16 bits and the rest only for its few million. **QLoRA** (Dettmers et al., 2023) goes further: the frozen base is stored in 4 bits, enough to fine-tune a 65B model on a single 48 GB GPU.

## bet-fit

A 13B model on one 16 GB T4. Which of the three fit?

## fit-note

Weights, gradients and optimizer only, before activations. Full fine-tuning needs {ft} — {t4s} T4s. LoRA needs {lora}: the frozen weights alone are already over. QLoRA needs {qlora}, and the rest of the card is left for activations. This is why QLoRA exists.

## bill-p3

And the storage. When fine-tuning for several different tasks, you only need to store the set of changed parameters for each task — one base model and a file of adapters per task, swapped per request.

## store-note

GPT-2 small in fp32: a fine-tuned copy is {full}, a LoRA adapter (r = 8 on `c_attn`, plus the head) is {adapter}.
