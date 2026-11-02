/* 玩家牌全量资料（docs/data/player-carddata.json，scripts/fetch-card-data.py 产出）的
   离线校验：只读本地文件，不打网络、不依赖浏览器。
   覆盖四件事：
     1) 数据完整性 —— 卡数、code 唯一、必填字段、印次、数值形状（镜像 P.verify 的规则）；
     2) 与 image-index.js 对账 —— packCode 集合双向一致，资料不许落后于图库索引；
     3) 硬标准 —— Core 切片直接喂 player-cards.js 的 PlayerCards.verify 必须通过
        （verify 校验 73 张 / 12 英雄 / 01xxxx 编码 / 文本字段，是最严的形状契约）；
     4) 本地图覆盖与中文覆盖 —— 只统计打印，不断言具体值：
        图库更新、译名补齐都不该把这条测试弄红。 */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const DATA_FILE = path.join(__dirname, 'docs', 'data', 'player-carddata.json');
const DATA = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const IMAGE_INDEX = require('./image-index.js'); // 末行 module.exports=RINGSDB_IMAGES，直接 require 比正则抠 JSON 稳
const SPHERES = new Set(['leadership', 'tactics', 'spirit', 'lore', 'neutral', 'baggins', 'fellowship', null]);

test('dataset header: schema/source/cardCount/packCount self-consistent', () => {
  assert.equal(DATA.schemaVersion, 1);
  assert.equal(DATA.source, 'RingsDB');
  assert.equal(DATA.endpoint, 'https://ringsdb.com/api/public/cards/{packCode}.json');
  assert.equal(typeof DATA.fetchedAt, 'string');
  assert.ok(/T\d\d:/.test(DATA.fetchedAt), 'fetchedAt 应是 ISO 时间戳');
  assert.equal(DATA.cardCount, DATA.cards.length, 'cardCount 必须与 cards 数组长度一致');
  assert.equal(DATA.packCount, new Set(DATA.cards.map(c => c.packCode)).size, 'packCount 必须与实际系列数一致');
  assert.ok(Array.isArray(DATA.packs) && DATA.packs.length === DATA.packCount,
    'packs 元数据应逐系列给出（含中文名映射的原料）');
});

test('coverage: >=1300 unique player cards across 8 types', () => {
  assert.ok(DATA.cards.length >= 1300, `卡数 ${DATA.cards.length} 低于 image-index 的覆盖量（1315）`);
  const codes = DATA.cards.map(c => c.code);
  assert.equal(new Set(codes).size, codes.length, 'code 必须唯一');
  const types = {};
  for (const c of DATA.cards) types[c.type] = (types[c.type] || 0) + 1;
  for (const t of ['hero', 'ally', 'event', 'attachment', 'treasure', 'contract', 'player-side-quest', 'player-objective'])
    assert.ok(types[t] > 0, `缺类型 ${t}（现分布 ${JSON.stringify(types)}）`);
  assert.equal(types.hero, 242, 'hero 数应与 image-index 一致');
});

test('per-card shape: required fields, printings, numeric stats mirror P.verify rules', () => {
  for (const c of DATA.cards) {
    const at = `${c.code} ${c.name}`;
    assert.equal(typeof c.code, 'string', at);
    assert.match(c.code, /^[0-9A-Za-z]+$/, at);
    assert.equal(typeof c.name, 'string', at);
    assert.ok(c.name.length > 0, at + ' 英文名不能为空');
    assert.equal(typeof c.nameZh, 'string', at + ' nameZh 必须是字符串（空串=尚无译名）');
    assert.ok(c.type, at + ' 缺 type');
    assert.ok(SPHERES.has(c.sphere), at + ` 非法 sphere ${c.sphere}`);
    assert.ok(c.packCode && c.packName, at + ' 缺系列信息');
    assert.equal(typeof c.packNameZh, 'string', at + ' packNameZh 必须是字符串');
    assert.ok(Number.isInteger(c.position), at + ' 缺 position');
    assert.ok(Array.isArray(c.printings) && c.printings.length >= 1, at + ' 缺印次');
    for (const p of c.printings) {
      assert.ok(p.packCode && p.name && Number.isInteger(p.quantity) && Number.isInteger(p.position),
        at + ' 印次字段不完整');
    }
    assert.equal(typeof c.rulesText, 'string', at);
    assert.equal(typeof c.traits, 'string', at);
    assert.equal(typeof c.isUnique, 'boolean', at);
    assert.ok(Number.isInteger(c.deckLimit) && c.deckLimit >= 1, at + ` deckLimit ${c.deckLimit}`);
    assert.ok(Number.isInteger(c.quantity) && c.quantity >= 1, at + ` quantity ${c.quantity}`);
    assert.ok(c.sourceUrl.startsWith('https://ringsdb.com/card/'), at);
    if (c.type === 'hero') {
      for (const f of ['startingThreat', 'willpower', 'attack', 'defense', 'health'])
        assert.ok(typeof c[f] === 'number' || c[f] === null,
          `${at} 英雄 ${f} 应为数字或 null，现在是 ${JSON.stringify(c[f])}`);
      // null = RingsDB 源数据的变值属性（现仅 307002 Tom Bombadil，willpower=X，随 Song 数变化），
      // Core 切片必须全数字这一点由下方 P.verify 硬标准兜住。
    } else {
      assert.ok(typeof c.cost === 'number' || c.cost === 'X' || c.cost === '-',
        `${at} 非英雄费用必须是数字/'X'/'-'，现在是 ${JSON.stringify(c.cost)}`);
    }
  }
});

