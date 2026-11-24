## s-modern
**ModernBERT:** RoPE, Pre-LN, GeGLU и чередование локального и глобального attention.

## modern-detail
В исходном BERT каждый токен читает весь доступный вход в каждом слое. В ModernBERT первый слой глобальный, затем глобальный повторяется через каждые {global_every} слоя; остальные используют локальное окно {local_window} токенов. Поддерживаемая длина контекста — {modern_context}. Для вычисления используются FlashAttention и обработка без padding; механизм FlashAttention разбираем в следующей лекции.

ModernBERT обучен на {modern_tokens} токенов. Его результаты отражают и архитектуру, и данные, и обучение. Отдельный вклад RoPE или GeGLU требует контролируемого сравнения.

## modern-note
Уменьшенная учебная последовательность: локальное окно охватывает соседние позиции, глобальный слой — всю последовательность. Нажмите токен и меняйте глубину: рамки показывают, откуда информация могла попасть к нему через уже пройденные слои. Это доступность пути, а не измеренные веса attention.

## q-local · pick
Два токена находятся дальше друг от друга, чем локальное окно. Могут ли их представления обменяться информацией в ModernBERT?
- [ ] нет, дальние токены навсегда изолированы
- [x] да, через глобальные слои и пути через промежуточные позиции
- [ ] только если убрать позиции
> Локальный слой ограничивает прямые связи одного слоя. Глобальные слои дают прямые связи между всеми позициями.

## s-padding
**Unpadding убирает вычисления по пустым позициям.** Границы отдельных текстов сохраняются.

## padding-note
Те же документы до и после удаления padding. Границы и цвета документов сохраняются: attention одного документа не получает доступ к другому. Счётчик показывает позиции, а не время на GPU.

## q-padding · pick
Несколько документов упакованы в одну последовательность для вычислений. Должен ли токен первого документа читать второй?
- [ ] да, это смысл упаковки
- [x] нет, границы документов ограничивают attention
- [ ] это определяется только цветом токена
> Удаление padding сохраняет независимость примеров. Реализация учитывает границы последовательностей.

## q-design · write
Службе поддержки нужны тема обращения, названия компаний и ответ фрагментом инструкции. Размеченных обращений мало; инструкции длинные. Спроектируйте решение: задача / данные / представление / модель / метрика / что сломается первым.
- Разделили классификацию, NER и извлечение ответа; указали выходы каждой задачи.
- Предложили разметку и отложенную выборку без утечки между близкими обращениями.
- Указали токенизацию, ограничения длины и обработку длинных инструкций.
- Обосновали заморозку или дообучение и способ проверки решения.
- Выбрали метрики: классификация, F1 по сущностям, точное совпадение и F1 ответа.
- Проверили отсутствие ответа, редкие сущности и выход за контекст.
> Энкодер подходит всем трём задачам с разными головами. Длинный контекст нужно проверять на реальных документах. Извлечение фрагмента требует, чтобы ответ присутствовал в тексте; для отсутствующего ответа нужны соответствующие данные и правило отказа.

## end-refs
* Devlin et al. (2019). [*BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding.*](https://arxiv.org/abs/1810.04805) NAACL.
* Liu et al. (2019). [*RoBERTa: A Robustly Optimized BERT Pretraining Approach.*](https://arxiv.org/abs/1907.11692) arXiv.
* Clark et al. (2020). [*ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators.*](https://arxiv.org/abs/2003.10555) ICLR.
* Reimers, Gurevych (2019). [*Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.*](https://aclanthology.org/D19-1410/) EMNLP-IJCNLP.
* Su et al. (2024). [*RoFormer: Enhanced Transformer with Rotary Position Embedding.*](https://arxiv.org/abs/2104.09864) Neurocomputing.
* Zhang, Sennrich (2019). [*Root Mean Square Layer Normalization.*](https://arxiv.org/abs/1910.07467) NeurIPS.
* Shazeer (2020). [*GLU Variants Improve Transformer.*](https://arxiv.org/abs/2002.05202) arXiv.
* Touvron et al. (2023). [*Llama 2: Open Foundation and Fine-Tuned Chat Models.*](https://arxiv.org/abs/2307.09288) arXiv.
* Warner et al. (2024). [*Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder for Fast, Memory Efficient, and Long Context Finetuning and Inference.*](https://arxiv.org/abs/2412.13663) arXiv.
* Alammar (2018). [*The Illustrated BERT, ELMo, and co.*](https://jalammar.github.io/illustrated-bert/) — иллюстрации архитектуры.
