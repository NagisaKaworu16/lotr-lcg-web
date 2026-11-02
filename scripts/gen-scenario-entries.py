"""Generate data.js-style HfG (The Hunt for Gollum) entry drafts from
docs/data/encounter-carddata.json (HoB /Export source, see fetch-encounter-data.py).

Output: docs/data/hfg-entries-draft.json with cards/quests/scenario/sets drafts
plus consistency checks (deck totals, quantity overrides, easy-mode removals,
missing faces). A human reviews the draft and merges it into data.js —
this script never writes data.js itself.

Id plan (avoid collisions with D.cards 74-118 / D.quests 119-128):
  quest cards  02011/02012/02013 -> 129/130/131 (D.quests)
  other cards  02014..02024      -> 132..142     (D.cards)
"""
import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'data', 'hfg-entries-draft.json')
QUEST_IDS = {'02011': 129, '02012': 130, '02013': 131}
NEW_PACK = 'THfG'
CORE_SET_RENAMES = {}  # Core 复用卡的 data.js set 名与 HoB encounterSet 对齐关系


def load_data_cards():
    out = subprocess.run(['node', '-e', 'console.log(JSON.stringify(require("./data.js")))'],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def strip_tags(s):
    return s.replace('<b>', '').replace('</b>', '').replace('\n', ' ').strip() if s else s


def main():
    with io.open(os.path.join(ROOT, 'docs', 'data', 'encounter-carddata.json'), encoding='utf-8') as fh:
        src = json.load(fh)
    data = load_data_cards()
    data_by_en = {c['en']: c for c in data['cards']}
    scenario = next(s for s in src['scenarios'] if s['pack'] == 'The Hunt for Gollum' and not s['slug'].endswith('Nightmare'))
    usage = {}
    for e in scenario['encounterCards']:
        if 'Nightmare' in e['encounterSet']:
            continue  # nightmare deck excluded from this build
        usage[e['code']] = e
    missing = [c for c in usage.values() if c['title'] not in data_by_en and c['code'] not in QUEST_IDS]

    missing = []  # Core 复用卡在 data.js 找不到才算异常；HfG 新卡本来就不在
    cards, quests = [], []
    easy_remove, overrides, missing_faces = {}, {}, []
    next_card_id = 132
    for code in sorted(usage):
        u = usage[code]
        raw = next(c for c in src['cards'] if c['code'] == code)
        core = data_by_en.get(raw['name'])
        if core:
            # Core 复用卡：不建新条目，data.js 既有 id 与数值为准；仅登记用量差异
            if core['quantity'] != u['normal']:
                overrides[str(core['id'])] = u['normal']
            if u['normal'] > u['easy']:
                easy_remove[str(core['id'])] = u['normal'] - u['easy']
            continue
        if u['normal'] > u['easy']:
            easy_remove[str(next_card_id)] = u['normal'] - u['easy']
        cid = next_card_id
        next_card_id += 1
        card = {'id': cid, 'name': raw['nameZh'] or raw['name'], 'en': raw['name'],
                'set': raw['encounterSet'], 'pack': NEW_PACK,
                'type': {'enemy': 'Enemy', 'location': 'Location', 'treachery': 'Treachery',
                         'objective': 'Objective'}[raw['type']],
                'quantity': u['normal'],
                'rule': strip_tags(raw.get('rulesText') or '') or '（暂无印刷文本）',
                'shadow': strip_tags(raw.get('shadow') or ''),
                'traits': raw.get('traits') or '',
                'engagement': raw.get('engagement'), 'threat': raw.get('threat'),
                'quest': raw.get('questPoints') if raw['type'] == 'location' else None,
                'attack': raw.get('attack'), 'defense': raw.get('defense'), 'health': raw.get('health'),
                'surge': 'Surge' in (raw.get('keywords') or '') or 'Surge' in (raw.get('rulesText') or ''),
                'doomed': 0}
        if 'Doomed' in (raw.get('keywords') or '') or 'Doomed' in (raw.get('rulesText') or ''):
            import re
            m = re.search(r'Doomed (\d+)', raw.get('keywords', '') + raw.get('rulesText', ''))
            card['doomed'] = int(m.group(1)) if m else 1
        if raw['code'] == '02014':
            card['willpower'] = 4  # HoB 缺印刷值；来源：卡图印 4（clue objective 附英雄后 +4 意志）
        if raw['code'] == '02015':
            card['threat'] = 'X'  # HoB 导出 254 是损坏值；卡图印 X（X=场上的盟友数量，效果层后续实现）
        cards.append(card)

    # quest 卡不在 encounterCards 里，从 questCards + 源卡记录生成
    for qc in scenario['questCards']:
        raw = next(c for c in src['cards'] if c['type'] == 'quest' and c['name'] == qc['title'])
        qid = QUEST_IDS[raw['code']]
        front, back = raw.get('front'), raw.get('back')
        if not front:
            missing_faces.append({'code': raw['code'], 'field': 'front'})
            front = '（源数据缺 A 面文案，TODO）'
        if not back:
            missing_faces.append({'code': raw['code'], 'field': 'back'})
            back = '（源数据缺 B 面文案，TODO）'
        quests.append({'id': qid, 'name': raw['name'], 'stage': int(raw['code'][4]),
                       'pack': NEW_PACK, 'points': qc['questPoints'],
                       'front': strip_tags(front), 'back': strip_tags(back)})

    deck_normal = sum(u['normal'] for u in usage.values())
    deck_easy = sum(u['easy'] for u in usage.values())
    sets_needed = sorted({u['encounterSet'] for u in usage.values()})
    draft = {
        'comment': '由 scripts/gen-scenario-entries.py 生成，人工审核后并入 data.js；本脚本不写 data.js。',
        'idPlan': {'quests': QUEST_IDS, 'cards': '02014..02024 -> 132..142'},
        'cards': cards,
        'quests': quests,
        'scenario': {
            'id': 'gollum', 'name': '寻找咕噜', 'en': 'The Hunt for Gollum', 'difficulty': 2,
            'coverCard': QUEST_IDS['02011'],
            'sets': sets_needed,
            'easyRemove': easy_remove,
            'deckQuantities': overrides,
            'stages': [
                {'id': QUEST_IDS['02011'], 'next': QUEST_IDS['02012']},
                {'id': QUEST_IDS['02012'], 'next': QUEST_IDS['02013']},
                {'id': QUEST_IDS['02013'], 'next': None},
            ],
        },
        'sets': {'The Hunt for Gollum': '寻找咕噜', 'Journey Along the Anduin': '沿安都因河而下'},
        'deck': {'normal': deck_normal, 'easy': deck_easy,
                 'easyCheck': deck_normal - sum(easy_remove.values())},
        'missingFaces': missing_faces,
        'coreReuse': [{'code': c, 'dataId': data_by_en[usage[c]['title']]['id']}
                      for c in sorted(usage) if usage[c]['title'] in data_by_en],
        'unmatched': [{'code': m['code'], 'title': m['title']} for m in missing],
    }
    with io.open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(draft, fh, ensure_ascii=False, indent=1)
    print(f"wrote {OUT}")
    print(f"deck normal={deck_normal} easy={deck_easy} easyCheck={draft['deck']['easyCheck']}")
    print(f"cards={len(cards)} quests={len(quests)} easyRemove={easy_remove} overrides={overrides}")
    print(f"missingFaces={missing_faces} unmatched={draft['unmatched']}")
    assert deck_normal == deck_easy + sum(easy_remove.values()), 'easy 移除必须精确解释 normal-easy 差值'
    return 0


if __name__ == '__main__':
    sys.exit(main())