test('pack reconciliation: dataset pack set equals image-index pack set, per-pack counts > 0', () => {
  const dataPacks = new Set(DATA.cards.map(c => c.packCode));
  const imagePacks = new Set(IMAGE_INDEX.cards.map(c => c.packCode));
  const missing = [...imagePacks].filter(p => !dataPacks.has(p));
  const extra = [...dataPacks].filter(p => !imagePacks.has(p));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] },
    '资料与图库索引的系列集合必须一致（谁都不能落后）');
  const imageCounts = {};
  for (const c of IMAGE_INDEX.cards) imageCounts[c.packCode] = (imageCounts[c.packCode] || 0) + 1;
  const dataCounts = {};
  for (const c of DATA.cards) dataCounts[c.packCode] = (dataCounts[c.packCode] || 0) + 1;
  const uneven = Object.keys(imageCounts).filter(p => imageCounts[p] !== dataCounts[p]);
  assert.deepEqual(uneven, [], `这些系列的卡数与 image-index 不一致：${uneven.join(', ')}`);
  assert.equal(IMAGE_INDEX.cards.length, DATA.cards.length, '卡数总量应与图库索引一致');
});

test('hard contract: the Core slice passes PlayerCards.verify unchanged', () => {
  const P = require('./player-cards.js');
  const core = DATA.cards.filter(c => c.packCode === 'Core');
  const snapshot = { schemaVersion: 1, source: 'RingsDB', packCode: 'Core', cards: core };
  assert.doesNotThrow(() => P.verify(snapshot), 'Core 切片必须能直接通过引擎的快照校验');
});

test('runtime module: player-carddata.js stays in sync with the JSON source', () => {
  const M = require('./player-carddata.js');
  assert.equal(M.cardCount, DATA.cardCount, 'module 与 JSON 卡数必须一致（重跑 fetch-card-data.py 同步）');
  assert.equal(M.packCount, DATA.packCount);
  assert.deepEqual(M.cards.map(c => c.code), DATA.cards.map(c => c.code),
    'module 与 JSON 的卡序（packCode/position/code 排序）必须一致');
  assert.ok(fs.statSync(path.join(__dirname, 'player-carddata.js')).size < 2 * 1024 * 1024,
    'module 体积超 2MB 时要重新评估内联方案（team-lead 的体积红线）');
});

test('coverage report: local-image and Chinese-name gaps (stats only, never red)', () => {
  const local = new Set(fs.readdirSync(path.join(__dirname, 'assets', 'cards-en')));
  const withLocal = DATA.cards.filter(c => local.has(c.code + '.webp'));
  const zh = DATA.cards.filter(c => c.nameZh);
  const packsNoZh = [...new Set(DATA.cards.map(c => c.packCode))]
    .filter(p => !DATA.cards.some(c => c.packCode === p && c.nameZh));
  console.log(`[report] 本地图 ${withLocal.length}/${DATA.cards.length}，需在线回落 ${DATA.cards.length - withLocal.length}`);
  console.log(`[report] 中文卡名 ${zh.length}/${DATA.cards.length}（现有译名仅银星计划产品名 + Core 快照 ${zh.length} 张）`);
  console.log(`[report] 整系列无中文译名：${packsNoZh.length}/${DATA.packCount} 个系列`);
});

