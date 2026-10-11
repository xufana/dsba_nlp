# end · Both tables

## end-p1



## end-p2

**Why not an encoder for everything?** Because a head has to enumerate its answers. When the set of answers is open — variable length, insertions, nesting, a type that did not exist last month — the task has nowhere to live but the prefix, and the prefix needs a decoder.

**Why not a decoder for everything?** Because a token costs a pass, and the output is guaranteed to be nothing in particular — not a label, not a copy, not a substring, not a schema; because its probabilities are scores rather than calibrated confidences; and because it reads its input causally — though the QA row shows that last argument predicting the wrong sign. Every one of those has a row in the cost table.

## end-p3

**Five things that transfer to every model this course will touch.** The head is the vocabulary, so the task is the prefix. One pass or $T$ — count before you choose. An encoder's ceiling is its label set — measure it before training. A generator's failure mode is doing more than it was asked — measure fidelity, not just accuracy. Look at twenty examples before choosing a body.

**Next week:** the same decoder, cheaper. The KV cache with numbers — memory per token, prefill against decode, why a GPU runs out of memory before it runs out of arithmetic; speculative decoding; and constrained generation — the mask on the vocabulary that makes a generator emit only what a schema allows, the generator's version of what the scorer did today.

## end-prose

Read the cost table down the *passes* column and it splits in two: the heads at 1, the generators at $T$ — ten times the milliseconds where both were timed. Read it down the *quality* column and it does not split — on every task the head is competitive or ahead at this model size, and the generator is where the head has a ceiling. Cheaper is not worse. It is *narrower*.
