## embeddings-intro

Распределительная гипотеза: близкие по употреблению слова встречаются в похожих контекстах. **Skip-Gram** учится по центральному слову предсказывать соседнее. Из обычного текста получаем обучающие пары без ручной разметки.

Создаём две обучаемые таблицы: `word_embeddings` хранит входной вектор каждого слова, `context_embeddings` — его вектор в роли предсказываемого соседа. В коде это два объекта `torch.nn.Embedding`: сначала они заполнены случайными числами, затем меняются при обучении. После обучения для представления слов берём `word_embeddings`.

## embeddings-note

Одна обучающая пара: центр «ест», сосед «рыбу». По номеру «ест» выбираем строку входной таблицы. Сравниваем этот вектор с выходными векторами всех слов и получаем вероятности через softmax. Правильный ответ — «рыбу».

## embeddings-detail

На каждой паре считаем функцию потерь и выполняем шаг оптимизатора: он меняет обе таблицы. Векторы слов со сходными контекстами получают сходные обучающие сигналы. Координаты не имеют заранее назначенных смыслов.

Обучающая задача отличается от будущего применения вектора: для классификации документов ещё нужны представление документа, метки и классификатор.

## neg-intro

**Negative sampling** сокращает число слов, которые оцениваем при обучении. Берём пару из текста — «ест, рыбу» — с меткой 1. К тому же центру подбираем случайные слова из словаря, например «стол» и «бег», с метками 0. Для каждой пары модель учится отличать соседа из текста от случайного слова.

## neg-note

Метки заданы при подготовке примеров. Модель вычисляет скалярные произведения векторов — оценки z. Функция потерь сравнивает эти оценки с метками: для настоящей пары повышаем σ(z), для случайных понижаем. Обновляются обе таблицы: `word_embeddings` и `context_embeddings`.

## neg-detail

В примере случайные слова выбираются из словаря равновероятно; `negative_count` задаёт их число на одну настоящую пару. `torch.multinomial` выполняет выбор, `candidates` объединяет настоящего соседа и случайные слова.

Случайное слово может оказаться уместным соседом или совпасть со словом из настоящей пары. Метка 0 означает способ получения примера. Сумма sigmoid-оценок по словарю не обязана равняться единице.

## q-embed · point

Где находится таблица, строку которой используем как эмбеддинг центрального слова?

<div data-link-scope><div data-fig="skip-question"></div></div>

- [ ] onehot: A
- [x] embedding: B
- [ ] hidden: C
- [ ] output: D
- [ ] distribution: E

> B — входная таблица `word_embeddings`: одна строка на слово. C — выбранная строка этой таблицы. D — транспонированная таблица `context_embeddings`, с которой сравниваем входной вектор. E — распределение по словам-кандидатам.

## q-negative · pick

Как звучит обучающая задача при negative sampling?

- [ ] определить тему текста
- [ ] выбрать следующее слово полным softmax
- [x] отличить наблюдённую пару от шумовой

> Метка принадлежит паре «центр, контекст». После обучения забираем векторы слов; тема документа не была целью этого обучения.

## code-embeddings

```python
optimizer = torch.optim.Adam(
    list(word_embeddings.parameters()) + list(context_embeddings.parameters()),
    lr=0.03,
)
for step in range(100):
    center_vectors = word_embeddings(center_ids)  # @lookup
    scores = center_vectors @ context_embeddings.weight.T  # @context
    loss = torch.nn.functional.cross_entropy(scores, context_ids)  # @target
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

## code-negative

```python
negative_count = 2
sampling_probs = torch.full((len(vocabulary),), 1 / len(vocabulary))
optimizer = torch.optim.Adam(
    list(word_embeddings.parameters()) + list(context_embeddings.parameters()),
    lr=0.03,
)
for step in range(100):
    negatives = torch.multinomial(
        sampling_probs, len(center_ids) * negative_count, replacement=True,
    ).reshape(-1, negative_count)  # @samples
    candidates = torch.cat([context_ids[:, None], negatives], dim=1)
    labels = torch.zeros_like(candidates, dtype=torch.float)
    labels[:, 0] = 1  # @labels
    centers = word_embeddings(center_ids)  # @lookup
    contexts = context_embeddings(candidates)  # @context
    scores = (centers[:, None, :] * contexts).sum(-1)  # @pair
    loss = torch.nn.functional.binary_cross_entropy_with_logits(scores, labels)  # @target
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

## cbow-intro

**CBOW** предсказывает центральное слово по соседям. Из `word_embeddings` берём векторы всех слов контекста и усредняем их. Затем сравниваем средний вектор с выходной таблицей. Порядок соседей при усреднении теряется.

## cbow-note

Окно «кот утром **ест** свежую рыбу»: четыре соседа выбирают четыре строки одной входной таблицы. Их среднее предсказывает центр «ест». У CBOW одно окно даёт один обучающий пример; у Skip-Gram каждая пара центра с соседом — отдельный пример.

## code-cbow

```python
cbow_context_ids = torch.tensor([
    vocabulary[word] for word in ["кот", "утром", "свежую", "рыбу"]
])
cbow_target = torch.tensor([vocabulary["ест"]])
optimizer = torch.optim.Adam(
    list(word_embeddings.parameters()) + list(context_embeddings.parameters()),
    lr=0.03,
)
for step in range(100):
    vectors = word_embeddings(cbow_context_ids)  # @lookup
    context_mean = vectors.mean(dim=0)  # @average
    scores = context_mean @ context_embeddings.weight.T  # @context
    loss = torch.nn.functional.cross_entropy(scores[None, :], cbow_target)  # @target
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```


## embedding-example-note

В каждом примере сначала выполните общий код: он задаёт небольшой учебный корпус, словарь, пары соседей и начальные веса. Затем запустите код выбранного метода. Корпус здесь нужен для разбора вычислений; для полезных языковых представлений нужны большие данные.

## code-embedding-data
```python
import torch

torch.manual_seed(7)
torch.set_num_threads(1)
train_texts = [
    "кот ест рыбу", "пёс ест мясо", "кошка любит молоко",
    "кот утром ест свежую рыбу", "банк выдал кредит",
    "компания выпустила акции", "рынок торгует акциями",
]
tokenized_train = [text.split() for text in train_texts]
vocabulary = {word: i for i, word in enumerate(sorted({
    word for text in tokenized_train for word in text
}))}
pairs = [
    (vocabulary[center], vocabulary[neighbor])
    for text in tokenized_train for i, center in enumerate(text)
    for j, neighbor in enumerate(text) if 0 < abs(i - j) <= 2
]
center_ids, context_ids = torch.tensor(pairs).T
```

## code-embedding-init
```python
word_embeddings = torch.nn.Embedding(len(vocabulary), 4)
context_embeddings = torch.nn.Embedding(len(vocabulary), 4)
```
