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

## end-refs

* Schuster, Nakajima (2012). [*Japanese and Korean Voice Search.*](https://doi.org/10.1109/ICASSP.2012.6289079) ICASSP. — WordPiece.
* Wu et al. (2016). [*Google's Neural Machine Translation System: Bridging the Gap between Human and Machine Translation.*](https://arxiv.org/abs/1609.08144) — the GNMT description of WordPiece.
* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://arxiv.org/abs/1508.07909) ACL. — BPE.
* Kudo (2018). [*Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates.*](https://arxiv.org/abs/1804.10959) ACL. — the Unigram model.
* Kudo, Richardson (2018). [*SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing.*](https://arxiv.org/abs/1808.06226) EMNLP demo.
* Bostrom, Durrett (2020). [*Byte Pair Encoding is Suboptimal for Language Model Pretraining.*](https://arxiv.org/abs/2004.03720) EMNLP Findings.
* Devlin, Chang, Lee, Toutanova (2019). [*BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding.*](https://arxiv.org/abs/1810.04805) NAACL.
* Liu et al. (2019). [*RoBERTa: A Robustly Optimized BERT Pretraining Approach.*](https://arxiv.org/abs/1907.11692) — NSP removed.
* Peters et al. (2018). [*Deep Contextualized Word Representations.*](https://arxiv.org/abs/1802.05365) NAACL. — ELMo.
* Clark, Luong, Le, Manning (2020). [*ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators.*](https://arxiv.org/abs/2003.10555) ICLR.
* Lan et al. (2020). [*ALBERT: A Lite BERT for Self-supervised Learning of Language Representations.*](https://arxiv.org/abs/1909.11942) ICLR.
* Tenney, Das, Pavlick (2019). [*BERT Rediscovers the Classical NLP Pipeline.*](https://arxiv.org/abs/1905.05950) ACL.
* Liu et al. (2019). [*Linguistic Knowledge and Transferability of Contextual Representations.*](https://arxiv.org/abs/1903.08855) NAACL.
* Reimers, Gurevych (2019). [*Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.*](https://arxiv.org/abs/1908.10084) EMNLP. — why a raw [CLS] is a poor sentence vector.
* Howard, Ruder (2018). [*Universal Language Model Fine-tuning for Text Classification.*](https://arxiv.org/abs/1801.06146) ACL. — ULMFiT.
* Peters, Ruder, Smith (2019). [*To Tune or Not to Tune? Adapting Pretrained Representations to Diverse Tasks.*](https://arxiv.org/abs/1903.05987) RepL4NLP.
* Mosbach, Andriushchenko, Klakow (2021). [*On the Stability of Fine-tuning BERT: Misconceptions, Explanations, and Strong Baselines.*](https://arxiv.org/abs/2006.04884) ICLR.
* Houlsby et al. (2019). [*Parameter-Efficient Transfer Learning for NLP.*](https://arxiv.org/abs/1902.00751) ICML. — adapters.
* Hu et al. (2021). [*LoRA: Low-Rank Adaptation of Large Language Models.*](https://arxiv.org/abs/2106.09685) ICLR 2022.
* Tjong Kim Sang, De Meulder (2003). [*Introduction to the CoNLL-2003 Shared Task: Language-Independent Named Entity Recognition.*](https://aclanthology.org/W03-0419/) CoNLL.
* Ramshaw, Marcus (1995). [*Text Chunking using Transformation-Based Learning.*](https://aclanthology.org/W95-0107/) WVLC. — the BIO scheme.
* Rajpurkar et al. (2016). [*SQuAD: 100,000+ Questions for Machine Comprehension of Text.*](https://arxiv.org/abs/1606.05250) EMNLP.
* Rajpurkar, Jia, Liang (2018). [*Know What You Don't Know: Unanswerable Questions for SQuAD.*](https://arxiv.org/abs/1806.03822) ACL. — SQuAD 2.0.
* Wang et al. (2019). [*GLUE: A Multi-Task Benchmark and Analysis Platform for Natural Language Understanding.*](https://arxiv.org/abs/1804.07461) ICLR.
* Raffel et al. (2020). [*Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer.*](https://arxiv.org/abs/1910.10683) JMLR 21. — T5.
* Xiao, Liu, Shao, Cao (2022). [*RetroMAE: Pre-Training Retrieval-oriented Language Models Via Masked Auto-Encoder.*](https://arxiv.org/abs/2205.12035) EMNLP. — RetroMAE.
