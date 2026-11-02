# design · Design it

## design-p1

One system, end to end, with this week's tools. There is no single right design; there is a short list of things a right design cannot skip.

## q-design · write

An online shop runs its support chat on an open 8B instruct model. It should check order status and issue refunds through two internal APIs, stop promising refunds it is not allowed to grant, and keep the shop's tone. You have 20 000 past chats handled by human agents, 3 000 thumbs up / thumbs down from a pilot, and a staging copy of both APIs. Sketch the post-training: the task, the data, the signal for each stage, the method, the metric, and what breaks first.

- try the prompt first: a system prompt with the refund policy and the tool schemas, measured, before any training
- the facts (prices, the policy text) go into the prompt, not into the weights
- SFT on the human chats rewritten as tool-calling trajectories, with the loss masked on the tool outputs
- refunds: a verifiable reward from the state of the staging system — a refund issued only when the policy allows it — and RL in the sandbox
- the thumbs are single labels, not pairs: KTO, or a reward model trained on them, for the tone
- the metric: task success on held-out tasks in staging, the rate of unauthorised refund promises, and a general-ability check before and after
- what breaks first: the agent hacking the sandbox's check, over-asking or over-refusing, injection through customers' text in order notes, and lost general abilities

> **Task.** Three behaviours, and they want different signals: *acting* through the two APIs (checkable — the staging system knows what happened), *not over-promising* (checkable — the refund policy can be written as a rule over the final state), *tone* (not checkable — only people's reactions). Before training anything, put the policy and the tool schemas into a system prompt and measure: a capable instruct model with a good prompt may already handle most of it, and that is the baseline every stage has to beat.
>
> **Data.** The 20 000 human chats are demonstrations, but not of tool use: the agents clicked in an admin panel. Rewrite them as trajectories — the API calls the agent would have made, the observations the staging system returns — and drop the ones that cannot be replayed. The 3 000 thumbs are single labels on single answers, not pairs. The refund policy and the prices are facts: they stay in the prompt, so they can change without a training run.
>
> **Signal and method, per stage.** SFT on the rewritten trajectories, with the loss on the agent's tokens only — the tool outputs are masked, or the model learns to imagine order statuses. Then RL in the staging sandbox with GRPO: tasks sampled from real chats, a reward from the final state (the right refund issued, or correctly not issued) — this is where the agent learns to recover from a wrong call and not to promise what the policy does not allow. For tone, KTO on the thumbs, or a reward model trained on them and mixed into the RL reward with a small weight.
>
> **Metric.** Task success on held-out tasks in staging; the rate of unauthorised refund promises — counted in the text, not only in the API calls, because a promise in words is the failure that costs money; and a general-ability check (an instruction-following set, a few safety prompts) before and after every stage, because every fine-tune costs something you did not measure.
>
> **What breaks first.** The sandbox check: an agent rewarded for the final state will find the cheapest way to that state — issuing and cancelling refunds, calling an admin endpoint you forgot to hide. Then the balance: an agent penalised for unauthorised refunds learns to refuse every refund, or to ask the customer three clarifying questions; measure both sides. Then injection: customers write text into order notes, and that text comes back as an observation. And the general abilities: a small model tuned hard on one shop's chats loses what it was not shown.
> miss: if the design starts with "fine-tune on the 20 000 chats": they are the most data you have and the least useful as they are — no tool calls in them, and human agents promise things the policy does not allow. The prompt baseline comes first; the chats become data only after rewriting.
