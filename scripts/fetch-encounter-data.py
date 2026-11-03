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
import urllib.parse
import urllib.request

import zh_merge  # shared nameZh merge layer (scripts/ dir is sys.path[0])

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
# Full encounter-side projection (--packs all): the 15 encounter-side type_code
# values present in the HoB bulk export (verified 2026-11-02, 3734 cards across
# 165 pack codes). Research-group breakdown for batch validation:
#   location 981 / enemy 890 / treachery 811 / quest 518 / objective 173 /
#   campaign 74 / nightmare-setup 72 / encounter-side-quest 69 /
#   objective-ally 53 / ship-objective 31 / ship-enemy 27 / treasure (bulk) 18 /
#   objective-location 8 / gencon-setup 5 / objective-hero 4
# Angmar Awakened cycle packs verified IN FULL under their own codes:
#   TLR 59 encounter-side / AtE 20 / DoCG 16 / TGoF 18 / TotD 15 /
#   TWoE 17 / TTiTD 18 / TWoEN+TTiTDN 8+8 (nightmare) / AAC 18 (campaign) / AAH 0.
#   NOTE: the research brief's "WoE/TiTD possibly missing" was a code mixup —
#   the real HoB codes are TWoE/TTiTD and both are complete.
ENCOUNTER_TYPES = {'location', 'enemy', 'treachery', 'quest', 'objective',
                   'campaign', 'nightmare-setup', 'encounter-side-quest',
                   'objective-ally', 'ship-objective', 'ship-enemy', 'treasure',
                   'objective-location', 'gencon-setup', 'objective-hero'}
# RingsDB-side card types we must NOT pull in (encounter-carddata is encounter-only;
# the 10 HfG player cards already live in player-carddata.json).
PLAYER_TYPES = {'hero', 'ally', 'attachment', 'event', 'treasure',
                'player-side-quest', 'contract', 'player-objective'}
# Boons/burdens (treasure cards of the three campaign expansions) come from the
# local RingsDB per-pack cache — zero network cost, richer text than HoB for
# these packs; marked with card-level source='ringsdb'.
RINGSDB_TREASURE_PACKS = ('AACE', 'DCCE', 'EMCE')
# Output field order (camelCase, aligned with the player-carddata.json style;
# encounter-specific stats extend the shared core). NOTE: `flavor` was dropped
# when the file went full-catalog (~5 MB, served as an external <script> tag —
# flavor text alone was 10-15% of the payload and nothing in the engine needs
# it; re-add via this list + project() if a future UI wants narrative text).
# `source` distinguishes hallofbeorn (bulk) from ringsdb (boons/burdens).
# `nightmareSet` flags cards belonging to a Nightmare encounter set so display
# code can keep them out of normal-mode decks (they ARE part of this dataset).
# `uid` is the HoB detail-page slug (ringsdb rows: 'ringsdb-<code>') — the ONLY
# fully unique key: (packCode, code) collides 103× across the full catalog
# (85 groups are distinct cards sharing a printed code — HoB numbering bug;
# 18 groups are same-name duplicate rows / campaign variants), and bare code
# collides far more often. Always key lookups on uid.
CARD_FIELDS = ('code,name,nameZh,type,typeName,sphere,sphereName,cost,engagement,threat,'
               'willpower,attack,defense,health,questPoints,victory,isUnique,quantity,'
               'encounterSet,traits,keywords,shadow,rulesText,front,back,hasErrata,'
               'illustrator,packCode,packName,packNameZh,position,imagesrc,sourceUrl,'
               'source,nightmareSet,stage,scenarioQuantity,uid').split(',')


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


