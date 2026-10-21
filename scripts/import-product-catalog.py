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
POD_MANIFEST = os.path.join(ROOT, 'pod-manifest.json')

# English group -> Chinese chapter title (fallback keeps the English name)
GROUP_ZH = {
    'Revised Core Set and Starter Decks': '新版核心与预组',
    'Revised Angmar Awakened': '新版 · 安格玛觉醒',
    'Revised Dream-chaser': '新版 · 追梦者',
    'Revised Ered Mithrin': '新版 · 埃瑞德米斯林',
    'Revised Lord of the Rings Saga': '新版 · 魔戒传奇',
    'Shadows of Mirkwood Cycle': '黑森林的魔影',
    'Dwarrowdelf Cycle': '矮人故乡',
    'Against the Shadow Cycle': '对抗魔影',
    'The Ring-maker Cycle': '铸戒者',
    'Angmar Awakened Cycle': '安格玛觉醒',
    'Dream-chaser Cycle': '追梦者',
    'Haradrim Cycle': '哈拉德人',
    'Ered Mithrin Cycle': '埃瑞德米斯林',
    'Oaths of the Rohirrim Cycle': '洛希尔人的誓言',
    'Vengeance of Mordor Cycle': '魔多的复仇',
    'The Lord of the Rings Saga': '魔戒传奇',
    'The Hobbit Saga': '霍比特人传奇',
    'Gen Con Decks': '官方 POD · Gen Con',
    'Fellowship Decks': '官方 POD · Fellowship',
    'Custom Scenario Kits': '官方 POD · 自定义剧本包',
    'Scenario Packs': '官方 POD · 剧本包',
    'Stand Alone Scenarios': '独立剧本合集',
    'Doom Mastered Cycle': '命运主宰',
    'Fell Summer Cycle': '酷夏之劫',
    'The Legacy of Fëanor': '费艾诺的遗产',
    'The First Age': '第一纪元',
}
# Nightmare decks reuse the cycle name; map the bare cycle name too.
NIGHTMARE_ZH = {
    'Shadows of Mirkwood': '黑森林的魔影',
    'Dwarrowdelf': '矮人故乡',
    'Against the Shadow': '对抗魔影',
    'The Ring-maker': '铸戒者',
    'Angmar Awakened': '安格玛觉醒',
    'Dream-chaser': '追梦者',
    'Haradrim': '哈拉德人',
    'Ered Mithrin': '埃瑞德米斯林',
    'Vengeance of Mordor': '魔多的复仇',
    'The Hobbit Saga': '霍比特人传奇',
    'The Lord of the Rings Saga': '魔戒传奇',
    'The Treachery of Rhudaur': '鲁道尔的背叛',
}
COND_ZH = {
    'Revised Content': '新版内容', 'Cycles': '循环', 'Sagas': '传奇',
    'Print on Demand': 'Print on Demand', 'Nightmare Decks': '噩梦包',
}
NIGHTMARE_TAB = 'nightmare'
POD_CATEGORIES = {'Print on Demand'}
# The revised core box and the four starter decks are the base game now; the
# screen already offers 基础剧本合集 as the playable entry, so they are skipped.
SKIP_NAMES = {'Revised Core Set', 'Dwarves of Durin', 'Elves of Lórien',
              'Defenders of Gondor', 'Riders of Rohan'}
# Revised solo scenario pack ships like a POD even though its category is Revised.
POD_OVERRIDES = {'The Dark of Mirkwood': ('旧', '新版 POD')}
# A revised cycle ships as two boxes. The scenarios only live in the campaign box,
# so the list shows one entry per cycle and points at that box.
HERO_RE = re.compile(r'^(.*)\s+Hero Expansion$')
CAMPAIGN_RE = re.compile(r'^(.*)\s+Campaign Expansion$')


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


def chapter_label(group, publisher, category, tab=None, pod_type=''):
    if tab == 'pod':
        return '官方 POD' if pod_type == 'official_pod' else 'ALeP 自制独立作品'
    if category == 'Revised Content':
        return '新版扩展（Revised）'
    zh = GROUP_ZH.get(group)
    if category == 'Nightmare Decks':
        bare = re.sub(r'\s+Nightmare(?:\s+(?:Deck|Decks|Product))?$', '', group).strip()
        name = NIGHTMARE_ZH.get(bare) or GROUP_ZH.get(bare + ' Cycle') or GROUP_ZH.get(bare) or bare
        return '噩梦 · ' + name
    if publisher != 'Fantasy Flight Games':
        return '社区 · ' + (GROUP_ZH.get(group) or group)
    return zh or GROUP_ZH.get(group + ' Cycle') or group


CODE_IN_NAME = re.compile(r'\(([A-Z]+[0-9][0-9A-Z-]*)\)\s*$')


def code_of(name):
    m = CODE_IN_NAME.search(name or '')
    return m.group(1) if m else ''


