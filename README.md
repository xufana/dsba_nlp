# NLP · ADD-2026

Русские материалы курса NLP для студентов DSBA НИУ ВШЭ.

Автор: [Daria Andreeva](https://t.me/Xufana).

## Материалы

* [Неделя 1 — представления текста](week01_text_representations/demo/week01_add.html): постановка задачи, токенизация, TF-IDF, классификация и эмбеддинги.
* [Неделя 2 — языковая модель и генерация](week02_language_modelling/demo/week02_add.html): BPE, n-граммы, обучение, рекуррентные сети и декодирование.

* [Занятие 3 — машинный перевод и трансформер](week03_attention_transformer/demo/week03_add.html): encoder–decoder, attention, Q/K/V, маски и устройство сети.
* [Занятие 4 — практика](week04_practice/week04_practice.ipynb): классификатор, генератор на GRU и блок трансформера с SVG-схемами.
* [Занятие 5 — BERT и развитие энкодеров](week05_bert/demo/week05_add.html): предобучение, головы задач, RoBERTa, ELECTRA, RoPE, нормы, gated FFN и ModernBERT.
* [Занятие 6 — GPT и развитие генеративных моделей](week06_gpt/demo/week06_add.html): следующий токен, обучение, KV-cache, GQA, FlashAttention и MoE.
* [Занятие 7 — PEFT и обучение по награде](week07_peft_alignment/demo/week07_add.html): linear probing, fine-tuning, LoRA, SFT, PPO, DPO, GRPO и RLVR.
* [Занятие 8 — практика BERT, GPT и LoRA](week08_practice/week08_practice.ipynb): классификация, zero-shot, NER, QA, стадии OLMo и сохранение адаптеров; [интерактивы](week08_practice/demo/week08_add.html).

[Ноутбуки и полные семинары](https://github.com/xufana/dsba_nlp/tree/autumn-2026) находятся в `autumn-2026`. Ноутбук занятия 4 находится в ADD-2026; ссылки на полный курс ведут в autumn-2026.

## Редактирование

В `weekNN_*/demo/add/`: `text/*.md` — текст, вопросы и короткий код; `body.html` — порядок блоков; `lesson.js` — SVG-схемы и расчёты. Метка `# @ключ` связывает строку Python с `data-f="ключ"` на схеме или формуле. Подробности размещаем в `<details class="optional">`.

В `artifacts/demo_data.json` лежат используемые измерения из соответствующих артефактов `autumn-2026`, коммит `b0ae710`: таблица классификации, сравнение декодирования и примеры генерации. Код опытов и исходные данные доступны в той ветке. Учебные расчёты выполняются в браузере.

В занятиях 5–6 исходный коммит записан в поле `source` артефакта. Их `export_demo_data.py` сохраняют эталоны PyTorch для численных проверок браузерных вычислений. Материал о форматах запросов и сохранённые генерации GPT-2 для следующего ноутбука находятся в `week06_gpt/parked/`.

Общие стили и механика вопросов — в `demo_base/`; сборка и проверка — в `scripts/`. `build_demo.py` и `build_site.py` предоставляют общие функции сборки и шаблон сайта.

## Сборка и проверка

```sh
uv sync
uv run python scripts/build_add.py
uv run python scripts/build_add_site.py
node scripts/check_demo.js week01_text_representations week01_text_representations/demo/week01_add.html week01_text_representations/demo/add/check_steps.json
node scripts/check_demo.js week02_language_modelling week02_language_modelling/demo/week02_add.html week02_language_modelling/demo/add/check_steps.json
node scripts/check_demo.js week03_attention_transformer week03_attention_transformer/demo/week03_add.html week03_attention_transformer/demo/add/check_steps.json
node scripts/check_demo.js week05_bert week05_bert/demo/week05_add.html week05_bert/demo/add/check_steps.json
node scripts/check_demo.js week06_gpt week06_gpt/demo/week06_add.html week06_gpt/demo/add/check_steps.json
node scripts/check_demo.js week07_peft_alignment week07_peft_alignment/demo/week07_add.html week07_peft_alignment/demo/add/check_steps.json
node scripts/check_demo.js week08_practice week08_practice/demo/week08_add.html week08_practice/demo/add/check_steps.json
.venv/bin/python scripts/check_add_practice.py
```

Локальный курс: `/tmp/dsba_nlp/_site/add-2026/index.html`. Проверки и скриншоты: `/tmp/dsba_nlp/weekNN/check_out/`.

## GitHub Pages

Общий workflow берёт две отдельные копии веток: `autumn-2026` публикуется в корень, `ADD-2026` — в `/add-2026/`. Локально обе версии можно собрать так:

```sh
uv run python scripts/build_add_site.py /tmp/dsba_nlp/_site --autumn-source /путь/к/отдельной/копии/autumn-2026
```

Без `--autumn-source` собираются только страницы ADD. Перед первой публикацией ADD файл `.github/workflows/pages.yml` должен совпадать в обеих ветках, чтобы push в любую из них сохранял обе версии сайта.


Таблица русской морфологии хранится в `week01_text_representations/artifacts/morphology.json`. Пересчитать её тем же кодом, который показан на странице:

```sh
uv run --script week01_text_representations/export_morphology.py
```

Зависимости этого опыта описаны в самом скрипте; uv создаёт отдельное окружение.


Векторы и веса для вкладок «От слов к документу» вычисляются из показанного кода:

```sh
uv run --script week01_text_representations/export_pooling.py
```

Скрипт сохраняет `artifacts/pooling.json` и выполняет примеры Skip-Gram, CBOW и negative sampling на маленьком учебном корпусе, на CPU.


Примеры n-граммной генерации DSBA и проверенные совпадения с подвыборкой корпуса хранятся в `week02_language_modelling/artifacts/ngram_examples.json`. Извлечь их из локальной ветки `autumn-2026`:

```sh
python3 week02_language_modelling/export_ngram_examples.py
```


Перплексии моделей на анекдотах и условия их обучения извлекаются из артефакта DSBA:

```sh
python3 week02_language_modelling/export_ppl_examples.py
```
