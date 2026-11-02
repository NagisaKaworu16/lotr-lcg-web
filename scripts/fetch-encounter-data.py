"""Fetch encounter-side card metadata (enemies / locations / treacheries /
objectives / quest cards) for the offline LOTR LCG build.

WHY NOT RingsDB (verified 2026-11-02):
  * https://ringsdb.com/api/public/cards/          -> 1315 cards, player side ONLY
    (hero/ally/attachment/event/treasure/player-side-quest/contract/player-objective)
  * https://ringsdb.com/api/public/cards/{pack}.json -> same, per pack (HfG = 10 player cards)
  * https://ringsdb.com/api/public/scenario/{id}.json -> counters only, NO card details
  RingsDB simply does not model encounter cards. Third-party tooling confirms this:
  silhouette-card-maker's ringsdb_scenario_url mode fetches the scenario *name* from
  RingsDB and then resolves every encounter/quest card from Hall of Beorn.

DATA SOURCE (Hall of Beorn /Export — unpublished but confirmed working, backed by
its open-source repo github.com/danpoage/hall-of-beorn ExportController.cs):
  GET /Export/Cards/OFFICIAL        -> ALL 5313 official cards (player + encounter),
                                       one bulk payload (~5 MB); the {set_type} path
                                       segment is IGNORED by the server (THfG and ALL
                                       both return the full catalog), so we cache the
                                       bulk payload once and filter by pack_code.
  GET /Export/Scenarios             -> scenario list (Title/Slug/Product)
  GET /Export/Scenarios/{slug}      -> QuestCards (Front/Back Stats: StageNumber,
                                       QuestPoints) + ScenarioCards (Slug/Title/
                                       EncounterSet + Easy/Normal/NightmareQuantity)
  Endpoints are slow (measured 25-30 s), hence generous timeouts and incremental cache.

PACK CODE DIFFERS FROM RingsDB (mapping below):
  RingsDB player packs use HfG; Hall of Beorn encounter packs use THfG
  (and THfGN for Nightmare). Core is the same on both sides. Extend
  PACK_ALIASES when onboarding more packs after checking /Export data.

FIELD MAPPING (HoB -> camelCase output; encounter semantics differ from the
player-side `threat` field in fetch-card-data.py):
  engagement_cost -> engagement   enemy only: engagement cost (string digits -> int)
  threat_strength -> threat       enemy/location: ENCOUNTER threat (NOT hero starting
                                  threat, which HoB carries in `threat` for heroes)
  threat          -> (dropped)    hero starting threat, meaningless here
  quest_points    -> questPoints  quest (B-side) / objective locations
  shadow          -> shadow       shadow effect HTML (enemy only)
  keywords        -> keywords     e.g. "Archery 1." (player cards usually have none)
  victory         -> victory      victory points
  text            -> rulesText    HTML rich text — kept verbatim, same treatment as
                                  player-carddata.json (consumers render/strip HTML)
  Quest stage numbers / per-side QuestPoints come from the scenario endpoint's
  QuestCards.Front/Back.Stats (merged into quest cards by title).

Usage:
    python scripts/fetch-encounter-data.py --proxy http://127.0.0.1:7899              # HfG pilot
    python scripts/fetch-encounter-data.py --proxy ... --packs HfG,Core               # more packs
    python scripts/fetch-encounter-data.py --proxy ... --force                        # refetch

Output:
  docs/data/cache/enc-catalog-OFFICIAL.json   bulk card catalog (incremental, not committed)
  docs/data/cache/enc-scenario-{slug}.json    per-scenario payloads (incremental, not committed)
  docs/data/encounter-carddata.json           projected dataset (camelCase)
  docs/data/encounter-carddata.js             same data as a JS module (file:// offline;
                                              NOT wired into build.py yet — engine hookup
                                              is a follow-up task)
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZH_TITLES = os.path.join(ROOT, 'product-zh.json')
OUT_DIR = os.path.join(ROOT, 'docs', 'data')
CACHE_DIR = os.path.join(OUT_DIR, 'cache')
OUT_FILE = os.path.join(OUT_DIR, 'encounter-carddata.json')
OUT_MODULE = os.path.join(OUT_DIR, 'encounter-carddata.js')
SCENARIOS_URL = 'https://hallofbeorn.com/Export/Scenarios'
SCENARIO_URL = 'https://hallofbeorn.com/Export/Scenarios/{slug}'
CARDS_URL = 'https://hallofbeorn.com/Export/Cards/OFFICIAL'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36'
# RingsDB player pack code -> Hall of Beorn encounter pack code. Core matches on
# both sides; THfG (Hunt for Gollum) is the known divergence. When adding packs,
# verify against the bulk catalog's pack_code values first.
PACK_ALIASES = {'HfG': 'THfG'}
# RingsDB-side card types we must NOT pull in (encounter-carddata is encounter-only;
# the 10 HfG player cards already live in player-carddata.json).
PLAYER_TYPES = {'hero', 'ally', 'attachment', 'event', 'treasure',
                'player-side-quest', 'contract', 'player-objective'}
# Output field order (camelCase, aligned with the player-carddata.json style;
# encounter-specific stats extend the shared core).
CARD_FIELDS = ('code,name,nameZh,type,typeName,sphere,sphereName,cost,engagement,threat,'
               'willpower,attack,defense,health,questPoints,victory,isUnique,quantity,'
               'encounterSet,traits,keywords,shadow,rulesText,flavor,hasErrata,illustrator,'
               'packCode,packName,packNameZh,position,imagesrc,sourceUrl,stage,'
               'scenarioQuantity').split(',')


def read_text(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def http_json(url, proxy, retries=2, timeout=120):
    """Hall of Beorn /Export is slow (25-30 s measured); 120 s timeout."""
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
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'{url}: {last}')


def cached_fetch(url, cache_path, proxy, retries, force=False):
    if os.path.exists(cache_path) and not force:
        try:
            data = json.loads(read_text(cache_path))
            if data:
                print(f'  cache hit: {os.path.basename(cache_path)}')
                return data
        except ValueError:
            pass
    data = http_json(url, proxy, retries)
    # Unrecognized HoB scenario slugs return HTTP 200 with a bare JSON *string*
    # ("Scenario ... not found") — reject that shape here, not downstream.
    if not isinstance(data, (list, dict)):
        raise RuntimeError(f'{url}: unexpected payload: {str(data)[:120]}')
    with io.open(cache_path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False)
    return data


def num(value):
    """HoB stat fields mix ints and digit strings ('12'); normalize digit strings
    to int, keep 'X'/'-' as-is, keep None as None."""
    if isinstance(value, str) and re.fullmatch(r'\d+', value or ''):
        return int(value)
    return value


def zh_pack_titles():
    try:
        return json.loads(read_text(ZH_TITLES)).get('titles', {})
    except (OSError, ValueError):
        return {}


def project(card, zh_titles):
    return {
        'code': card.get('code'),
        'name': card.get('name'),
        'nameZh': '',  # no Chinese encounter-card source yet (Core snapshot is player-side only)
        'type': card.get('type_code'),
        'typeName': card.get('type_name'),
        'sphere': card.get('sphere_code'),
        'sphereName': card.get('sphere_name'),
        'cost': num(card.get('cost')),
        'engagement': num(card.get('engagement_cost')),  # enemy only
        'threat': num(card.get('threat_strength')),      # enemy/location encounter threat
        'willpower': num(card.get('willpower')),
        'attack': num(card.get('attack')),
        'defense': num(card.get('defense')),
        'health': num(card.get('health')),
        'questPoints': num(card.get('quest_points')),
        'victory': num(card.get('victory')),
        'isUnique': card.get('is_unique'),
        'quantity': card.get('quantity'),
        'encounterSet': card.get('encounter_set'),
        'traits': card.get('traits') or '',
        'keywords': card.get('keywords') or '',
        'shadow': card.get('shadow') or '',
        'rulesText': card.get('text') or '',
        'flavor': card.get('flavor') or '',
        'hasErrata': card.get('has_errata'),
        'illustrator': card.get('illustrator'),
        'packCode': card.get('pack_code'),
        'packName': card.get('pack_name'),
        'packNameZh': zh_titles.get(card.get('pack_name'), ''),
        'position': card.get('position'),
        'imagesrc': card.get('imagesrc'),
        'sourceUrl': card.get('url'),
        'stage': None,            # quest cards: ['1A', '1B'] from the scenario endpoint
        'scenarioQuantity': None, # {easy, normal, nightmare} when the scenario uses this card
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--proxy', default=os.environ.get('LOTR_PROXY'), help='http://127.0.0.1:7899 (mainland direct connections die with SIGTERM)')
    ap.add_argument('--packs', default='HfG', help='comma-separated RingsDB-style pack codes (default HfG; extendable: Core, ...)')
    ap.add_argument('--retries', type=int, default=2)
    ap.add_argument('--force', action='store_true', help='refetch cached payloads')
    ap.add_argument('--no-project', action='store_true', help='refresh cache only, skip writing the dataset')
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    zh_titles = zh_pack_titles()

    # --- 1. bulk catalog (single ~5 MB payload; per-pack server-side filtering
    #        does not exist — /Export/Cards/{anything} returns the same list) ---
    print('fetching Hall of Beorn bulk card catalog (slow, ~30 s)...')
    catalog = cached_fetch(CARDS_URL, os.path.join(CACHE_DIR, 'enc-catalog-OFFICIAL.json'),
                           args.proxy, args.retries, args.force)
    by_slug = {}
    for card in catalog:
        url = card.get('url') or ''
        if url:
            by_slug[url.rsplit('/', 1)[-1]] = card
    pack_names = {}
    for card in catalog:
        pack_names.setdefault(card.get('pack_code'), card.get('pack_name'))

    # --- 2. scenario list, for slug lookup by product name ---
    scenarios_list = cached_fetch(SCENARIOS_URL, os.path.join(CACHE_DIR, 'enc-scenario-list.json'),
                                  args.proxy, args.retries, args.force)

    wanted = [x.strip() for x in args.packs.split(',') if x.strip()]
    merged, order = {}, []
    scenario_summaries = []
    failed = []

    for pack in wanted:
        hob_code = PACK_ALIASES.get(pack, pack)
        pack_name = pack_names.get(hob_code)
        if not pack_name:
            failed.append(f'{pack} (no HoB pack_code {hob_code})')
            continue
        print(f'pack {pack} -> HoB {hob_code} ({pack_name})')

        own = [c for c in catalog
               if c.get('pack_code') == hob_code and c.get('type_code') not in PLAYER_TYPES]
        types = {}
        for c in own:
            types[c['type_code']] = types.get(c['type_code'], 0) + 1
        print(f'  encounter-side cards: {len(own)}  types: {types}')

        # --- 3. scenarios whose Product is this pack: quest-card stats + per-mode
        #        encounter quantities; reusable Core cards get pulled in too ---
        pack_scenarios = [s for s in scenarios_list if s.get('Product') == pack_name]
        for meta in pack_scenarios:
            slug = meta.get('Slug')
            print(f'  scenario: {meta.get("Title")} ({slug})')
            scen = cached_fetch(SCENARIO_URL.format(slug=slug),
                                os.path.join(CACHE_DIR, f'enc-scenario-{slug}.json'),
                                args.proxy, args.retries, args.force)
            if not isinstance(scen, dict):
                failed.append(f'{slug} (scenario payload not an object)')
                continue

            quests = scen.get('QuestCards') or []
            quest_by_title = {q.get('Title'): q for q in quests}
            quest_stats = []
            for q in quests:
                front, back = q.get('Front') or {}, q.get('Back') or {}
                quest_stats.append({
                    'title': q.get('Title'),
                    'stage': [front.get('Stats', {}).get('StageNumber'),
                              (back.get('Stats') or {}).get('StageNumber')],
                    'questPoints': num((back.get('Stats') or {}).get('QuestPoints')),
                })

            # ScenarioCards carry Slug + per-mode quantity only; resolve details
            # against the bulk catalog. Nightmare-set cards ride along in the
            # payload — HoB reports the SAME quantity for all three modes on
            # them (verified: Dark Pools 3/3/3), i.e. the quantities describe
            # nightmare-mode composition. They must NOT enter the normal-mode
            # dataset, and easy/normal totals must exclude them.
            scenario_cards = []
            for sc in scen.get('ScenarioCards') or []:
                detail = by_slug.get(sc.get('Slug', ''))
                if not detail:
                    failed.append(f'{slug}: unknown card slug {sc.get("Slug")}')
                    continue
                quantities = {m: sc.get(f'{m.capitalize()}Quantity') or 0
                              for m in ('easy', 'normal', 'nightmare')}
                is_nightmare = (sc.get('EncounterSet') or '').endswith('Nightmare')
                scenario_cards.append({
                    'slug': sc.get('Slug'),
                    'title': sc.get('Title'),
                    'encounterSet': sc.get('EncounterSet'),
                    'packCode': detail.get('pack_code'),
                    'code': detail.get('code'),
                    'easy': quantities['easy'],
                    'normal': quantities['normal'],
                    'nightmare': quantities['nightmare'],
                    'nightmareSet': is_nightmare,
                })
                if (quantities['normal'] > 0 and not is_nightmare
                        and sc['Slug'] not in merged):
                    merged[sc['Slug']] = project(detail, zh_titles)
                    merged[sc['Slug']]['scenarioQuantity'] = quantities
                    order.append(sc['Slug'])

            # merge the pack's own encounter-side cards (dedupe by HoB slug)
            for c in own:
                url = c.get('url') or ''
                slug = url.rsplit('/', 1)[-1] if url else c.get('code')
                if slug in merged:
                    continue
                merged[slug] = project(c, zh_titles)
                order.append(slug)

            # quest-card stage/questPoints: match by title onto the catalog card
            for title, q in quest_by_title.items():
                url = (by_slug.get(q.get('Slug', '')) or {}).get('url') or ''
                slug = url.rsplit('/', 1)[-1] if url else None
                if slug and slug in merged:
                    front = q.get('Front') or {}
                    back = q.get('Back') or {}
                    merged[slug]['stage'] = [front.get('Stats', {}).get('StageNumber'),
                                             (back.get('Stats') or {}).get('StageNumber')]
                    if merged[slug]['questPoints'] is None:
                        merged[slug]['questPoints'] = num((back.get('Stats') or {}).get('QuestPoints'))

            scenario_summaries.append({
                'slug': slug,
                'name': scen.get('Title'),
                'pack': scen.get('Product'),
                'questCards': quest_stats,
                'encounterCards': scenario_cards,
                # HoB reports identical easy/normal/nightmare quantities on
                # nightmare-set cards, so per-mode totals are only meaningful
                # over the non-nightmare sets; nightmare deck composition is
                # left for a dedicated nightmare-support pass.
                'totals': {m: sum(c[m] for c in scenario_cards if not c['nightmareSet'])
                           for m in ('easy', 'normal')},
                'nightmareSetCards': sum(1 for c in scenario_cards if c['nightmareSet']),
            })

    cards = [merged[s] for s in order]
    print(f'\nmerged unique encounter cards: {len(cards)}; failed: {failed or "none"}')
    if args.no_project or not cards:
        return

    cards.sort(key=lambda c: (c['packCode'], c['position'] or 0, c['code']))
    # field-order sanity: projection must stay aligned with CARD_FIELDS
    for c in cards:
        missing = [f for f in CARD_FIELDS if f not in c]
        extra = [f for f in c if f not in CARD_FIELDS]
        if missing or extra:
            raise SystemExit(f'field projection drift for {c.get("code")}: missing={missing} extra={extra}')

    dataset = {
        'schemaVersion': 1,
        'source': 'Hall of Beorn',
        'endpoint': 'https://hallofbeorn.com/Export/{Cards/OFFICIAL,Scenarios/{slug}}',
        'ringsdbNote': 'RingsDB API carries no encounter cards (verified 2026-11-02); '
                       'pack codes differ: RingsDB HfG = Hall of Beorn THfG.',
        'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime()),
        'cardCount': len(cards),
        'packCount': len({c['packCode'] for c in cards}),
        'packs': [{'requested': p, 'hobCode': PACK_ALIASES.get(p, p)} for p in wanted
                  if PACK_ALIASES.get(p, p) in pack_names],
        'scenarios': scenario_summaries,
        'cards': cards,
    }
    tmp = OUT_FILE + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(dataset, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT_FILE)
    # JS module for file:// offline use; '<' escaped so '</' can never close a
    # <script> block early (same convention as player-carddata.js). NOT wired
    # into build.py yet — engine hookup is a follow-up task.
    module_text = ('/* 由 scripts/fetch-encounter-data.py 从 docs/data/encounter-carddata.json 生成——手改无效，重跑脚本同步。 */\n'
                   'const ENCOUNTER_CARDS_DATA=' + json.dumps(dataset, ensure_ascii=False).replace('</', '<\\/') + ';\n'
                   'if(typeof module!=="undefined")module.exports=ENCOUNTER_CARDS_DATA;\n')
    tmp_m = OUT_MODULE + '.tmp'
    with io.open(tmp_m, 'w', encoding='utf-8') as fh:
        fh.write(module_text)
    os.replace(tmp_m, OUT_MODULE)

    # ---------------- validation report ----------------
    print(f'wrote {OUT_FILE}: {os.path.getsize(OUT_FILE)} bytes')
    print(f'wrote {OUT_MODULE}: {os.path.getsize(OUT_MODULE)} bytes')
    types = {}
    for c in cards:
        types[c['type']] = types.get(c['type'], 0) + 1
    print(f'cards={len(cards)} packs={dataset["packCount"]} types={types}')

    print('\n-- field coverage (non-empty / total) --')
    stat_fields = ['engagement', 'threat', 'willpower', 'attack', 'defense', 'health',
                   'questPoints', 'victory', 'shadow', 'keywords', 'traits', 'rulesText', 'quantity']
    for f in stat_fields:
        n = sum(1 for c in cards if c.get(f) not in (None, ''))
        print(f'  {f}: {n}/{len(cards)}')

    print('\n-- numeric spot checks --')
    problems = []
    for c in cards:
        if c['type'] == 'enemy':
            for f in ('engagement', 'threat', 'attack', 'defense', 'health'):
                if c.get(f) is None:
                    problems.append(f'enemy {c["code"]} {c["name"]}: missing {f}')
        if c['type'] == 'location' and c.get('threat') is None:
            problems.append(f'location {c["code"]} {c["name"]}: missing threat')
        if c['type'] == 'quest':
            if not c.get('stage'):
                problems.append(f'quest {c["code"]} {c["name"]}: missing stage (scenario merge failed?)')
            if c.get('questPoints') is None:
                problems.append(f'quest {c["code"]} {c["name"]}: missing questPoints')
        if c['type'] in ('objective', 'objective-ally') and c.get('willpower') is None:
            # HoB data gap (e.g. Signs of Gollum 02014): printed willpower exists
            # on the physical card but the export omits it — report, never guess.
            problems.append(f'{c["type"]} {c["code"]} {c["name"]}: missing willpower (HoB export gap)')
    if problems:
        print('  MISSING CORE FIELDS:')
        for p in problems:
            print('   !', p)
    else:
        print('  all enemy engagement/threat/attack/defense/health present;'
              ' location threat present; quest stage/questPoints present')
    for s in scenario_summaries:
        print(f'scenario {s["name"]}: quest stages='
              f'{[(q["stage"], q["questPoints"]) for q in s["questCards"]]} '
              f'encounter totals={s["totals"]} '
              f'nightmareSetCards={s["nightmareSetCards"]}')


if __name__ == '__main__':
    main()
