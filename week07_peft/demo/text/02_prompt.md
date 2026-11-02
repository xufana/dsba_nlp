# prompt · Prompt tuning

## prompt-p1

Prompt tuning is based on the observation that large language models are capable of solving tasks in a zero-shot and few-shot paradigm, relying only on the input prompt. For models that can work in this format, prompt tuning suggests not selecting the prompt manually, but training it: a few vectors are put in front of the embeddings of the text, and only they — and, for classification, the head — are trained.

When configuring the prompt, you can vary its length as well as the initialization method: random, or the embeddings of a text prompt. The notebook starts from "Predict if sentiment of this review is positive or negative".

## prompt-note1

The coloured columns are trainable, the grey ones are the frozen embeddings of the text. The model is causal, so every word can read the prompt; the head reads the last token. Each virtual token costs 768 parameters — and one more position of context on every call.

## bet-prompt

Twelve trained vectors on GPT-2 small. Do they get close to LoRA?

## prompt-note2

{pt} against LoRA's {lora} — {gap} points down, and {below_lp} the head alone. Lester et al. (2021) found prompt tuning matches full fine-tuning only once the model exceeds billions of parameters (T5-XXL, 11B); at 124M the frozen model cannot be steered by twelve vectors. It also learns unstably: the result changes non-monotonically with the prompt length.

## prompt-below

even below

## prompt-above

only a little above
