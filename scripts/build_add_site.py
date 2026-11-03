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
    for en, ru in (("all weeks", "все недели"), ("← week ", "← неделя "), ("week 02 →", "неделя 02 →")):
        page = page.replace(en, ru)
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
        following = sources[i+1].name[4:6] if i+1 < len(sources) else None
        (dest / "index.html").write_text(add_navigation(page, previous, following))
        cards.append({"num": num, "topic": title, "formula": None,
                      "lecture": f"week{num}/", "href": f"{BASE}/week{num}/", "check": None,
                      "topics": re.findall(r"<li>(.*?)</li>", topics or '', re.S),
                      "colab": f"https://colab.research.google.com/github/{REPO}/blob/autumn-2026/{week}/{week}.ipynb",
                      "github": f"https://github.com/{REPO}/blob/autumn-2026/{week}/{week}.ipynb"})
    if not cards:
        raise SystemExit("Нет weekNN_add.html — запустите scripts/build_add.py")
    return cards


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
