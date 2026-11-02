# probe · Head or body

## probe-p1

A pretrained model learned a lot from a heap of data; a downstream task has little. Three ways to use it: train only the last layer — the **head**, linear probing; train **the whole model**, fine-tuning; or train **a small set of weights** next to the frozen body — parameter-efficient fine-tuning, the rest of today.

Probing is the simplest and fastest, and it does not change the information the model extracts. Fine-tuning is the longest and usually the most accurate: it teaches the model to extract what matters for the task. The question is what each does to data the task did not show — **in distribution** (ID: the test looks like the training set) against **out of distribution** (OOD: the same task, other data).

## bet-kumar-id

In distribution — who wins, fine-tuning or the head alone?

## bet-kumar-ood

Out of distribution — who wins?

## kumar-note

Fine-tuning wins in distribution by {id_gap} points, and **loses** out of distribution by {ood_gap}. The third column is the fix below: LP-FT wins both. These are averages over image datasets (CIFAR, ImageNet, DomainNet and their shifted versions) — the paper that named the effect; nobody has a news-article version of this table.

## probe-p2

Why would training *more* hurt? Full fine-tuning starts with a random head. On the first steps its gradients are large and random, and they flow into the body: the features the model brought from pretraining get distorted before the head has learned what to read from them. The fix is two stages: first train the head alone, then fine-tune everything starting from that head — **LP-FT**.

## toy-p1

The smallest network where this can happen: one feature $z = b_1 x_1 + b_2 x_2$, one head weight $v$, the prediction $v z$. The pretrained feature is already right ($b_1 = b_2$). The training data vary only along $x_1$ (dots on the horizontal axis); the OOD data only along $x_2$ (squares on the vertical axis). Train it three ways — this runs in your browser.

## bet-toy

Fine-tuning from a random head reaches 100% on the training data. What happens to the OOD squares?

## toy-note

The gradient of $b_2$ is $v · x_2 · (…)$, and every training point has $x_2 ≈ 0$: **fine-tuning cannot touch $b_2$**. This random head started with the wrong sign, as half of random heads do; fine-tuning fixes the training data the fastest way — by flipping $b_1$ — while $b_2$ stays, so the boundary turns and every OOD square falls on the wrong side. Probing moves only $v$. LP-FT starts from the probed $v$, which already has the right sign: fine-tuning then stretches $b_1$ in the direction it already had, and the boundary keeps pointing the right way.

## toy-result

{name}: ID {id}, OOD {ood}, $b_1$ = {b1}, $b_2$ = {b2}, $v$ = {v}
