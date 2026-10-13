# Seminars, autumn 2025

Seventeen notebooks for twelve weeks (one of them a bonus for week 6) and an extra one on agents and
text diffusion, plus the data they read. Each of them starts with an **environment cell** (`%pip
install ...`) that installs exactly what that notebook imports, pinned to the major versions it was
written against; run it once in Colab or in a fresh virtualenv. Locally, the same lists live in the
root `pyproject.toml` as dependency groups:

```bash
uv sync --group week03            # one week; add --group cuda on a Linux + NVIDIA machine
uv run jupyter lab
```

Paths inside the notebooks are relative to this directory (`data/...`, `weights/...`), so start
Jupyter here or `cd seminars` first. Model and dataset downloads from the Hugging Face Hub are
listed per week below; nothing needs a token except the Inference API in the extra agents notebook.

## Why the pins

The notebooks use `transformers` 4.x, `datasets` 3.x and `langchain` 0.3. Since then
`transformers` 5, `datasets` 4 (which dropped dataset scripts such as `conll2003` and
`feedbackQA`) and `langchain` 1 were released and changed or removed the APIs used here.
Hence `transformers>=4.56,<5`, `datasets>=3.6,<4`, `langchain*<1`, `sentence-transformers<5`.
Everything else is a lower bound.

## Weeks

