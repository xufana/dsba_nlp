# eval · relevance and the metrics

## s-rel

- **Relevance** — a person's judgement on a pair (query, document): 0 / 1, or graded 0 / 1 / 2
- nobody judges everything: only the **pool** — the union of several systems' top $k$
- outside the pool = **counted as not relevant**

## eval-pool

**Where relevance comes from.** People read pairs (query, document) and mark them relevant or not — sometimes on a scale, 0 / 1 / 2. Judging every document for every query is impossible on a real collection, so test collections are built by **pooling**: run several systems, take the union of their top results, judge only those, and treat the rest as not relevant. This is the Cranfield paradigm, from the 1960s, and every number below inherits its two weak spots: unjudged documents count as misses, and the pool favours the systems that built it.

## pool-caption

① three systems retrieve → ② only their union is judged → ③ a fourth system's new finds count as misses.

## pool-more

The picture is the procedure of a test collection (TREC, and every golden set built the same way). Several systems run every query; the union of their top $k$ is the pool; people judge only the pool. A new system is then scored against those judgements: a document it found that nobody else did was never judged, and the metrics count it as not relevant — whether it is or not. Two consequences, both visible here: the new system's precision is underestimated, and $R$, the number of relevant documents the metrics divide by, is the pool's, not the collection's. The pool favours the systems that built it (Zobel, 1998); bpref, on the last tab of the metrics, is the metric designed for exactly this.

## s-gold

For RAG: a **golden set** — question → the *id* of the document that answers it, not a quote.

## eval-gold

For RAG the judgements are usually cheaper: a "golden set" of questions, each with the passage or the post that answers it. Write it down *as a document id*. A quote that has to be matched against the retrieved text by fuzzy similarity is a second, hidden retriever inside your metric.

## s-metrics

One query → a ranked list $d_1, d_2, …$ with grades $\mathrm{rel}_i$; $R$ — relevant documents in the collection.

Every metric models a **reader**: who reads how much of the list, and what counts.

## metrics-caption

Click a document to change its grade (0 → 1 → 2 → not judged), move $k$ and $R$; every tab recomputes on this list.

## mt-p

$P@k = \frac{1}{k} ∑_{i=1}^{k} \mathrm{rel}_i$ — the share of relevant documents among the first $k$.

**Reader:** looks at all $k$ results. **Blind spot:** a **ceiling** — with $R < k$ relevant documents the best possible is $R/k$: one relevant document, $P@10 ≤ 0.1$ for a perfect retriever. The order inside the top $k$ does not count.

<div data-fig="pceil"></div>

## mt-rprec

$\text{R-precision} = P@R$ — precision at the depth of the number of relevant documents.

**Reader:** wants all $R$ of them. **Fixes** the ceiling of $P@k$: a perfect ranking always scores 1. **Blind spot:** needs $R$, which under pooling nobody knows; the order inside the first $R$ does not count.

## mt-recall

$\mathrm{Recall}@k = \frac{1}{R} ∑_{i=1}^{k} \mathrm{rel}_i$ — the share of the relevant documents that made it into the top $k$.

**Reader:** takes the top $k$ as a set — a prompt with $k$ passages. **Blind spot:** **only grows with $k$** and reaches 1 at $k = |D|$ for any retriever: compare systems at one $k$. Divides by $R$, which the pool underestimates.

<div data-fig="prk"></div>

## mt-hit

$\mathrm{Hit}@k = 1$ if anything relevant is in the top $k$, else 0 (also Success@k).

**Reader:** needs *one* good document — a RAG question with one answering passage. With $R = 1$ it equals $\mathrm{Recall}@k$. **Blind spot:** binary per query — one of ten relevant documents found counts like all ten; it saturates fast, so systems tie at large $k$.

## mt-f1

$F_1@k = \frac{2 · P@k · \mathrm{Recall}@k}{P@k + \mathrm{Recall}@k}$ — precision and recall in one number.

**Reader:** a set of $k$ where both matter: nothing missing, little noise. **Blind spot:** inherits both — depends on $k$ and on $R$; ignores the order. Rare for rankings, common for classification.