def split_sides(text):
    """Split double-sided quest rulesText at the structured '<b>Side A</b>' /
    '<b>Side B</b>' markers, dropping the markers themselves. Returns None when
    the text carries no marker pair — HoB's quest text is only partially marked
    (verified: 10/13 of the HfG+Core quest cards) and its /Export/Scenarios
    QuestCards.Text is no better (Front/Back assignment is inconsistent across
    cards and misses whole sides), so unmarked cards stay unsplit and get
    reported as missing rather than guessed at."""
    a, b = '<b>Side A</b>', '<b>Side B</b>'
    if a in text and b in text:
        front, back = text.split(a, 1)[1].split(b, 1)
        return front.strip(), back.strip()
    return None


def is_nightmare(card):
    return (card.get('type_code') == 'nightmare-setup'
            or (card.get('encounter_set') or '').endswith('Nightmare'))


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
        'front': None,   # quest cards: side A text (split from rulesText markers)
        'back': None,    # quest cards: side B text; None/'' = source lacks the side
        'hasErrata': card.get('has_errata'),
        'illustrator': card.get('illustrator'),
        'packCode': card.get('pack_code'),
        'packName': card.get('pack_name'),
        'packNameZh': zh_titles.get(card.get('pack_name'), ''),
        'position': card.get('position'),
        'imagesrc': card.get('imagesrc'),
        'sourceUrl': card.get('url'),
        'source': 'hallofbeorn',
        'nightmareSet': is_nightmare(card),
        'uid': ((card.get('url') or '').rsplit('/', 1)[-1]
                or f"{card.get('pack_code')}-{card.get('code')}-{card.get('position')}"),
        'stage': None,            # quest cards: ['1A', '1B'] from the scenario endpoint
        'scenarioQuantity': None, # {easy, normal, nightmare} when the scenario uses this card
    }


def project_ringsdb(card, zh_titles):
    """Boons/burdens (campaign-expansion treasure cards) from the RingsDB cache.
    Same output shape as project(), stats fields left empty (treasure cards
    carry none), source tagged 'ringsdb'."""
    return {
        'code': card.get('code'),
        'name': card.get('name'),
        'nameZh': '',
        'type': card.get('type_code'),
        'typeName': card.get('type_name'),
        'sphere': card.get('sphere_code'),
        'sphereName': card.get('sphere_name'),
        'cost': num(card.get('cost')),
        'engagement': None,
        'threat': None,
        'willpower': None,
        'attack': None,
        'defense': None,
        'health': None,
        'questPoints': None,
        'victory': None,
        'isUnique': card.get('is_unique'),
        'quantity': card.get('quantity'),
        'encounterSet': None,
        'traits': card.get('traits') or '',
        'keywords': '',
        'shadow': '',
        'rulesText': card.get('text') or '',
        'front': None,
        'back': None,
        'hasErrata': card.get('has_errata'),
        'illustrator': card.get('illustrator'),
        'packCode': card.get('pack_code'),
        'packName': card.get('pack_name'),
        'packNameZh': zh_titles.get(card.get('pack_name'), ''),
        'position': card.get('position'),
        'imagesrc': None,
        'sourceUrl': card.get('url'),
        'source': 'ringsdb',
        'nightmareSet': False,
        'uid': 'ringsdb-' + str(card.get('code')),
        'stage': None,
        'scenarioQuantity': None,
    }