| Week | Notebook(s) | Topic | Extra packages (on top of numpy, pandas, matplotlib, tqdm) | Data / models | Hardware |
| --- | --- | --- | --- | --- | --- |
| 01 | `week01_word_embeddings.ipynb` | Tokenization, stemming/lemmatization, TF-IDF classifier, Word2Vec, GloVe analogies, PCA/t-SNE | scikit-learn, nltk, gensim, wordcloud, bokeh, jupyter-bokeh | `data/quora.txt`, `data/ag_news_*.csv` (in repo); `glove-twitter-100` via gensim (~400 MB) | CPU |
| 02 | `week02_NN_text_classification.ipynb` | CNN / TextCNN / GRU classifiers on Word2Vec, trainable embeddings, perturbation explanations | torch, nltk, gensim, wandb (optional) | `data/ag_news_*.csv` | GPU recommended; CPU ≈ 10 min/epoch |
| 03 | `week03_lm.ipynb` | BPE, n-gram LM, perplexity, Laplace smoothing, RNN LM | torch, scikit-learn, bpe | `data/anek.txt` | CPU (n-grams); CUDA GPU for the RNN LM (its 50k-way softmax is too slow on CPU/MPS) |
| 04 | `week04_lstm_attention_transformer.ipynb` | De→En translation: LSTM seq2seq, `nn.Transformer`, cross-attention ablation, beam search, BLEU | torch, transformers, datasets, evaluate, accelerate, wandb (optional) | `bentrevett/multi30k`; BERT tokenizers (en, de) | GPU |
| 05 | `week05_transformer.ipynb` | Transformer encoder from scratch, HF `datasets`/`tokenizers`, attention maps | torch, transformers, datasets, tokenizers | `fancyzhx/ag_news` | GPU |
| 06 | `week06_BERT.ipynb`, `week06_bonus_NER.ipynb` | BERT zero-shot via MLM, `[CLS]` features + logistic regression, fine-tuning with `Trainer`; bonus: NER with BERT, `Trainer` and an Accelerate loop | torch, transformers, datasets, evaluate, accelerate, scikit-learn, seqeval (bonus) | `fancyzhx/ag_news`, `bert-base-uncased`; bonus: `eriktks/conll2003` (script dataset), `bert-base-cased` | GPU |
| 07 | `week07_nlp_tasks.ipynb`, `hse_seminar_7_part_2_summ.ipynb` | NER (token classification), extractive QA (SQuAD), extractive and abstractive summarization (T5, ROUGE) | torch, transformers, datasets, evaluate, accelerate, seqeval, rouge-score, nltk | `eriktks/conll2003` (script dataset), `squad`, `knkarthick/samsum`, `EdinburghNLP/xsum`; `bert-base-cased`, `t5-small`, `Qwen2.5-0.5B-Instruct` | GPU |
| 08 | `week08_modern_LLM.ipynb` | Base vs instruct models, chat templates, SFT, RLHF, DPO | torch, transformers, accelerate | `unsloth/Llama-3.2-1B(-Instruct)` (~2.5 GB each) | GPU (8 GB) |
| 09 | `week09_RAG.ipynb` | Chunking, embeddings, Qdrant, Hit@k / MRR, BM25 + hybrid, reranking, structured output | torch, transformers, langchain 0.3 stack, qdrant-client, sentence-transformers, chonkie, rapidfuzz, rank-bm25, outlines, pydantic, openpyxl; `google-genai` optional | `data/gonzo_dump.csv`, `data/golden_mock.xlsx`; `BAAI/bge-m3`, `BAAI/bge-reranker-v2-m3`, `ruadapt_qwen2.5_3B` (~6 GB) | CPU for retrieval; GPU for the 3B generator |
| 10 | `week10_PEFT.ipynb` | Full fine-tuning vs linear probing vs LoRA vs prompt tuning vs LP-FT on SST-2 | torch, transformers, datasets, evaluate, accelerate, peft, torchmetrics, seaborn | `glue/sst2`, `gpt2` | GPU |
| 11 | `week11_pt0_Decoding_and_Sampling.ipynb`, `week11_pt1_Evaluation_with_Harness.ipynb`, `week11_pt2_LLM_as_a_Judge.ipynb` | Decoding strategies and speculative decoding; `lm-evaluation-harness` tasks in YAML; LLM-as-a-judge vs human ratings | torch, transformers, datasets, accelerate, huggingface-hub, lm-eval; `vllm` optional (Linux + CUDA) | `SmolLM2-{135M,360M,1.7B}`, `Llama-3.2-1B-Instruct`, `McGill-NLP/feedbackQA` (script dataset), BoolQ, CoLA, MMLU | GPU |
| 12 | `week12_pt0_Torch_and_ONNX_Quantization_+_PEFT.ipynb`, `week12_pt1_Distillation_and_GPTQ_Quantization.ipynb` | int8 quantization from scratch, torch dynamic quantization, bitsandbytes, ONNX static quantization, GPTQ, QLoRA | torch, transformers, datasets, evaluate, accelerate, peft, optimum-onnx[onnxruntime]; `bitsandbytes`, `gptqmodel` optional (Linux + CUDA) | `imdb`, `lvwerra/distilbert-imdb`, `facebook/opt-125m`, `TheBloke/Llama-2-7b-Chat-GPTQ` (~4 GB) | CPU for int8/ONNX parts; GPU for the rest |
| extra | `hse_seminar_14_agents_and_diffusion.ipynb` | Tool-calling agents with `smolagents`; masked text diffusion (LLaDA) | torch, transformers, huggingface-hub, smolagents, ddgs | HF Inference API (token needed); `LLaDA-MoE-7B-A1B-Instruct` (~14 GB) | Inference API; GPU (24 GB) for LLaDA |

## Running without accounts

- **Weights & Biases** (weeks 2 and 4): logging is off by default (`WANDB_MODE=disabled`), and the
  metrics W&B would have shown are printed after every epoch. Set `WANDB_MODE=online` and run
  `wandb.login()` to log to an account.
- **Gemini** (end of week 9): the hosted structured-output example runs only if `GEMINI_API_KEY`
  is set; the local `outlines` example before it needs no key.
- **Hugging Face Inference API** (extra agents notebook): needs `notebook_login()`.

## What changed

The fixes made in the autumn-2025 pass, notebook by notebook, and how they were checked are in
[CHANGELOG.md](CHANGELOG.md).
