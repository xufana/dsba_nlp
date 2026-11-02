# problems · Inference-time alignment, the problems every method shares, and the pipeline in practice

## inf-p1

**Inference-time alignment** changes nothing in the weights:

- a **system prompt** or a specification of behaviour — cheap, and easily bypassed;
- **best-of-N** / rejection sampling with a reward model — $N$ times the cost; often used to generate SFT data rather than in production;
- **guardrails**: classifiers on the input and the output.

The problems: jailbreaks, prompt injection, latency. It is a fence around the model, not a change in it.

## prob-p1

**The problems every method shares.**

1. **Specification.** We cannot state the goal precisely ourselves, and helpful and harmless conflict: over-refusal on one side, dangerous answers on the other.
2. **Goodhart.** Every measurable reward is a proxy.
3. **Sycophancy** is a systemic artefact: people and judges both prefer agreement and confidence (Sharma et al. 2023).
4. **Scalable oversight.** How do you check a model that is stronger than its labellers? Debate, weak-to-strong generalisation, interpretability.
5. **Shallowness.** Alignment mostly changes the first tokens of an answer and its style — hence jailbreaks, and hence a small fine-tune can remove the behaviour.
6. **Evaluation.** A benchmark is not reality, and models can recognise that they are being tested.

## q-prob-sort · sort

Which problem does each symptom show?

bins: specification · Goodhart · sycophancy · scalable oversight · shallowness · evaluation

- the model refuses to explain how to kill a Python process → specification
- the reward model's score went up, the users' ratings went down → Goodhart
- the user insists that 7 × 8 = 54, and the model agrees and apologises → sycophancy
- nobody on the labelling team can check whether the model's proof is correct → scalable oversight
- an answer that starts with "Sure, here is how" carries on into content the model refuses when asked directly → shallowness
- top of the leaderboard, and the users complain → evaluation

> One symptom each, though they feed each other: sycophancy is Goodhart on a human rater; over-refusal is a specification written to be safe rather than useful; and a shallow alignment is what makes the "Sure, here is" prefill work — the refusal lives in the first few tokens, and once they are past, the model continues as its base would (Qi et al. 2024).
> miss: if "kill a Python process" went to shallowness: the model is doing exactly what it was trained to — refusing "kill" — and that is the problem. The training goal, not its depth.

## q-shallow · pick

A safety-tuned open model is fine-tuned for a hundred steps on harmless customer-support dialogues. Afterwards it answers harmful requests it used to refuse. Which property of alignment explains this best?

- [x] shallowness: the refusals are a small, mostly surface change, and a little training in another direction is enough to move it
- [ ] Goodhart: the support data had a hidden reward
- [ ] scalable oversight: the support data were not checked by experts
- [ ] sycophancy: the support dialogues taught it to agree

> Shallowness. Post-training is a small move in weight space, and fine-tuning is a move in another direction; with nothing in the new data that asks for refusals, there is nothing holding them in place. Qi et al. (2023) showed it with benign data, exactly this setting. The practical rule: every fine-tune of an aligned model needs the safety evaluation re-run, even when the data are harmless.
> miss: if sycophancy: a support bot does agree a lot, but that would not explain answering what it used to refuse. What disappeared is the refusal behaviour itself.

## practice-p1

**The typical pipeline in practice.**

1. **SFT** on human and synthetic demonstrations (often through rejection sampling).
2. **Preference optimisation**: RLHF where the infrastructure exists, the DPO family for simplicity; safety data and AI feedback by principles.
3. **RLVR** for maths, code and agentic tasks.
4. **Red teaming**, classifiers, iterations: new failures turn into new data.

And the whole map in one table:

<table class="task-table"><thead><tr><th>method</th><th>signal</th><th>what it needs</th><th>regime</th><th>main plus</th><th>main pain</th></tr></thead><tbody>
<tr><td><b>SFT</b></td><td>reference answers</td><td>demonstrations</td><td>off-policy, offline</td><td>simple, sets the format</td><td>no negative signal, imitation</td></tr>
<tr><td><b>RLHF (PPO)</b></td><td>human comparisons → a reward model</td><td>4 models, RL infrastructure</td><td>nearly on-policy</td><td>subtle preferences</td><td>instability, reward hacking</td></tr>
<tr><td><b>CAI / RLAIF</b></td><td>comparisons by a model, by principles</td><td>a constitution and a judge</td><td>that of its RL part</td><td>scale, explicit rules</td><td>the judge's biases</td></tr>
<tr><td><b>DPO and co.</b></td><td>pairs, or labels</td><td>1–2 models</td><td>offline</td><td>cheap, stable</td><td>distribution shift</td></tr>
<tr><td><b>RLVR / GRPO</b></td><td>an automatic check</td><td>a verifier and rollouts</td><td>nearly on-policy</td><td>teaches reasoning, no reward model</td><td>only checkable domains</td></tr>
<tr><td><b>inference-time</b></td><td>—</td><td>a prompt, filters</td><td>—</td><td>instant</td><td>easily bypassed</td></tr>
</tbody></table>
