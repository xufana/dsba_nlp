# ann · finding the nearest vectors fast

## s-ann

Exact search costs $N · d$ per query. **ANN** gives up a little recall for orders of magnitude in speed.

## ann-p1

The exact search compares the query with every stored vector: $N · d$ multiplications per query. A million documents at $d = 1024$ is a billion — fine on a GPU for one query, too slow for a service with many. **Approximate nearest neighbour** (ANN) indexes give up a little recall for orders of magnitude in speed. Three ideas cover most of what vector stores do. The table gives their costs for $N$ vectors of dimension $d$.

## ann-asym

<table class="asym">
<tr><th></th><th>build</th><th>one query</th><th>memory</th></tr>
<tr><td><b>flat</b> (exact)</td><td>—</td><td>$O(N d)$</td><td>$O(N d)$</td></tr>
<tr><td><b>IVF</b>, $C$ cells</td><td>k-means, $O(N C d)$ per pass</td><td>$O(C d + n_{probe} · \frac{N}{C} · d)$</td><td>$O(N d)$</td></tr>
<tr><td><b>HNSW</b>, $M$ links</td><td>$O(N \mathrm{log} N)$</td><td>$O(\mathrm{log} N)$ hops, $O(M d)$ each</td><td>$O(N (d + M))$</td></tr>
<tr><td><b>PQ</b>, $m$ codes</td><td>k-means per piece</td><td>$O(N m)$ table lookups</td><td>$O(N m)$ bytes</td></tr>
</table>

## s-hnsw

**HNSW:** a layered graph; a greedy walk from the sparse top layer down — about $\mathrm{log} N$ hops.

## ann-hnsw

**HNSW** — a hierarchical navigable small-world graph: every vector is linked to its $M$ nearest neighbours, in several layers from sparse to dense; a vector reaches layer $l$ with probability decaying exponentially in $l$, so there are about $\mathrm{log} N$ layers. A search starts at the top and walks greedily towards the query, descending a layer whenever no neighbour is closer. Each layer costs a few hops, so a query costs $O(\mathrm{log} N)$ hops in practice (the logarithm is empirical, not a guarantee); building inserts every vector with the same walk, $O(N \mathrm{log} N)$. The fastest at high recall; the price is memory — the graph sits next to the full vectors — and $ef$, the width of the walk, which trades recall against time.

## hnsw-caption

Start on the sparse top layer, always step to the neighbour closest to the query, descend.

## s-ivf

**IVF:** k-means cells; search only the $n_{probe}$ cells nearest to the query. A neighbour across a border is lost.

## ann-ivf

**IVF**, the inverted file: cluster the vectors with k-means into $C$ cells; at query time compare the query with the $C$ centroids and look only into the $n_{probe}$ nearest cells. The inverted index again, with cells instead of words. A true neighbour that sits across a cell border is lost unless its cell is probed.

## ivf-caption

Shaded — the probed cells; ringed — the true top 10, green found, red missed. Move $n_{probe}$, or click the map.

## s-ivfreal

In 1024 dimensions the neighbours scatter: on gonzo_ML one cell of {ivf_cells} finds {ivf_r1} of the true top 10; {ivf_r_big} costs {ivf_s_big} of the collection.

## ivf-real

Two dimensions flatter IVF: there a query's neighbours sit in one or two cells. In high dimension they scatter. On the {ivf_n} bge-m3 vectors of the gonzo_ML posts and their chunks ($d$ = {ivf_d}), with {ivf_cells} cells and the {ivf_nq} questions as queries, one probed cell returns {ivf_r1} of the true top 10; {ivf_r_big} needs {ivf_np_big} cells — {ivf_s_big} of the collection scanned. That is why a real IVF index has thousands of cells and probes dozens, and why its $n_{probe}$ has to be tuned on your own vectors.

## ivfreal-caption

bge-m3 vectors of gonzo_ML: recall of the true top 10 (blue) and the share scanned (grey), by $n_{probe}$.

## s-pq

**PQ:** cut the vector into $m$ pieces, replace each by the id of its nearest centroid → 4 KB becomes $m$ bytes.

## ann-pq

**PQ**, product quantisation: split each vector into $m$ pieces and replace every piece with the id of its nearest centroid among 256 — one byte. A $d = 1024$ float vector, 4 KB, becomes $m$ bytes; distances are computed from small tables of piece-to-centroid distances, without decompressing. Combined with IVF (IVF-PQ) it fits a billion vectors into one machine's memory, at some cost in accuracy.

## pq-caption

Each of the 8 pieces → the index of its nearest centroid: 4096 bytes → 8.

## q-ann · sort

Which index fits?

bins: flat (exact) · HNSW · IVF-PQ

- 20 000 FAQ chunks, a few queries a minute → flat (exact)
- 5 million product descriptions, a search box that must answer in 20 ms, a server with plenty of memory → HNSW
- 800 million image embeddings, memory is the constraint → IVF-PQ
- a golden-set evaluation of a new encoder on 50 000 passages → flat (exact)

> Below a few hundred thousand vectors an exact search is fast enough and has no recall loss — and an evaluation should always be exact, or it measures the index together with the encoder. Millions with a latency budget and memory to spare: HNSW. Hundreds of millions when memory is the limit: compress, IVF-PQ.
> miss: if the evaluation went to HNSW: then a drop in recall could come from the encoder or from $ef$, and you cannot tell which.

## s-filter

**Filters** (date, language, access rights): filter *after* the top $k$ → often nothing left; filter *during* the search → the $k$ best that pass.

## ann-p2

**Filters.** Real queries come with conditions — a date, a language, a user's access rights. Filtering the top $k$ *after* the vector search (post-filtering) returns nothing when the condition is rare; filtering *during* it needs an index that supports it. Every vector database answers this differently, and it is worth checking before choosing one.

## q-filter · pick

The index returns the top 10 by cosine, then keeps only the posts from 2024. 2 % of the collection is from 2024. What does a user usually see?

- [ ] the 10 best posts from 2024
- [x] almost nothing: of the 10 nearest, on average fewer than one is from 2024
- [ ] an error from the database
- [ ] the 10 best posts overall, the filter is ignored

> Post-filtering keeps what passes among the 10 already retrieved: with 2 % passing, that is 0.2 on average, so most queries return nothing. The fixes are to filter before or during the search (pre-filtering: search only among the vectors that pass) or to ask for far more than 10 and filter that.
> miss: if "the 10 best posts from 2024" was picked: that is what pre-filtering gives; post-filtering never looks beyond the first 10.

## postf-caption

The same query, the same filter («2024», 2% of the collection): filter after the top 10, or search only among what passes.
