# -*- coding: utf-8 -*-
"""nameZh merge layer shared by fetch-card-data.py / fetch-encounter-data.py.

Source data (docs/data/zh-overrides/, provided by team-lead, see README.md):
  * edge-translation.json  EN->CN map (~1068 entries, MIXES card names with
    trait names and pack titles — only entries whose EN string normalizes to a
    card's own name may be used)
  * edge-pack.json         ALeP player packs (银星11弹/13弹): pack.code/name +
    cards {RingsDB numeric code -> {code, name(CN)}}

Matching order (per team-lead spec):
  1. code exact match — edge-pack cards layer, PLAYER pipeline only
  2. normalized English name — norm(EN) = lowercase + strip non-alphanumerics,
     from edge-translation.json

Guards (never overwrite / never guess):
  * a card that already carries a non-empty nameZh is left untouched
    (player pipeline: Core snapshot names; data.js remains authoritative)
  * name-layer hits are skipped when the matched EN string equals one of the
    card's OWN trait tokens (normalized) — that entry is a trait translation,
    not a card name (e.g. "Messenger of the King Allies" style entries)
  * encounter pipeline skips every EN name that data.js carries as a built-in
    entry (cards + quests, e.g. Core 45 encounter cards and the HfG 132-142
    block) — data.js is authoritative for those, nameZh is not written back

Conflict policy: if one normalized EN key maps to several DIFFERENT CN values
inside edge-translation.json the key is excluded from the name layer entirely
and reported; we never pick a winner.

The report (docs/data/zh-merge-report.json) aggregates per-pipeline counts;
each pipeline run updates its own key and preserves the other's.
"""
import io
import json
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZH_DIR = os.path.join(ROOT, 'docs', 'data', 'zh-overrides')
TRANSLATION_FILE = os.path.join(ZH_DIR, 'edge-translation.json')
PACK_FILE = os.path.join(ZH_DIR, 'edge-pack.json')
CORE_TEXT_FILE = os.path.join(ZH_DIR, 'core-text-zh.json')
DATA_JS = os.path.join(ROOT, 'data.js')
REPORT_FILE = os.path.join(ROOT, 'docs', 'data', 'zh-merge-report.json')
# 特质/包名条目混在 translation.json 里；除特质自证守卫外，这里是手工甄别出的
# 已知非卡名键（normalize 后）。目前为空——trait 守卫已覆盖实测全部误命中，
# 出现新误命中时加进这里并同步 README。
NAME_EXCLUDE = set()
LIST_CAP = 200  # report lists are truncated to this many entries


def norm(s):
    """lowercase + strip every non-alphanumeric char (team-lead spec)."""
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def _read_json(path):
    with io.open(path, encoding='utf-8') as fh:
        return json.load(fh)


def load_name_layer():
    """edge-translation.json -> ({normEN: CN}, [conflict entries])."""
    raw = _read_json(TRANSLATION_FILE)
    buckets = {}
    for en, cn in raw.items():
        buckets.setdefault(norm(en), set()).add(cn)
    name_map, conflicts = {}, []
    for key, values in buckets.items():
        if len(values) > 1:
            conflicts.append({'normalizedEn': key, 'candidates': sorted(values)})
        elif key in NAME_EXCLUDE:
            continue
        else:
            name_map[key] = next(iter(values))
    return name_map, conflicts


def load_code_layer():
    """edge-pack.json -> {RingsDB numeric code: CN} (player pipeline only)."""
    packs = _read_json(PACK_FILE)
    code_map = {}
    for _pod, data in packs.items():
        for card in (data.get('cards') or {}).values():
            code_map[str(card.get('code'))] = card.get('name')
    return code_map


def load_datajs_names():
    """Normalized EN names of every built-in data.js entry (cards + quests).

    data.js carries /* comments */ inside an otherwise JSON payload — strip
    them before parsing. Used by the encounter pipeline to NOT write nameZh
    for cards data.js already owns (display layer reads data.js first).
    """
    with io.open(DATA_JS, encoding='utf-8') as fh:
        src = fh.read()
    payload = src[src.find('{'):src.rfind('}') + 1].replace('/*', '\x00').replace('*/', '\x00')
    payload = re.sub(r'\x00(?:[^\x00]|\x00)*?\x00', '', payload)  # balanced block comments
    data = json.loads(payload)
    names = set()
    for entry in list(data.get('cards', [])) + list(data.get('quests', [])):
        en = entry.get('en')
        if en:
            names.add(norm(en))
    return names


def trait_tokens(card):
    """Normalized trait tokens of a card ('Noble. Dwarf.' -> {'noble','dwarf'})."""
    out = set()
    for chunk in re.split(r'[.·]', card.get('traits') or ''):
        token = norm(chunk)
        if token:
            out.add(token)
    return out