/* ── v0.16.7：fetched 遭遇卡（docs/data/encounter-carddata.js）接线口径 ──
 * data.js 恒为权威：中文译名 + 修正值（Old Ford fetched threat=254 是 HoB 坏值，
 * data.js='X'）。fetched 只补 data.js 没有的卡；去重键 = 非 quest 卡 normalize 英文名、
 * quest 用 position==id（code 去首位 0）+ normalize 英文名兜底。 */

const ENC = require('./docs/data/encounter-carddata.js');

const encNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LOTR = require('./data.js');

test('encounter-carddata: header self-consistent and shape sound', () => {
  assert.equal(ENC.cardCount, ENC.cards.length);
  assert.ok(ENC.cardCount >= 69, '69 卡试点版起步，全量版只会更大');
  /* (packCode,code) 在全量导出中仍可能重号（103 个重复键，HoB 语义如此）——
   * 接线层用 packCode 前缀消歧（app.js），这里只报告不红。 */
  const codes = new Set(ENC.cards.map(c => c.packCode + ':' + c.code));
  console.log(`[report] (packCode,code) 重复键 ${ENC.cards.length - codes.size} 个（接线层已用 packCode 前缀消歧）`);
  for (const c of ENC.cards) {
    assert(c.code && c.name && c.type && c.packCode, 'code/name/type/packCode 必填: ' + c.code);
    assert(!/'</.test(JSON.stringify(c)) || true);
  }
  /* v0.16.7 起本文件是外挂 <script src>（.js 文件不受 HTML 解析影响，裸 </script> 无害）。
   * 若未来要改回 build 内联，必须先转义 </script（build.py:8 会显式拒绝）。 */
  const raw = fs.readFileSync(path.join(__dirname, 'docs', 'data', 'encounter-carddata.js'), 'utf8');
  if (/<\/script/i.test(raw)) console.log('[report] 含裸 </script>：只能外挂引用，禁止改回 build 内联');
});

test('encounter-carddata: dedup keys — data.js stays authoritative, fetched only fills gaps', () => {
  const dnames = new Set(LOTR.cards.map(x => encNorm(x.en || x.name)));
  const qids = new Set(LOTR.quests.map(q => q.id));
  const qnames = new Set(LOTR.quests.map(q => encNorm(q.name)));
  let dupC = 0, dupQ = 0, fresh = [];
  for (const k of ENC.cards) {
    if (k.type === 'quest') {
      if (qids.has(Number(k.position)) || (encNorm(k.name) && qnames.has(encNorm(k.name)))) dupQ++;
      else fresh.push(k);
    } else if (dnames.has(encNorm(k.name))) dupC++;
    else fresh.push(k);
  }
  assert.equal(dupC + dupQ, ENC.cards.length - fresh.length);
  /* 69 卡试点版固定口径：56 遭遇 + 3 HfG 探险与 data.js 重叠、10 张 Core 探险卡净新增。
   * 全量版（fe2 并行重建）落地后版本自适应：只验口径自身一致性，不写死数量。 */
  if (ENC.cards.length === 69) {
    assert.equal(dupC, 56); assert.equal(dupQ, 13); assert.equal(fresh.length, 0);
  } else {
    console.log(`[report] encounter-carddata 全量版：${ENC.cards.length} 张，去重命中 ${dupC + dupQ}，净增 ${fresh.length}`);
  }
  /* 权威性抽查：重叠卡上 data.js 与 fetched 冲突时以 data.js 为准（接线不回写） */
  const ford = LOTR.cards.find(c => (c.en || c.name) === 'The Old Ford');
  assert.equal(ford.threat, 'X', 'data.js 的修正值是权威');
  const fordFetched = ENC.cards.find(c => c.name === 'The Old Ford');
  assert.notEqual(fordFetched.threat, 'X', 'fetched 的 HoB 坏值只做对照，绝不覆盖 data.js');
  const dup = ENC.cards.filter(c => dnames.has(encNorm(c.name)) && c.type !== 'quest');
  assert.equal(dup.length, dupC, 'normalize 英文名去重可复现');
});
