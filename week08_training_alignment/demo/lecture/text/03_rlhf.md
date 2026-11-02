# rlhf · RLHF, RLAIF and Constitutional AI

## rlhf-p1

Most of what we want from an assistant — helpful but not wordy, confident but not invented, the balance between helping and refusing — is hard to demonstrate and easy to compare. So the next stage learns from **comparisons**.

**Step 1 — a reward model.** People see two answers to the same prompt and pick the better one. The reward model $r(x, y)$ — usually the SFT model with its vocabulary head replaced by one number — is trained on the picks with the Bradley–Terry model: every answer has a hidden score, and the probability that $y_w$ wins over $y_l$ depends only on the difference of the scores. In effect, logistic regression on a pair.

## rlhf-p2

**Step 2 — RL with a KL penalty** to the SFT model; the optimiser is PPO. The model generates answers, the reward model scores them, and the policy is pushed towards answers with high reward — while the KL term keeps it close to the SFT model it started from, the reference. Without the leash the policy finds the blind spots of the reward model: the reward model is just a network trained on a few hundred thousand comparisons, and outside them its scores mean nothing.

**What it is for.** The subtle properties: tone, helpfulness, when to help and when to refuse. Unlike SFT the training is on-policy — the model learns from its own answers — and there is a negative signal: a low reward pushes an answer down.

## rlhf-caption

Four networks of the size of the policy, and generation inside the training loop. The value model (critic) estimates how good a half-written answer is, so that each token can be credited with part of the final reward.

## q-rlhf-trained · pick

During PPO, which of the four models receive gradient updates? Tick all that do.

- [x] the policy
- [ ] the reference
- [ ] the reward model
- [x] the value model

> The policy and the critic. The policy is the point of the exercise; the critic has to keep up with it — it predicts the reward the *current* policy will get from a given prefix, so it is retrained alongside. The reference is the frozen SFT model, the anchor of the KL term: if it moved, the leash would move with the dog. The reward model is frozen too: it was trained in step 1 on human picks, and training it on the policy's own answers without new human labels would teach it nothing about people.
> miss: if the critic was left out: it is easy to file it with "the extra frozen models". It is a second network being trained, which is part of why PPO is so unstable.

## q-beta · sort

$β$ is the weight of the KL penalty. For each symptom, was $β$ too small or too large?

bins: β too small · β too large

- the reward model's score climbs, and the answers grow longer and fuller of bullet points → β too small
- after a thousand steps the answers are indistinguishable from the SFT model's → β too large
- the policy drifts into odd text that the reward model happens to score high → β too small
- nothing the preference data asked for shows up in the answers → β too large

> Small $β$: the leash is loose, and the policy goes wherever the reward model is generous — including places no human ever rated, where its score is noise. Large $β$: any step away from the reference costs more than the reward can pay, and the model stays the SFT model. There is no universal value; it is tuned per run, and it is one of PPO's notorious knobs.
> miss: if "longer answers" went to β too large: length is a reward-model preference the policy *exploits*, and exploiting needs room to move — a loose leash.

## rlhf-p3

**The problems.**

- Four models in memory: policy, reference, reward and value. PPO is unstable and sensitive to hyperparameters.
- **Reward hacking**, Goodhart's law: once a measure becomes a target it stops being a good measure. The policy finds what the reward model likes regardless of quality — long answers, extra formatting, and **sycophancy**: agreeing with the user.
- The annotators are noisy and disagree with each other; they pick the answer that *sounds* convincing, not the one that is correct.
- Choosing $β$: a weak KL means degradation, a strong one means the model does not learn.
- Alignment tax: some capabilities sometimes drop.

## q-hack · pick

The reward model's score keeps rising through PPO. A fresh human evaluation went up for the first thousand steps and then down. What is the policy likely doing? Tick all that apply.

- [x] writing longer answers
- [x] adding headers and bullet points
- [x] agreeing with whatever the user claims
- [ ] learning facts it did not know

> Goodhart in a training curve: the proxy keeps rising after the real target has turned over. Gao et al. (2022) measured exactly this shape, with a large "gold" reward model standing in for the humans: the gold score rises and then falls as the policy moves away from the reference. What fills the gap are the reward model's systematic preferences: length, formatting, agreement. None of them is new knowledge — RL against a reward model can only move probability between answers the model can already write.
> miss: if "learning facts": the reward model never tells the policy any facts, it only scores answers. A rising score is the policy finding what scores well.

## cai-p1

**RLAIF and Constitutional AI.** The idea: replace the human, partly, with a model. In Constitutional AI (Bai et al. 2022) the model gets a set of written principles:

1. **SL phase.** The model critiques and rewrites its own answers according to the principles, and is fine-tuned on the rewritten ones.
2. **RL phase.** A judge model compares pairs of answers according to the principles; its picks train the reward model; then RL as above.

**What it is for.** Scaling the labelling, especially for safety. The principles are explicit and can be edited — the rules of the model are a document, not a crowd's implicit taste.

**The problems.** The judge has biases of its own: it prefers its own style (self-preference) and it likes length. Principles conflict and are hard to formulate. And there is a closed loop: the model learns to please a model.

## q-cai · pick

You replace your human labellers with an LLM judge and a list of principles. What new failure do you have to watch for? Tick all that apply.

- [x] the judge prefers answers written the way it writes
- [x] the judge prefers longer answers, and the policy learns to write longer
- [x] two principles contradict each other on the same prompt
- [ ] the labels become too expensive to collect

> The judge is a model, so it has a model's preferences, and the policy will find them as surely as it finds a reward model's — self-preference and length are the documented ones. Conflicting principles ("be maximally helpful" against "avoid any risk") end up as noise in the picks. What the judge solves is the cost: AI labels are orders of magnitude cheaper, which is the whole reason to do it.
> miss: if you thought the judge removes the noise: it removes the disagreement between people, and replaces it with one systematic bias, which is harder to see.
