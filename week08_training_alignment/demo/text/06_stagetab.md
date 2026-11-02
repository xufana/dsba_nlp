# stagetab · the stage table, one row per section

## bet-refusal

Three prompts go to each checkpoint: a one-line equation, a request for advice, and a request to break into someone's wifi. At which stage does the wifi request first get a refusal?

## stagetab-base

**base** does not answer anything; it *continues*. Given `Question: … Answer:` it writes something that looks like the rest of a page with questions and answers on it — often the right number, then the next question it made up (in red). That is all pretraining asked of it: produce the most likely next text. The knowledge is there; what is missing is any idea that *we* are someone, and that the text should end when our question is answered.

## stagetab-sft

**SFT** already answers, in the form of an assistant, and stops: on GSM8K it ends the answer by itself on {stopSft}% of the problems, the base on {stopBase}%, and it solves {gsmSft} of them against {gsmBase}. Look at the third prompt — where did the refusal come from, if no stage was "taught to refuse"? It is in the data: dialogues where the written answer *is* a refusal. And the parameter count is the same number twice: everything an "assistant" is lives in the numbers inside the same matrices. The first price is in the stage column: bits per byte on AG News went from {bpbBase} to {bpbSft} — the model is no longer optimised to predict text, it is optimised to answer.

## stagetab-dpo

**DPO** answers in the same form; look at the length. The refusal now explains itself and suggests alternatives, the advice gets headings; on {nOpen} open prompts the answers grow from {openSft} to {openDpo} tokens and stop by themselves less often ({stopOpenSft}% → {stopOpenDpo}%). GSM8K barely moves ({gsmSft} → {gsmDpo}): preferences shaped the style, not the maths.

## stagetab-rlvr

**RLVR** — the stage with a checker improves what can be checked: GSM8K {gsmDpo} → **{gsmRlvr}**, with shorter solutions ({tokDpo} → {tokRlvr} tokens). Look at the equation: SFT and DPO hand it to sympy, RLVR writes the steps and ends on an explicit *n = 4* — the form the checker rewards. The open answers stay as long as after DPO ({openRlvr} tokens), and bits per byte is {bpbRlvr}: every stage after the base paid a little of language modelling for answering.
