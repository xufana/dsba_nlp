# bottleneck · Two experiments that make it visible instead of asserted

## bottleneck-p1

**First: BLEU as a function of input length.** If one vector is the limit, short sentences should translate well and long ones should fall off, because a longer sentence has more to cram through the same 256 numbers. The sweep ran at three bottleneck widths — 64, 128, 256. **Bet**, two questions.

## bet-len

(1) For the 256-wide model, BLEU from the shortest bucket to the longest …

## bet-flat

(2) Which width has the flattest line?

## len-note

**The capable models slope down.** For hidden = 256, BLEU falls steadily from short sentences to long — the longer the German, the more has to squeeze through the same 256 numbers. This is the plot that motivates attention: Bahdanau et al. (2015) opens by showing exactly this decay and proposes letting the decoder look back at *all* encoder states, which flattens the curve. The hidden = 64 line is flat because it is near the floor everywhere — a bottleneck that narrow barely translates *any* length, so there is no slope left to see. You need a model good enough to have something to lose. **A wider bottleneck lifts the whole line**, but the slope is still there at 256: the failure is architectural, not a matter of size. Attention removes the slope; width only raises the line.

## bottleneck-note1

The bottleneck is a real vector — look at what it encodes. Coloured by source length, the leading axis of the "meaning" vector is *bookkeeping*: how long the sentence was. Real information, but it is telling that the fixed budget is spent on it first. Sutskever et al. (2014) showed the same PCA revealed clusters by voice and word order.

## bet-beam

Beam width 1 → 3 → 5 on translation: BLEU …

## beam-note

Wider beams find higher-probability translations and BLEU climbs — for a while. Then it flattens, and can even dip: beyond a point the extra probability is spent on making the translation *shorter and safer*, the same likelihood trap as block 06, milder because here probability and quality are better aligned. Every unit of beam width is a linear increase in compute. Beam 5 is the usual default; the table shows why nobody uses beam 50. **Bet answered:** beam search helped here (a right answer to approximate) and would have hurt on the jokes (no right answer, likelihood ≠ quality). Same algorithm, opposite verdict — because the *task* changed, not the decoder.

## beam-all

On all 1 000 test sentences: greedy {greedy}, beam-5 {beam5}.