def merge(cards, pipeline, code_layer=False, skip_names=frozenset()):
    """Fill empty nameZh in-place; return the per-pipeline report section."""
    name_map, conflicts = load_name_layer()
    code_map = load_code_layer() if code_layer else {}
    stats = {'matchedByCode': 0, 'matchedByName': 0, 'alreadyZh': 0,
             'skippedDatajs': 0, 'skippedAsTrait': 0, 'conflict': 0,
             'unmatched': 0, 'total': len(cards),
             'matchedByCodeList': [], 'matchedByNameList': [], 'unmatchedList': []}
    for c in cards:
        en = c.get('name') or ''
        key = norm(en)
        if c.get('nameZh'):
            stats['alreadyZh'] += 1
            continue
        if code_layer and str(c.get('code')) in code_map:
            c['nameZh'] = code_map[str(c['code'])]
            stats['matchedByCode'] += 1
            if len(stats['matchedByCodeList']) < LIST_CAP:
                stats['matchedByCodeList'].append({'code': c.get('code'), 'name': en,
                                                   'nameZh': c['nameZh']})
            continue
        if not key or key not in name_map:
            if key and key in conflicts_names(conflicts):
                stats['conflict'] += 1
                continue
            stats['unmatched'] += 1
            if len(stats['unmatchedList']) < LIST_CAP:
                stats['unmatchedList'].append({'code': c.get('code'), 'name': en,
                                               'type': c.get('type')})
            continue
        if key in skip_names:
            stats['skippedDatajs'] += 1
            continue
        if key in trait_tokens(c):
            # the matched string equals one of the card's own traits — that
            # translation entry is a trait name, not this card's name
            stats['skippedAsTrait'] += 1
            continue
        c['nameZh'] = name_map[key]
        stats['matchedByName'] += 1
        if len(stats['matchedByNameList']) < LIST_CAP:
            stats['matchedByNameList'].append({'code': c.get('code'), 'name': en,
                                               'nameZh': c['nameZh']})
    stats['translationConflicts'] = conflicts[:LIST_CAP]
    print(f"[zh-merge:{pipeline}] total={stats['total']} "
          f"byCode={stats['matchedByCode']} byName={stats['matchedByName']} "
          f"alreadyZh={stats['alreadyZh']} skipDatajs={stats['skippedDatajs']} "
          f"skipTrait={stats['skippedAsTrait']} conflict={stats['conflict']} "
          f"unmatched={stats['unmatched']}")
    write_report(pipeline, stats)
    return stats


def conflicts_names(conflicts):
    return {c['normalizedEn'] for c in conflicts}


def merge_core_text(cards):
    """向后兼容包装：core-text-zh.json（试点批）走通用入口。"""
    return merge_text_zh(cards, 'core-text-zh.json', 'playerCoreText')


def merge_text_zh(cards, filename, report_key):
    """规则文本译文通用入口（v0.17.7 core-text 试点 / v0.17.8 cycles1 批次2）：
    docs/data/zh-overrides/<filename> 按 code 精确匹配。traitsZh/rulesTextZh
    直写原样保留（markdown 极简标记与 \\n 不做任何加工，渲染归展示层）；
    nameZh 仅「条目带该键且卡现值为空」时回填——Core 快照与 EDGE merge 权威，
    批次2 产物整体无 nameZh 键，此路径自然跳过。多来源时后者覆盖前者字段，
    覆盖数如实记入 overlap 供审计。返回报告节并写入 report。"""
    path = os.path.join(ZH_DIR, filename)
    ct = _read_json(path).get('cards', {}) if os.path.exists(path) else {}
    by_code = {str(c.get('code')): c for c in cards}
    stats = {'source': filename, 'entries': len(ct), 'matched': 0,
             'nameZhBackfilled': 0, 'nameZhKept': 0, 'rulesTextZhFilled': 0,
             'traitsZhFilled': 0, 'overlap': 0, 'unmatched': 0,
             'unmatchedList': [], 'reviewed': False,
             'note': 'code 精确匹配；rulesTextZh/traitsZh 原样直写（** ** 与 \\n '
                     '不加工），nameZh 仅条目带键且卡现值为空时回填；机器辅助译文'
                     '未人工复核（见产物 meta.reviewed）。'}
    for code in sorted(ct, key=lambda x: (len(x), x)):
        e = ct[code] or {}
        c = by_code.get(code)
        if c is None:
            stats['unmatched'] += 1
            if len(stats['unmatchedList']) < LIST_CAP:
                stats['unmatchedList'].append(code)
            continue
        stats['matched'] += 1
        if 'rulesTextZh' in c or 'traitsZh' in c:
            stats['overlap'] += 1  # 多译文来源覆盖同卡，审计用
        # 字段存在即直写（含空串：01013/01028 原文为空，空串与缺失语义不同）
        if 'rulesTextZh' in e:
            c['rulesTextZh'] = e['rulesTextZh'] or ''
            stats['rulesTextZhFilled'] += 1
        if 'traitsZh' in e:
            c['traitsZh'] = e['traitsZh'] or ''
            stats['traitsZhFilled'] += 1
        if e.get('nameZh'):
            if c.get('nameZh'):
                stats['nameZhKept'] += 1
            else:
                c['nameZh'] = e['nameZh']
                stats['nameZhBackfilled'] += 1
    print(f"[zh-merge:{report_key}] entries={stats['entries']} matched={stats['matched']} "
          f"rulesTextZh={stats['rulesTextZhFilled']} traitsZh={stats['traitsZhFilled']} "
          f"nameZhKept={stats['nameZhKept']} nameZhBackfilled={stats['nameZhBackfilled']} "
          f"overlap={stats['overlap']} unmatched={stats['unmatched']}")
    write_report(report_key, stats)
    return stats


def write_report(pipeline, stats):
    report = {}
    if os.path.exists(REPORT_FILE):
        try:
            report = _read_json(REPORT_FILE)
            if not isinstance(report, dict):
                report = {}
        except ValueError:
            report = {}
    report[pipeline] = stats
    report['fetchedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime())
    report['note'] = ('nameZh merge from docs/data/zh-overrides (EDGE 扩展导出，见该目录 '
                      'README.md)；匹配顺序 code 精确（仅玩家卡）→ 规范化英文名；'
                      'data.js 已有中文名/内置条目不覆盖；conflict=translation.json 内'
                      '同一规范名对应多个不同中文值，该键整体排除不采用。')
    tmp = REPORT_FILE + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, REPORT_FILE)
    print(f"[zh-merge:{pipeline}] wrote {REPORT_FILE}")
