# rnn · Recurrent language models

## rnn-p1

Counting has a ceiling and we just hit it. The reason is not the amount of data; it is that a count-based model treats every prefix as an unrelated symbol. *Штирлиц открыл* and *Мюллер открыл* share nothing — even though whatever follows one probably follows the other. Last week gave us the tool for that: embeddings. The **recurrent** network drops the fixed window entirely: it keeps a state vector h<sub>t</sub>, updated once per token, that is supposed to summarise everything so far. Same chain rule, same next-token prediction, but the context is — in principle — unbounded. In practice it is bounded by how much a 256-dimensional vector can hold and by how far a gradient can travel; we measure both.

## rnn-note1

Top: every position is a classification problem with 8 000 classes — given the state, predict the next piece. The pills are what the LSTM in this page actually outputs at each step (the argmax of its softmax), and the dashed line runs from each output to the token that goes in next — which is always the gold one. Red ≠: the output was wrong and the loss at that step is large; green =: it was right. Either way the output is only scored; what gets fed is the joke. The input sequence is the joke with <span class="mono">[BOS]</span> in front, the target is the same joke shifted left by one with <span class="mono">[EOS]</span> at the end, and because the whole input is known before the forward pass, all positions are scored at once. The loss is the average cross-entropy over them — log perplexity — so **training minimises perplexity directly**. Padding has to be excluded from that average (<span class="mono">ignore_index=PAD</span>); get it wrong and the model learns to predict <span class="mono">[PAD]</span> after <span class="mono">[EOS]</span> with near-certainty, which is easy, worthless, and makes perplexity look better than it is. Bottom: at inference nothing is known in advance. The model gets <span class="mono">[BOS]</span>, emits a distribution, a decoding rule (block 05) picks a token, and that token becomes the next input — the dashed green loop. The recurrence is the same, the weights are the same; only the source of the inputs changed, and that is why the text can drift: one odd sample, and every later step conditions on it.

## rnn-p2

In the notebook we train an LSTM on a slice of the data — 8 000 jokes, two epochs, 21 seconds on a laptop — enough to watch the perplexity move. **Bet:** does it beat the interpolated BPE trigram, which was counted on 40 000 jokes in a few seconds?

## bet-live

After two epochs on 8 000 jokes, the LSTM's test perplexity is …

## live-note

It does not — with 7% of the data and two passes, the network is still behind counting on all of it. And its samples are letter soup. Worth remembering the next time someone shows you a neural model losing to a baseline: the question is always *how much data and how much compute each one got*.

## rnn-p3

The pipeline, the model and the training loop again — this time with nothing in between. Same names as the notebook, no validation, no shuffling, no progress bar: four steps, one screen. It runs as written; this is the cell to copy into your own project.

## rnn-note2

Read the four comments and you have the whole seminar so far in one place: the data is the joke shifted by one, the model is three layers, the loss is cross-entropy over every position except padding, and the number is exp of that loss on held-out text. Everything else on this page — cells, dropout, clipping schedules, decoding rules — is a knob on one of these four lines.
<div class="footnote" style="margin-top:10px">In the notebook, with the prose between the pieces: <a href="https://github.com/xufana/dsba_nlp/blob/autumn-2026/week02_language_modelling/week02_language_modelling.ipynb" target="_blank" rel="noopener">3.1 The data pipeline · 3.2 The model · 3.3 RNN vs LSTM vs GRU</a>.</div>

## rnn-p4

Three cells, the same 256-dimensional size, the same 12 000 jokes, the same three epochs each (trained overnight on CPU; <span class="mono">precompute.py</span> redraws it). **Bet:** the LSTM has 4× the recurrent parameters of the plain RNN. On short jokes, trained for a few epochs, how far apart do the three land in perplexity?

## bet-cells

RNN, GRU and LSTM land within …

## cells-note

**The neural models do not beat the count baseline here.** Same tokenizer and test set, so both columns are fair — and the interpolated BPE trigram sits below all three small networks. A 4.6M-parameter network trained for three epochs on a slice of the data does not clear a count model trained on all of it in seconds. Same lesson as last week's "averaged embeddings lose to TF-IDF": run the strong simple baseline first. **Among the neural models the three are close**, within ~20%, and the plain RNN keeps up with the gated cells: our jokes are short, and the dependencies that pick the next subword are mostly local, so there is little for a gate to save. So why bother? Because the network *generalises instead of memorising* — its text is not in the corpus — and because its curve is still falling while the trigram is at its ceiling. One of these has somewhere to go.

## rnn-note3

Dot size and the numbers are the measured mean ‖∂ loss / ∂ input embedding‖ on 50 test jokes, relative to the position next to the loss — the same data as the chart below, on a log scale. Through a <span class="mono">tanh</span> recurrence the gradient is multiplied by a Jacobian at every step; through the LSTM's cell state it is added to, and passes through the forget gate instead of a weight matrix.

## rnn-note4

Left: every step of the same measurement, log scale — the RNN loses four orders of magnitude over forty steps, the gated cells about two. Right: the gradient norm before clipping, every 20th training step; the largest batch is about three times the typical one, and <span class="mono">clip_grad_norm_</span> at 1.0 caps anything larger.

## rnn-why1

Homework in the notebook: weight tying (`self.out.weight = self.emb.weight`, removes a third of the parameters and usually helps), dropout, a second layer. Everything there runs as written.
