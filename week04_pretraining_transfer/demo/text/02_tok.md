# tok · One loop, three criteria

## tok-p1

In week 2 we trained BPE: count the most frequent adjacent pair, glue it, repeat. That's the tokenizer under GPT. It is **not** the tokenizer under BERT, and it is not the one under T5 or ALBERT either. There are three algorithms in use, and the good news is that two of them are the same loop. Everything in this block runs on a toy: 2 000 AG News texts.

Both trainers do the same thing at every step: over the corpus as it is currently split, pick the adjacent pair ${(a,b)}$ with the highest score and glue it. Only the score differs:

## bet-tok-first

Now the score divides by how frequent the two parts are on their own. Will the first WordPiece merge still be `s` + `</w>`?

## tok-note

It is not. `s</w>` is the most *frequent* pair, but `s` and `</w>` are each so common on their own that seeing them together is not surprising. WordPiece picks the pair that is frequent *relative to* what you'd expect from its parts — pointwise mutual information under a different name. The first merges are digit pairs out of years and prices. BPE maximises compression; WordPiece maximises likelihood.

## tok-p2

Training gives you a vocabulary. **Encoding a new word with that vocabulary is a second algorithm**, and BPE and WordPiece disagree on it too: BPE *replays the merges* in training order; WordPiece *ignores the merges* and takes the longest piece in the vocabulary that matches the start of the word, then the longest piece that matches the rest. Greedy longest-match-first. If no piece matches, the whole word is `[UNK]`.

## bet-enc

On what fraction of the test words do replay and longest-match disagree?

## enc-note

A vocabulary is not a tokenizer. The same set of pieces, applied by two different rules, gives you two different sequences — and a model trained on one of them has never seen the other. This is the actual reason `tokenizers` saves the merge list *and* the algorithm type in the same json.

## tok-note1

Drag the merge count down to zero and every word is characters; up, and the pieces grow in training order. The third row applies the *same* WordPiece vocabulary by longest-match — watch for words where it differs from the replay, and for `[UNK]` when a character was never in the toy corpus.

## tok-p3

The third algorithm (Kudo 2018) does not merge anything. It runs *backwards*: start with a huge vocabulary, give each piece a probability and treat a word as a sequence of independent pieces, estimate by EM, then throw away the pieces whose removal hurts the corpus likelihood the least. Encoding a word is then **Viterbi**: the most probable segmentation — not a greedy rule, and not a replay.

## tok-note2

We remove a fifth of the vocabulary every round and the log-likelihood barely moves — it even goes *up*, because the E/M re-estimation after each round fits the corpus better than the crude seed did. And a word does not *have* one tokenization: the best segmentation holds most of the probability but not all of it. Kudo's subword regularization **samples** a segmentation during training — data augmentation that BPE cannot do, because BPE has no distribution to sample from.

## tok-note3

`bert-base-uncased` lowercases and strips accents before it does anything else — a *normalizer*, which is why an uncased BERT can never tell *Apple* from *apple*. The Russian sentence under BERT and GPT-2 is a pile of fragments and single bytes: the vocabularies were trained on English. GPT-2 has no `[UNK]` at all — byte-level BPE starts from the 256 bytes, at the price of a word like *взлетели* costing a token per byte.
