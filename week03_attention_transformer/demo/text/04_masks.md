# masks · Cross, self, causal

## masks-p1

Three cases of one formula:

**Cross-attention** — queries from one sequence (en), keys and values from another (de). The decoder reading the encoder.<br>
**Self-attention** — $Q$, $K$ and $V$ all from the same sequence (for example, en): every position gathers a context from every other position. This is the one that replaces recurrence.<br>
**Masked (causal) self-attention** — self-attention where position $t$ is forbidden to look at positions ${>t}$. Without the mask, position $t$ would simply read the answer at ${t+1}$ from the gold sequence, learn nothing, and have nothing to read at generation time.

Masks are just boolean matrices, and it is worth seeing them once as pictures. A padding mask says which *keys* are real tokens; a causal mask says which *keys* are in the past; a decoder's self-attention uses both.

## masks-note1

In the code, black cells get ${−10^9}$ added to their score before the softmax, so their weight is exactly zero after it.
