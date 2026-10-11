# table · The results table, read as one story

## table-note1

Every row is the same equation — P(next token | prefix) × a decoding rule — with the left factor built a different way. **Counting** is a strong, cheap baseline that generalises not at all; well-smoothed, it beat our small networks on perplexity today. **A recurrent network** generalises through embeddings and an unbounded-in-principle state; at laptop scale it matched the trigram rather than beating it — but it writes novel text instead of reciting, its curve is still falling, and, decisively, it can be conditioned. **An encoder–decoder** conditions the whole thing on a second sequence, bottlenecked by the one vector between the halves. And the right factor turned out to carry as much weight as the left. None of that is about the model.

## table-p1

**1 · Everything is next-token prediction.** The training loss is cross-entropy, which is log perplexity; the model outputs a distribution, and text is a second decision on top. Transformers change how P is computed, not this frame.<br>
**2 · Perplexity is comparable only under a fixed tokenizer and test set** — and bits/char only lifts the tokenizer restriction for models that are lossless over the text. Off that, the number lies.<br>
**3 · The decoding rule is a design choice with its own failure modes.** Temperature, top-p, min-p, repetition penalty, beam width — the same knobs on our LSTM and on a 400B LLM.<br>
**4 · A fixed-size bottleneck loses information as the input grows, with a measurable slope.** That slope is next week's motivation.<br>
**5 · Likelihood is not quality.** The most probable continuation is usually not the one to show a human — the single most important thing decoding taught the field.

<p class="footnote" style="margin-top:30px">Full notebook, homework and the reading list: <span class="mono">week02_language_modelling/</span>. Everything marked 🏠 there runs as-is — Kneser–Ney against the LSTM per bits/char, weight tying and dropout, scheduled sampling, and min-p at T = 2 are the ones worth an evening.</p>
