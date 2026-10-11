# inside · 48 cross-attention heads, and the alignment is in there somewhere

## inside-p1

Only our own model today; what the heads of a *pretrained* model do — and how much of that is real — is a topic for when we open one. But our 6-layer translator has 48 cross-attention heads and 48 self-attention heads on each side, and the block-01 alignment picture is in there somewhere.

For one test sentence: the decoder's cross-attention weights, one panel per (layer, head), rows are the produced English tokens, columns the German source. Click a panel to enlarge it.

## inside-note1

The LSTM had one attention map and it was an alignment. The transformer has 48, and the alignment is *distributed*: <span id="inside-say"></span> That is what multi-head buys — different heads do different lookups — and it is also why "the attention map" of a transformer is not one picture. The encoder self-attention panels are square: German tokens attending to German tokens. Common shapes in the first layers are *previous token*, *next token* and *self* — stripes just off the diagonal — because the cheapest useful thing a first layer can do is build bigrams. Deeper layers get harder to read, and here is the reason.

## inside-p2

One step per layer, ignoring the FFN for a moment: the vector at position $i$ after layer $ℓ$ is the vector before it, plus what attention gathered from the other positions.

## inside-note2

Each bar is one position's residual stream; its colours say which *original* tokens it is made of. Layer 0 is the embedding — the token itself. Every layer adds what attention gathered from the other positions, so the self share (outlined) shrinks and the mixture deepens: by the last layer "the vector at position 7" is a blend of the whole sentence, weighted the way this sentence's heads actually attended. The weights are measured; the one convention is that the residual and the attention branch are drawn with equal weight (the FFN and W<sub>V</sub> are left out, as in the prose).

## inside-p3

Every layer *adds* to one running vector per position — the residual stream — and reads from it. Three consequences to say out loud:

**1. The next layer's query is built from what this layer gathered.** $q_i^{(ℓ+1)}$, $k_i^{(ℓ+1)}$ and $v_i^{(ℓ+1)}$ are three projections of the *same* vector — the token itself (through the residual) plus whatever position $i$ collected from its neighbours. So a second-layer head can ask a question whose *content* depends on the answer a first-layer head fetched. Two layers compose; that composition is where the interesting behaviour of real models lives (the "induction head" — a previous-token head feeding a copy head — is the textbook case, and it will come up when we look at pretrained models).

**2. Attention moves information between positions; the FFN processes it within a position.** Two different jobs, two different sublayers, and the parameter count (block 04) says which one the model spends more on.

**3. After the first layer, key $j$ is no longer "word $j$".** It is "word $j$ in context" — which is exactly why deep-layer maps stop looking like word-to-word alignments, and why reading them as such is a mistake.

Decoding here was greedy: the encoder runs once, the decoder re-reads its growing prefix. Beam search was last week's; its successors are a topic for the generation seminars.

## inside-say-cross

for this sentence, <b>{sharp} of 48</b> cross-attention heads are sharp (mean max weight above 0.5), the cleanest being layer {layer} head {head} ({score}); <b>{end_heads}</b> put most of their weight on the last source token regardless of the query; the rest are diffuse.

## inside-say-self

for this sentence, <b>{sharp} of 48</b> encoder self-attention heads are sharp (mean max weight above 0.5); <b>{end_heads}</b> look at the sentence-final token from most positions.
