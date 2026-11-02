# grpo · RLVR and GRPO: RL on verifiable rewards

## grpo-p1

**The idea.** Where the answer can be checked automatically — maths with a known answer, code with tests, a required format — no reward model is needed: the reward is the result of the check. This is RL with verifiable rewards, RLVR.

**GRPO** (Shao et al. 2024, *DeepSeekMath*; then DeepSeek-R1) drops the value model too. For one prompt the model writes a **group** of $G$ answers, the checker gives each a reward $r_i$, and the advantage of each answer is counted relative to its own group:

## grpo-p2

Every token of answer $i$ is then pushed up or down by $A_i$, with the same clipping and KL to a reference as in PPO.

**What it is for.** Teaching the model to reason: long chains of thought, checking itself, backtracking — all of it appears out of optimising for correctness, nobody writes it down. Strictly speaking this is capability training more than alignment, but it lives in the same post-training pipeline.

**The problems.**

- Only where there is a verifier.
- Hacking the verifier: fitting the tests, editing the tests, guessing the format.
- Sparse reward: if all $G$ answers are wrong, the std is zero and there is no gradient. A curriculum is needed.
- Length blow-up, entropy collapse, languages mixed in the chain of thought.
- Expensive: many long rollouts.

## q-grpo-solved · pick

A prompt the model already solves: all 8 answers in the group are right. What does it contribute to the update?

- [ ] a strong push up — every answer was right
- [x] nothing — every advantage is zero
- [ ] a push down, to keep the model from overconfidence

> $r_i − \mathrm{mean} = 0$ for everyone, so every advantage is zero, and so is the gradient. The same for a group where all 8 are wrong. GRPO learns only from prompts where the group *disagrees* — problems **at the edge** of what the model can do. A dataset of easy problems is a dataset of wasted rollouts.
> miss: if "a strong push up": that would be REINFORCE with no baseline, where every rewarded answer is pushed up. The group mean *is* the baseline: an answer is good only if it is better than the model's other attempts at the same problem.

## grpo-p3

The question that comes next on its own: if the model trains on its own attempts at a fixed set of problems, will it not just fit those problems?

The group normalisation itself does not lead to fitting — it removes the dependence on how hard a problem is. The advantage is counted separately for each prompt: it is a **baseline**, "how much better is this answer than the other attempts at the same task". The value model in PPO does the same thing with a neural network; GRPO does it with a sample. But fitting the *distribution of tasks* and fitting the *verifier* are real risks of RLVR.

## q-grpo-overfit · pick

Where can RLVR fit something other than "solve the task"? Tick all that apply.

- [x] the distribution of training tasks — olympiad maths and code, and little else
- [x] the verifier — what passes the check rather than what is right
- [x] the weighting — dividing by the std gives some problems disproportionate weight
- [ ] the group baseline — it memorises the answers to the training problems

> The first three. **(a) The task distribution**: train on what can be checked (olympiad maths, code, puzzles) and on everything else the model may reason excessively and lose the "soft" skills — style, loose instructions, calibrated confidence. **(b) The verifier**: the reward is "passed the check", not "solved it", so the model fits the format, the weak tests, the parser. **(c) The std**: see the table below. The group baseline is a mean of eight numbers; it remembers nothing between prompts.
> miss: if the baseline: it is recomputed from scratch for every prompt, from the 8 answers in hand. Fitting happens in what you reward — the tasks and the checker — not in how you centre it.

## grpo-p4

**(c) in numbers.** With binary rewards, a group where 7 of 8 are right has a small std, so its advantages are inflated: the almost-always-solved and almost-never-solved problems get a weight out of proportion to what they teach. **Dr. GRPO** (Liu et al. 2025) removes the division by the std — and, along with it, the normalisation by each answer's length, which penalised long wrong answers less per token than short ones and so encouraged them. Computed here for a group of 8:

## grpo-std-caption

A right answer gets $A_+$, a wrong one $A_−$; the total push of the group is the sum of $|A_i|$. With the std the total depends far less on $k$ than without it: the edges are lifted towards the middle.

## grpo-p5

**(d) Sharpening rather than new abilities.** There is evidence (Yue et al. 2025, *Does RL really incentivize reasoning capacity…*) that RLVR mostly raises pass@1 — the chance that one answer is right — while at large $k$ the pass@k of the model before RL can be just as high. RL narrows the distribution, and the diversity falls.

**The good news.** With comparable data, RL generalises better than SFT: SFT memorises solutions, RL learns from its own attempts and from a signal about the outcome (Chu et al. 2025, *SFT Memorizes, RL Generalizes*).

**What is done against the fitting:** a varied mix of domains, with ordinary preference RL running alongside; **difficulty filtering** — throw away the prompts where all answers are right or all are wrong (dynamic sampling in DAPO, Yu et al. 2025); a KL to the reference (often weakened in reasoning RL); strong verifiers — hidden tests, equivalence checks, protection against editing the tests; held-out evaluation outside the training distribution; and watching pass@k, the entropy and the length, not only pass@1.

The short version: fitting in RLVR comes from *what* we reward and *with what*: a narrow task distribution, a leaky verifier, a skew of weights from the std.

## q-passk · pick

OLMo 2 1B on 100 GSM8K problems: RLVR lifts pass@1 from {sft1} (after SFT) to {rlvr1}. Which measurement would tell you whether RL taught a new ability or sharpened an old one?

- [x] pass@k at large k, for the model before and after RL
- [ ] pass@1 on a harder benchmark
- [ ] the length of the chains of thought
- [ ] the training reward curve

> pass@k at large $k$ asks what the model *can* produce given enough tries. If RL only moved probability onto solutions the model could already sample, the curves meet at large $k$. On this model they nearly do: pass@32 is {sft32} after SFT and {rlvr32} after RL, while at one try the gap is {gap1}. Mostly sharpening, then: RL made the model more reliable on what it could already do. (The base model, before SFT, is another story: {base1} at one try and {base32} at 32 — most of the jump to the SFT curve is the format of the answer.)
> miss: if a harder benchmark: a higher pass@1 there is still one try, and it cannot distinguish "learned to solve" from "learned to pick the solution it already had among its samples more often".

## q-flat · pick

Same model, groups of 8 answers per problem. The share of GSM8K problems whose group is all right or all wrong — and so carries no gradient — is {flat_sft} after SFT and {flat_rlvr} after RLVR. What follows?

- [x] as training goes on, more and more prompts stop teaching; the batch has to be refilled with problems at the model's edge
- [ ] RL made the model worse at a third of the problems
- [ ] the std of the rewards should be increased

> The better the model gets, the more problems it solves 8 times out of 8 — and those groups are pure cost: a full set of long rollouts for a zero gradient. That is why DAPO filters them out of the batch and samples more, and why the RL datasets of 2025 are curated by difficulty and re-filtered as the model improves. (The base model: {flat_base} — mostly all-wrong groups, the other end of the same problem.)
> miss: if "worse": the share grew because of the all-*right* groups — {allright_sft} → {allright_rlvr}, while the all-wrong ones fell, {allwrong_sft} → {allwrong_rlvr}. The model got better at those problems; they just have nothing left to teach it.
