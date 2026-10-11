# results · Now the real ones

## results-p1

`precompute.py` trained 1, 3 and 6 layers — same width, same 15 epochs — and two ablations at 6 layers: the decoder attending to one mean-pooled encoder vector (the week-2 bottleneck, rebuilt inside a transformer) and the same model with no positional encoding. Read it as three separate experiments, because there are three parameters — and bet on each before the table opens.

## bet-res-depth

(1) Depth: 1 vs 3 vs 6 layers, 15 epochs on 29 000 pairs — the spread between best and worst is …

## bet-res-noca

(2) No cross-attention (one mean-pooled vector, 6 layers of self-attention on each side) lands at …

## bet-res-nope

(3) No positions (a bag of words on the encoder side) lands at …

## res-note

**Depth.** On one hand — the deeper, the bigger the model — the better, but for deeper models we also need more data, so something might go a little bit different than we expected: <span id="res-depth-say"></span>.
**No cross-attention.** <span id="res-noca-say"></span> This is the ablation that says where the transformer's gain comes from: not from self-attention as such — that model has all of it — but from the decoder's access to every source position.
**No positions.** Same model, no positional encoding: <span id="res-nope-say"></span> — a clear drop, but not to zero. The decoder still has its causal mask, which leaks order into the target side, and a bag of German words still says *what* the caption is about.

## results-p2

All 1 000 test sentences, translated greedily by three models, with the sentence-level BLEU of each. Filter by source length and read what each model gets right.

## res-depth-say

1, 3 and 6 layers land at <b>{depths}</b> BLEU — a spread of {spread}; on 29 000 pairs the extra layers buy {buy}, and cost {s_l6} s/epoch against {s_l1}

## res-noca-say

<b>{noca}</b> BLEU — a drop of {drop} — and the slope is back in the right-hand plot: {short} on short sentences, {long} on long ones.

## res-nope-say

<b>{nope}</b> BLEU, {below} below the full model, and {long_nope} on long sentences against {long_l6}

## res-depth-nothing

nothing the first one did not

## res-depth-little

a little

## tr-summary

{n} sentences in this bucket · mean sentence BLEU: LSTM {lstm}, LSTM + attention {attn}, transformer {tf} · corpus BLEU on all 1 000: {c_lstm} / {c_attn} / {c_tf}
