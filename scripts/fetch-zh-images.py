# -*- coding: utf-8 -*-
"""DragnCards 中文卡图摄取管线（阶段1：清单 + 批次下载，不碰 build 内联文件）。

数据源：
  * cardDb.tsv        DragnCards 全量卡数据库（databaseId=uuid、name=英文、packName、
                      numberInPack、side、imageUrl），随引擎分发，可 --refetch 重新拉取
  * player-carddata.json / encounter-carddata.json   本仓库两张 RingsDB/HoB 基线

匹配：name+packName 主键（两侧都是英文名，规范化 = NFD 去变音符 + 小写去非字母数字，
否则 Dúnhere 之类匹配不上）；同 pack 同名歧义时用 numberInPack == 数字尾数消歧
（Core 双「A Chosen Path」01121/01122 → 121/122 实测吻合）。关卡卡取 side=='A' 行，
B 面图 = <uuid>.B.jpg（cardDb 自带命名约定）。

下载：https://dragncards-lotrlcg.s3.amazonaws.com/cards/Chinese/<uuid>[.B].jpg
JPEG 魔数校验；403/缺失如实记录（安格玛 S3 无中文，即此情况，不阻塞）。
转 webp 复用 scripts/optimize-card-images.py 的 convert()（quality 80 / 长边 620）。

产物：
  assets/cards-zh/<ringsdb-code>.webp       玩家卡（批内）
  assets/cards-zh-enc/<uid>[.B].webp        遭遇卡/关卡面（批内）
  docs/data/zh-image-map.json               全量审计清单（含未命中/失败记录）
  docs/data/zh-image-map.js                 外挂 module（仅 status=ok 记录，阶段2接线用，
                                            不进 build.py 内联清单）

Usage:
    python scripts/fetch-zh-images.py --packs Core                 # 批次① Core
    python scripts/fetch-zh-images.py --packs Core --no-download   # 只重建清单
"""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

from PIL import Image  # to_webp 直接落盘统一口径 webp（v0.17.5）

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'optimize_card_images', os.path.join(_HERE, 'optimize-card-images.py'))
opt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(opt)  # 复用 convert()：quality/max_side 口径与英文图一致

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYER = os.path.join(ROOT, 'docs', 'data', 'player-carddata.json')
ENCOUNTER = os.path.join(ROOT, 'docs', 'data', 'encounter-carddata.json')
MAP_JSON = os.path.join(ROOT, 'docs', 'data', 'zh-image-map.json')
MAP_JS = os.path.join(ROOT, 'docs', 'data', 'zh-image-map.js')
DIR_PLAYER = os.path.join(ROOT, 'assets', 'cards-zh')
DIR_ENC = os.path.join(ROOT, 'assets', 'cards-zh-enc')
RAW_CACHE = os.path.join(ROOT, 'docs', 'data', 'cache', 'zh-images')
S3 = 'https://dragncards-lotrlcg.s3.amazonaws.com/cards/Chinese/'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36'
DB_URL = 'https://raw.githubusercontent.com/DavidDCostello/lotr-lcg/master/cardDb.tsv'


def norm(s):
    s = unicodedata.normalize('NFD', (s or '').lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(ch for ch in s if not unicodedata.combining(ch)))


# ── v0.17.3 批次② 映射提升 ─────────────────────────────────────────────
# 1) packName 参与规范化匹配：cardata 'Khazad-dûm'/'The Hobbit: X'/'X Nightmare'
#    与 cardDb 'Khazad-dum'/'The Hobbit - X'/'X - Nightmare' 的写法差异全部被
#    norm() 吸收（Û→u、: → 空、- → 空），此前 packName 用原文做键是批次①未命中大头。
# 2) 真别名（cardata packName → cardDb packName 的 norm 键，按序回退）：
PACK_ALIASES = {
    norm('Revised Core Set'): [norm('Revised Core Set'), norm('Core Set')],
    norm('The Dark of Mirkwood'): [norm('The Dark of Mirkwood'), norm('Dark of Mirkwood')],
    norm('On the Doorstep'): [norm('On the Doorstep'), norm('The Hobbit - On the Doorstep')],
    norm('Over Hill and Under Hill'): [norm('Over Hill and Under Hill'),
                                       norm('The Hobbit - Over Hill and Under Hill')],
}
# 3) saga 三部曲：cardDb 根本没有这三个包的行（电影三部曲数据源分组），只能按
#    卡名在全库（剔除 - Nightmare 包）唯一命中才采信；多包同名 → ambiguous 如实留空。
SAGA_PACKS = {norm(x) for x in ('The Fellowship of the Ring', 'The Two Towers',
                                'The Return of the King')}
