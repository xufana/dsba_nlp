# Week 7 — From Next Token to Assistant: What Each Training Stage Changes

Two questions frame the seminar and are answered at the end: *what does each stage of training change, if the
architecture never does?* and *when is fine-tuning a model the wrong move?* The body is one model after each of its
training stages — OLMo 2 1B: base, SFT, DPO, RLVR.

    uv run python precompute.py            # the artifacts (about three hours on an M-series Mac, demo tier)
    uv run python precompute.py --smoke    # tiny random models and toy data, no network, a few minutes

## Sources

### The pipeline

* Ouyang et al. (2022). [*Training Language Models to Follow Instructions with Human Feedback.*](https://arxiv.org/abs/2203.02155) — InstructGPT.
* Team OLMo (2024). [*2 OLMo 2 Furious.*](https://arxiv.org/abs/2501.00656)
* Lambert et al. (2024). [*Tülu 3: Pushing Frontiers in Open Language Model Post-Training.*](https://arxiv.org/abs/2411.15124)
* Zhou et al. (2023). [*LIMA: Less Is More for Alignment.*](https://arxiv.org/abs/2305.11206)

### Data

* Penedo et al. (2024). [*The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale.*](https://arxiv.org/abs/2406.17557)
* Allal et al. (2025). [*SmolLM2: When Smol Goes Big — Data-Centric Training of a Small Language Model.*](https://arxiv.org/abs/2502.02737)
* Taori et al. (2023). [*Alpaca: A Strong, Replicable Instruction-Following Model.*](https://crfm.stanford.edu/2023/03/13/alpaca.html)
* Gudibande et al. (2023). [*The False Promise of Imitating Proprietary LLMs.*](https://arxiv.org/abs/2305.15717)

### SFT and preferences

* Hu et al. (2021). [*LoRA: Low-Rank Adaptation of Large Language Models.*](https://arxiv.org/abs/2106.09685)
* Bradley, Terry (1952). *Rank Analysis of Incomplete Block Designs: I. The Method of Paired Comparisons.* Biometrika.
* Christiano et al. (2017). [*Deep Reinforcement Learning from Human Preferences.*](https://arxiv.org/abs/1706.03741)
* Schulman et al. (2017). [*Proximal Policy Optimization Algorithms.*](https://arxiv.org/abs/1707.06347)
* Rafailov et al. (2023). [*Direct Preference Optimization: Your Language Model is Secretly a Reward Model.*](https://arxiv.org/abs/2305.18290)
* Singhal et al. (2023). [*A Long Way to Go: Investigating Length Correlations in RLHF.*](https://arxiv.org/abs/2310.03716)

### RL with a verifier, and reasoning

* Shao et al. (2024). [*DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models.*](https://arxiv.org/abs/2402.03300) — GRPO.
* DeepSeek-AI (2025). [*DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning.*](https://arxiv.org/abs/2501.12948)
* Yu et al. (2025). [*DAPO: An Open-Source LLM Reinforcement Learning System at Scale.*](https://arxiv.org/abs/2503.14476)
* Liu et al. (2025). [*Understanding R1-Zero-Like Training: A Critical Perspective.*](https://arxiv.org/abs/2503.20783) — Dr. GRPO.
* Yue et al. (2025). [*Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?*](https://arxiv.org/abs/2504.13837)
* Chen et al. (2021). [*Evaluating Large Language Models Trained on Code.*](https://arxiv.org/abs/2107.03374) — pass@k.
* Mukherjee et al. (2025). [*Reinforcement Learning Finetunes Small Subnetworks in Large Language Models.*](https://arxiv.org/abs/2505.11711)
* Qwen Team (2025). [*Qwen3 Technical Report.*](https://arxiv.org/abs/2505.09388)

### The cost of fine-tuning

* McCloskey, Cohen (1989). *Catastrophic Interference in Connectionist Networks: The Sequential Learning Problem.*
* Biderman et al. (2024). [*LoRA Learns Less and Forgets Less.*](https://arxiv.org/abs/2405.09673)
* Shenfeld, Pari, Agrawal (2025). [*RL's Razor: Why Online Reinforcement Learning Forgets Less.*](https://arxiv.org/abs/2509.04259)
* Gekhman et al. (2024). [*Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations?*](https://arxiv.org/abs/2405.05904)
* Qi et al. (2023). [*Fine-tuning Aligned Language Models Compromises Safety, Even When Users Do Not Intend To!*](https://arxiv.org/abs/2310.03693)
* Betley et al. (2025). [*Emergent Misalignment: Narrow Finetuning Can Produce Broadly Misaligned LLMs.*](https://arxiv.org/abs/2502.17424)
