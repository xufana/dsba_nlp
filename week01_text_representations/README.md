# Week 1 — Representations of Text

**Thesis:** `classifier = representation × head`. The head has been a logistic
regression for fifteen years; only the representation changed. If that lands,
text classification is closed as a concept and the course never returns to it.

## Sources

### Distributional semantics and term weighting

* Harris (1954). [*Distributional Structure.*](https://doi.org/10.1080/00437956.1954.11659520) Word 10(2–3).
* Spärck Jones (1972). [*A Statistical Interpretation of Term Specificity and Its Application in Retrieval.*](https://doi.org/10.1108/eb026526) Journal of Documentation 28(1).
* Salton, Buckley (1988). [*Term-weighting Approaches in Automatic Text Retrieval.*](https://doi.org/10.1016/0306-4573(88)90021-0) Information Processing & Management 24(5).
* Deerwester et al. (1990). [*Indexing by Latent Semantic Analysis.*](https://doi.org/10.1002/(SICI)1097-4571(199009)41:6%3C391::AID-ASI1%3E3.0.CO;2-9) JASIS 41(6).
* Robertson, Zaragoza (2009). [*The Probabilistic Relevance Framework: BM25 and Beyond.*](https://doi.org/10.1561/1500000019) Foundations and Trends in Information Retrieval 3(4).

### Normalization and lexical resources

* Porter (1980). [*An Algorithm for Suffix Stripping.*](https://doi.org/10.1108/eb046814) Program 14(3).
* Miller (1995). [*WordNet: A Lexical Database for English.*](https://doi.org/10.1145/219717.219748) Communications of the ACM 38(11).

### Subword tokenization

* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://arxiv.org/abs/1508.07909) ACL 2016.
* Kudo (2018). [*Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates.*](https://arxiv.org/abs/1804.10959) ACL 2018.
* Kudo, Richardson (2018). [*SentencePiece: A Simple and Language Independent Subword Tokenizer and Detokenizer for Neural Text Processing.*](https://arxiv.org/abs/1808.06226) EMNLP 2018.

### Topic models

* Blei, Ng, Jordan (2003). [*Latent Dirichlet Allocation.*](https://www.jmlr.org/papers/v3/blei03a.html) JMLR 3.

### Static word embeddings

* Mikolov et al. (2013). [*Efficient Estimation of Word Representations in Vector Space.*](https://arxiv.org/abs/1301.3781) ICLR 2013 Workshop.
* Mikolov et al. (2013). [*Distributed Representations of Words and Phrases and their Compositionality.*](https://arxiv.org/abs/1310.4546) NeurIPS 2013.
* Pennington, Socher, Manning (2014). [*GloVe: Global Vectors for Word Representation.*](https://aclanthology.org/D14-1162/) EMNLP 2014.
* Bojanowski et al. (2017). [*Enriching Word Vectors with Subword Information.*](https://arxiv.org/abs/1607.04606) TACL 5.
* Joulin et al. (2017). [*Bag of Tricks for Efficient Text Classification.*](https://arxiv.org/abs/1607.01759) EACL 2017.

### Sentence vectors from word vectors

* Arora, Liang, Ma (2017). [*A Simple but Tough-to-Beat Baseline for Sentence Embeddings.*](https://openreview.net/forum?id=SyK00v5xx) ICLR 2017.
* Mu, Viswanath (2018). [*All-but-the-Top: Simple and Effective Postprocessing for Word Representations.*](https://arxiv.org/abs/1702.01417) ICLR 2018.
* Ethayarajh (2018). [*Unsupervised Random Walk Sentence Embeddings: A Strong but Simple Baseline.*](https://aclanthology.org/W18-3012/) Repl4NLP 2018.

### Analogies and social bias in embeddings

* Bolukbasi et al. (2016). [*Man is to Computer Programmer as Woman is to Homemaker? Debiasing Word Embeddings.*](https://arxiv.org/abs/1607.06520) NeurIPS 2016.
* Linzen (2016). [*Issues in Evaluating Semantic Spaces Using Word Analogies.*](https://arxiv.org/abs/1606.07736) RepEval 2016.
* Caliskan, Bryson, Narayanan (2017). [*Semantics Derived Automatically from Language Corpora Contain Human-like Biases.*](https://arxiv.org/abs/1608.07187) Science 356(6334).
* Gonen, Goldberg (2019). [*Lipstick on a Pig: Debiasing Methods Cover up Systematic Gender Biases in Word Embeddings But do not Remove Them.*](https://arxiv.org/abs/1903.03862) NAACL 2019.
* Nissim, van Noord, van der Goot (2020). [*Fair is Better than Sensational: Man is to Doctor as Woman is to Doctor.*](https://arxiv.org/abs/1905.09866) Computational Linguistics 46(2).

### Linear text classification

* Wang, Manning (2012). [*Baselines and Bigrams: Simple, Good Sentiment and Topic Classification.*](https://aclanthology.org/P12-2018/) ACL 2012.

### Explanations and shortcuts

* Ribeiro, Singh, Guestrin (2016). [*"Why Should I Trust You?": Explaining the Predictions of Any Classifier.*](https://arxiv.org/abs/1602.04938) KDD 2016.
* Lundberg, Lee (2017). [*A Unified Approach to Interpreting Model Predictions.*](https://arxiv.org/abs/1705.07874) NeurIPS 2017.
* Jain, Wallace (2019). [*Attention is not Explanation.*](https://arxiv.org/abs/1902.10186) NAACL 2019.
* Wiegreffe, Pinter (2019). [*Attention is not not Explanation.*](https://arxiv.org/abs/1908.04626) EMNLP 2019.
* Geirhos et al. (2020). [*Shortcut Learning in Deep Neural Networks.*](https://arxiv.org/abs/2004.07780) Nature Machine Intelligence 2.

### Dimensionality reduction and visualization

* van der Maaten, Hinton (2008). [*Visualizing Data using t-SNE.*](https://www.jmlr.org/papers/v9/vandermaaten08a.html) JMLR 9.
* Wattenberg, Viégas, Johnson (2016). [*How to Use t-SNE Effectively.*](https://distill.pub/2016/misread-tsne/) Distill.
* McInnes, Healy, Melville (2018). [*UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction.*](https://arxiv.org/abs/1802.03426) arXiv:1802.03426.

### Determinism in LLM inference

* He, Thinking Machines Lab (2025). [*Defeating Nondeterminism in LLM Inference.*](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)

### Data

* Zhang, Zhao, LeCun (2015). [*Character-level Convolutional Networks for Text Classification.*](https://arxiv.org/abs/1509.01626) NeurIPS 2015. Source of the AG News classification set.

### Expository

* Alammar. [*The Illustrated Word2vec.*](https://jalammar.github.io/illustrated-word2vec/)
