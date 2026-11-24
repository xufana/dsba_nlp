# Занятие 5 — BERT и развитие энкодеров

Вход BERT, MLM и NSP, выходы классификации/NER/извлечения ответа, RoBERTa и ELECTRA, RoPE, gated FFN, нормы и ModernBERT. Подробности норм скрыты под раскрытием.

Исходники страницы — `demo/add/`, собранная страница — [demo/week05_add.html](demo/week05_add.html). Полный семинар и ноутбук: `autumn-2026/week04_pretraining_transfer/`. Примеры распределений MLM перенесены из его `artifacts/demo_data.json`; коммит указан в поле `source` артефакта этой лекции. Параметры ModernBERT взяты из статьи, ссылка находится на странице.

`export_demo_data.py` сохраняет исходные примеры и эталоны PyTorch на CPU для норм, активаций и RoPE. Числа учебных схем описывают показанные вычисления; качество моделей по ним не оценивается.

Из корня репозитория:

```sh
.venv/bin/python week05_bert/export_demo_data.py
.venv/bin/python scripts/build_add.py week05_bert
node scripts/check_demo.js week05_bert week05_bert/demo/week05_add.html week05_bert/demo/add/check_steps.json
```

Скриншоты и результаты проверки находятся в `/tmp/dsba_nlp/week05/check_out/`.
