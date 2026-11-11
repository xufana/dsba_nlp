# hybrid · two lists, one ranking

## s-hyb

BM25 and dense search fail on **different** queries → run both and merge. The scores live on different scales → merge the **ranks**.

## hyb-p1

Lexical and dense search fail on different queries: one on paraphrases, the other on codes and fresh names. Running both and merging the lists is the cheapest improvement there is. The question is how to merge.

Adding the scores does not work as such: BM25 runs from zero with no upper bound, and its scale changes from query to query with the number and rarity of the words; a cosine sits in $[−1, 1]$, usually in a narrow band. Min-max normalisation per query is possible but fragile — one outlier squeezes all the others. **Reciprocal rank fusion** (Cormack et al., 2009) ignores the scores and adds up ranks:

## s-c

**$c = 60$**: rank 1 is worth only ×{rrf_ratio12} of rank 2; rank 10 keeps {rrf_w10} of rank 1. Being in **both** lists beats being first in one.

## hyb-p2

**What $c$ does.** Rank $r$ is worth $1/(c + r)$. The constant decides how much the fusion cares about a difference in rank: the first place is worth $(c + 2)/(c + 1)$ times the second. With $c = 0$ that is twice as much — one list's favourite dominates the sum. With $c = 60$, the default from the paper, it is {rrf_ratio12} times; even the tenth place keeps {rrf_w10} of the first one's weight. So RRF with $c = 60$ hardly hears the order *inside* the top of a list and hears loudly whether a document is in the list at all, and in how many: a document that both retrievers put in their top ten beats one that only one of them put first. A smaller $c$ trusts each list's top positions more. The price either way: RRF does not know how far the first document was ahead of the second.

## rrfw-caption

The weight of a rank relative to rank 1: your $c$ (solid) and $c = 0$ (dashed).

## q-rrf · fill

Document A is first in the BM25 list and fifth in the dense list. Document B is third in BM25 and second in dense. With $c = 60$ and equal weights, which one does RRF put first?

The winner: [[w]] · its score: [[s]]

- w = B | b
- s = @rrf_b ~ 0.0001

> $A: 1/61 + 1/65 ≈ {rrf_a}$; $B: 1/63 + 1/62 ≈ {rrf_b}$. B wins: being near the top of both lists beats being first in one. Without the constant ($c = 0$), A would win by a mile — $1/1 + 1/5$ against $1/3 + 1/2$ — which is exactly the dominance of the first place that $c$ is there to damp.
> miss: if A was picked: a first place is worth only a little more than a third with $c = 60$; the fifth place in the other list costs A more than that.
