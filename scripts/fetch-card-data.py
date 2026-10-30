"""Fetch full player-card metadata from RingsDB, one request per pack.

The offline build carries two RingsDB-derived data files today:
  * image-index.js        — 1315 player cards / 98 packs, image URLs only
  * ringsdb-snapshot.js   — Core Set (73 cards) with rules text and Chinese names

This script fills the gap: full metadata (rulesText / stats / traits / printings)
for every player card in every pack the image index already references, written
as JSON so the rendering side can wire it up without touching build inputs.

Endpoints (verified 2026-10-30):
  GET https://ringsdb.com/api/public/packs/            -> pack list (code/name/known/total)
  GET https://ringsdb.com/api/public/cards/{code}.json -> ALL player cards of that pack
NOTE: https://ringsdb.com/api/public/packs/{code}/ is an HTML page (404 for the
JSON API) — the per-pack JSON lives under /cards/{code}.json.

Both hosts are unreachable from mainland China; use --proxy like
fetch-card-images.py.

Usage:
    python scripts/fetch-card-data.py --proxy http://127.0.0.1:7899            # full run
    python scripts/fetch-card-data.py --proxy ... --packs Core                 # smoke test
    python scripts/fetch-card-data.py --proxy ... --packs Core --no-project    # cache only

Output:
  docs/data/cache/{packCode}.json   raw per-pack payloads; incremental cache,
                                    re-run skips packs already cached (this dir
                                    is a local cache, not committed)
  docs/data/player-carddata.json    projected dataset (camelCase, aligned with
                                    ringsdb-snapshot.js; nameZh empty where no
                                    Chinese name is known yet)
"""
import argparse
import glob
import io
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_INDEX = os.path.join(ROOT, 'image-index.js')
CORE_SNAPSHOT = os.path.join(ROOT, 'ringsdb-snapshot.js')
ZH_TITLES = os.path.join(ROOT, 'product-zh.json')
OUT_DIR = os.path.join(ROOT, 'docs', 'data')
CACHE_DIR = os.path.join(OUT_DIR, 'cache')
OUT_FILE = os.path.join(OUT_DIR, 'player-carddata.json')
PACKS_URL = 'https://ringsdb.com/api/public/packs/'
CARDS_URL = 'https://ringsdb.com/api/public/cards/{code}.json'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36'
# snapshot schema field order; projection must stay aligned with ringsdb-snapshot.js
CARD_FIELDS = ('code,name,nameZh,type,typeName,sphere,sphereName,cost,startingThreat,willpower,'
               'attack,defense,health,isUnique,deckLimit,quantity,traits,rulesText,flavor,'
               'hasErrata,illustrator,packCode,packName,packNameZh,position,printings,sourceUrl').split(',')


def read_text(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def image_index_packs():
    """Pack codes referenced by image-index.js, in first-seen order."""
    src = read_text(IMAGE_INDEX)
    m = re.search(r'const RINGSDB_IMAGES = (\{.*\});?', src, re.S)
    if not m:
        raise SystemExit('image-index.js: 找不到 RINGSDB_IMAGES')
    data = json.loads(m.group(1).rstrip(';\n'))
    packs, seen = [], set()
    for card in data['cards']:
        code = card.get('packCode')
        if code and code not in seen:
            seen.add(code)
            packs.append({'code': code, 'name': card.get('packName', '')})
    return packs


def zh_maps():
    """Card-level Chinese names (Core snapshot) and pack-level titles."""
    cards = {}
    src = read_text(CORE_SNAPSHOT)
    start, end = src.find('{'), src.rfind('}')
    snap = json.loads(src[start:end + 1])
    for card in snap.get('cards', []):
        if card.get('nameZh'):
            cards[card['code']] = card['nameZh']
    titles = {}
    try:
        titles = json.loads(read_text(ZH_TITLES)).get('titles', {})
    except (OSError, ValueError):
        pass
    return cards, titles


def http_json(url, proxy, retries=2, timeout=40):
    handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy} if proxy else {})
    opener = urllib.request.build_opener(handler)
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with opener.open(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as exc:  # noqa: BLE001 - network errors come in many shapes
            last = exc
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'{url}: {last}')


def num(value):
    """API cost fields arrive as strings ('2', 'X', '-') — mirror the Core snapshot."""
    if isinstance(value, str) and re.fullmatch(r'\d+', value or ''):
        return int(value)
    return value


