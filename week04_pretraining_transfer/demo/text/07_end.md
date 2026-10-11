# end · The results table, read as one story

## end-p1

Every row is the same equation — a pretrained body × a head × what you let move — and the rows are ordered by the third factor:

<ul>
      <li><strong>nothing moves</strong> (zero-shot): the body knows things, we can reach them through the pretraining interface, and a word in the prompt is worth seventeen points. Under TF-IDF.</li>
      <li><strong>a Linear moves</strong> (frozen features, head only): a logistic regression on whichever vector you choose. Still under TF-IDF. A frozen body that was never asked about topics does not hand over topic features.</li>
      <li><strong>the top of the body moves</strong>: two blocks and we are a point from week 1; six and we're near the ceiling. The task-relevant adjustment lives near the top.</li>
      <li><strong>everything moves</strong>: the best number, the biggest bill, and — at the wrong learning rate or the wrong seed — the only setting that can <em>destroy</em> the body.</li>
    </ul>

And across the three tasks, one Linear each: `[B, C]` from one vector, `[B, L, C]` softmaxed over classes, `[B, L, 2]` softmaxed over positions. Where the head attaches and which axis is normalised — that was the task. How much of the body has to move to feed it — that depended on whether pretraining had already built what the task needs (names: yes; the answer to a question: no).