def parse_scenario(scen, by_slug, merged, order, failed, merge_cards, zh_titles):
    """Resolve one /Export/Scenarios payload into (quest_stats, scenario_cards,
    quests). With merge_cards=True (per-pack mode) normal-quantity non-nightmare
    cards get pulled into merged; in --packs all mode every card is already
    present, so this only builds the per-scenario quantity rows."""
    quests = scen.get('QuestCards') or []
    quest_stats = []
    for q in quests:
        front, back = q.get('Front') or {}, q.get('Back') or {}
        quest_stats.append({
            'title': q.get('Title'),
            'stage': [front.get('Stats', {}).get('StageNumber'),
                      (back.get('Stats') or {}).get('StageNumber')],
            'questPoints': num((back.get('Stats') or {}).get('QuestPoints')),
        })

    # ScenarioCards carry Slug + per-mode quantity only; resolve details against
    # the bulk catalog. Nightmare-set cards ride along in the payload — HoB
    # reports the SAME quantity for all three modes on them (verified: Dark
    # Pools 3/3/3), i.e. the quantities describe nightmare-mode composition.
    # They must NOT enter the normal-mode dataset, and easy/normal totals must
    # exclude them. A slug missing from the bulk catalog is a real reconciliation
    # gap (e.g. ALeP homebrew scenarios) — recorded, never guessed.
    scenario_cards = []
    for sc in scen.get('ScenarioCards') or []:
        detail = by_slug.get(sc.get('Slug', ''))
        if not detail:
            failed.append(f'{scen.get("Slug")}: unknown card slug {sc.get("Slug")}')
            continue
        quantities = {m: sc.get(f'{m.capitalize()}Quantity') or 0
                      for m in ('easy', 'normal', 'nightmare')}
        nightmare_set = (sc.get('EncounterSet') or '').endswith('Nightmare')
        scenario_cards.append({
            'slug': sc.get('Slug'),
            'title': sc.get('Title'),
            'encounterSet': sc.get('EncounterSet'),
            'packCode': detail.get('pack_code'),
            'code': detail.get('code'),
            'easy': quantities['easy'],
            'normal': quantities['normal'],
            'nightmare': quantities['nightmare'],
            'nightmareSet': nightmare_set,
        })
        if (merge_cards and quantities['normal'] > 0 and not nightmare_set
                and sc['Slug'] not in merged):
            merged[sc['Slug']] = project(detail, zh_titles)
            order.append(sc['Slug'])
    return quest_stats, scenario_cards, quests