# 4) MotK 前缀剥离：'(MotK) Ingold' → 'Ingold'。ALeP 包 cardDb 无行，当前
#    剥离后仍 no-row（不与其它包同名卡交叉匹配，避免张冠李戴），仅前向兼容。
_MOTK_PREFIX = re.compile(r'^\([^)]*\)\s*')


def numtail(x):
    try:
        return int(str(x).strip()) % 1000
    except (TypeError, ValueError):
        return None


def load_carddb(path, proxy, retries):
    if not os.path.exists(path):
        handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy} if proxy else {})
        opener = urllib.request.build_opener(handler)
        req = urllib.request.Request(DB_URL, headers={'User-Agent': UA})
        with opener.open(req, timeout=60) as resp:
            data = resp.read()
        with io.open(path, 'w', encoding='utf-8') as fh:
            fh.write(data.decode('utf-8'))
        print(f'cardDb.tsv fetched: {len(data)} bytes -> {path}')
    csv.field_size_limit(10 ** 9)
    with io.open(path, encoding='utf-8') as fh:
        return list(csv.DictReader(fh, delimiter='\t'))


def http_get(url, proxy, retries=2, timeout=40):
    """成功返回字节；403/404（S3 无该中文图）返回 None；其余网络错误抛出。"""
    handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy} if proxy else {})
    opener = urllib.request.build_opener(handler)
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with opener.open(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 404):
                return None
            last = exc
        except Exception as exc:  # noqa: BLE001
            last = exc
        if attempt < retries:
            time.sleep(2)
    raise RuntimeError(f'{url}: {last}')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def fetch_face(url, dest_jpg, proxy):
    """下载单面到缓存目录并做 JPEG 魔数校验；返回 'ok' | 'http-403/404'。"""
    if os.path.exists(dest_jpg):
        return 'ok'
    data = http_get(url, proxy)
    if data is None:
        return 'http-403/404'
    if not data.startswith(b'\xff\xd8\xff'):
        raise RuntimeError(f'非 JPEG 内容: {url} ({data[:8]!r})')
    os.makedirs(os.path.dirname(dest_jpg), exist_ok=True)
    with open(dest_jpg, 'wb') as fh:
        fh.write(data)
    return 'ok'


