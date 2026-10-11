# hero · context =Σ softmax(score(q, kᵢ)) · vᵢ

## lede

So, do you remember where we stopped last week? A bidirectional LSTM read a German sentence, squeezed everything it knew into 256 numbers, and a second LSTM wrote the English from that one vector. It worked — BLEU 13 on Multi30k — and it worked worse the longer the sentence was: 18 BLEU on short captions, 8.5 on long ones. We called that the bottleneck, we showed that a wider vector lifts the whole curve without flattening it, and we promised the fix would be this week's topic.

## hero-p1

Here it is. The fix is embarrassingly simple to state: let's stop trying to put all the info into one cell, but instead let the decoder see everything before it. The mechanism that does the looking is called attention, and it turned out to be something more than a patch for translation. So we'll take it and use different architectures with the same concept.

## hero-p2

**Attention is a differentiable lookup: a query, a set of keys, a weighted sum of values.** One formula, three degrees of freedom (three matrices, see) — *how* the score is computed, *what* plays query and key, and *which set* the keys come from — and everything sits somewhere on those three axes. We'll approach it step by step.