def project(card, zh_cards, zh_titles):
    pack_code = card.get('pack_code')
    cost = num(card.get('cost'))
    ctype = card.get('type_code')
    if ctype != 'hero' and cost is None:
        # treasures / contracts / side-quests have no cost at all; the Core snapshot
        # spells that out as '-' (player-cards.js P.verify accepts number|'X'|'-'),
        # so mirror it instead of shipping nulls that every consumer must re-guess.
        cost = '-'
    return {
        'code': card.get('code'),
        'name': card.get('name'),
        'nameZh': zh_cards.get(card.get('code'), ''),
        'type': ctype,
        'typeName': card.get('type_name'),
        'sphere': card.get('sphere_code'),
        'sphereName': card.get('sphere_name'),
        'cost': cost,
        'startingThreat': card.get('threat'),
        'willpower': card.get('willpower'),
        'attack': card.get('attack'),
        'defense': card.get('defense'),
        'health': card.get('health'),
        'isUnique': card.get('is_unique'),
        'deckLimit': card.get('deck_limit'),
        'quantity': card.get('quantity'),
        'traits': card.get('traits') or '',
        'rulesText': card.get('text') or '',
        'flavor': card.get('flavor') or '',
        'hasErrata': card.get('has_errata'),
        'illustrator': card.get('illustrator'),
        'packCode': pack_code,
        'packName': card.get('pack_name'),
        'packNameZh': zh_titles.get(card.get('pack_name'), ''),
        'position': card.get('position'),
        'printings': [{'packCode': p.get('pack_code'), 'name': p.get('pack_name'),
                       'quantity': p.get('quantity'), 'position': p.get('position')}
                      for p in card.get('packs', [])],
        'sourceUrl': card.get('url') or f'https://ringsdb.com/card/{card.get("code")}',
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--proxy', default=os.environ.get('LOTR_PROXY'), help='http://127.0.0.1:7899')
    ap.add_argument('--packs', help='comma-separated pack codes (smoke test)')
    ap.add_argument('--interval', type=float, default=1.2, help='seconds between requests (>=1)')
    ap.add_argument('--retries', type=int, default=2)
    ap.add_argument('--no-project', action='store_true', help='cache only, skip writing the dataset')
    ap.add_argument('--force', action='store_true', help='refetch packs that are already cached')
    args = ap.parse_args()
    interval = max(args.interval, 1.0)

    packs = image_index_packs()
    if args.packs:
        wanted = [x.strip() for x in args.packs.split(',') if x.strip()]
        packs = [p for p in packs if p['code'] in wanted] or [{'code': c, 'name': ''} for c in wanted]
    print(f'packs referenced by image-index.js: {len(packs)}')

    zh_cards, zh_titles = zh_maps()
    print(f'zh sources: {len(zh_cards)} card names (Core snapshot), {len(zh_titles)} pack titles')

    os.makedirs(CACHE_DIR, exist_ok=True)
    # pack list gives name/known/total — cross-check against image-index, best effort
    try:
        listing = http_json(PACKS_URL, args.proxy, args.retries)
        by_code = {p['code']: p for p in listing}
        missing = [p['code'] for p in packs if p['code'] not in by_code]
        print(f'RingsDB pack list: {len(listing)} packs; not in list: {missing or "none"}')
        time.sleep(interval)
    except Exception as exc:  # noqa: BLE001
        by_code = {}
        print(f'pack list unavailable ({exc}); continuing with image-index names')

    raw_cards, failed = [], []
    for i, pack in enumerate(packs, 1):
        code = pack['code']
        cache = os.path.join(CACHE_DIR, f'{code}.json')
        if os.path.exists(cache) and not args.force:
            try:
                payload = json.loads(read_text(cache))
            except ValueError:
                payload = None
            if isinstance(payload, list) and payload:
                raw_cards.extend(payload)
                continue
        try:
            payload = http_json(CARDS_URL.format(code=code), args.proxy, args.retries)
        except Exception as exc:  # noqa: BLE001
            failed.append(code)
            print(f'[{i}/{len(packs)}] {code}: FAILED {exc}')
            time.sleep(interval)
            continue
        with io.open(cache, 'w', encoding='utf-8') as fh:
            json.dump(payload, fh, ensure_ascii=False)
        raw_cards.extend(payload)
        print(f'[{i}/{len(packs)}] {code}: {len(payload)} cards')
        time.sleep(interval)

    print(f'fetched/cached {len(raw_cards)} cards from {len(packs) - len(failed)} packs; failed: {failed or "none"}')
    if args.no_project or not raw_cards:
        return

    seen, cards = set(), []
    for raw in raw_cards:
        code = raw.get('code')
        if code in seen:
            continue
        seen.add(code)
        cards.append(project(raw, zh_cards, zh_titles))
    cards.sort(key=lambda c: (c['packCode'], c['position'] or 0, c['code']))

    dataset = {
        'schemaVersion': 1,
        'source': 'RingsDB',
        'endpoint': 'https://ringsdb.com/api/public/cards/{packCode}.json',
        'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime()),
        'cardCount': len(cards),
        'packCount': len({c['packCode'] for c in cards}),
        'packs': [{'code': p['code'], 'name': by_code.get(p['code'], {}).get('name', p['name']),
                   'known': by_code.get(p['code'], {}).get('known'), 'total': by_code.get(p['code'], {}).get('total'),
                   'cyclePosition': by_code.get(p['code'], {}).get('cycle_position'),
                   'position': by_code.get(p['code'], {}).get('position'),
                   'available': by_code.get(p['code'], {}).get('available')} for p in packs],
        'cards': cards,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = OUT_FILE + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(dataset, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT_FILE)
    zh_known = sum(1 for c in cards if c['nameZh'])
    types = {}
    for c in cards:
        types[c['type']] = types.get(c['type'], 0) + 1
    print(f'wrote {OUT_FILE}: {os.path.getsize(OUT_FILE)} bytes')
    print(f'cards={len(cards)} packs={dataset["packCount"]} types={types}')
    print(f'chinese names: {zh_known}/{len(cards)} ({100.0 * zh_known / len(cards):.1f}%)')


if __name__ == '__main__':
    main()
