# bpe · BPE in twenty lines, running in your browser

## bpe-p1

Byte-pair encoding is a greedy algorithm: start from characters, so nothing is ever out of vocabulary; then, repeatedly, find the pair of adjacent units that occurs most often and glue it into a new unit; stop when the vocabulary is as big as you want. Every word carries an end-of-word marker <span class="mono eow">&lt;/w&gt;</span>, so a word-final <span class="mono">ов</span> is a different pair from a word-internal <span class="mono">ов</span>.

**Bet:** what will the very first merge be on a Russian corpus? Pick, then press *Train* — it runs the same 300 merges on the same 3 000 jokes as the notebook, here.

## bet-merge

The first merge on Russian jokes is …

## bpe-note

The first merges are not words. They are the most frequent letter pairs in Russian — the end of a word attached to its last letter, then the commonest bigrams — and only after a few dozen merges do whole short words (*не, что, это*) appear. The algorithm has no idea what a word is. It only counts. And look at <span class="mono">мужик / мужика / мужиками</span>: one piece plus a suffix. That is Russian morphology recovered from statistics alone, and it is the reason the Zipf tail hurts less. <span class="mono">инквизиция</span> is shredded, because 3 000 jokes do not mention the Inquisition much: rare words are expensive in sequence length, not in vocabulary. Nothing is <span class="mono">[UNK]</span>, and nothing ever will be.

## bpe-why1

Encoding applies the same merges in the same order. The Python version takes minutes on the full corpus; `tokenizers` (Rust underneath) does the identical algorithm in about a second and adds a pre-tokenizer that decides where merges may not cross.

## bpe-p2

The <span class="mono">tokenizers</span> library trains the same algorithm on all 117 000 jokes in about a second, and adds two details: a **pre-tokenizer** (word starts are marked with <span class="mono">▁</span>, so decoding is reversible, and punctuation is split off, so a comma never gets glued onto a word) and **special tokens** with fixed ids. The 8 000-token vocabulary below is the one every neural model on this page shares. Type anything — the encoder runs here, on the saved merges.

## bpe-note1

Frequent words are one token; a rare surname is three or four pieces; <span class="mono">[UNK]</span> appears only for a character the corpus never contained. The round trip is exact — spaces included — and that reversibility is going to matter in block 03, when we compare models across tokenizers.

## bpe-p3

Characters give a vocabulary of ~150 and a hundred tokens per joke. Words give 134 000 types and seventeen tokens. BPE puts a dial between the two, and where you set it is a trade: every token the model has to predict is a step of computation and a place to make a mistake; every token you add to the vocabulary is a row of the embedding matrix that needs enough data to train.

## bet-dial

Going from a 1 000-token vocabulary to 32 000, the average joke gets shorter by …

## dial-note

A 32 000-token vocabulary is **not** four times more efficient than an 8 000 one: 1 000 → 32 000 shortens the average joke by ×{ratio}, and the curve keeps flattening. The frequent words were already single tokens at 8 000; the extra 24 000 slots go to rare words that barely appear, and every one of those embedding rows will be trained on a handful of examples. At 8 000 tokens a joke costs {tok_per_word} tokens per word — compare last week's <span class="mono">tiktoken</span> experiment: a tokenizer trained *on Russian* pays far less for Russian than one trained mostly on English. A word vocabulary has {oov} of test tokens out of vocabulary; BPE has exactly zero, at any size. We use **8 000** for the rest of the day — not because it is optimal, but because the perplexities below are only comparable if every neural model shares one tokenizer.

## bpe-merges-empty

Nothing merged yet. Place your bet, then press *Train*.
