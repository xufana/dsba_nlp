# Занятие 6 — GPT и развитие генеративных моделей

Причинная модель, сдвиг целей, генерация, prefill/decode, KV-cache, GQA и FlashAttention. MoE находится под раскрытием. Форматы запросов, RLHF и квантизация относятся к следующему занятию.

Исходники страницы — `demo/add/`, собранная страница — [demo/week06_add.html](demo/week06_add.html). Материал взят из `autumn-2026/week05_decoder_only/` и `week06_modern_llm/`. Сохранённое продолжение и параметры устройства перенесены из их `artifacts/demo_data.json`; коммит указан в `source`.

В [parked/](parked/) сохранены блок «Как задать задачу текстом», входы и полные продолжения GPT-2 для следующего ноутбука с генерациями.

Из корня репозитория:

```sh
.venv/bin/python week06_gpt/export_demo_data.py
.venv/bin/python scripts/build_add.py week06_gpt
node scripts/check_demo.js week06_gpt week06_gpt/demo/week06_add.html week06_gpt/demo/add/check_steps.json
```

Эталоны получены `torch.nn.functional.scaled_dot_product_attention` в float64 на CPU: обычная и причинная маски, один токен, неполные плитки, большие оценки, причинные префиксы. Браузерные расчёты сравниваются с ними до 1e-9. Числа кэша — память тензоров K,V одного запроса; счётчики FlashAttention учитывают только обмены промежуточных матриц S,P в показанном наивном варианте.

Скриншоты находятся в `/tmp/dsba_nlp/week06/check_out/`.
