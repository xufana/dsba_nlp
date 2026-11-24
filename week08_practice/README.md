# Занятие 8 — практика BERT, GPT и LoRA

`week08_practice.ipynb` — исходный ноутбук. `practice_data.json` — общие сохранённые результаты для ноутбука и страницы. Источники и коммит указаны в `artifacts/sources.json`.

Маршрут: BERT для классификации и дообучение; zero-shot через MLM; BIO и подслова NER; окна и границы QA; четыре стадии OLMo 2 1B; LoRA на GPT-2 с сохранением, загрузкой и слиянием. В конце выполняются градиентные шаги PPO, DPO и GRPO на учебной policy с конечным набором ответов.

На CUDA по умолчанию включены BERT и LoRA. На CPU/MPS доступны сохранённые результаты и учебные вычисления; загрузка весов включается вручную. Для живой части включите соответствующие `RUN_*` в настройках. Для BERT-классификации нужны `RUN_BERT` и `RUN_BERT_TRAINING`, для LoRA — `RUN_LORA`. Размеры выборки, число шагов и батч заданы рядом. Короткий запуск проверяет механизм; условия сохранённых опытов отличаются.

```sh
.venv/bin/python week08_practice/export_demo_data.py
.venv/bin/python scripts/build_add.py week08_practice
.venv/bin/python scripts/check_add_practice.py
node scripts/check_demo.js week08_practice week08_practice/demo/week08_add.html week08_practice/demo/add/check_steps.json
```

Проверка ноутбука использует настоящие классы Transformers/PEFT с маленькими случайными весами, локальными токенизаторами BERT/GPT-2 и небольшими учебными данными. Она проходит загрузку, обучение, NER, QA, генерацию и цикл сохранения LoRA. Параметр `--real-lora` повторяет только путь LoRA на настоящем GPT-2 из локального кэша; данные остаются маленькими учебными примерами. Это проверка выполнения, а не оценка качества SST-2.
