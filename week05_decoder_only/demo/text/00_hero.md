# hero · solver = prefix × decoder × vocabulary head

## lede

Last week the body was an encoder somebody had pretrained for us, and the task lived in the head: its output shape, the point where it attaches, the axis the softmax runs along. One Linear per task, and the rest was a dial.

## hero-p1

Here is what changes. The head is the vocabulary, and the vocabulary is not ours to reshape — so the head never changes again. It is the same for classification, for NER, for question answering, for translation, for chat. If the task cannot live in the head, it has to live somewhere else, and the only other place is *the input*. That is the whole idea behind "prompting", two years before anyone called it that.

And it has a price. An encoder answers in one forward pass. A decoder answers one token at a time — one pass per token — and we are going to count those passes all day.

## hero-p2

**Two questions to keep in front of you**, answered at the end in two lines each: *why not an encoder for everything?* — *why not a decoder for everything?*
