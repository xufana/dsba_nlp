# llm · Asking an LLM, and reading the bill

## llm-p1

It is not a secret, that you can perform the simpliest classification by just asking any LLM "what the class is this out of four?" (using a so-called zero-shot or few-shot prompting). The method exists, it is used in industry, and it needs no labelled data at all, which is another huge advantage, on what the previous models and methods weren't capable of. But there is another thing we need to discuss. I've run it earlier on 200 test examples, wrote two prompts differing only in the order of the class list, made three repeatitions for each, using <span class="mono">temperature=0</span>.

## llm-why1

Everything expensive about this is in the last line: no schema, no calibrated score, and a parse step that fails on real traffic. Structured output or tool-use schemas remove the parsing problem; they do not give you back `predict_proba`.

## llm-note1

So, what it costs: latency per example is three to four orders of magnitude above TF-IDF. On the full test set that is the difference between three seconds and an hour. Also, identical calls at <span class="mono">temperature=0</span> can disagree. The same input does not reliably produce the same output at all. Reordering the class list in the prompt — a change with no semantic content — moves accuracy. Moreover, there is no calibrated probability. <span class="mono">predict\_proba</span> from the logistic regression is a real number you can threshold (if you don't get the reference, check out the topic of calibration curves from ML); a generated string is not. And we cannot interpret the model's reasoning, because it is not a model at all — it is a black box that produces text. But it is still good, cuz there is needed zero labelled examples. On a task where nobody has annotated 120 000 documents, that is not a minor convenience — it is the difference between having a system and not having one. **Open question:** why does <span class="mono">temperature=0</span> not guarantee identical output? It has nothing to do with sampling — look up batching and floating-point non-associativity.
