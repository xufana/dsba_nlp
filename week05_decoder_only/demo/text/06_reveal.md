# reveal · Punctuation and case, two ways

## reveal-p1

**The encoder way.** Token classification, one label per word: what to do with the case — `lower`, `Cap`, `CAPS` — and what to put after the word — nothing, a comma, a period, `? ! : ;`. Four cases times eight punctuations is 32 labels, and that is the encoder's *entire* vocabulary of answers. Some words are not expressible: `U.S.`, `iPhone`, `Wal-Mart`, `3.5`. They all get `other` — and `other` means *the head will get this word wrong whatever it learns*. That is the **ceiling** of the formulation, measured before training anything.

**The decoder way.** No labels at all: `stripped => original`, and the model writes the original. Nothing is unexpressible. The cost is one pass per output token — and a new failure mode the encoder cannot have: the model may change a word it was only supposed to capitalise. We measure that as **changed**.

## pl-note

Dotted words are the ones the label set cannot express: whatever you pick, the rebuilt word is wrong. After the check, the encoder's own answer is shown under each word.

## bet-punct-all

Word accuracy overall — who is ahead?

## bet-punct-cap

On the words the labels *can* express — capitalised words, commas, periods — who is ahead?

## bet-punct-chg

The decoder's `changed`: words that came back with different letters?

## reveal-p2

The second follow-up decides which bill you can afford. *Words arrive one at a time, from a live stream*: the encoder reads bidirectionally, so it must wait for the phrase to end before it can label the first word — its latency is the length of the utterance. A causal model labels as the words come, with what it has; and when the next word arrives, the last comma may have to move. Same task, and the product flips the answer.

## reveal-p3

**The encoder way**, honestly stated. An encoder can *point*: one label per word, `ok` / `wrong`. It cannot write the right word, because the right word is not one of two labels. So the encoder detects, and something else corrects: the nearest dictionary word by edit distance, week 1's tools. Two stages, one pass. **The decoder way.** `noisy => clean`. Nothing about word counts.

## reveal-p4

Week 4's head: `[B, L, 9]`, one BIO tag per word, and everything the model can say is a tag on a word that exists. The decoder has to *write* the entities — inline, a copy of the sentence with brackets, or a list of the entities only. Both outputs are parsed back to tags and scored with the same entity F1 as week 4.

## bet-ner-f1

Entity F1 of the two formats against week 4's fine-tuned BERT?

## bet-ner-fmt

Inline against list?

## bet-ner-unm

Share of predicted entities that are not in the text — unmatched?

## reveal-p5

Week 4's answer was two pointers: `[B, L, 2]`, and the answer is a substring *by construction*. The generator writes an answer. Usually it copies; nothing forces it to. And the bet from block 01 comes due here: the paragraph is read causally. Put it before the question and it was encoded without knowing what to look for; put it after and every token of it can see the question. Two fine-tunes, identical except for the order of two strings in the prompt.

## bet-qa-em

Exact match against week 4's BERT?

## bet-qa-order

Which order wins?

## bet-qa-sub

Share of answers that are not a substring of the paragraph?

## pl-score

you: <b>{hit}/{n_words}</b> · the encoder: <b>{enc_hit}/{n_words}</b> · unexpressible: {n_unx}

## punct-note

Overall the two are a point apart — {enc_acc} and {dec_acc} — and the split underneath is the whole story. On every label the head can express, the encoder is ahead: `Cap` {enc_cap} to {dec_cap}, commas {enc_comma} to {dec_comma}, periods {enc_period} to {dec_period}. The decoder wins on the words the labels cannot express, and only there: {dec_other_case} on the `other` cases, {dec_other_punct} on the `other` punctuation, where the encoder is at zero by construction — and those are the words that matter. The encoder is cheaper by a factor of {speed_ratio} as measured, not the L ≈ {L} the pass count promises: the generator's steps are batched. And a failure that **changed** does not count: a dropped word is scored as wrong, not as changed — the first demo text lost {dropped} of its {n_words} words. Fidelity has to be measured on both sides.

## typos-note

Zero on `split`, zero on `merge`, and it is not a training problem — it is the formulation. A label per input word can only ever describe *that* word; it has nowhere to say "these two are one" or "this one is two". Not *expensive to express*, but *not expressible*. The usual escape is to extend the labels into edit operations — GECToR (Omelianchuk et al. 2020). The decoder is at {dec_split} and {dec_merge} there — and behind the dictionary on {n_enc_ahead} of the four ops inside a word ({enc_ahead_list}). A 124M model retyping a word is a worse speller than edit distance over a word list. Its row on `none`: {dec_none} — it edits one clean word in {one_in}. Overall {dec_acc} to {enc_acc}, and the whole margin is `split` and `merge`.

## ner-note

At 124M the generator is below the head — {inline_f1} against {bert_f1} — and the two formats land within half a point of each other, one seed each, so on quality call it a tie; the list writes {list_tokens} tokens where inline writes {inline_tokens} and costs half. The more interesting number is *how* it is wrong. The head can only miss or mislabel; it cannot invent, because a tag has to sit on a word. The generator invents — {inline_unmatched} of inline entities and {list_unmatched} of list entities are not in the text — and {list_wrong_type}–{inline_wrong_type} of what it finds carries the wrong type. The follow-ups are where the generator earns its bill: `Bank of America` — BIO cannot nest, the inline format nests for free; *a new type every month* — the head is a matrix with nine rows, the generator is a word in the prompt.

## qa-note

Two pointers guarantee a quote and cost one pass: {bert_em} EM against {gen_em} for the better order, on the same {n_train} training questions. The generator costs a pass per answer token, and {not_substring} of its answers are not a substring — paraphrases, right in meaning, wrong for a system whose contract is *quote the document*. And the order matters — {direction}, by {em_gap} EM points and {f1_gap} F1. One seed per order, so hold the size loosely; the sign is the finding. {left_out} With an encoder that question does not exist — every token sees every other.

## punct-drop-note

{dropped} of {n_words} words dropped — scored as wrong, not as changed

## fig-order-note-cq

Context first: the paragraph is read *without knowing the question* — the argument from block 01 says this order should lose. But the question is the last thing before the answer.

## fig-order-note-qc

Question first: every token of the paragraph can see what to look for — the argument from block 01 says this order should win. But the model has to carry the question across 150 tokens of paragraph.

## qa-dir-opposite

in the *opposite* direction from what block 01 predicted. The paragraph read *without* the question wins

## qa-dir-predicted

in the direction block 01 predicted

## qa-left-out

What block 01 left out: what is read late is read with more context, and what is read late is also *next to the output*. Causal reading cuts both ways, and here the second edge is sharper.
