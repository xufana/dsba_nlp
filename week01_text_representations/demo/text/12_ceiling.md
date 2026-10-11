# ceiling · Where the missing accuracy actually is

## ceiling-p1

Look at the spread in the table. A 1972 representation, a 2013 one and a 2026 one all land within a few points of each other. That is suspicious: either every method is equally good, or something other than the method is setting the limit.

Twenty mistakes from the best model, read by hand:

## ceiling-p2

Now the twelve you labelled at the start, with what the dataset claims and what the model said:

## ceiling-note1

A cricket match filed under World. The anniversary of the Kennedy assassination filed under Sci/Tech. A travel column about Aboriginal-owned tours, also Sci/Tech. Those are not hard examples — they are **wrong labels**, and no representation fixes them.

## ceiling-note2

On items where the label itself is contested, both you and the best model collapse towards chance. On the full test set every method built today sits inside a ten-point band — which means the distance between a 1972 representation and a 2026 one is smaller than the distance between two careful readers of the same headline. The accuracy still missing is not sitting in a better representation. It is sitting in the label definition: if you want the next point, you go back to the annotation guidelines, not the hyperparameters.

## ceiling-p3

**1 · Strong sparse baseline first, always.** It is an hour of work and it is frequently the answer.<br>
**2 · Complexity has to pay for itself** in whichever column your problem actually cares about — labelled data, latency, interpretability, predictability.<br>
**3 · Explanations are a debugging tool for your data**, not a deliverable.<br>
**4 · The ceiling is set by the data.** When every method lands in the same narrow band, stop tuning and go read the labels.

<p class="footnote" style="margin-top:30px">Full notebook, homework and the reading list: <span class="mono">week01_text_representations/</span>. Everything marked 🏠 there runs as-is — the learning curve of accuracy against number of labelled examples is the graph that actually answers “should I use an LLM here”.</p>