def load_manifest():
    """Selected POD manifest: the authority for what counts as 支线剧情."""
    if not os.path.isfile(POD_MANIFEST):
        return []
    with io.open(POD_MANIFEST, encoding='utf-8') as fh:
        data = json.load(fh)
    return data.get('items', [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help='folder containing products.json and images/')
    args = ap.parse_args()

    with io.open(os.path.join(args.source, 'products.json'), encoding='utf-8') as fh:
        data = json.load(fh)
    products = data['products'] if isinstance(data, dict) else data

    titles = load_zh()
    manifest = load_manifest()
    by_code = {i['code']: i for i in manifest if i.get('code')}
    os.makedirs(OUT_IMG, exist_ok=True)
    KEYS = ('revised', 'legacy', 'pod', NIGHTMARE_TAB)
    order = {k: [] for k in KEYS}
    chapters = {k: {} for k in KEYS}
    converted = skipped = 0
    seen_codes = set()
    seen_titles = set()

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
        name = p.get('name', '')
        base = CODE_RE.sub('', name).strip()
        if base in SKIP_NAMES:
            skipped += 1
            continue
        if PROMO_RE.search(base):
            # Preorder promotions reprint an existing scenario; they are not new content.
            skipped += 1
            continue
        code = code_of(name)
        if code:
            seen_codes.add(code)
        seen_titles.add(base.lower())
        pod = by_code.get(code) if code else None
        hero = HERO_RE.match(base)
        if hero and category == 'Revised Content':
            # Same cycle as the campaign box, which is the one holding the scenarios.
            skipped += 1
            continue
        pod_type = ''
        if pod:
            tab = 'pod'
            pod_type = pod['type']
        elif base in POD_OVERRIDES:
            tab = 'pod'
            pod_type = 'official_pod'
        elif category == 'Nightmare Decks':
            tab = NIGHTMARE_TAB
        elif category in POD_CATEGORIES:
            tab = 'pod'
            pod_type = 'official_pod'
        elif publisher != 'Fantasy Flight Games':
            # Community cycles are deluxe + adventure packs, so they belong with the legacy boxes.
            tab = 'legacy'
        elif category == 'Revised Content':
            tab = 'revised'
        else:
            tab = 'legacy'
        label = chapter_label(group, publisher, category, tab, pod_type)
        campaign = CAMPAIGN_RE.match(base) if category == 'Revised Content' else None
        series = campaign.group(1) if campaign else ''
        zh = (titles.get(series) or zh_name(p.get('name', ''), titles)) if series else zh_name(p.get('name', ''), titles)
        item = {
            'id': ident,
            'name': p.get('name', ident),
            'en': series or base,
            'zh': zh,
            'art': 'assets/products/' + dest_name,
            'meta': POD_OVERRIDES.get(base, (None, COND_ZH.get(category, category)))[1],
            'pub': 'community' if publisher != 'Fantasy Flight Games' else 'ffg',
            'cat': category,
        }
        if label not in chapters[tab]:
            chapters[tab][label] = []
            order[tab].append(label)
        chapters[tab][label].append(item)

    # Manifest entries the catalogue snapshot never collected (e.g. The Mirror of Galadriel).
    for it in manifest:
        if it.get('code') and it['code'] in seen_codes:
            continue
        if it['title_en'].lower() in seen_titles:
            continue
        ident = 'pod-' + slug_id(it['title_en']).lower()
        art = ''
        dest = os.path.join(OUT_IMG, ident + '.webp')
        cover = it.get('cover') or ''
        if os.path.isfile(dest):
            # Hand-made cover already dropped in (e.g. 加拉德瑞尔之镜).
            art = 'assets/products/' + ident + '.webp'
        elif cover:
            src = os.path.join(args.source, '..', 'lotr-pod-workbuddy', cover.replace('/', os.sep))
            src = os.path.normpath(src)
            if os.path.isfile(src):
                dest = os.path.join(OUT_IMG, ident + '.webp')
                convert(src, dest)
                art = 'assets/products/' + ident + '.webp'
                converted += 1
        pod_type = it['type']
        label = chapter_label('', '', '', 'pod', pod_type)
        if label not in chapters['pod']:
            chapters['pod'][label] = []
            order['pod'].append(label)
        chapters['pod'][label].append({
            'id': ident,
            'name': it['title_en'],
            'en': it['title_en'],
            'zh': titles.get(it['title_en'], ''),
            'art': art,
            'meta': 'ALeP 自制' if pod_type == 'fan_standalone' else '官方 POD',
            'pub': 'community' if pod_type == 'fan_standalone' else 'ffg',
            'cat': 'Print on Demand',
        })
        seen_titles.add(it['title_en'].lower())

    def build(tab, start_index):
        out = []
        for i, label in enumerate(order[tab], start=start_index):
            out.append({'label': 'CHAPTER %d · %s' % (i, label), 'items': chapters[tab][label]})
        return out

    payload = {
        'source': data.get('source') if isinstance(data, dict) else '',
        'generated': '2026-10-21',
        'revised': build('revised', 2),     # chapter 1 is the playable core set
        'legacy': build('legacy', 1),
        'pod': build('pod', 1),
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
    for t in ('revised', 'legacy', 'pod', NIGHTMARE_TAB):
        n = sum(len(chapters[t][l]) for l in chapters[t])
        print('%-10s chapters=%2d items=%3d' % (t, len(order[t]), n))
    print('wrote', OUT_JS)


if __name__ == '__main__':
    sys.exit(main())