def finalize_quests(merged, quests):
    """Stage/questPoints pairing onto quest cards already in merged.
    Same-titled quest pairs exist by design (Core 01121/01122 both
    "A Chosen Path" — the stage-3 player choice), so walk the ordered
    QuestCards list and hand stats out in order to same-titled cards
    (position order); a title dict would silently drop the first."""
    used = {}
    for q in quests:
        title = q.get('Title')
        front = q.get('Front') or {}
        back = q.get('Back') or {}
        stats = (front.get('Stats', {}).get('StageNumber'),
                 (back.get('Stats') or {}).get('StageNumber'))
        qp = num((back.get('Stats') or {}).get('QuestPoints'))
        # unassigned-first: the same quest title often exists as several
        # reprints (Core 01119 + RevCore 01119; the Campaign scenarios process
        # before their base versions), and a plain position sort would hand
        # every scenario's stats to the same first row, starving the rest.
        candidates = sorted(
            (c for c in merged.values() if c['type'] == 'quest' and c['name'] == title),
            key=lambda c: (c['stage'] is not None,
                           c['position'] if c['position'] is not None else 0,
                           c['code'] or ''))
        idx = used.get(title, 0)
        used[title] = idx + 1
        if idx < len(candidates):
            candidates[idx]['stage'] = stats
            if candidates[idx]['questPoints'] is None:
                candidates[idx]['questPoints'] = qp


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--proxy', default=os.environ.get('LOTR_PROXY'), help='http://127.0.0.1:7899 (mainland direct connections die with SIGTERM)')
    ap.add_argument('--packs', default='HfG', help='comma-separated RingsDB-style pack codes (default HfG; extendable: Core, ...) or "all" for the full encounter-side projection')
    ap.add_argument('--retries', type=int, default=2)
    ap.add_argument('--force', action='store_true', help='refetch cached payloads')
    ap.add_argument('--no-project', action='store_true', help='refresh cache only, skip writing the dataset')
    ap.add_argument('--scenarios-only', action='store_true',
                    help='fetch/persist ALL 154 /Export/Scenarios/{slug} payloads into the '
                         'incremental cache, then exit (network-heavy: ~25-30 s per slug, '
                         '~70 min cold; run in the background, dataset projection follows later)')
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

    if args.scenarios_only:
        # Warm the incremental cache for every slug, then exit. Each payload is
        # cached at enc-scenario-{slug}.json so the projection step never needs
        # the network again. Progress is flushed line-by-line so the background
        # log shows where a run stopped if it is interrupted.
        total = len(scenarios_list)
        done = skipped = failed = 0
        for i, meta in enumerate(scenarios_list, 1):
            slug = meta.get('Slug')
            if not slug:
                continue
            cache_path = os.path.join(CACHE_DIR, f'enc-scenario-{slug}.json')
            if os.path.exists(cache_path) and not args.force:
                try:
                    if json.loads(read_text(cache_path)):
                        skipped += 1
                        continue
                except ValueError:
                    pass
            try:
                # some slugs carry non-ASCII (The-Caves-of-Nibin-Dûm-(Campaign))
                # — percent-encode the path segment or urllib dies on ascii encode
                cached_fetch(SCENARIO_URL.format(slug=urllib.parse.quote(slug)), cache_path,
                             args.proxy, args.retries, args.force)
                done += 1
                print(f'[{i}/{total}] fetched {slug}', flush=True)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f'[{i}/{total}] FAILED {slug}: {exc}', flush=True)
            time.sleep(1.0)
        print(f'scenarios-only done: fetched={done} skipped(cached)={skipped} failed={failed} of {total}', flush=True)
        return

    wanted = [x.strip() for x in args.packs.split(',') if x.strip()]
    all_mode = wanted == ['all']
    merged, order = {}, []
    scenario_summaries = []
    failed = []

    if all_mode:
        # ---- full encounter-side projection straight from the bulk catalog ----
        for c in catalog:
            if c.get('type_code') not in ENCOUNTER_TYPES:
                continue
            url = c.get('url') or ''
            slug = url.rsplit('/', 1)[-1] if url else c.get('code')
            if slug not in merged:
                merged[slug] = project(c, zh_titles)
                order.append(slug)
        print(f'bulk projection: {len(order)} encounter-side cards')
        # boons/burdens: treasure cards of the three campaign expansions from
        # the local RingsDB cache. The 5-digit code spaces of HoB packs (TDR,
        # AAC...) and RingsDB campaign expansions OVERLAP with different cards
        # (e.g. 10157 = "Wraith of Carn Dûm" enemy in HoB, "Iârion's Pendant"
        # treasure in RingsDB), so dedupe on code+NAME — code alone would
        # wrongly drop ~28 real boons/burdens.
        ringsdb_added = 0
        for pack_code in RINGSDB_TREASURE_PACKS:
            path = os.path.join(CACHE_DIR, f'{pack_code}.json')
            try:
                payload = json.loads(read_text(path))
            except (OSError, ValueError):
                failed.append(f'ringsdb treasure cache missing/corrupt: {pack_code}')
                continue
            for c in payload:
                if c.get('type_code') != 'treasure':
                    continue
                if any(m['code'] == c.get('code') and m['name'] == c.get('name')
                       for m in merged.values()):
                    continue
                slug = 'ringsdb-' + str(c.get('code'))
                merged[slug] = project_ringsdb(c, zh_titles)
                order.append(slug)
                ringsdb_added += 1
        print(f'ringsdb treasure added: {ringsdb_added}')

    for pack in ([] if all_mode else wanted):
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
            scen = cached_fetch(SCENARIO_URL.format(slug=urllib.parse.quote(slug)),
                                os.path.join(CACHE_DIR, f'enc-scenario-{slug}.json'),
                                args.proxy, args.retries, args.force)
            if not isinstance(scen, dict):
                failed.append(f'{slug} (scenario payload not an object)')
                continue

            quest_stats, scenario_cards, quests = parse_scenario(
                scen, by_slug, merged, order, failed, merge_cards=True, zh_titles=zh_titles)

            # merge the pack's own encounter-side cards (dedupe by HoB slug)
            for c in own:
                url = c.get('url') or ''
                slug2 = url.rsplit('/', 1)[-1] if url else c.get('code')
                if slug2 in merged:
                    continue
                merged[slug2] = project(c, zh_titles)
                order.append(slug2)

            finalize_quests(merged, quests)

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

        # Per-scenario usage on the card itself only when the pack maps to
        # exactly ONE scenario — shared encounter sets (Core: three scenarios)
        # would otherwise silently carry whichever scenario was processed
        # first. For multi-scenario packs the quantities stay on
        # scenarios[].encounterCards, keyed by slug.
        if len(pack_scenarios) == 1 and scenario_summaries:
            for sc in scenario_summaries[-1]['encounterCards']:
                card = merged.get(sc['slug'])
                if card is not None and card['scenarioQuantity'] is None:
                    card['scenarioQuantity'] = {'easy': sc['easy'], 'normal': sc['normal'],
                                                'nightmare': sc['nightmare']}

    if all_mode:
        # ---- absorb every cached scenario payload (pre-warmed via
        #      --scenarios-only; never fetches the network here) ----
        total = len(scenarios_list)
        absorbed = missing_cache = 0
        for i, meta in enumerate(scenarios_list, 1):
            slug = meta.get('Slug')
            path = os.path.join(CACHE_DIR, f'enc-scenario-{slug}.json')
            if not os.path.exists(path):
                failed.append(f'scenario cache missing: {slug} (run --scenarios-only)')
                missing_cache += 1
                continue
            try:
                scen = json.loads(read_text(path))
            except ValueError:
                failed.append(f'scenario cache corrupt: {slug}')
                missing_cache += 1
                continue
            if not isinstance(scen, dict):
                failed.append(f'{slug} (scenario payload not an object)')
                continue
            quest_stats, scenario_cards, quests = parse_scenario(
                scen, by_slug, merged, order, failed, merge_cards=False, zh_titles=zh_titles)
            finalize_quests(merged, quests)
            scenario_summaries.append({
                'slug': slug,
                'name': scen.get('Title'),
                'pack': scen.get('Product'),
                'questCards': quest_stats,
                'encounterCards': scenario_cards,
                'totals': {m: sum(c[m] for c in scenario_cards if not c['nightmareSet'])
                           for m in ('easy', 'normal')},
                'nightmareSetCards': sum(1 for c in scenario_cards if c['nightmareSet']),
            })
            absorbed += 1
            if i % 25 == 0:
                print(f'  scenarios absorbed: {i}/{total}', flush=True)
        print(f'scenarios absorbed: {absorbed}/{total} (cache missing/corrupt: {missing_cache})')

    cards = [merged[s] for s in order]
    # quest front/back: split at the structured Side A/B markers where present
    for c in cards:
        if c['type'] == 'quest':
            sides = split_sides(c['rulesText'])
            if sides:
                c['front'], c['back'] = sides
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

    # nameZh merge (EDGE zh-overrides, normalized-EN layer only — edge-pack
    # carries player-pack codes that do not apply here). data.js built-in
    # entries (Core encounter cards, HfG 132-142 block, quests) are skipped:
    # data.js is authoritative for those and the display layer reads it first,
    # so their nameZh stays empty rather than diverging from data.js.
    zh_stats = zh_merge.merge(cards, 'encounter', code_layer=False,
                              skip_names=zh_merge.load_datajs_names())

    per_pack = {}
    for c in cards:
        per_pack[c['packCode']] = per_pack.get(c['packCode'], 0) + 1

    dataset = {
        'schemaVersion': 1,
        'source': 'Hall of Beorn',
        'endpoint': 'https://hallofbeorn.com/Export/{Cards/OFFICIAL,Scenarios/{slug}}',
        'ringsdbNote': 'RingsDB API carries no encounter cards (verified 2026-11-02); '
                       'pack codes differ: RingsDB HfG = Hall of Beorn THfG. Boons/'
                       'burdens (campaign treasure) come from the local RingsDB cache '
                       'and carry card-level source="ringsdb".',
        'uniqueKeyNote': 'Card identity = the materialized `uid` field (100% unique). '
                         '(packCode, code) collides 103x across the full catalog — every '
                         'Nightmare pack restarts at 02001, several 5-digit codes are '
                         'reused across packs with different cards, and 18 groups are '
                         'same-name double rows; see encounter-missing-report.json '
                         'packCodeCodeDuplicates for the full audit. Display-side lookups '
                         'by (pod, code) MUST switch to uid.',
        'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime()),
        'nameZhNote': 'nameZh 来自 docs/data/zh-overrides（EDGE 扩展导出）规范化英文名匹配，'
                      '遭遇侧覆盖极弱（如实留空，不编造）；data.js 内置条目'
                      '（Core 遭遇卡 / HfG 132-142 / quest）不回写——展示层以 data.js '
                      '为准。详见 scripts/zh-merge.py 与 docs/data/zh-merge-report.json。',
        'cardCount': len(cards),
        'packCount': len({c['packCode'] for c in cards}),
        'packs': ([{'code': k, 'name': pack_names.get(k), 'cards': v}
                   for k, v in sorted(per_pack.items())] if all_mode else
                  [{'requested': p, 'hobCode': PACK_ALIASES.get(p, p)} for p in wanted
                   if PACK_ALIASES.get(p, p) in pack_names]),
        'scenarios': scenario_summaries,
        'cards': cards,
    }
    tmp = OUT_FILE + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(dataset, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT_FILE)
    # JS module for file:// offline use; '<' escaped so '</' can never close a
    # <script> block early (same convention as player-carddata.js). At full size
    # (~5 MB) this file is NOT inlined by build.py — shell.html references it as
    # an external <script src="docs/data/encounter-carddata.js"></script> tag
    # (keep the path relative to index.html); the global ENCOUNTER_CARDS_DATA is
    # the engine-facing handle.
    module_text = ('/* 由 scripts/fetch-encounter-data.py 从 docs/data/encounter-carddata.json 生成——手改无效，重跑脚本同步。\n'
                   ' * 外挂引用：shell.html/index.html 以 <script src="docs/data/encounter-carddata.js"></script> 引入，\n'
                   ' * 不进 build.py 内联清单；全局 ENCOUNTER_CARDS_DATA 供引擎读取。 */\n'
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
    src = {}
    for c in cards:
        src[c['source']] = src.get(c['source'], 0) + 1
    print(f'sources: {src}')

    print('\n-- field coverage (non-empty / total) --')
    stat_fields = ['engagement', 'threat', 'willpower', 'attack', 'defense', 'health',
                   'questPoints', 'victory', 'shadow', 'keywords', 'traits', 'rulesText', 'quantity']
    for f in stat_fields:
        n = sum(1 for c in cards if c.get(f) not in (None, ''))
        print(f'  {f}: {n}/{len(cards)}')

    print('\n-- cards per encounter set --')
    sets = {}
    for c in cards:
        sets[c['encounterSet'] or '(no encounter set)'] = sets.get(c['encounterSet'] or '(no encounter set)', 0) + 1
    print(f'  {len(sets)} encounter sets; largest:')
    for k in sorted(sets, key=lambda k: -sets[k])[:15]:
        print(f'  {k}: {sets[k]}')

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
            if not c.get('front') or not c.get('back'):
                problems.append(f'quest {c["code"]} {c["name"]}: '
                                f'front {"ok" if c.get("front") else "MISSING"} / '
                                f'back {"ok" if c.get("back") else "MISSING"} '
                                f'(no Side A/B markers in HoB text; scenario QuestCards.Text '
                                f'similarly incomplete — engine needs a manual-text overlay)')
        if c['type'] in ('objective', 'objective-ally') and c.get('willpower') is None:
            # HoB data gap (e.g. Signs of Gollum 02014): printed willpower exists
            # on the physical card but the export omits it — report, never guess.
            problems.append(f'{c["type"]} {c["code"]} {c["name"]}: missing willpower (HoB export gap)')
    # (packCode, code) uniqueness audit: 103 colliding groups at full-catalog
    # size — 85 groups are DISTINCT cards sharing one printed code (HoB
    # numbering bug: e.g. CotW 22073 holds two different treacheries), 18 are
    # same-name duplicate rows / campaign variants (e.g. DCC 12042 lists
    # "Stormcaller" twice). Content is left untouched; every card carries its
    # unique `slug`, so consumers must key on slug (fe's catalogEntries uses a
    # packCode:code prefix, which is still ambiguous for these 103 groups —
    # see the report file for the full group list).
    from collections import defaultdict
    key_groups = defaultdict(list)
    for c in cards:
        key_groups[(c['packCode'], c['code'])].append(c)
    key_dups = [{'packCode': k[0], 'code': k[1],
                 'kind': 'same-name' if len({c['name'] for c in v}) == 1 else 'distinct-cards',
                 'cards': [{'uid': c['uid'], 'name': c['name'], 'type': c['type'],
                            'encounterSet': c['encounterSet'],
                            'rulesTextIdentical': len({c['rulesText'] for c in v}) == 1}
                           for c in v]}
                for k, v in sorted(key_groups.items()) if len(v) > 1]
    key_dup_same = sum(1 for g in key_dups if g['kind'] == 'same-name')
    key_dup_diff = len(key_dups) - key_dup_same
    uids = [c['uid'] for c in cards]
    uid_dups = len(uids) - len(set(uids))
    print(f'  (packCode,code) duplicate-key groups: {len(key_dups)} '
          f'({key_dup_same} same-name / {key_dup_diff} distinct-cards) — key on uid instead')
    print(f'  uid uniqueness: {"OK" if uid_dups == 0 else str(uid_dups) + " COLLISIONS"} '
          f'({len(set(uids))}/{len(uids)})')
    if problems:
        print(f'  MISSING CORE FIELDS: {len(problems)} cards affected (full list in the report file)')
        by_kind = {}
        for p in problems:
            by_kind.setdefault(p.split(': ', 1)[1] if ': ' in p else p, []).append(p)
        for kind, items in sorted(by_kind.items(), key=lambda x: -len(x[1])):
            print(f'   ! [{len(items)}] {kind}')
            for p in items[:2]:
                print(f'      e.g. {p}')
    else:
        print('  all enemy engagement/threat/attack/defense/health present;'
              ' location threat present; quest stage/questPoints present')
    # reconciliation report: every missing-field row + every scenario/bulk
    # mismatch, written next to the dataset for the acceptance write-up
    report_path = os.path.join(OUT_DIR, 'encounter-missing-report.json')
    with io.open(report_path + '.tmp', 'w', encoding='utf-8') as fh:
        json.dump({'fetchedAt': dataset['fetchedAt'], 'cardCount': len(cards),
                   'problems': problems, 'failed': failed,
                   'packCodeCodeDuplicates': key_dups}, fh, ensure_ascii=False, indent=1)
    os.replace(report_path + '.tmp', report_path)
    print(f'wrote {report_path} ({len(problems)} missing-field rows, {len(failed)} reconciliation failures)')
    if not all_mode:
        for s in scenario_summaries:
            print(f'scenario {s["name"]}: quest stages='
                  f'{[(q["stage"], q["questPoints"]) for q in s["questCards"]]} '
                  f'encounter totals={s["totals"]} nightmareSetCards={s["nightmareSetCards"]}')


if __name__ == '__main__':
    main()
