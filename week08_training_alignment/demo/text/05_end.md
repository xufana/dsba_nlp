# end · the two questions from the top

## end-p1

**What does each stage change?** Whose tokens carry the loss and who weighs them. Pretraining: everybody's text, weighed equally — the knowledge. SFT: a written answer — the format. Preferences: a comparison — the style, the length, the refusals. RL with a verifier: the model's own answers, weighed by a checker — reliability on whatever can be checked, and the habit of thinking before answering. The architecture is the same; the weights move by a few percent.

**When is fine-tuning the wrong move?** When the problem is knowledge rather than format; when the abilities you are not measuring matter; when a prompt, a retrieved document or an encoder would do. It is always a trade: what the new data asks for, against everything it does not mention.

## end-p2

1. **Every stage is next-token loss.** They differ in whose tokens carry it and who decides their weight — look at those two before anything else.
2. **Check which tokens carry the loss** before you train. A missing mask is a model that learns to write your users' questions.
3. **Post-training is a small move in weight space and a large move in behaviour** — which is why it is cheap, and why it is easy to undo.
4. **RL with a verifier sharpens what the model can already sample.** Measure pass@k, not only pass@1, before you call it a new ability.
5. **Every fine-tune costs something you did not measure.** Pick the abilities you rely on and measure them before and after.

## end-refs

* Ouyang et al. (2022). [*Training Language Models to Follow Instructions with Human Feedback.*](https://arxiv.org/abs/2203.02155) NeurIPS. — InstructGPT.
* OLMo Team (2024). [*2 OLMo 2 Furious.*](https://arxiv.org/abs/2501.00656) — the model of this seminar.
* Lambert et al. (2024). [*Tülu 3: Pushing Frontiers in Open Language Model Post-Training.*](https://arxiv.org/abs/2411.15124)
* Zhou et al. (2023). [*LIMA: Less Is More for Alignment.*](https://arxiv.org/abs/2305.11206) NeurIPS.
* Bradley, Terry (1952). *Rank Analysis of Incomplete Block Designs: I. The Method of Paired Comparisons.* Biometrika 39(3/4). — not on arXiv.
* Hunter (2004). [*MM Algorithms for Generalized Bradley–Terry Models.*](https://doi.org/10.1214/aos/1079120141) Annals of Statistics 32(1).
* Cui et al. (2023). [*UltraFeedback: Boosting Language Models with Scaled AI Feedback.*](https://arxiv.org/abs/2310.01377) — the source of the four rated answers.
* Christiano et al. (2017). [*Deep Reinforcement Learning from Human Preferences.*](https://arxiv.org/abs/1706.03741) NeurIPS.
* Schulman et al. (2017). [*Proximal Policy Optimization Algorithms.*](https://arxiv.org/abs/1707.06347)
* Rafailov et al. (2023). [*Direct Preference Optimization: Your Language Model is Secretly a Reward Model.*](https://arxiv.org/abs/2305.18290) NeurIPS.
* Singhal et al. (2023). [*A Long Way to Go: Investigating Length Correlations in RLHF.*](https://arxiv.org/abs/2310.03716)
* Geng et al. (2025). [*The Delta Learning Hypothesis: Preference Tuning on Weak Data can Yield Strong Gains.*](https://arxiv.org/abs/2507.06187)
* Shao et al. (2024). [*DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models.*](https://arxiv.org/abs/2402.03300) — GRPO.
* DeepSeek-AI (2025). [*DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning.*](https://arxiv.org/abs/2501.12948)
* Yu et al. (2025). [*DAPO: An Open-Source LLM Reinforcement Learning System at Scale.*](https://arxiv.org/abs/2503.14476)
* Liu et al. (2025). [*Understanding R1-Zero-Like Training: A Critical Perspective.*](https://arxiv.org/abs/2503.20783) — Dr. GRPO.
* Yue et al. (2025). [*Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?*](https://arxiv.org/abs/2504.13837)
* Chen et al. (2021). [*Evaluating Large Language Models Trained on Code.*](https://arxiv.org/abs/2107.03374) — pass@k.
* Qwen Team (2025). [*Qwen3 Technical Report.*](https://arxiv.org/abs/2505.09388)
* OLMo Team (2025). [*Olmo 3.*](https://arxiv.org/abs/2512.13961)
* Hinton, Vinyals, Dean (2015). [*Distilling the Knowledge in a Neural Network.*](https://arxiv.org/abs/1503.02531)
* Kim, Rush (2016). [*Sequence-Level Knowledge Distillation.*](https://arxiv.org/abs/1606.07947) EMNLP.
* Agarwal et al. (2024). [*On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes.*](https://arxiv.org/abs/2306.13649) ICLR.
* Muennighoff et al. (2025). [*s1: Simple Test-Time Scaling.*](https://arxiv.org/abs/2501.19393)
* Shenfeld, Pari, Agrawal (2025). [*RL's Razor: Why Online Reinforcement Learning Forgets Less.*](https://arxiv.org/abs/2509.04259)
