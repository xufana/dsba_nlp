# end · The scoreboard

## end-p1

Five ways, one model, one dataset, one thousand steps.

## bet-board

Sort the five methods by validation accuracy, best first.

## bet-lpft

LP-FT against plain fine-tuning?

## board-note

The bars are ±1 standard error of an accuracy on {n} sentences — about {se} points. Fine-tuning, LoRA and LP-FT are **a tie**: LoRA gets there moving {lora_pct} of the parameters. LP-FT gains nothing measurable in distribution — Kumar et al.'s gain is out of distribution, which SST-2's validation set is not. Learning rates differ (2e-6 for full fine-tuning, 1e-4 for LoRA), so the comparison is not one knob.

## gpt3-p1

The same comparison at 175B, from the LoRA paper. Read the parameter column against the accuracy columns.

## end-p2

**Head or body.** Probing keeps the features and loses accuracy; fine-tuning gains accuracy and can distort the features; LP-FT does the head first.

**What to train.** A prompt, an adapter, the biases, or a low-rank update next to the frozen weights. LoRA wins on the combination: few parameters, no extra latency once merged, a tie with full fine-tuning.

**What it saves.** Not time per step — memory and storage. That is what makes fine-tuning a 7B model a notebook exercise, which is where week 8 starts.

## end-refs

* Hu et al. (2021). [*LoRA: Low-Rank Adaptation of Large Language Models.*](https://arxiv.org/abs/2106.09685) ICLR 2022.
* Lester, Al-Rfou, Constant (2021). [*The Power of Scale for Parameter-Efficient Prompt Tuning.*](https://arxiv.org/abs/2104.08691) EMNLP 2021.
* Houlsby et al. (2019). [*Parameter-Efficient Transfer Learning for NLP.*](https://arxiv.org/abs/1902.00751) ICML 2019. — adapters.
* Ben Zaken, Ravfogel, Goldberg (2021). [*BitFit: Simple Parameter-efficient Fine-tuning for Transformer-based Masked Language-models.*](https://arxiv.org/abs/2106.10199) ACL 2022.
* Kumar et al. (2022). [*Fine-Tuning can Distort Pretrained Features and Underperform Out-of-Distribution.*](https://arxiv.org/abs/2202.10054) ICLR 2022. — LP-FT.
* Aghajanyan, Zettlemoyer, Gupta (2020). [*Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning.*](https://arxiv.org/abs/2012.13255) ACL 2021.
* Dettmers et al. (2023). [*QLoRA: Efficient Finetuning of Quantized LLMs.*](https://arxiv.org/abs/2305.14314) NeurIPS 2023.
* Socher et al. (2013). [*Recursive Deep Models for Semantic Compositionality Over a Sentiment Treebank.*](https://aclanthology.org/D13-1170/) EMNLP 2013. — the source of SST-2; not on arXiv.
* Wang et al. (2018). [*GLUE: A Multi-Task Benchmark and Analysis Platform for Natural Language Understanding.*](https://arxiv.org/abs/1804.07461) ICLR 2019.
