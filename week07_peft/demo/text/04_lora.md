# lora · LoRA

## lora-p1

When we fine-tune, every weight matrix $W$ moves to $W + ΔW$. The idea of LoRA (Hu et al., 2021): $ΔW$ does not need all of its numbers. Freeze $W$, and learn the update as the product of two thin matrices of rank $r$: $B$ of size $d × r$ and $A$ of size $r × k$, with $r$ around 8.

## lora-note1

Step through the three states. At **init** $B = 0$, so the model is exactly the pretrained one. In **training** only $A$ and $B$ get gradients. After training, **merge**: $\frac{α}{r}BA$ is added into $W$ once, and inference costs nothing extra — unlike an adapter, there is no extra layer left.

## bet-init

$A$ starts random and $B$ at zero. What if both start at zero?

## init-note

Both stay at zero forever: the gradient of $B$ is proportional to $Ax$, the gradient of $A$ to $B^⊤$, and both are zero. One of them has to be random. $B = 0$ is chosen so that training starts from the pretrained model exactly; random $A$ with zero $B$ trains as well as the reverse.

## lora-p2

Why should a low rank be enough? The update is not the weights. A pretrained matrix uses all of its directions; the change a small task needs is a handful of them. Aghajanyan et al. (2020) measured how few directions a fine-tune needs: 200 trainable parameters, randomly projected back into the full space of RoBERTa, reach 90% of full fine-tuning on MRPC.

## bet-rank

Which of the two matrices survives being squeezed to rank 4?

## rank-note

Rank {r}: {w_keep} of $W$'s energy, {dw_keep} of $ΔW$'s. The spectrum of $W$ decays slowly, the spectrum of $ΔW$ falls off a cliff after a few directions. A rank-$r$ $BA$ stores $r(d + k)$ numbers instead of $dk$ — here {lora_n} instead of {full_n}.

## lora-p3

The most important parameter of this model is the rank of matrices $A$ and $B$ ($r$). Increasing it gives more degrees of freedom in adjusting the $BA$ additive, thereby increasing the number of trainable parameters. The library is `peft`; the class below is what it does to one linear layer.

## code-note

In the original article, the authors train only $W_Q$ and $W_V$. GPT-2 computes Q, K and V with one layer, `c_attn` ($768 → 2304$), so `target_modules=['c_attn']` gives **one** pair $A, B$ for all three: the rank-8 update is shared by Q, K and V. And GPT-2's `Conv1D` stores $W$ transposed — hence the `fan_in_fan_out` warning `peft` prints.

## bet-where

The same budget of trainable parameters. Put it all into one matrix at rank 8, or spread it over several at a smaller rank?

## where-note

Spreading wins: on MultiNLI the best column is all four matrices at rank 2, on WikiSQL $W_Q, W_V$ at rank 4 ties with it, and $W_Q$ or $W_K$ alone are the worst. A rank of 2–4 already captures enough of $ΔW$ that it pays to adapt more matrices.

## bet-r

$W_Q, W_V$ on GPT-3. The smallest rank within the noise of $r = 64$?

## r-note

Rank **1**. On both datasets $r = 1$ is within the noise of $r = 64$ for $W_Q, W_V$ — and $W_Q$ alone needs a larger $r$ and never catches up.