## mt-rr

$\mathrm{RR} = 1 / \mathrm{rank}$ of the first relevant document; MRR is its mean over queries.

**Reader:** reads **one** result — a search box answer, a voice assistant. **Blind spot:** ignores everything after the first relevant document; **not linear** — from rank 1 to 2 costs 0.5, from 5 to 6 costs 0.03.

<div data-fig="rrbars"></div>

## mt-ap

$\mathrm{AP}@k = \frac{1}{\mathrm{min}(R, k)} ∑_{i=1}^{k} \mathrm{rel}_i · P@i$ — the precision at every relevant position, averaged; MAP is its mean over queries.

**Reader:** wants **all** relevant documents, and high — a lawyer, a systematic review. It is the area under the precision–recall curve. **Blind spot:** $R$ in the denominator — a relevant document nobody judged raises AP; with $R = 1$ it is just RR.

<div data-fig="apfig"></div>

## mt-ndcg

$\mathrm{DCG}@k = ∑_{i=1}^{k} \frac{\mathrm{rel}_i}{\mathrm{log}_2(i + 1)}$, $\mathrm{NDCG}@k = \mathrm{DCG}@k / \mathrm{DCG}@k$ of the best order.

**Reader:** scans from the top and cares **how good**, not only whether — graded relevance. **Blind spot:** normalised per query — one relevant document at rank 1 scores 1.0, like ten in the top ten; the gain and the logarithm are conventions; the best order needs every relevant document.

<div data-fig="disc"></div>

## mt-err

$\mathrm{ERR} = ∑_{r} \frac{1}{r} R_r ∏_{i<r} (1 − R_i)$, $R_i = \frac{2^{g_i} − 1}{2^{g_{max}}}$ — the expected $1/\mathrm{rank}$ at which the reader **stops**.

**Reader:** reads down and stops at the first document that satisfies them (a cascade): a perfect document on top makes everything below it almost irrelevant. **Blind spot:** needs grades and $g_{max}$; a model of a user, not their measured behaviour.

## mt-bpref

$\mathrm{bpref} = \frac{1}{R} ∑_{r} (1 − \frac{|n \text{ above } r|}{\mathrm{min}(R, N)})$ over the retrieved relevant $r$; $n$ — **judged** non-relevant documents, $N$ of them.

**Reader:** an evaluation with **incomplete judgements** — the pool. Unjudged documents are skipped, not counted as misses; only judged non-relevant ones ranked above a relevant one cost. **Blind spot:** depends on how many non-relevant documents were judged; noisy when there are few.

## s-reader

**The reader decides the metric:** reads one → MRR · reads all $k$ → Recall@k / Hit@k · scans from the top, with grades → NDCG.

## rank-caption

One query, five results. Green — relevant. The collection holds two relevant documents for this query, both shown.

## q-metrics · fill

For the ranking in the picture, with binary relevance and two relevant documents in the collection:

<div data-fig="ranking"></div>

$P@3$ = [[p3]], reciprocal rank = [[rr]], $\mathrm{AP}@5$ = [[ap]], $\mathrm{NDCG}@5$ = [[ndcg]]

- p3 = @p3 ~ 0.01
- rr = @rr ~ 0.01
- ap = @ap ~ 0.01
- ndcg = @ndcg ~ 0.01

> $P@3$: one relevant in the first three, $1/3$. Reciprocal rank: the first relevant is second, $1/2$. AP: precision at each relevant position — $1/2$ at position 2, $2/4$ at position 4 — averaged over the two relevant documents. NDCG: $\mathrm{DCG} = 1/\mathrm{log}_2 3 + 1/\mathrm{log}_2 5$, and the best order puts both on top, $\mathrm{IDCG} = 1 + 1/\mathrm{log}_2 3$.
> miss: if AP came out as 1/2 + 1/2 = 1: AP divides by the number of relevant documents, not by the number of terms you happened to add.

## eval-p4