def to_webp(src, dest_webp, quality, max_side):
    """直接用 PIL 落盘统一口径的 webp（quality/长边见参数，method 6 与英文图管线一致）。

    v0.17.5 修复：此前复用 opt.convert()，其「webp 不比 jpg 小就删除输出、返回 jpg
    原件」的回退路径会把 raw jpg 被 os.replace 成 .webp 资产（331 张假 webp，实为
    JPEG 字节），并在缓存留下 webp 残留。改为无条件下巴不比对，永远产出真 webp。"""
    with Image.open(src) as im:
        out = opt.fit(im.convert('RGB'), max_side)
        out.save(dest_webp, 'WEBP', quality=quality, method=6)
    return dest_webp


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--proxy', default=os.environ.get('LOTR_PROXY', 'http://127.0.0.1:7899'))
    ap.add_argument('--carddb', default=os.path.join(os.environ.get('TEMP', ''), 'cardDb.tsv'))
    ap.add_argument('--refetch', action='store_true', help='重新下载 cardDb.tsv')
    ap.add_argument('--packs', default='Core', help='本批下载的 packCode（玩家/遭遇共用）')
    ap.add_argument('--no-download', action='store_true', help='只重建清单，不下载')
    ap.add_argument('--quality', type=int, default=70, help='v0.17.5 起默认 70（体积护栏口径）')
    ap.add_argument('--max-side', type=int, default=560, help='v0.17.5 起默认 560（体积护栏口径）')
    args = ap.parse_args()
    if args.refetch and os.path.exists(args.carddb):
        os.remove(args.carddb)

    db = load_carddb(args.carddb, args.proxy, 2)
    print(f'cardDb rows: {len(db)}')
    # 行去重：cardDb 存在完全重复行（同 name/pack/number/side/back/uuid 出现两次，
    # 如 DCC 'Calphon' 13 号），按五元组+uuid 折叠，避免同名多条假歧义。
    seen, dedup = set(), []
    for r in db:
        k = (norm(r['name']), norm(r['packName']), r['numberInPack'], r['side'],
             r['cardBack'], r['databaseId'])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)
    if len(dedup) != len(db):
        print(f'cardDb dedupe: {len(db)} -> {len(dedup)} rows')
    db = dedup
    by_name = {}
    for r in db:
        by_name.setdefault((norm(r['name']), norm(r['packName'])), []).append(r)
    saga_all = {}
    for r in db:
        if 'nightmare' not in norm(r['packName']):
            saga_all.setdefault(norm(r['name']), []).append(r)

    def resolve_uuid(hits, cand):
        """多条命中时按数字尾数消歧；仍不唯一则按 distinct uuid 判定。"""
        rows = [r for r in hits if r['side'] != 'B'
                and numtail(r['numberInPack']) == cand]
        if len(rows) == 1:
            return rows[0]
        uuids = {r['databaseId'] for r in hits}
        return hits[0] if len(uuids) == 1 else None

    def pick(card, back):
        """packName 规范化 + 别名链主键匹配；saga 包按全库名字唯一性采信。"""
        nname, npack = norm(card['name']), norm(card.get('packName'))
        if npack in SAGA_PACKS:
            hits = saga_all.get(nname, [])
            if not hits:
                return None, 'no-dragncards-row'
            row = resolve_uuid(hits, numtail(card.get('position')) or numtail(card.get('code')))
            if row is None:
                return None, 'ambiguous'
            return row, 'matched'
        name2 = _MOTK_PREFIX.sub('', card['name'])  # '(MotK) ' 前缀剥离（前向兼容）
        for pk in PACK_ALIASES.get(npack, [npack]):
            hits = by_name.get((nname, pk), [])
            if not hits and name2 != card['name']:
                hits = by_name.get((norm(name2), pk), [])
            if not hits:
                continue
            if len(hits) == 1:
                row = hits[0]
            else:
                cand = numtail(card.get('position')) or numtail(card.get('code'))
                row = resolve_uuid(hits, cand)
                if row is None:
                    return None, 'ambiguous'
            pref = [row] if row['cardBack'] == back else \
                [r for r in hits if r['cardBack'] == back and r['side'] != 'B']
            row2 = pref[0] if pref else row
            return row2, 'matched'
        return None, 'no-dragncards-row'

    with io.open(PLAYER, encoding='utf-8') as fh:
        pcards = json.load(fh)['cards']
    with io.open(ENCOUNTER, encoding='utf-8') as fh:
        ecards = json.load(fh)['cards']

    records, counters = [], {'ok': 0, 'pending': 0, 'no-dragncards-row': 0, 'ambiguous': 0,
                             'http-403/404': 0}
    wanted = {x.strip() for x in args.packs.split(',') if x.strip()}

    def rec(kind, key, card, row, status, url=None, local=None, sha=None):
        records.append({'kind': kind, 'key': key, 'code': card.get('code'), 'uid': card.get('uid'),
                        'name': card.get('name'), 'pack': card.get('packCode') or card.get('packName'),
                        'uuid': (row or {}).get('databaseId'), 'url': url, 'local': local,
                        'sha256': sha, 'status': status})
        counters[status if status in counters else 'pending'] = \
            counters.get(status if status in counters else 'pending', 0) + 1

    # ── 玩家卡 ──────────────────────────────────────────────────────────
    for c in pcards:
        row, status = pick(c, 'player')
        in_batch = c['packCode'] in wanted
        if status != 'matched' or not row:
            rec('player', c['code'], c, None, status)
            continue
        uuid = row['databaseId']
        url = S3 + uuid + '.jpg'
        key, local, st, sha = c['code'], f'assets/cards-zh/{c["code"]}.webp', 'pending', None
        dest = os.path.join(DIR_PLAYER, c['code'] + '.webp')
        if in_batch and not args.no_download and not os.path.exists(dest):
            raw = os.path.join(RAW_CACHE, 'player-' + c['code'] + '.jpg')
            st = fetch_face(url, raw, args.proxy)
            if st == 'ok':
                to_webp(raw, dest, args.quality, args.max_side)
        if os.path.exists(dest):  # 文件已存在即 ok（跨批次累积，不回退 pending）
            st, sha = 'ok', sha256(dest)
            local = f'assets/cards-zh/{c["code"]}.webp'
        rec('player', key, c, row, st, url, local if st == 'ok' else None, sha)

    # ── 遭遇卡 / 关卡卡（A+B 面）────────────────────────────────────────
    for c in ecards:
        row, status = pick(c, 'encounter')
        in_batch = c['packCode'] in wanted
        if status != 'matched' or not row:
            rec('encounter', c['uid'], c, None, status)
            continue
        uuid = row['databaseId']
        url = S3 + uuid + '.jpg'
        dest = os.path.join(DIR_ENC, c['uid'] + '.webp')
        st, sha = 'pending', None
        if in_batch and not args.no_download and not os.path.exists(dest):
            raw = os.path.join(RAW_CACHE, 'enc-' + c['uid'] + '.jpg')
            st = fetch_face(url, raw, args.proxy)
            if st == 'ok':
                to_webp(raw, dest, args.quality, args.max_side)
        if os.path.exists(dest):  # 文件已存在即 ok（跨批次累积）
            st, sha = 'ok', sha256(dest)
        rec('encounter', c['uid'], c, row, st, url,
            f'assets/cards-zh-enc/{c["uid"]}.webp' if st == 'ok' else None, sha)
        if c.get('type') == 'quest':  # 关卡 B 面
            burl = S3 + uuid.replace('.jpg', '') + '.B.jpg'
            bkey, blocal = c['uid'] + '.B', f'assets/cards-zh-enc/{c["uid"]}.B.webp'
            bdest = os.path.join(DIR_ENC, c['uid'] + '.B.webp')
            bst, bsha = 'pending', None
            if in_batch and not args.no_download and not os.path.exists(bdest):
                raw = os.path.join(RAW_CACHE, 'enc-' + c['uid'] + '.B.jpg')
                bst = fetch_face(burl, raw, args.proxy)
                if bst == 'ok':
                    to_webp(raw, bdest, args.quality, args.max_side)
            if os.path.exists(bdest):  # 文件已存在即 ok（跨批次累积）
                bst, bsha = 'ok', sha256(bdest)
            records.append({'kind': 'questB', 'key': bkey, 'code': c.get('code'), 'uid': c.get('uid'),
                            'name': c.get('name'), 'pack': c.get('packCode'), 'uuid': uuid,
                            'url': burl, 'local': blocal if bst == 'ok' else None,
                            'sha256': bsha,
                            'status': bst})
            counters[bst if bst in counters else 'pending'] = \
                counters.get(bst if bst in counters else 'pending', 0) + 1

    # ── 清单落盘 ────────────────────────────────────────────────────────
    ok = [r for r in records if r['status'] == 'ok']
    manifest = {
        'schemaVersion': 1,
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime()),
        'source': 'DragnCards S3 /cards/Chinese/<uuid>.jpg（cardDb.tsv name+packName 匹配，'
                  'NFD 规范化 + numberInPack 尾数消歧）',
        'note': '安格玛觉醒（TLR 等）S3 无中文卡图为已知事实，对应记录 status=no-dragncards-row，'
                '不阻塞其他批次；status=pending=尚未下载（后续批次）。',
        'quality': args.quality, 'maxSide': args.max_side,
        'summary': {k: v for k, v in sorted(counters.items()) if v},
        'records': records,
    }
    tmp = MAP_JSON + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, MAP_JSON)

    js_records = [{k: r[k] for k in ('kind', 'key', 'uuid', 'url', 'local', 'sha') if k in r}
                  for r in ok]
    module = {
        'schemaVersion': 1,
        'note': '由 scripts/fetch-zh-images.py 生成——手改无效，重跑脚本同步。外挂引用'
                '（阶段2：<script src> 标签，不进 build.py 内联清单）；键 kind+key，'
                'status=ok 的记录才在此表。',
        'generatedAt': manifest['generatedAt'],
        'records': js_records,
    }
    tmp = MAP_JS + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        fh.write('/* 由 scripts/fetch-zh-images.py 从 docs/data/zh-image-map.json 生成（仅 status=ok）。\n')
        fh.write(' * 外挂引用：不进 build.py 内联清单；全局 ZH_IMAGE_MAP 供接线层读取。 */\n')
        fh.write('const ZH_IMAGE_MAP=' + json.dumps(module, ensure_ascii=False).replace('</', '<\\/') + ';\n')
        fh.write('if(typeof module!=="undefined")module.exports=ZH_IMAGE_MAP;\n')
    os.replace(tmp, MAP_JS)

    print(f'records={len(records)} ok={len(ok)} summary={manifest["summary"]}')
    print(f'wrote {MAP_JSON}: {os.path.getsize(MAP_JSON)} bytes')
    print(f'wrote {MAP_JS}: {os.path.getsize(MAP_JS)} bytes')
    size = sum(os.path.getsize(os.path.join(d, f))
               for d in (DIR_PLAYER, DIR_ENC) if os.path.isdir(d) for f in os.listdir(d))
    print(f'assets: cards-zh={len(os.listdir(DIR_PLAYER)) if os.path.isdir(DIR_PLAYER) else 0} '
          f'files, cards-zh-enc={len(os.listdir(DIR_ENC)) if os.path.isdir(DIR_ENC) else 0} '
          f'files, total {size / 1e6:.1f} MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
