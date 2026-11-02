# recipes · how the 2025–2026 recipes look whole

## recipes-p1

Everyone does the same thing in a different order. Every model you talk to in 2026 went through an SFT stage, a preference stage and an RL stage; what differs is the data of each, and **who writes the tokens** — a human, a teacher model, or the model itself. That is the claim's table, read by rows. Switch the colouring.

## recipes-note

Read the two colourings together: the *type* of a stage says which loss; *who writes* says whether the model is pulled towards somebody else's text (off-policy) or re-weighted on its own (on-policy). Every recipe ends on-policy. Small models get their reasoning from the top row's teachers, not from RL of their own.

## r1-p1

"DeepSeek-R1" is usually told as "GRPO taught a model to reason". The paper has two models. **R1-Zero** is that story: RL with a checker straight on the base model, no SFT before it; it learned to write long chains of reasoning — in mixed languages, hard to read. **R1**, the released one, is the four-stage row above: a *cold start* (SFT on thousands of curated long solutions), RL with verifiable rewards plus a reward for keeping the reasoning in one language, *rejection sampling* — the model of stage 2 writes many solutions, only the verified ones are kept (about 600k), mixed with 200k of writing and general data, and the **base** model is fine-tuned on them again — and a final RL: checkers where an answer can be checked, preference models where it cannot. Stage 3 is the claim's table once more: SFT on the model's own samples, $w_t = 1$ on accepted answers and 0 on the rest — RL's data with SFT's loss.

## distill-p1

The same move is how small models get reasoning: **distillation**, a student trained on what a teacher produces. R1's distilled Qwen and Llama models are the first row of the table below — SFT on the 800 thousand samples, no RL stage; the paper reports that this beat running RL on the small model directly. Qwen3's small models take the first row and then the third. s1 (Muennighoff et al. 2025) took the first row to the extreme: 1 000 examples chosen from 59 000.

## distill-table

<table class="task-table"><thead><tr><th>the student is trained on</th><th>the loss</th><th>it needs</th></tr></thead><tbody>
<tr><td>the teacher's written answers</td><td>next-token loss on their tokens — sequence distillation (Kim &amp; Rush 2016)</td><td>only the text</td></tr>
<tr><td>the teacher's distribution at every position of those answers</td><td>KL(p<sub>teacher</sub> ‖ p<sub>student</sub>) over the vocabulary (Hinton et al. 2015)</td><td>logits, a shared vocabulary</td></tr>
<tr><td>the teacher's distribution on the <b>student's own</b> answers</td><td>the same KL, on prefixes the student wrote — on-policy (Agarwal et al. 2024)</td><td>the teacher during training</td></tr>
</tbody></table>

## filter-note

A filter keeps a problem if at least one of $K$ teacher solutions is verified. With $K$ = {K}: a problem the teacher solves 90% of the time survives with **{easy}%**, one it solves 10% of the time with **{hard}%**. The filtered set over-represents what the teacher already does well — store the number of tries and the reasons for dropping, or the next model inherits the bias without a record of it.
