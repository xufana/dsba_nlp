# hero · One model, five ways to teach it

## lede

In week 4 we froze BERT and turned one dial: the head only, the top blocks, everything. Today the body stays frozen and something small is trained next to it — a prompt, an adapter, a pair of thin matrices — and we ask how small it can be.

## hero-p1

In this workshop, we will attempt to fine-tune the GPT2-small model for the task of sentiment analysis using various PEFT methods: LoRA, prompt tuning, and PEFT + LP-FT. To evaluate the quality of fine-tuning, we will use one of the GLUE benchmark datasets, SST-2 (Stanford Sentiment Treebank): sentences with movie reviews that need to be classified as positive or negative.

## hero-p2

**The question for today:** how few parameters does a 124M model need to move to learn a new task — and what does moving fewer of them actually save?

## hero-note

Accuracies, parameter counts and speeds are the autumn-2025 run of this notebook ({device}, {steps} steps of {batch} sentences, {n_valid} validation sentences). Panels marked <span class="illus">illustrative</span> are drawn from a similar distribution, not measured. Tables from papers name their table.