What each one does not see. None of them knows what the reader does with the list. If the reader stops at the first result, only the first relevant one matters. If the reader takes the top five and reads them all in any order, the order inside the five does not matter at all.

## q-which-metric · sort

Which metric fits the reader?

bins: MRR · Recall@k · NDCG@k

- a question-answering box that shows only the first result → MRR
- a RAG pipeline that pastes the top 5 into the prompt, in any order → Recall@k
- web search, with pages judged 0 / 1 / 2 and users who scan from the top → NDCG@k
- e-discovery for a court case: every relevant contract must be found → Recall@k
- a voice assistant that reads out one answer → MRR

> The reader decides. One result read → only the first relevant one counts: MRR (or Hit@1). A set read in full → was it found at all: Recall@k, with $k$ as large as the reader can take. A list scanned from the top with grades → NDCG.
> miss: if the RAG pipeline went to NDCG: inside the prompt the model reads all five, and NDCG would penalise an order the retriever cannot be blamed for. Where in the prompt a passage works best is a property of the model, measured separately.

## s-trap1

Trap 1: **P@k has a ceiling** of $R/k$.

## q-pk-cap · pick

Two test sets. In A every question has exactly one relevant document; in B, about twenty. The same retriever gets $P@10 = 0.09$ on A and $0.6$ on B. Where does it work better?

- [ ] on B: 0.6 is far above 0.09
- [x] on A, very likely: the best possible $P@10$ there is 0.1, and 0.09 is nine questions out of ten with the document in the top 10
- [ ] the same: precision does not depend on the test set
- [ ] on neither: precision below 0.5 means the retriever is useless

> On A the ceiling is $1/10$: 0.09 means the relevant document is in the top 10 for 90% of the questions. On B the ceiling is 1 and 0.6 leaves 40% of the top 10 empty of relevant ones. $P@k$ compared across sets with different $R$ compares their ceilings; with one relevant document per query report Hit@k (or R-precision) instead.
> miss: if B was picked: the two numbers live on different scales — 0.1 and 1.0 are the two maxima.

## s-trap2

Trap 2: **Recall@k only grows with $k$** — compare at one $k$.

## q-recall-k · pick

A vendor reports Recall@10 = 0.92 for system A and Recall@50 = 0.97 for system B, on the same golden set. Which is the better retriever?

- [ ] B: 0.97 is higher
- [ ] A: it reaches 0.92 with five times fewer documents
- [x] cannot tell: recall at 50 is at least recall at 10 for any system, so the numbers are not comparable — ask for both at the same $k$
- [ ] the same: the difference is noise

> Recall never decreases with $k$, so B's 0.97 at 50 says nothing about B at 10, and A's 0.92 nothing about A at 50. Even at the same golden set, the order of two systems can flip between depths. On the {n_golden} questions over gonzo_ML: a dense retriever (bge-m3) has Hit@5 = {qd_h5} and Hit@10 = {qd_h10}; the same retriever fused with BM25 has Hit@5 = {en_h5} and Hit@10 = {en_h10}. Which one is "better" depends on $k$ — and each of those gaps is one question, 0.05, on a set this small.
> miss: if A was picked: it may well be, but nothing in the two numbers shows it — A at 50 could be 0.99 or 0.93.

## s-trap3

Trap 3: **MRR is not linear** in the rank.

## q-mrr-drop · pick

Twenty questions. Which change lowers the MRR more?

- [ ] question 1: its relevant document falls from rank 1 to rank 2
- [ ] question 2: its relevant document, at rank 2, disappears from the list
- [x] the same
- [ ] neither changes MRR: it only looks at the first position

> Both lose exactly 0.5 of one question's reciprocal rank: $1 → 1/2$, and $1/2 → 0$. MRR treats "slightly worse on top" and "lost the document entirely" as one and the same — for a reader who reads only the first result, they are. For a prompt with the top 5 the first is harmless and the second is a failure, and Hit@5 sees exactly that difference.
> miss: if the disappearance looked worse: it is, for a reader of five results; MRR models a reader of one.
