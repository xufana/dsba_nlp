# Занятие 7 — PEFT и обучение по награде

Линейная голова, полное дообучение и LoRA; SFT, модель награды, PPO, DPO, GRPO и RLVR. Выбор обучаемых слоёв BERT на AG News перенесён из `week04_pretraining_transfer`: схема показывает замороженные части, результаты — точность, время и число параметров сохранённого опыта. Таблица Kumar et al. по изображениям раскрывается рядом с LP-FT. Остальные интерактивы перенесены из `week07_peft` и `week08_training_alignment` ветки `autumn-2026`, подписи переведены. Исходный коммит и файлы перечислены в `artifacts/sources.json`.

На странице видны краткие объяснения и схемы. Дополнительные методы и таблицы раскрываются отдельно. Синтетические матрицы и кривые PEFT помечены как учебные иллюстрации; сохранённый прогон 2025 года и таблицы статей указаны отдельно.

```sh
.venv/bin/python scripts/build_add.py week07_peft_alignment
node scripts/check_demo.js week07_peft_alignment week07_peft_alignment/demo/week07_add.html week07_peft_alignment/demo/add/check_steps.json
```

Практика находится в `week08_practice`.

Численные эталоны DPO/GRPO и число параметров LoRA пересчитываются из PyTorch:

```sh
.venv/bin/python week07_peft_alignment/export_demo_data.py
```
