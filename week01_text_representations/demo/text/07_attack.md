# attack · The real model, running in your browser

## attack-p1

So, we've trained the model, got a few options, checked if there is a shortcut/leak, but can we actualy break it?

Your turn: write a headline the classifier confidently gets wrong. Confident means <span class="mono">max(predict\_proba) &gt; 0.8</span>.

## attack-why1

LIME samples, so its output is a random variable — with `num_samples` too low, two runs of the same explanation disagree on a deterministic model. SHAP repeats exactly and still disagrees with plain occlusion, because they answer different questions.

## attack-note1

A word’s coefficient answers “how much does this push towards class *c*”; deleting it answers “how much does the *probability* move”. Those are different questions, and they disagree — a softmax probability is a competition between classes, so a word can be weak evidence *for* the predicted class and still raise its probability by hurting a rival more. Explanations are measurements with their own assumptions, not a readout of the model’s reasoning. A full seminar on xAI is planned on the week 14th right now.
