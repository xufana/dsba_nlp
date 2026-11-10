"""Собирает ADD и при --autumn-source добавляет основной курс."""

import argparse
import re
import shutil
from pathlib import Path

import build_site

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://xufana.github.io/dsba_nlp"
REPO = "xufana/dsba_nlp"


def add_navigation(page, prev_num, next_num):
    """Добавляет переходы между русскими неделями и к основному курсу."""
    page = build_site.with_nav(page, "../", prev_num, next_num)
    for en, ru in (("all weeks", "все недели"), ("← week ", "← неделя ")):
        page = page.replace(en, ru)
    page = re.sub(r"week (\d+) →", r"неделя \1 →", page)
    return page.replace('<div class="site-nav">', f'<div class="site-nav"><a href="{BASE}/">autumn-2026</a> ', 1)


def add_cards(out):
    """Публикует объединённые страницы и ссылки на практику autumn-2026."""
    cards = []
    sources = sorted(ROOT.glob("week[0-9][0-9]_*/demo/week*_add.html"))
    for i, src in enumerate(sources):
        num = src.name[4:6]
        week = src.parent.parent.name
        page = src.read_text()
        title = build_site.inner(r"<h1[^>]*>(.*?)</h1>", page)
        topics = build_site.inner(r'<template data-text="topics">(.*?)</template>', page)
        dest = out / f"week{num}"
        dest.mkdir(parents=True, exist_ok=True)
        previous = sources[i-1].name[4:6] if i else None
        following = sources[i+1].name[4:6] if i+1 < len(sources) else (
            "04" if num == "03" and (ROOT / "week04_practice/week04_practice.ipynb").exists() else None)
        (dest / "index.html").write_text(add_navigation(page, previous, following))
        cards.append({"num": num, "topic": title, "formula": None,
                      "lecture": f"week{num}/", "href": f"{BASE}/week{num}/", "check": None,
                      "topics": re.findall(r"<li>(.*?)</li>", topics or '', re.S),
                      "colab": f"https://colab.research.google.com/github/{REPO}/blob/autumn-2026/{week}/{week}.ipynb",
                      "github": f"https://github.com/{REPO}/blob/autumn-2026/{week}/{week}.ipynb"})
    if not cards:
        raise SystemExit("Нет weekNN_add.html — запустите scripts/build_add.py")
    return cards


def practice_card(prefix):
    """Карточка практики со ссылками на ноутбук ADD."""
    notebook = "week04_practice/week04_practice.ipynb"
    github = f"https://github.com/{REPO}/blob/ADD-2026/{notebook}"
    colab = f"https://colab.research.google.com/github/{REPO}/blob/ADD-2026/{notebook}"
    return f'''<li class="card"><div class="num">04</div><div class="text">
<h2>Практика: классификатор, генератор и блок трансформера</h2>
<div class="topics"><ul><li>TF-IDF и нейросетевой классификатор</li><li>GRU и генерация текста</li><li>Attention и причинная маска</li><li>Обучение и проверка моделей</li></ul></div>
<div class="entry"><div class="main"><a class="t" href="{colab}">Открыть в Colab</a><span class="s">код, схемы и обучение на CPU</span></div>
<div class="main"><a class="t" href="{prefix}week04_practice.ipynb" download>Скачать ноутбук</a><span class="s">SVG-схемы вложены в файл</span><span class="x"><a href="{prefix}practice_data.json" download>Данные для локального запуска</a></span><span class="x"><a href="{github}">GitHub</a></span></div></div>
</div></li>'''


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('out', nargs='?', type=Path, default=Path('/tmp/dsba_nlp/_site'))
    ap.add_argument('--autumn-source', type=Path, help='отдельная копия autumn-2026 для совместной публикации')
    args = ap.parse_args()
    if args.autumn_source:
        source = args.autumn_source.resolve()
        if source == ROOT or not list(source.glob('week*/demo/week*_demo.html')):
            ap.error('--autumn-source требует отдельную копию материалов autumn-2026')
    if args.out.exists():
        shutil.rmtree(args.out)
    args.out.mkdir(parents=True)
    weeks = []
    if args.autumn_source:
        build_site.ROOT = source
        weeks = build_site.collect(args.out, 'autumn-2026')
        autumn = build_site.render(weeks).replace('<footer>', '<footer><a href="add-2026/">ADD-2026 · курс на русском</a> · ', 1)
        (args.out / 'index.html').write_text(autumn)
    add_out = args.out / 'add-2026'
    add_out.mkdir()
    add = build_site.render(add_cards(add_out))
    notebook = ROOT / "week04_practice/week04_practice.ipynb"
    if notebook.exists():
        practice = add_out / "week04"
        practice.mkdir()
        shutil.copy2(notebook, practice / notebook.name)
        shutil.copy2(notebook.with_name("practice_data.json"), practice / "practice_data.json")
        landing = build_site.TEMPLATE.replace("{{cards}}", practice_card(""))
        landing = landing.replace('<html lang="en">', '<html lang="ru">')
        landing = landing.replace("<title>NLP @ HSE DSBA</title>", "<title>Занятие 4 · практика · ADD-2026</title>")
        landing = landing.replace("<h1>NLP @ HSE DSBA</h1>", "<h1>Практика · ADD-2026</h1>")
        landing = landing.replace("Lectures and seminar demos for the NLP course, 4th year DSBA, autumn 2026.",
                                  "Занятие 4 · ADD-2026 · практика на CPU")
        landing = landing.replace("<footer>", '<footer><a href="../">ADD-2026 · все занятия</a> · ', 1)
        (practice / "index.html").write_text(landing)
        add = add.replace("  </ol>", practice_card("week04/") + "\n  </ol>", 1)
    for en, ru in (
        ('<html lang="en">', '<html lang="ru">'),
        ('<title>NLP @ HSE DSBA</title>', '<title>NLP @ HSE DSBA · ADD-2026</title>'),
        ('<h1>NLP @ HSE DSBA</h1>', '<h1>NLP · ADD-2026</h1>'),
        ('Lectures and seminar demos for the NLP course, 4th year DSBA, autumn 2026.', 'Курс на русском: теория, вопросы и короткий код. Практика — в autumn-2026.'),
        ('This week\'s lecture', 'Темы недели'),
        ('>Lecture<', '>Материал и вопросы<'),
        ('theory, then check yourself', 'объяснение, схемы и код'),
        ('>Seminar demo<', '>Семинар autumn-2026<'),
        ('the live experiments', 'полные опыты и ноутбук'),
    ):
        add = add.replace(en, ru)
    add = add.replace('<footer>', f'<footer><a href="{BASE}/">autumn-2026 · все недели</a> · ', 1)
    (add_out / 'index.html').write_text(add)
    count = len(list(add_out.glob("week*/index.html")))
    main_course = f"; autumn-2026: {len(weeks)} недель" if args.autumn_source else ""
    print(f"ADD-2026: {count} недели{main_course} → {args.out}")


if __name__ == '__main__':
    main()
