# pipe

## pipe-p1

Simple: documents + question → LLM → answer. Less simple: the documents are first split and encoded into an index, the question is encoded by the same encoder, the search over the index returns the top-k, and only those get into the prompt. The five places we can influence are marked with numbers.

## f1-cap

RAG, simple. The documents and the question go into the prompt together — it works while there are few documents and they fit into the context.

## f2-cap

RAG, less simple. The documents are encoded into an index in advance (the upper branch), the query is encoded by the same encoder and searched in the index; only the documents found and the question get into the LLM. The numbers are the five points of influence.

## stepper-note

Pick a question and walk through the steps: each one shows what physically lies at the input and the output of the block. The search is bge-m3 over the {docs} documents; the answer is the 3B model's, greedy, with the notebook's prompt.

## lcel-p1

So far the pieces were assembled by hand. In practice they are combined into one **RAG module** with the LangChain Expression Language (LCEL): a declarative chain `retriever -> prompt -> llm -> parser` built with the `|` operator. Hover a line to see which step of the stepper it is.

## lcel-note

The notebook's bonus cell. `RunnablePassthrough()` hands the question on unchanged; the dictionary runs its two branches on the same input.
