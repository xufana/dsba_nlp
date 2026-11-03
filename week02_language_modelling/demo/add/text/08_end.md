## lede

Хотим генерировать текст. Приходим к языковому моделированию: учимся оценивать продолжения по уже написанному контексту.

## intro

На каждой схеме следим за входом, формой массива и смыслом ячейки. Ответьте до открытия разбора. Подробности скрыты; код связан со схемами подсветкой. Полные опыты и ноутбук доступны в autumn-2026.

## design-intro

Теперь выбираем модель и правило решения под конкретный продукт.

## q-design · write

Мессенджеру нужны подсказки следующих слов на русском прямо на телефоне. Сеть недоступна, память и время ответа ограничены. Спроектируйте решение.

- задача: ранжирование подсказок по префиксу
- данные: тексты сообщений с корректным разделением и приватностью
- представление: слова или части слов и сборка полного слова
- модель: счётная или маленькая рекуррентная
- метрика: принятие подсказок, сэкономленные нажатия, задержка и память
- что сломается: имена, сленг, переключение языка и новые темы

> Начнём со сглаженной счётной модели и проверим небольшую GRU на тех же данных. Показываем несколько вероятных полных слов, а не случайную генерацию. PPL используем при разработке; в продукте проверяем, выбирают ли подсказки, сколько нажатий они экономят и укладываются ли в ограничения устройства.

## end-refs

* Sennrich, Haddow, Birch (2016). [*Neural Machine Translation of Rare Words with Subword Units.*](https://aclanthology.org/P16-1162/) ACL. — BPE для перевода.
* Bengio et al. (2003). [*A Neural Probabilistic Language Model.*](https://www.jmlr.org/papers/v3/bengio03a.html) JMLR.
* Hochreiter, Schmidhuber (1997). [*Long Short-Term Memory.*](https://doi.org/10.1162/neco.1997.9.8.1735) Neural Computation.
* Cho et al. (2014). [*Learning Phrase Representations using RNN Encoder–Decoder for Statistical Machine Translation.*](https://aclanthology.org/D14-1179/) EMNLP. — GRU и encoder–decoder.
* Holtzman et al. (2020). [*The Curious Case of Neural Text Degeneration.*](https://arxiv.org/abs/1904.09751) ICLR.
* Papineni et al. (2002). [*BLEU: a Method for Automatic Evaluation of Machine Translation.*](https://aclanthology.org/P02-1040/) ACL.

## topics

* Языковая модель и генерация
* Подсловная токенизация BPE
* N-граммы и сглаживание
* Обучение и perplexity
* RNN, LSTM и GRU
* Декодирование и перевод
