# eval

## eval-p1

Three families of metrics, and each has its blind spot: distance metrics between texts need a reference and miss hallucinations; ranking metrics evaluate the retriever, not the system; LLM-based metrics evaluate everything but are unstable. And before any of them: what counts as a hit.

## proxy-p1

**A hit is a proxy.** "The retriever found the answer" is never observed directly; it is replaced by something that can be checked automatically, and the choice decides what the metric measures.

## proxy-table

<table class="proxies">
<tr><th>a hit is…</th><th>needs</th><th>breaks when</th></tr>
<tr><td><b>metadata</b>: the retrieved chunk has the id of the post (document, section, URL, product) labelled as the answer</td><td>the golden set written down as ids; the id carried by every chunk</td><td>the documents are re-split and a chunk loses its parent's id; the answer sits in two posts and one is labelled</td></tr>
<tr><td><b>text</b>: the golden quote occurs in the retrieved text — exactly, or by fuzzy match above a threshold</td><td>a quote per question, no ids</td><td>the quote was retold rather than copied; the threshold is set by taste</td></tr>
<tr><td><b>a model</b>: an LLM reads the question and the chunk and says whether the chunk answers</td><td>nothing labelled per document</td><td>the judge is noisy and biased — the last part of this block</td></tr>
</table>

## proxy-p2

The first version of the notebook used the second proxy: a retrieved text is a hit if `fuzz.partial_ratio(golden quote, text) >= 80`. This page uses the first: the post id. On the same retrieved lists, the two can be compared pair by pair.

## proxy-cap

Every (question, document) pair of Qdrant's top 10 for the {n} golden questions, at its fuzzy score against the golden quote. Green — the document belongs to the gold post; grey — it does not. A question counts as a hit by id if any of its green dots is there, and as a hit by fuzzy match if any dot reaches the threshold. Click a dot to see where `partial_ratio` found its window.

## bet-proxy

Move the threshold. Is there one at which fuzzy match agrees with the post ids on every golden question?

## proxy-note

At 80, the notebook's first rule, fuzzy match loses {lost80} questions whose gold post *was* retrieved, and with any retriever at most {reach}/{n} questions can count as hits: the three best retrievers of the first table all stopped at {ceil}. Other posts never score above {omax}, and the best gold document of a question scores as low as {gmin}. Every threshold from {tlo} to {thi} counts no other post and still disagrees with the ids on {dbest} question(s); lower thresholds start counting other posts. So a usable threshold exists on this golden set, but finding it took the post ids. With the ids at hand the text proxy is not needed; without them, nobody can tell whether 80, 60 or 50 is right.

## asran-note

The first table, reproduced: Qdrant at `k = 4`, over a collection that also held the 120-character children, scored by fuzzy match — MRR {asis}. The same encoder over the documents only, top-10, scored by the gold post: {fixed}.

## rank-p1

The retriever's output for one query. Drag the documents (or use the arrows), move k — the metrics are recomputed term by term. What all of them share: without a labelling of "what is relevant" none of them can be computed.

## rank-note

P@k does not distinguish the order inside the top-k; with one relevant post per question it stays near 1/k (above it only when the post was split into several documents), which is why the notebook reports Hit@k instead. MRR rewards the relevant document for being higher; NDCG@k does the same with a logarithmic discount and can work with graded relevance (0/1/2). All of them are silent about what the LLM will do with what was found.

## board-p1

All the retrievers of the notebook in one table, scored by the gold post. Before each row is revealed: better or worse than Qdrant? The cells on the right are the 20 questions — the rank of the gold post in each; one question is 0.05 of every metric.

## board-note

Against Qdrant's MRR: better by more than one question's worth — {better}; worse by more than that — {worse}; the rest are within one question of it.

## judge-intro

A judge is a model with a prompt, and the prompt is a measuring instrument. Three ways to use it, and what a rubric needs:

## judge-schemes

<table class="proxies">
<tr><th>scheme</th><th>what the judge does</th><th>when</th></tr>
<tr><td><b>pointwise</b></td><td>scores one answer on a scale or by criteria</td><td>an absolute score is needed: monitoring in production</td></tr>
<tr><td><b>pairwise</b></td><td>compares two answers and picks the better one</td><td>A against B: steadier than a scale, but sensitive to the order</td></tr>
<tr><td><b>reference-based</b></td><td>compares the answer with a reference one</td><td>a set with references exists: regression tests</td></tr>
</table>

