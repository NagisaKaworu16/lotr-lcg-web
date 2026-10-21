"""Import the Hall of Beorn product catalogue into the offline build.

Reads products.json produced by collect_products.py, converts each cover to
WebP under assets/products/ and writes product-catalog.js with the products
already grouped into the new-game chapter structure.

Usage:
  python scripts/import-product-catalog.py --source "C:/.../lotr-lcg-products"
"""
import argparse
import io
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, 'assets', 'products')
OUT_JS = os.path.join(ROOT, 'product-catalog.js')
ZH_JSON = os.path.join(ROOT, 'product-zh.json')

# English group -> Chinese chapter title (fallback keeps the English name)
GROUP_ZH = {
    'Revised Core Set and Starter Decks': '新版核心与预组',
    'Revised Angmar Awakened': '新版 · 安格玛觉醒',
    'Revised Dream-chaser': '新版 · 追梦者',
    'Revised Ered Mithrin': '新版 · 埃瑞德米斯林',
    'Revised Lord of the Rings Saga': '新版 · 魔戒传奇',
    'Shadows of Mirkwood Cycle': '暗影中的魔窟',
    'Dwarrowdelf Cycle': '卡兹杜姆',
    'Against the Shadow Cycle': '对抗阴影',
    'The Ring-maker Cycle': '魔戒匠人',
    'Angmar Awakened Cycle': '安格玛觉醒',
    'Dream-chaser Cycle': '追梦者',
    'Haradrim Cycle': '哈拉德林',
    'Ered Mithrin Cycle': '埃瑞德米斯林',
    'Oaths of the Rohirrim Cycle': '洛汗誓言',
    'Vengeance of Mordor Cycle': '复仇魔多',
    'The Lord of the Rings Saga': '魔戒传奇',
    'The Hobbit Saga': '霍比特人传奇',
    'Gen Con Decks': '官方 POD · Gen Con',
    'Fellowship Decks': '官方 POD · Fellowship',
    'Custom Scenario Kits': '官方 POD · 自定义剧本包',
    'Scenario Packs': '官方 POD · 剧本包',
    'Stand Alone Scenarios': '社区 STANDALONE',
    'Doom Mastered Cycle': '社区 · 命运主宰',
    'Fell Summer Cycle': '社区 · 陨落之夏',
    'The Legacy of Fëanor': '社区 · 费艾诺的遗产',
}
COND_ZH = {
    'Revised Content': '新版内容', 'Cycles': '循环', 'Sagas': '传奇',
    'Print on Demand': 'Print on Demand', 'Nightmare Decks': '噩梦包',
}
NIGHTMARE_TAB = 'nightmare'
POD_CATEGORIES = {'Print on Demand'}


def slug_id(slug):
    return re.sub(r'[^A-Za-z0-9._-]+', '-', slug).strip('-')


def load_zh():
    if not os.path.isfile(ZH_JSON):
        return {}
    with io.open(ZH_JSON, encoding='utf-8') as fh:
        data = json.load(fh)
    return data.get('titles', {})


CODE_RE = re.compile(r'\s*\((?:UME|ME|OP|FA|ALE|LOF)[0-9A-Z-]+\)\s*$')
NIGHT_RE = re.compile(r'\s+Nightmare(?:\s+(?:Deck|Decks|Product))?$', re.I)
PROMO_RE = re.compile(r'\s+Preorder Promotion$', re.I)


def zh_name(name, titles):
    """Resolve a Chinese title: exact -> nightmare suffix -> preorder suffix."""
    base = CODE_RE.sub('', name).strip()
    if base in titles:
        return titles[base]
    m = NIGHT_RE.search(base)
    if m:
        stem = base[:m.start()].strip()
        zh = titles.get(stem) or titles.get(stem.replace('Treachery', 'The Treachery'))
        if zh:
            return zh + ' · 噩梦'
    m = PROMO_RE.search(base)
    if m:
        stem = base[:m.start()].strip()
        if stem in titles:
            return titles[stem] + '（预购特典）'
    return ''


