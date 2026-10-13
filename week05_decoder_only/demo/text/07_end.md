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

## end-refs

* Radford, Narasimhan, Salimans, Sutskever (2018). [*Improving Language Understanding by Generative Pre-Training.*](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1.
* Radford et al. (2019). [*Language Models are Unsupervised Multitask Learners.*](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
* Brown et al. (2020). [*Language Models are Few-Shot Learners.*](https://arxiv.org/abs/2005.14165) — the prefix as the whole interface.
* nostalgebraist (2020). [*Interpreting GPT: the logit lens.*](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens)
* Alammar (2019). [*The Illustrated GPT-2.*](https://jalammar.github.io/illustrated-gpt2/) — masked self-attention and the cache, with pictures.
* Xiao et al. (2023). [*Efficient Streaming Language Models with Attention Sinks.*](https://arxiv.org/abs/2309.17453)
* Holtzman et al. (2019). [*The Curious Case of Neural Text Degeneration.*](https://arxiv.org/abs/1904.09751)
* von Platen (2020). [*How to generate text.*](https://huggingface.co/blog/how-to-generate) — the `generate` API.
* Su et al. (2022). [*A Contrastive Framework for Neural Text Generation.*](https://arxiv.org/abs/2202.06417)
* Pope et al. (2022). [*Efficiently Scaling Transformer Inference.*](https://arxiv.org/abs/2211.05102)
* Schick, Schütze (2021). [*Exploiting Cloze Questions for Few-Shot Text Classification and Natural Language Inference.*](https://arxiv.org/abs/2001.07676) EACL. — verbalizers.
* Zhang et al. (2025). [*Do BERT-Like Bidirectional Models Still Perform Better on Text Classification in the Era of LLMs?*](https://arxiv.org/abs/2505.18215)
* Zhan, Wang, Huang (2026). [*Assessment of Generative Named Entity Recognition in the Era of Large Language Models.*](https://arxiv.org/abs/2601.17898) — formats, and how generators are wrong.
* Omelianchuk et al. (2020). [*GECToR — Grammatical Error Correction: Tag, Not Rewrite.*](https://arxiv.org/abs/2005.12592) BEA. — the encoder with a vocabulary of edits.
* Tam et al. (2024). [*Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of LLMs.*](https://arxiv.org/abs/2408.02442)
* Su et al. (2021). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864) — RoPE.
* Chen et al. (2023). [*Extending Context Window of Large Language Models via Positional Interpolation.*](https://arxiv.org/abs/2306.15595) — interpolation instead of extrapolation.
* Peng et al. (2023). [*YaRN: Efficient Context Window Extension of Large Language Models.*](https://arxiv.org/abs/2309.00071) — per-frequency scaling.
* Biderman et al. (2023). [*Pythia: A Suite for Analyzing Large Language Models Across Training and Scaling.*](https://arxiv.org/abs/2304.01373) ICML.
* Leviathan, Kalman, Matias (2023). [*Fast Inference from Transformers via Speculative Decoding.*](https://arxiv.org/abs/2211.17192) ICML.
* Willard, Louf (2023). [*Efficient Guided Generation for Large Language Models.*](https://arxiv.org/abs/2307.09702) — constrained generation.
