# hero

## lede

Every model you actually talk to went through the same sequence: pretraining on trillions of tokens, and then a few rounds of much smaller training — supervised fine-tuning, preference tuning, reinforcement learning — that turn a text continuer into something that answers, refuses, and thinks before it answers.

## hero-p1

We look at every round on one model: **OLMo 2 1B**, which Ai2 released after *each* stage, together with the data of each stage. Four checkpoints, one architecture. Like Pythia last week, that is an experiment somebody already paid for.

The second half is the question you will meet at work much sooner than the first one: if a few thousand examples can turn a base model into an assistant, why is *"let's just fine-tune it"* so often the wrong answer?

## claim-p1

Every stage is this one sum — week 2's next-token loss. What changes from stage to stage is only **whose tokens are in the sum**, and **who decides the weight** $w_t$ of each.

## claim-p2

Read the picture top to bottom: the model writes more and more of its own training data, and a human — or a program — only says how good it was.
