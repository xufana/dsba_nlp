# seq2seq · The recipe: score, normalise, aggregate

## seq2seq-p1

Last week we threw all of the hidden states of encoder away except the last one. Attention (Bahdanau, Cho &amp; Bengio 2015) keeps them and lets the decoder consult them. At every decoding step $t$:

## seq2seq-note1

The red dashed arrow is last week's entire connection between the halves; it is still there (it initialises the decoder), but it no longer has to carry the sentence. The green arrows are new, and they are recomputed at every step with different weights.

## seq2seq-p2

The context $c_t$ is a different vector at every step — from the point of how it is seen from the word being produced right now. The decoder gets it on top of its own state, and the output layer reads both. Three names that stick for the rest of the course: the decoder state is the **query**, the encoder states are the **keys** (what the score is computed against) and the **values** (what gets summed). Here keys and values are the same vectors yet.

One more detail: **input feeding**. The previous step's context is concatenated to the decoder's input at step $t$, so the decoder knows where it looked last time — without it, the model tends to translate the same source word twice or skip one.

## seq2seq-p3

Attention (hehe) here!: the encoder states of a *padded* batch include states for `[PAD]` positions, and the softmax must never put weight on them. The mask sets their scores to a large negative number *before* the softmax. Large negative, not ${−∞}$: if a row were ever fully masked, ${−∞}$ everywhere gives ${\mathrm{exp}(−∞)/0=}$ NaN, and NaN in one weight is NaN in every parameter one backward pass later.

## seq2seq-why1

Nothing changed in training from the last week: the same `train_seq2seq` loop, cross-entropy at every position except padding, gradient clipping at 1.0.

## seq2seq-note2

Attention with a 256-dimensional scoring space, the key projection and the attentional vector together add well under a million parameters to an 8M model — under ten percent, most of it in the wider decoder input. Whatever it does to the curve, it does not do it by being bigger. Not efficient, next.

## attn-note

Read the right-hand plot against the bet. The no-attention curve slopes down; the attention curve is higher *everywhere* — by more than twenty BLEU at every length. Long sentences are no longer squeezed through a fixed budget: every decoder step re-reads the source, so the twenty-fifth German token is as available as the first. This is Figure 2 of Bahdanau et al. (2015), on our data. One honest reading of the slope: <span id="attn-slope"></span>

## seq2seq-p4

The weights $α_{t,i}$ are numbers we can look at: a row per English token, a column per German token, the weight the decoder put on each source position while producing each target token. The model was never shown which German word corresponds to which English word — only sentence pairs — so whatever structure appears in this matrix was learned as a *by-product* of translating.

## seq2seq-note3

Things to look for, and to check on your own sentences: **a near-diagonal** — German and English caption word order mostly agree, so most target tokens attend to the source token in the same place; the interesting cells are the ones *off* the diagonal. **Word-order swaps** — German puts the verb of a subordinate clause at the end (*…, der einen Hut <b>trägt</b>* → *who <b>is wearing</b> a hat*): the English verb should attend far to the right of where the diagonal would put it; compound nouns go the other way, one German token feeds several English ones. **Function words** — articles and `[EOS]` often attend diffusely or to the end of the sentence. One sentence of caution: the map shows where the decoder *looked*, not *why* it chose the word. It is evidence of alignment, not an explanation of the translation. Read it as "there is some kind of relation, but idk what kind".
<div class="footnote" style="margin-top:8px">Question: what does it mean when a German word receives almost no attention from any target position? How would you measure how often that happens, and what would you expect it to correlate with? (Tu et al. 2016 call the fix <em>coverage</em>.)</div>

## attn-slope

from short to long sentences the score drops by <b>{drop_none}</b> BLEU without attention and by <b>{drop_attn}</b> with it; as a ratio, long sentences keep {keep_none} of the short-sentence score without attention and {keep_attn} with it. On this data attention lifted the whole curve; it did not flatten it.