def convert(path, dest, max_side=520, quality=82):
    with Image.open(path) as im:
        im = im.convert('RGBA')
        w, h = im.size
        scale = min(1.0, max_side / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        im.save(dest, 'WEBP', quality=quality, method=6)


def chapter_label(group, publisher, category):
    if category == 'Revised Content':
        return '新版内容（Revised）'
    zh = GROUP_ZH.get(group)
    if publisher != 'Fantasy Flight Games':
        prefix = '社区 · '
        return prefix + (zh or group)
    if category == 'Nightmare Decks':
        return '噩梦 · ' + (GROUP_ZH.get(group.replace(' Nightmare Decks', '').replace(' Cycle', ' Cycle'), group.replace(' Nightmare Decks', '')))
    return zh or group


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help='folder containing products.json and images/')
    args = ap.parse_args()

    with io.open(os.path.join(args.source, 'products.json'), encoding='utf-8') as fh:
        data = json.load(fh)
    products = data['products'] if isinstance(data, dict) else data

    titles = load_zh()
    os.makedirs(OUT_IMG, exist_ok=True)
    tabs = {'campaign': [], 'pod': [], NIGHTMARE_TAB: []}
    order = {'campaign': [], 'pod': [], NIGHTMARE_TAB: []}
    chapters = {'campaign': {}, 'pod': {}, NIGHTMARE_TAB: {}}
    converted = skipped = 0

    for p in products:
        if p.get('status') != 'ok' or not p.get('file'):
            skipped += 1
            continue
        src = os.path.join(args.source, p['file'].replace('/', os.sep))
        if not os.path.isfile(src):
            skipped += 1
            continue
        ident = slug_id(p['slug'])
        dest_name = ident + '.webp'
        dest = os.path.join(OUT_IMG, dest_name)
        if not os.path.isfile(dest):
            convert(src, dest)
            converted += 1
        publisher = p.get('publisher', '')
        category = p.get('category', '')
        group = p.get('group', '')
        if category == 'Nightmare Decks':
            tab = NIGHTMARE_TAB
        elif category in POD_CATEGORIES or publisher != 'Fantasy Flight Games':
            tab = 'pod'
        else:
            tab = 'campaign'
        label = chapter_label(group, publisher, category)
        zh = zh_name(p.get('name', ''), titles)
        item = {
            'id': ident,
            'name': p.get('name', ident),
            'zh': zh,
            'art': 'assets/products/' + dest_name,
            'meta': COND_ZH.get(category, category),
            'pub': 'community' if publisher != 'Fantasy Flight Games' else 'ffg',
            'cat': category,
        }
        if label not in chapters[tab]:
            chapters[tab][label] = []
            order[tab].append(label)
        chapters[tab][label].append(item)

    def build(tab, start_index):
        out = []
        for i, label in enumerate(order[tab], start=start_index):
            out.append({'label': 'CHAPTER %d · %s' % (i, label), 'items': chapters[tab][label]})
        return out

    payload = {
        'source': data.get('source') if isinstance(data, dict) else '',
        'generated': '2026-10-21',
        'campaign': build('campaign', 2),   # chapter 1 is the playable core set
        'pod': build('pod', 2),
        'nightmare': build(NIGHTMARE_TAB, 1),
    }
    with io.open(OUT_JS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('/* Generated by scripts/import-product-catalog.py — Hall of Beorn product covers.\n')
        fh.write('   Product art belongs to its respective rights holders; source links live in the\n')
        fh.write('   offline index shipped with the collector output. */\n')
        fh.write('const PRODUCT_TABS=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')

    total = sum(len(chapters[t][l]) for t in chapters for l in chapters[t])
    named = sum(1 for t in chapters for l in chapters[t] for it in chapters[t][l] if it.get('zh'))
    print('images converted=%d reused=%d skipped=%d' % (converted, total - converted, skipped))
    print('chinese titles: %d/%d' % (named, total))
    for t in ('campaign', 'pod', NIGHTMARE_TAB):
        n = sum(len(chapters[t][l]) for l in chapters[t])
        print('%-10s chapters=%2d items=%3d' % (t, len(order[t]), n))
    print('wrote', OUT_JS)


if __name__ == '__main__':
    sys.exit(main())
