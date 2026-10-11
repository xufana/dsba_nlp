# NLP course for HSE DSBA

This repository contain materials for NLP course for 4th year students of HSE DSBA.

## Course Topics

1. Week 1: Text representations. Main tasks: text classification and regression. Context: lecture, [seminar](/week01_text_representations/)
2. Week 2: Language modelling with RNNs. [seminar](/week02_language_modelling/)
3. Week 3: Attention and the transformer. [seminar](/week03_attention_transformer/)
4. Week 4: Pretraining and transfer with encoders. [seminar](/week04_pretraining_transfer/)
5. Week 5: Decoder-only models. [seminar](/week05_decoder_only/)
6. Week 6: The bill — scaling laws, the modern block, serving. [seminar](/week06_modern_llm/)

Interactive pages for the seminars: [xufana.github.io/dsba_nlp](https://xufana.github.io/dsba_nlp/).

## How the repository is organised

One directory per week. In it: the seminar notebook (the source of everything), `README.md`,
`precompute.py` (artifacts that take too long for Colab; their JSON is committed to `artifacts/`),
`export_demo_data.py` (every number the interactive page shows, produced by the notebook's own
code), and `demo/` — the page's prose in `text/*.md`, its structure in `body.html`, its JS, and
the built `weekNN_demo.html` that GitHub Pages serves.

Weights and corpora are not in git: the notebooks fetch them from the Hugging Face Hub
(`scripts/hub.py`, dataset repo `xufana/dsba-nlp-artifacts`) on first run.

One `uv` workspace serves every week:

```
uv sync --all-packages                                   # one .venv at the root
uv run python scripts/build_demo.py week06_modern_llm    # demo/weekNN_demo.html from demo/ + artifacts/
node scripts/check_demo.js week06_modern_llm             # headless-Chrome checks and screenshots -> /tmp/dsba_nlp/
uv run python scripts/new_week.py 07 slug "Title"        # scaffold a new week
```

## Authors:

* [Gleb Kuzmin](https://t.me/glkuzi)
* [Daria Andreeva](https://t.me/Xufana)
* [Fedor Pakhurov](https://t.me/fpakhurov)