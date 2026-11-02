# rlvr · RL with a verifier, and reasoning

## rlvr-p1

For one kind of task nobody has to compare anything: when the answer can be **checked**. A maths problem with a known number, code with tests, an output that must parse as JSON. Then the reward model is replaced by a program, and the reward cannot be fooled by style or length — only by the check itself. This is *reinforcement learning with verifiable rewards*, RLVR (Lambert et al. 2024 named it for Tülu 3), and it is what OLMo's last stage did on maths problems. It is also how DeepSeek-R1 (2025) learned to reason.

## grpo-p1

The algorithm that won is GRPO (Shao et al. 2024, *DeepSeekMath*). For one prompt the model writes a **group** of $G$ answers; each gets its reward $r_i$ — 1 if the checker says right, 0 if not — and each answer's **advantage** is how much better it did than its own group. Then every token of answer $i$ gets pushed up or down by $A_i$ — the claim's $w_t$ — with the same KL leash to a reference as in PPO. Compare with PPO: no reward model (a checker), no critic (the group average is the baseline the critic used to estimate). Two of PPO's four models are gone.

## grpo-bet

Click the samples to flip them right / wrong. What are the advantages when one of eight is right? When all eight are?

## grpo-note

With {right} of {G} right: **{aPos}** for each right answer, **{aNeg}** for each wrong one; they sum to zero — the group as a whole is not pushed anywhere, only re-weighted inside. Every token of a right answer — the reasoning, not only the final number — is pushed up. That is the whole mechanism of "learning to reason by RL": nobody wrote a solution; the model's own solutions that happened to end on the right number become more likely, together with whatever led there.

## grpo-note-flat

With {right} of {G} right every advantage is **zero**: the prompt teaches nothing. Too easy and too hard problems are wasted compute, and DAPO (Yu et al. 2025) simply filters them out of the batch.

## grpo-note-std

Dividing by the std gives the most weight to the problems where the group almost agrees: one right out of {G} earns **{aPos}** — the rarer the success, the larger the push. Dr. GRPO (Liu et al. 2025) removes the division, and the averaging over each answer's own length that rewards long wrong answers less than short ones.

## checker-p1

The whole "reward model" of RL with a verifier is fifteen lines of the notebook: cut off the base model's next `Question:`, look for `\boxed{}`, `####` or *the answer is*, else take the last number in the text; 1 if it matches, 0 otherwise. Type an answer and see what it earns.

## checker-note

A reward for the *format* is a common helper — and the first thing a policy learns to farm. Move its weight: at 1.0 a wrong answer with the right tag earns as much as a right answer without it. Reward hacking in one slider; the verifier is a security boundary, not a grader.

## teach-p1

GRPO learns only from the **difference inside a group**. If all $G$ answers to a prompt get the same reward — all right or all wrong — every advantage is $(r_i − \mathrm{mean})/\mathrm{std} = 0$, and the prompt contributes no gradient at all, although we paid for $G$ generations.

So the question is: for a prompt the model solves with probability $p$, how often is a group *mixed*? All $G$ right happens with probability $p^G$, all wrong with $(1 − p)^G$, so a group teaches with probability $1 − p^G − (1 − p)^G$. Too hard ($p ≈ 0$): all wrong. Too easy ($p ≈ 1$): all right. Only the middle teaches — which is why the RL datasets of 2025 are curated by difficulty, and DAPO drops the groups with no spread and samples new ones.

## teach-sim-note

Each row is one prompt and its group; ✓ / ✗ is the checker. A row with both colours gets advantages and pushes the model; a row of one colour is thrown away. Move $p$ to the ends and watch the rows go flat. A larger $G$ helps at the edges — and costs $G$ generations per prompt.

## teach-note

The same thing on real models: {n} GSM8K problems, {samples} samples each. The red bars are problems that teach nothing — never solved, or solved every time. The base model: **{base0}%** never solved, too hard. After SFT most problems land in the middle ({sftFlat}% wasted). After RLVR the right end fills up: **{rlvr1}%** solved by all {samples} samples — the model has outgrown them ({rlvrFlat}% wasted, against {sftFlat}% for SFT). To keep learning, RL needs new problems at the edge of what it can do.

## passk-p1

**Sharper, or smarter?** pass@k is the probability that *at least one* of $k$ answers is right (Chen et al. 2021); the notebook's `pass_at_k` estimates it from $n$ samples without bias. pass@1 is how good the model is when you take one answer. pass@k at large $k$ is what the model *can* do, given enough tries.

## bet-passk

Three curves, base / SFT / RLVR. At k = 1 RLVR is on top. Which curve does it meet by k = 32?

## passk-note

The left end is what everyone reports: RLVR {rlvr1} against {sft1} for SFT and {base1} for the base at one try. The right end is the finding of Yue et al. (2025): as $k$ grows, the others catch up. Here the base does **not** cross by k = {kmax} ({baseK} against {rlvrK}) — but SFT nearly does: {sftK}, a gap of {gap1} at k = 1 that became {gapK}. RL with a verifier mostly moves probability onto correct solutions the model could already sample — it makes the model **more reliable, not more capable**. And a correction to the textbook claim that "what the base never solves, RL does not solve either": of the {baseNever} problems the base never got right in {n} tries, RLVR solves {rlvrSolves} at least once — but SFT alone already solves {sftSolves} of them. That is the format, not the RL.

## think-p1

**Thinking is written tokens.** The other thing RL did in 2025 is to make models think out loud: given a reward only for the final answer and room to write, DeepSeek-R1-Zero learned by itself to write long chains of reasoning, to check, to backtrack — and its accuracy grew with the length of what it wrote. Most models of 2026 do this, and many — Qwen3, SmolLM3 — can do it *or not*, by one switch in the chat template: a pair of empty `<think></think>` tags. That is test-time compute: a third dial, next to week 6's $N$ and $D$.

## bet-think

Qwen3-0.6B on GSM8K, thinking on and off. How many times more tokens does it write — and how much accuracy does that buy?

## think-note

Same weights, same question — only the template differs. Thinking: **{accOn}** accuracy, {tokOn} tokens on average, **{ranOut}%** of the answers hit the {budgetOn}-token budget before `</think>` closed. Without: **{accOff}**, {tokOff} tokens. **×{ratio}** tokens for +{gain} accuracy. Week 5's arithmetic applies to every one of them: one forward pass per token, the cache growing. Thinking is the most expensive way to buy accuracy per request, and the cheapest per *parameter*: the 0.6B model with thinking is the price of a larger model without it, paid at inference time instead of training time.
