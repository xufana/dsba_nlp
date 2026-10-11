# skipgram · Skip-gram, from noise to neighbourhoods

## skipgram-p1

Everything so far represents a word by its identity — a column index — so <span class="mono">oil</span> and <span class="mono">petroleum</span> are exactly as far apart as <span class="mono">oil</span> and <span class="mono">basketball</span>. But didn't we want to make embeddings in a way that distance between words (and their vectors as well) means something? Here is how they get there.

First the sampling: a window slides over a real headline, and every (centre, context) pair inside it becomes one training example. Negative sampling adds a handful of words drawn from the corpus that were *not* in the window, and the model is asked to tell the two apart.

**A window of four words is not a four-word input.** This is the part of skip-gram that is easy to picture wrongly, so it is worth being explicit: the context is never combined. A window is *decomposed* into independent (centre, context) pairs, each one a separate training example with its own forward pass and its own update. Four context words around <span class="mono">oil</span> means four passes that all happen to read the same row of <span class="mono">W\_in</span> — not one pass over a four-word context. That is why two matrices are enough: the model never has to represent a set of words, only a pair of them.

The variant that *does* combine a multi-word context is **CBOW**, the mirror image of skip-gram: it averages the context rows into one vector and predicts the centre word from it. Same two matrices, opposite direction — <span class="mono">sg=1</span> versus <span class="mono">sg=0</span> in gensim. Skip-gram makes more examples out of the same corpus and does better on rare words; CBOW is faster and smoother on frequent ones.

## skipgram-note1

Every line above is its own training example. The four positives from this position are not fed in together — they are four separate passes that share a centre row, and the model would behave identically if you shuffled them into different parts of the epoch. One honest simplification here: real word2vec draws the window size uniformly from 1…<span class="mono">window</span> for every token, so near words are sampled more often than far ones; this demo keeps the window fixed at 2.

## skipgram-p2

And this is the whole model that consumes those pairs. The textbook drawing of it — <span class="mono">x → W\_in → h → W\_out → ŷ</span> — is right, and worth reading carefully, because two of its boxes are less than they look. The input <span class="mono">x</span> is one-hot, so <span class="mono">h = W\_inᵀx</span> does not compute anything: it *selects a row*, and that row is the embedding, <span class="mono">h = v\_c</span>. And the hidden layer has no activation function, so there is nothing non-linear anywhere before the output. What is left is two lookup tables — one row per word in <span class="mono">W\_in</span> for when the word is the centre, one row per word in <span class="mono">W\_out</span> for when it is the context — and a dot product between them. The entire parameter count is <span class="mono">2 × V × d</span>: for this demo 2 × 1 500 × 24 = 72 000 numbers, for the full AG News run 2 × 65 000 × 100 = 13 million.

**So what is being predicted?** One context word. The scores <span class="mono">u = W\_out·h</span> are a number for every word in the vocabulary; a softmax turns them into <span class="mono">ŷ</span>, a distribution over all 1 500 of them, and the label <span class="mono">y</span> is the one-hot of the word that actually stood next to the centre. Nobody wants that prediction. It is a *pretext task*: an excuse to force the rows of <span class="mono">W\_in</span> into positions where words that keep the same company end up close, after which the classifier head is thrown away and the table is what you ship.

The catch is the cost. A softmax over the vocabulary touches every row of <span class="mono">W\_out</span> on every single pair — O(V) work per example, on billions of examples. **Negative sampling replaces the output layer and nothing else.** Instead of “which of the 1 500 words is it”, it asks “is this pair real, or drawn from noise?” for the true context word and a handful of random ones: k + 1 independent sigmoids instead of one normalized distribution. The input, the row lookup and the hidden layer are untouched — flip the switch on the panel below and watch which half of the picture changes.

## skipgram-note2

Three things fall out of the picture. **The embedding is not computed, it is stored** — the “model” for the word <span class="mono">oil</span> is literally row <span class="mono">oil</span> of <span class="mono">W\_in</span>, and training is gradient descent on that row. **Every word has two vectors**, one in each table; the one you ship is <span class="mono">W\_in</span>, and <span class="mono">W\_out</span> is thrown away after training — a detail almost every diagram of word2vec leaves out. And **nothing here is deep**: with no non-linearity the whole network is one bilinear form, <span class="mono">v\_cᵀu\_o</span>. Levy &amp; Goldberg (2014) took that seriously and showed skip-gram with negative sampling is implicitly factorising a shifted PMI matrix — the 2013 headline method turning out to be a 1990 method in different clothes.

## skipgram-p3

Now run it. We'll take only 5 000 headlines for the demo, a 1 500-word vocabulary, 24 dimensions, five negatives per pair — trained here, in your browser, from random initialization. The map is a live PCA of the vectors as they move; the neighbour list is the thing you would actually use.

## skipgram-why1

`sg=1` is skip-gram, `sg=0` is CBOW. `workers>1` makes training faster and non-reproducible — for a seminar keep it at 1 with a fixed `seed`. Note gensim's `window` is the *maximum*: the actual window is resampled per token.

## skipgram-note3

Watch the order the structure arrives in: frequent function words collapse into one blob almost immediately, then sports, then markets, then tech. Train the same corpus with the stopwords removed and the neighbourhoods change — words that were six positions apart become adjacent, so the window is measuring a different thing. Whether that helps depends entirely on what you want the neighbourhood to mean.

## window-pairs-note

The model never sees a label. Its only job is to tell a pair that really co-occurred from one that did not — and the vectors are what it needs in order to do that.

## sg-math-softmax-note

This is the honest 2013 objective, and the reason nobody trains it this way: the gradient is dense in the vocabulary, so cost per example grows with V while only one word was ever the answer. Hierarchical softmax replaces the flat normalisation with a binary tree (log V); negative sampling gives up on normalising at all. Flip the switch back to see what is left.

## sg-math-neg-note

The two coefficients in the middle are the entire learning signal. <span class="mono">σ − 1</span> is negative for the pair that really occurred and <span class="mono">σ</span> is positive for the one that did not, so a single update rule pulls <span class="mono">{context}</span> towards <span class="mono">{centre}</span> and pushes <span class="mono">{neg}</span> away. Both shrink as the model gets the pair right — a pair it already scores confidently produces almost no gradient, which is why the loss curve flattens.

## sg-neighbours-empty

Train the model and the neighbourhood appears. At epoch 0 these are random directions in 24 dimensions.
