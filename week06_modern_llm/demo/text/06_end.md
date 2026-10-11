# end · The question from the top, in three lines

## end-p1

**Training.** Scaling laws turned the cost of a bigger model into a forecast: loss is a power law in $N$, $D$ and compute, so the result could be priced before it was bought — and $6ND$ could be split on purpose between parameters and data.

**Memory.** Positions stopped being a table, so the context could grow; keys and values were grouped, so the cache that grows with it could be stored; attention stopped being full in every layer — or stopped being a softmax — so it could be computed.

**Compute per token.** Experts let a model own several times the parameters it runs; and part of what a token costs is not arithmetic at all, but launches, copies and waits.

The block itself — normalise, attend, add, normalise, feed forward, add — is the one from week 3.
