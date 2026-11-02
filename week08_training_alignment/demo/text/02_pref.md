# pref · preferences: from votes to Bradley–Terry to DPO

## pref-p1

SFT has a limit that is built into its loss: it only ever says *"write this"*. It never says *"not that"*. And for most of what we want from an assistant — helpful but not wordy, confident but not invented, polite but not grovelling — it is hard to write the best answer, and easy to say which of two answers is better. So the next stage learns from **comparisons**. Let's make some.

## label-p1

One prompt, four answers from four different models (UltraFeedback, Cui et al. 2023). Six pairs. For each pair the room votes — hands up for the left one, hands up for the right one — and the counts go into the table. Nobody sees the judge's scores or the models' names until the reveal.

## agree-note

**{mean}%** of the votes went with the majority of their pair; against a coin that is κ = **{kappa}**. {cycle}

## agree-cycle-yes

The majorities form a cycle — A beats B, B beats C, C beats A — which a single score per answer cannot express. Bradley–Terry will fit it anyway, by giving the three nearly equal scores.

## agree-cycle-no

The majorities are transitive: a single score per answer can reproduce every one of them.

## bt-p1

To learn from picks we need a model of how a pick happens; the one used is from 1952 — Bradley & Terry, ranking chess players and tournaments: every answer has a hidden score $r$, and only the *difference* of scores matters.

## bt-p2

Fitting it to the votes is a few lines, and a step at a time it is readable: start every score at zero; then raise the score of whoever won more often than the model currently expects, lower the others, and repeat. Each step is one update of Hunter's (2004) iteration; the loss it lowers is the one the reward model will be trained with.

## bt-step

step **{k}** · loss {nll} · ranking {order}

## bt-reveal-agree

The judge (GPT-4, 1–10) ranked them {judge}. The room's ranking **agrees**: same order.

## bt-reveal-disagree

The judge (GPT-4, 1–10) ranked them {judge}; the room put {room}. Where they differ is the pair worth arguing about — and the pair a reward model trained on this data would learn wrong.

## rm-p1

**A reward model** is this loss on a network. InstructGPT (Ouyang et al. 2022), following Christiano et al. (2017): people pick between two answers; the SFT model with its vocabulary head swapped for one number is trained on the picks with $-\mathrm{log}\hspace{0.2em}σ(r_{chosen} − r_{rejected})$ — logistic regression on the difference, the classifier applied to a pair. (Chatbot Arena's leaderboard is the same model fitted to votes over pairs of *systems*.)

**Then, reinforcement learning.** The SFT model generates, the reward model scores, and PPO (Schulman et al. 2017) pushes up the answers with high reward — with a penalty for drifting away from the SFT model, so that it does not find the reward model's blind spots. Count what PPO keeps in memory: the policy being trained, the frozen reference, the reward model, and a value network (critic) to estimate how good a half-written answer is — **four models of the size of the policy**, and generation inside the training loop. It worked; it was famously hard to make work.

## roles-note

Click a method to see what it keeps in memory. The reference never generates: it scores the same answer under the same prefixes, for the KL leash.

## dpo-p1

Rafailov et al. (2023) noticed that the objective above has an exact solution. For a fixed reward, the best policy is the reference re-weighted by the exponentiated reward — and the reward can be read back off the policy. $Z(x)$ is a sum over *every possible answer*; nobody can compute it. But both answers of a pair answer the same prompt, so $β\hspace{0.2em}\mathrm{log}\hspace{0.2em}Z(x)$ appears in both scores and **cancels in the difference**. What is left contains only log-probabilities that we can compute.

## dpo-p2

No reward model, no sampling, no critic; two models in memory (the one trained and the frozen SFT), and a loss you can write in one line. The paper's subtitle says what happened: *your language model is secretly a reward model* — $β\hspace{0.2em}\mathrm{log}\hspace{0.2em}π/π_{ref}$ **is** the reward, and Bradley–Terry is what lets $Z$ disappear. This is why the 2023–2025 open models, OLMo 2 among them, used DPO and not PPO for this stage.

## calc-p1

Move the four log-probabilities and $β$. The presets are the notebook's *let's calculate*: (b) the chosen answer went up and the rejected one down; (c) **both went down**, the rejected one faster. Same margin, same loss — and in (c) the chosen answer became $e^5 ≈ 150$ times *less* likely. The loss only sees the difference. Whether that happens on a real model is a measurement.

## calc-ln

Tülu 3's variant divides each log-ratio by the answer's length: $Δ_w = 2$ over 100 tokens against $Δ_l = 1$ over 10 tokens is a gap of +1 for DPO and −0.08 for length-normalised DPO — the pair flips. It is a different objective, not a numerical tweak.

## pairs-p1

Take pairs from OLMo's own DPO data and compute $\mathrm{log}\hspace{0.2em}π$ of each answer under the SFT model (DPO's reference) and under the DPO model. No training — four numbers per pair, and the sign of the margin. Each dot is a pair; below the diagonal it moved the right way.

## bet-pairs

On what share of its own training pairs did the DPO model make the **chosen** answer more likely than SFT had it?

## pairs-note

Two readings. First, the share: on **{marginPos}%** of its own training pairs DPO prefers the chosen answer more than its reference did — but not all; nobody trains to zero loss on 378k noisy pairs. These are training pairs, so this is training accuracy, not a test. Second, the quadrants, which are (c) on real numbers: on **{bothDown}%** of the pairs *both* answers became less likely, the rejected one more so; $\mathrm{log}\hspace{0.2em}π(chosen)$ went up on only **{chosenUp}%**. This is a known property of DPO, not a bug of OLMo: probability has to go somewhere, and the loss does not say where — usually into answers that are in neither half of any pair. Several of the variants that followed (IPO, SimPO; Tülu 3's length-normalised DPO) change exactly the function of the margin, or add a term that keeps $\mathrm{log}\hspace{0.2em}π(chosen)$ from falling. The RLVR checkpoint, scored on the same pairs, sits at {rlvrPos}%: the last stage did not undo the preferences.

## policy-note

Split by who wrote the pairs. On the {nOn} *on-policy* pairs — both answers sampled from the SFT model before training — the chosen answer went up on **{onUp}%** and both fell on **{onBoth}%**; on the {nOff} pairs written by other models, **{offUp}%** and **{offBoth}%**. The model's own answers are exactly the ones it pushes down hardest: for them there is no "elsewhere" for the probability to go but away from its own style.

## length-p1

Then **length**. Preference data has a well-documented bias: judges, human or model, tend to prefer the longer of two answers, and preference-tuned models learn to write more (Singhal et al. 2023).

## length-note

In these {n} pairs the chosen answer is the longer one on **{longer}%**. On {nOpen} open prompts the SFT model writes {sftTok} tokens and stops by itself on {sftStop}% of them; after DPO, {dpoTok} tokens and {dpoStop}% — the rest run into the {budget}-token budget.

## bt-reveal-novotes

The judge (GPT-4, 1–10) ranked them {judge}. Type the room's votes above and fit the scores to see where the room disagrees.
