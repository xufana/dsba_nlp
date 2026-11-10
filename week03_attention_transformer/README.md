# Занятие 3 — машинный перевод и трансформер

Условная генерация → encoder–decoder → attention по состояниям энкодера → self-attention и Q, K, V → маски → блок и полный переводчик.

Q, K, V вводятся в блоке трансформера. В рекуррентной модели используются оценки соответствия, веса и контекст.

Источник страницы: `demo/add/`. Сборка: `python scripts/build_add.py week03_attention_transformer`. Проверка:

```sh
node scripts/check_demo.js week03_attention_transformer week03_attention_transformer/demo/week03_add.html week03_attention_transformer/demo/add/check_steps.json
```

Проверка выгружает схемы страницы в `figures/` как SVG и PNG. Ноутбук занятия 4 содержит вложенные копии тех же схем.
