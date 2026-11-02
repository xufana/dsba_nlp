# map · Where the trainable parameters go

## map-p1

All of today's methods on one picture of GPT-2: twelve blocks, each with attention (`c_attn`, `c_proj`) and a feed-forward network (`c_fc`, `c_proj`), and the head on top. One more method from the same family: **BitFit** (Ben Zaken et al., 2021) — the biases have very few parameters, so train only them.

## bet-sort

Sort by the number of trainable parameters, smallest first.

## map-note

Coloured is what trains. The count is computed here from GPT-2's shapes; the check compares it to what `print_trainable_parameters()` printed in the notebook.
