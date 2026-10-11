# weights · The weights are readable, we can guess from the data

## weights-p1

Here are the top-weighted features of the real model from the table, with the class names hidden. Match them up — it takes about ten seconds, and that is the point: remember how easy this was.

## guess-note

Assign a class to each column, then reveal.

## weights-p2

Look at the very first training example: <span class="mono" id="first-doc"></span>

The source is written into the text. If sources are not spread evenly across categories, the model can classify the *news agency* instead of the news.

## weights-note1

Not evenly distributed at all — several sources sit almost entirely inside one category.

## weights-p3

**Bet, two parts.** Given *only* the source marker and nothing else, how accurate can a model be — chance is 25%? And if we strip the markers and retrain, how much accuracy do we lose?

## shortcut-note

**Don’t be fooled by the two numbers.** The marker alone beats chance by a wide margin — the shortcut is real and carries genuine class information. But stripping it costs essentially nothing, because the signal is fully redundant: the headline says “oil prices” as well as “(Reuters)”. A shortcut being present in the data does not mean the model depends on it. Run only the strip experiment and you conclude there is no shortcut; run only the marker-only experiment and you conclude the model is cheating. Neither is true. **Open question:** what would a dataset look like where stripping the shortcut *does* collapse accuracy?

## guess-note-reveal

{score}A linear model on a sparse representation is directly readable — the parameters *are* the words, and fifteen of them per class are enough to name the class. Remember how easy that was; block 06 is the contrast, and every model after this seminar is the harder case.

## guess-note-hits

**{hits} / 4 correct.**

## shortcut-result-first

First training row, with the marker removed: <span class="mono">{example}</span>
