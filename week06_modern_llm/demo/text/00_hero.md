# hero · How models could afford to grow

## lede

Last week one 124M decoder did everything, and we counted what an answer costs: one forward pass per token, and a cache so the prefix is not read twice. We also left two things unpaid — the cache's memory, and the question nobody asked out loud: if 124M was enough for a seminar, why is nothing you actually use that small?

## hero-p1

GPT-2 at its largest was 1.5 billion parameters, trained on 40 GB of text, reading 1 024 tokens at a time. Five years later the same block — attention, feed-forward, a residual stream — runs at hundreds of billions of parameters, on trillions of tokens, over a hundred thousand tokens of context. Nobody invented a new architecture in between. What happened is that somebody worked out **what growing costs**, and then replaced, one by one, the parts of the block that sent the largest bills.

So today is a seminar about bills. There is no training in it: every number is either something you compute by hand from a `config.json`, or one forward pass through a model somebody else trained.

## hero-p2

**The question for today:** how did models afford to become a hundred times bigger than GPT-2? The block of 2017 still stands; what changed are the parts that sent these bills.