## judge-rubric

A rubric has four parts:

1. **criteria** — independent axes; "quality" and "usefulness" are one axis counted twice;
2. **a scale** for each criterion: pass/fail, 1–5, a share;
3. **anchors** — what each mark means; a "5" without a description is not a criterion but a lottery;
4. **edge cases** — a partly correct answer, a contradictory context, a question outside the domain. Whatever is not written down, the judge decides by itself, and differently each time.

The order of work: the rubric before the prompt → a pilot on contrasting examples → reasoning before the score → structured output → few criteria per call → freeze it before the mass run. Criteria drift as people label (Shankar et al., 2024): a rubric is versioned like a prompt.

## judge-bias

<table class="proxies">
<tr><th>bias</th><th>what is known</th><th>how to check it on your data</th><th>how to treat it</th></tr>
<tr><td><b>position</b></td><td>in pairwise the judge prefers the first answer; GPT-4 on MT-Bench is consistent under swapping in ≈ 65% of pairs, weaker judges less often</td><td>every pair in both orders; the share of disagreements</td><td>average over both orders; a disagreement is a tie</td></tr>
<tr><td><b>length</b></td><td>an inflated answer with the same facts scores higher; GPT-4 is steadier than others, but not fully</td><td>inflate 10 answers without new facts, compare</td><td>a brevity criterion in the rubric; length-controlled win rate</td></tr>
<tr><td><b>self-preference</b></td><td>a judge overrates answers of its own family: about 10 points of win rate for GPT-4</td><td>blind labelling; a second judge of another family</td><td>a judge of another family, or a specialised one (Prometheus 2)</td></tr>
<tr><td><b>noise</b></td><td>at T &gt; 0, different scores for the same input; at T = 0, not zero either</td><td>R repeats of one input, σ<sub>judge</sub></td><td>T = 0 and measure the rest; average</td></tr>
</table>

The numbers are from Zheng et al. (2023) and Wang et al. (2023), for other people's judges on other tasks. Below — ours: two judges on twenty answers.

## kappa-p1

**Calibrating on people: kappa.** If 90% of the answers are good, a judge that always says "good" agrees with a person on 90% of them while telling nothing apart. Cohen's κ subtracts the agreement expected from random labels: $κ = (p_o − p_e) / (1 − p_e)$. Landis and Koch's reading: below 0.2 slight, 0.2–0.4 fair, 0.4–0.6 moderate, 0.6–0.8 substantial, above that almost perfect. On an ordinal scale (1–5) plain κ punishes "5 against 4" exactly as "5 against 1"; weighted κ with quadratic weights punishes by the square of the distance.

## kappa-cap

Synthetic labels, a real computation: 60 answers, a person gives 2–5, the judge gives the same mark minus a shift, plus a random ±1 error on a share of answers. Watch how accuracy, plain and weighted κ react to a systematic shift.

## kappa-0

Without a shift both kappas are close: the judge errs at random, and weighting changes little. This is the case where accuracy does not lie — only because the classes are balanced.

## kappa-1

The judge systematically marks one point lower. Accuracy and plain κ say "a bad judge"; weighted κ sees that it keeps the order of the answers. Such a judge is calibrated by a shift of +1, not thrown away.

## kappa-2

A shift of two points: plain κ goes to zero or below — "worse than chance", although the judge still ranks correctly. Weighted κ tells a systematic error from a random one; plain κ does not.

## judge-p1

Two standard LLM judges, one model: a lenient prompt and a strict one, the same 20 answers. **Relevance** — how much the answer is about the question; **faithfulness** — how much it rests on the context. Cohen's κ measures how much the two agree beyond chance.

## bet-judge

Same model, same answers, two prompts that differ by one sentence. Will the judges agree beyond "moderate" (κ > 0.4)?

## judge-note

κ = {kr} on relevance and {kf} on faithfulness, on {n} answers. {verdict}

## judge-ok

A judge is as trustworthy as its validation on your own golden set: without a few hundred labelled examples it is a "metric by feel".

## judge-bad

One sentence of the prompt moved the scores this much — before any comparison with a human. A judge is as trustworthy as its validation on your own golden set.
