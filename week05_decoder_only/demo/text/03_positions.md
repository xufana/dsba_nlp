# positions · The table, or the rotation

## positions-p1

Attention has no order of its own; something has to tell it which token is where. GPT-2 does it with a table `wpe`: one row per position, 1 024 rows, added to the token embedding *once*, at the input. Row 1 025 does not exist. That is the constraint behind every context-window number you have seen since — GPT-2 1 024, GPT-3 2 048, Llama 2 4 096, then 8k, 128k, a million: a table cannot grow after training, so almost every model after 2021 stopped using one.

What replaced it is a **rotation** (RoPE, Su et al. 2021), and it lives in every layer rather than at the input. Split a query of dimension $d$ into ${d/2}$ pairs of coordinates, and turn pair $i$ at position $m$ by the angle ${mθ_i}$, one frequency per pair.

## positions-p2

A rotation by $m$ against a rotation by $n$ is a rotation by ${n−m}$, so the score can only depend on the *offset*. No parameter learns positions; the positions are in the arithmetic. Move the sliders: the table's score jumps, the rotation's does not.

## positions-note1

Pair 0 turns a full circle every 6 positions and resolves *adjacent* tokens; pair 31 turns once every 47 000 and resolves *near versus far*. Same ladder of frequencies as week 3's sinusoids, applied to $q$ and $k$ inside every attention instead of added to $x$ once.

## positions-p3

A table stops at its last row. A rotation is defined at every position: you can *ask* for position 3 000. But past the training window the slow pairs sit at angles no training example ever reached. Two ways to go past the window, neither with training: **extrapolate** — run as is; **interpolate** (Chen et al. 2023) — divide every angle by a factor, so 3 072 positions fit into the 2 048 the model knows.

Two models of the same size, 12 × 768: `gpt2`, a table of 1 024, and `pythia-160m`, RoPE trained at 2 048. News texts concatenated into streams of 3 072 tokens, next-token loss at every position.

## bet-rope-gpt

GPT-2 at position 1 025?

## bet-rope-ext

Pythia past 2 048, run as is?

## bet-rope-int

Positions squeezed by 1.5 — *inside* the window, compared with running as is?

## positions-p4

Count, for every pair, how many turns it completes inside the training window: ${r_i=L/λ_i}$. A pair with many turns has met every angle it can produce — squeezing it only blurs the neighbours it was resolving. A pair with less than one turn is the one that runs into unseen angles past $L$. Between the two, a ramp; and a temperature on the logits, folded into the cos and sin tables.

## rope-note

GPT-2 at 1 025 is not a worse prediction; it is an `IndexError` — the table has no row, and no scaling trick applies to a table. Pythia, run past its window as is: nothing happens for about {flat_for} positions — then the wall, {ext_last} in the last 256 positions. Squeezed by 1.5, the wall is gone ({int_last} in the last 256) and the price is everywhere: {int_inside} against {ext_inside} *inside* the window, because every offset the model learned now means something 1.5 times smaller. That is the trade behind every "context extended" release note: interpolate so nothing collapses, then fine-tune briefly at the new length.{yarn_line} {n_streams} streams, one seed; the bucket-to-bucket wobble is the noise floor.

## yarn-note

At s = {s}: pairs with more than β = {beta} turns inside the window keep their angles, pairs with fewer than α = {alpha} are divided by {s}, the rest ramp. The temperature is {temperature} on the attention logits — {temp_note}. Measured on Pythia at s = 1.5: no wall past the window, and inside it {inside} — the price linear interpolation paid is gone.

## yarn-m2

{yarn_inside} against the native {native_inside}

## rope-note-yarn

YaRN, the fourth line: {yarn_last} in the last 256 and {yarn_inside} inside — the price is gone, without a step of training.

## yarn-temp-small

almost nothing at this stretch

## yarn-temp-big

no longer negligible
