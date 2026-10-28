/* 玩家区纵向预算验收（v0.15.87）。
   用户反馈两连：「添加附属之后，手牌就看不到了；并且交战区有怪物之后，角色卡和手牌都看不到了」。
   实测根因：玩家区是固定高度的窄带（1440×900 下 450px），而里面的「行」会随状态增加——
   附属独立行 184px、交战区独立行 151px。行一多，手牌就被推到 y=865 / y=1021（视口外），
   而且 .bottom-deck 是 overflow:hidden，连滚都滚不到。
   验收口径：不论有没有附属/交战/更多的敌人，**手牌必须完整落在玩家区内**，
   玩家区自身不出现纵向滚动（横向滚动是设计的一部分）。
   运行：NODE_PATH=<node_modules> node scripts/check-mat-layout.cjs [--width 1440 --height 900] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? Number(process.argv[i + 1]) : null; };
const W = arg('--width') || 1440, H = arg('--height') || 900;

const MEASURE = () => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
  const matEl = document.querySelector('.player-mat');
  const mat = matEl;
  const deck = document.querySelector('.bottom-deck');
  const row = document.querySelector('.own-characters');
  const hand = document.querySelector('.hand-zone');
  const chip = document.querySelector('.attach-chip');
  const enemy = [...document.querySelectorAll('.own-characters .encounter-card')][0];
  const inMat = e => { if (!e || !mat) return null; const a = r(e), m = r(mat); return a.bottom <= m.bottom + 0.5 && a.y >= m.y - 0.5; };
  return {
    vh: window.innerHeight,
    mat, hand, handBottom: hand ? +r(hand).bottom.toFixed(1) : null, matBottom: mat ? +r(mat).bottom.toFixed(1) : null,
    handInMat: inMat(hand),
    matScrolls: mat ? mat.scrollHeight > mat.clientHeight + 1 : null,
    matScrollPair: mat ? `${mat.scrollHeight}/${mat.clientHeight}` : '',
    decide: document.querySelectorAll('.decide-box').length,
    rowH: row ? +r(row).h.toFixed(1) : null, rowScrollH: row ? row.scrollHeight : null,
    deckKids: deck ? [...deck.children].map(e => ({ cls: (e.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.'), h: +r(e).h.toFixed(1), flex: getComputedStyle(e).flex + ' / minH ' + getComputedStyle(e).minHeight })).filter(x => x.h > 0) : [],
    deckBox: deck ? { ...r(deck), scrollH: deck.scrollHeight } : null,
    chip: chip ? { box: r(chip), nat: chip.querySelector('img')?.naturalWidth || 0, inCaption: !!chip.closest('.table-card-caption') } : null,
    chipClicks: chip ? { action: chip.dataset.action || '', image: chip.dataset.imageAction || '', plan: chip.dataset.plan || '' } : null,
    divider: document.querySelectorAll('.own-characters > .row-divider').length,
    enemies: document.querySelectorAll('.own-characters .encounter-card').length,
    attachRow: !!document.querySelector('.own-attachments'),
    enemyCap: enemy ? { box: r(enemy.querySelector('.table-card-caption')), text: (enemy.querySelector('.table-card-caption') || {}).textContent || '' } : null,
    enemyInMat: enemy ? inMat(enemy.querySelector('.table-card-caption')) : null,
    counts: (document.querySelector('.bottom-deck > .zone-heading') || {}).textContent || '',
    zones: (() => { const L = document.querySelector('.tabletop-layout'); const g = e => { const b = e.getBoundingClientRect(); return { y: +b.y.toFixed(0), h: +b.h || +b.height.toFixed(0) }; };
      const dock = document.querySelector('.operation-dock'), tb = document.querySelector('.public-table'), mt = document.querySelector('.player-mat');
      return { rows: getComputedStyle(L).gridTemplateRows, dock: g(dock), table: g(tb), mat: g(mt) }; })(),
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });
  const shot = async tag => { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, `mat-layout-${tag}-${W}x${H}.png`) }); };

  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '1');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
  add('对局已开始', await page.evaluate(() => !!(typeof state !== 'undefined' && state && state.status === 'playing')));

  /* ── ① 基线：无附属、无交战 ── */
  const s1 = await page.evaluate(MEASURE);
  await shot('base');
  add('① 手牌完整落在玩家区内', s1.handInMat === true, `手牌底 ${s1.handBottom} / 区底 ${s1.matBottom}`);
  add('① 玩家区没有纵向滚动', s1.matScrolls === false, s1.matScrollPair);
  add('① 没有附属徽章与交战分隔（不该凭空出现）', s1.chip === null && s1.divider === 0, `chip=${!!s1.chip} divider=${s1.divider}`);

  /* ── ② 加 1 张附属：从「独立 184px 行」变成卡名旁的徽章 ── */
  await page.evaluate(() => {
    const p = state.players[0], host = p.heroStates.find(h => !h.destroyed);
    p.attachments.push({ uid: ++state.serial, code: '01055', owner: 0, controller: 0, target: host.uid, exhausted: false });
    render();
  });
  await page.waitForTimeout(300);
  const s2 = await page.evaluate(MEASURE);
  await shot('attach');
  add('② 打完附属后手牌仍然看得见', s2.handInMat === true, `手牌底 ${s2.handBottom} / 区底 ${s2.matBottom}`);
  add('② 玩家区仍无纵向滚动', s2.matScrolls === false, s2.matScrollPair);
  add('② 附属不再单开一行（.own-attachments 不出现）', s2.attachRow === false);
  add('② 附属变成卡名行里的徽章（15×19、有真实卡图）', !!s2.chip && Math.abs(s2.chip.box.w - 15) <= 1 && Math.abs(s2.chip.box.h - 19) <= 1 && s2.chip.nat > 0,
    s2.chip ? `${s2.chip.box.w}×${s2.chip.box.h}px，图 ${s2.chip.nat}px` : '没有徽章');
  add('② 徽章挂在卡名那一行里（不压代币）', !!s2.chip && s2.chip.inCaption === true);
  add('② 徽章点开就是卡图（未到可用窗口）', !!s2.chipClicks && s2.chipClicks.action === 'images', s2.chipClicks && s2.chipClicks.action);
  add('② 角色行高度没被这行内容顶起来（≤+6px）', Math.abs(s2.rowH - s1.rowH) <= 6, `${s1.rowH} → ${s2.rowH}`);

  /* ── ③ 加 1 名交战敌人：并入角色行，不再单开 row('交战区') ── */
  await page.evaluate(() => {
    const p = state.players[0];
    p.engaged.push({ ...E.byId[74], uid: ++state.serial, shadows: [], exhausted: false });
    render();
  });
  await page.waitForTimeout(300);
  const s3 = await page.evaluate(MEASURE);
  await shot('engaged');
  add('③ 有交战敌人时手牌仍完整可见', s3.handInMat === true, `手牌底 ${s3.handBottom} / 区底 ${s3.matBottom}`);
  add('③ 角色卡行仍然在（没有被挤掉）', s3.rowH >= 140, `角色行 ${s3.rowH}px`);
  add('③ 敌人并进角色行（同一行内 + 1 道「交战」竖分隔）', s3.enemies === 1 && s3.divider === 1, `敌 ${s3.enemies} / 分隔 ${s3.divider}`);
  add('③ 敌人卡文字精简为「攻/防 + 生命」', !!s3.enemyCap && /攻击/.test(s3.enemyCap.text) && /生命/.test(s3.enemyCap.text) && !/威胁/.test(s3.enemyCap.text), s3.enemyCap && s3.enemyCap.text.slice(0, 40));
  add('③ 敌人卡文字没有被裁掉', s3.enemyInMat === true, s3.enemyCap ? `说明块底 ${s3.enemyCap.box.bottom}` : '');
  add('③ 玩家区仍无纵向滚动', s3.matScrolls === false, s3.matScrollPair);
  add('③ 角色行只在横向铺开（无纵向滚动）', s3.rowScrollH <= s3.rowH + 1, `${s3.rowScrollH} / ${s3.rowH}`);

  /* ── ④ 叠到 3 名敌人 + 1 张附属：仍然手牌优先 ── */
  await page.evaluate(() => {
    const p = state.players[0];
    for (const id of [75, 76]) p.engaged.push({ ...E.byId[id], uid: ++state.serial, shadows: [], exhausted: false });
    render();
  });
  await page.waitForTimeout(300);
  const s4 = await page.evaluate(MEASURE);
  await shot('many');
  add('④ 3 名敌人 + 附属时手牌仍可见', s4.handInMat === true, `手牌底 ${s4.handBottom} / 区底 ${s4.matBottom}`);
  add('④ 玩家区没有纵向滚动', s4.matScrolls === false, s4.matScrollPair);
  add('④ 角色行不让纵向溢出（只是横向滚动）', s4.rowScrollH <= s4.rowH + 1, `${s4.rowScrollH} / ${s4.rowH}`);

  /* ── ⑤ 宿主离场的「孤儿附属」仍要有地方呆 ── */
  await page.evaluate(() => {
    const p = state.players[0];
    p.attachments.forEach(a => { a.target = 99999; });
    render();
  });
  await page.waitForTimeout(300);
  const s5 = await page.evaluate(MEASURE);
  await shot('orphan');
  add('⑤ 宿主离场的附属回到独立行（不再挂在角色卡上）', s5.attachRow === true && s5.chip === null, `row=${s5.attachRow} chip=${!!s5.chip}`);
  add('⑤ 这种少见情况下手牌也没被顶掉', s5.handInMat === true, `手牌底 ${s5.handBottom} / 区底 ${s5.matBottom}`);

  /* ── ⑥ 真的进到探险阶段：决策触发条（40px）在场时，压缩的应该是角色行，
        手牌依然贴底可见——这条是「手牌优先」的核心承诺。 ── */
  await page.evaluate(() => {
    const p = state.players[0];
    p.attachments.forEach(a => { a.target = p.heroStates[0].uid; });
    document.querySelectorAll('.draw-toast').forEach(n => n.remove());
    render();
  });
  const door = page.locator('button[data-action="endPhase"]').first();
  if (await door.count()) { await door.click({ force: true }).catch(() => {}); await page.waitForTimeout(700); }
  await page.evaluate(() => document.querySelectorAll('.draw-toast').forEach(n => n.remove()));
  await page.waitForTimeout(200);
  const s6 = await page.evaluate(MEASURE);
  await shot('quest');
  add('⑥ 进入探险阶段后手牌仍完整可见', s6.handInMat === true, `手牌底 ${s6.handBottom} / 区底 ${s6.matBottom}`);
  add('⑥ 决策触发条在场时玩家区仍不纵向滚动', s6.matScrolls === false, `${s6.matScrollPair}，decide=${s6.decide}`);

  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const fail = checks.filter(c => !c.ok);
  for (const c of checks) console.log(`${c.ok ? '  PASS' : '  FAIL'}  ${c.name}${c.detail ? '  · ' + c.detail : ''}`);
  console.log(`\n${fail.length ? 'FAIL' : '通过'}：${checks.length - fail.length}/${checks.length} 项通过（${W}×${H}）`);
  fs.writeFileSync(path.join(OUT, `mat-layout-${W}x${H}.json`), JSON.stringify({ checks, states: { s1, s2, s3, s4, s5, s6 } }, null, 1));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
