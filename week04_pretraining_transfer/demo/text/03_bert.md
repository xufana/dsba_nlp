# bert · What the pretraining optimises

## bert-p1

BERT (Devlin et al. 2019) is the encoder half of last week's transformer — the stack of self-attention + FFN blocks, no decoder, no cross-attention — trained on 3.3 billion words of Wikipedia and books with a task that needs no labels. `bert-base` is 12 blocks, 12 heads, ${d=768}$, and we're going to load it now and mostly leave it alone.

## bert-note1

**A fifth of BERT is the embedding table** — 30 522 WordPiece rows of 768 numbers — and every one of the twelve blocks is the same 7.1M we built last week: four 768 × 768 matrices in attention, and a 768 → 3072 → 768 FFN that is two thirds of the block. There is nothing in here we haven't written. **Positions are learned**, not sinusoidal: a 512 × 768 table, which is why BERT has a hard limit of 512 tokens — there is no row 513. Two special tokens: `[CLS]` in front of everything and `[SEP]` between and after the sentences. A `pooler` — 0.6M parameters, ${\mathit{tanh}(Wh_{\text{[CLS]}}+b)}$.

## bert-p2

The pretraining task: hide 15% of the tokens, predict them from the rest. Of the 15% chosen tokens, only **80%** are replaced by `[MASK]`; **10%** are replaced by a *random* token, and **10%** are left *unchanged*, and the model is asked to predict the original at all three kinds of position. Why? Because at fine-tuning time there is no `[MASK]`. The 10/10 forces it to *check* every token against its context.

## bert-note2

At `[MASK]` the model does what it was trained for. At `banana` it doesn't just copy: part of the mass goes to the input token, part goes to *store* — the model is checking the token against the sentence and flagging that it doesn't fit. At `store` it copies with high confidence. Every unmasked token's vector carries "what I am" *and* "what would fit here". That second part is what makes the representation useful for everything below.

## bert-p3

Which means we can already classify news without training anything. Add `This news is about [MASK].` after a text as a second segment, read the distribution at the mask, and keep only the four words that name our classes. The model never saw AG News, never saw a label, was never told this is classification. This is *zero-shot*, and it is the direct ancestor of "prompting".

## bet-zs

One word per class — the class names are the obvious choice. Accuracy on the 7 600 test texts? Week 1's TF-IDF is 0.92; random is 0.25.

## zs-note

Not random, but not good either — and the per-class numbers say it's not *evenly* not good. Business swallows everything; World is a disaster. What does the model actually *want* to put in the mask for World news? It says *politics*. And *war*, and *iraq* — 2004, remember. "World" is the name a newsroom gave the section; the texts in it are about politics. Rename the class, keep everything else — one word in the prompt, seventeen points of accuracy. The prompt is a hyperparameter, and a fragile one. And zero-shot is still far under TF-IDF: the model knows more than a bag of words, but it has no way to *use* what it knows for our four classes. Time to attach something. <span class="mono" style="font-size:13px">The mask distribution over 40 candidate words was computed once in the notebook; picking words here only re-reads four columns and takes an argmax per text.</span>

## bert-p4

BERT's second pretraining task, **next-sentence prediction**: show two sentences and predict whether B followed A. The prediction is made from the `[CLS]` position — through the pooler, ${\mathit{tanh}(Wh_{\text{[CLS]}}+b)}$, and one Linear on top. This is the *only* reason `[CLS]` has any meaning at all. Which brings us to a sentence that appears in roughly every BERT tutorial: *"`[CLS]` contains a representation of the whole text, so we can use it as a sentence embedding."* Let's test that. Three ways to turn the body's output into one vector per text, a logistic regression on top of each, no fine-tuning.

## bet-probe

Rank the three. Which one wins?

## probe-note

**You can't rank them.** One point apart, on a test set where the standard error of an accuracy is about 0.004 — the whiskers are ±2 of it. **All three lose to TF-IDF from week 1, by five points.** A 110M-parameter model, pretrained on 3.3B words, frozen and probed, does not beat counting words with the right weights. Frozen features from a model that was never asked to separate topics are not topic features — this is the result that made Reimers &amp; Gurevych build Sentence-BERT in 2019. So: the body knows things, the mask proves it, the frozen vectors don't hand them over, and the number to beat is still 0.92. The smallest possible thing we could train is one Linear — a head.

## bert-p5

The learned position table is a nice thing to look at, cuz nobody told it what a position is:

## fig-bert-note-in

Two sentences in, `[CLS] A [SEP] B [SEP]`. Every token becomes the *sum* of three table rows — its WordPiece, its segment (A or B: this is `token_type_ids`) and its position (a learned 512-row table, not a formula). `[SEP]` is where the segment flips; `[CLS]` has no token of its own, so whatever ends up in $h_0$ is whatever a training task pushed there. Then 12 copies of last week's encoder block, and one 768-vector per position comes out. Our code differs from Alammar's picture in one place: Pre-LN inside the block, not Post-LN.

## fig-bert-note-mlm

Masked language modelling. Of the 15% chosen positions, <span class="tok mk" style="font-size:12px">80%</span> are replaced by `[MASK]`, <span class="tok rnd" style="font-size:12px">10%</span> by a random token, <span class="tok keep" style="font-size:12px">10%</span> are left unchanged — and at all three the head has to produce the *original* token: a Linear + LayerNorm + Linear to 30 522 logits, softmax over the vocabulary, cross-entropy against the original. The other 85% of the positions get no gradient at all; that is the number ELECTRA later attacks.

## fig-bert-note-nsp

Next-sentence prediction. Only $h_0$ is read — through the *pooler*, ${\mathit{tanh}(Wh_0+b)}$, and one `Linear(768, 2)`: did B follow A in the text, or was it a random sentence? This is the only reason `[CLS]` means anything: nothing else in pretraining ever looks at that position. RoBERTa dropped this task and lost nothing; the pooler stayed in every checkpoint.

## mlm-say-masked

<b>masked</b> · the head predicts from context alone: top-1 <b>{top1}</b> at {p_top1}

## mlm-say-copied

<b>{t}</b> is copied with {p_own} — the 10% "unchanged" case; the runners-up are what would also fit here

## mlm-say-flagged

<b>{t}</b> gets {p_own}, but <b>{top1}</b> gets {p_top1} — the model flags the token as not fitting its context: the 10% "random" case

## mlm-say-missing

<b>{t}</b> is not even in its own top-5: the head wants <b>{top1}</b> here ({p_top1})

## probe-live

live cell in the notebook, {n} texts: pooler {pooler}, [CLS] {cls}, mean {mean} · encoding {n_train} texts took {seconds}s
