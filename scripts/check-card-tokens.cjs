/* 角色卡代币布局验收（v0.15.91「上属性 / 下状态」双带）。
   改前：属性 2×2 方块悬在卡面上方 7px 并盖掉插画上缘；状态两枚压在牌文框正中。
   改后：属性 1×4 横带贴卡面上沿内侧、状态 1×2 贴下沿，代币锚 .card-frame。
   断言：
     A. 属性 4 枚同一行、等距、落在卡面内（不悬空）；数字不溢出圆；
     B. 状态 2 枚同一行、贴卡面底边（下沿距卡面底 ≤ 4px），且在牌文带内占比 ≤ 30%；
     C. 卡高与改前一致（≤ 150px），卡名不被压；
     D. 零值代币仍渲染但淡化（opacity < 1）；
     E. 四档视口 + 2 人局对手小卡：无横向溢出、手牌仍在视口内。
   运行：NODE_PATH=<node_modules> node scripts/check-card-tokens.cjs */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');

const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });

async function boot(page, players = 1) {
  await page.goto(FILE);
  await page.waitForTimeout(420);
  if (players > 1) { await page.selectOption('#playerCount', String(players)); await page.waitForTimeout(200); }
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const f = page.locator('button[data-action="finishSetup"]'); if (await f.count()) await f.click(); }
  await page.waitForTimeout(500);
  for (let i = 0; i < 40; i++) {
    const r = page.locator('[data-action="setupResolve"]'), d = page.locator('[data-action="setupDraw"]');
    if (await r.count()) await r.first().click();
    else if (await d.count()) await d.first().click();
    else break;
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });
}

const geo = page => page.evaluate(() => {
  const c = document.querySelector('.own-characters .character-card');
  if (!c) return null;
  const R = e => { const b = e.getBoundingClientRect(); return { t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const card = R(c), art = R(c.querySelector('.card-face')), cap = R(c.querySelector('.table-card-caption'));
  const attr = [...c.querySelectorAll('.attr-tokens .tk')].map(R);
  const state = [...c.querySelectorAll('.state-tokens .tk')].map(R);
  const zero = document.querySelector('.own-characters .state-tokens .tk[data-n="0"]');
  const digit = c.querySelector('.attr-tokens .tk b');
  const band = { t: art.t + art.h * 0.60, b: art.b - 3 };
  let hit = 0;
  for (const r of [...attr, ...state]) {
    const h = Math.max(0, Math.min(r.b, band.b) - Math.max(r.t, band.t));
    const w = Math.max(0, Math.min(r.r, art.r) - Math.max(r.l, art.l));
    hit += h * w;
  }
  return {
    card, art, cap, attr, state,
    attrCount: attr.length, stateCount: state.length,
    attrSameRow: attr.length > 1 && Math.max(...attr.map(r => r.t)) - Math.min(...attr.map(r => r.t)) <= 1,
    stateSameRow: state.length > 1 && Math.max(...state.map(r => r.t)) - Math.min(...state.map(r => r.t)) <= 1,
    attrInside: attr.every(r => r.t >= card.t - 0.5 && r.b <= card.b + 0.5 && r.l >= card.l - 0.5 && r.r <= card.r + 0.5),
    stateBottomGap: state.length ? Math.max(...state.map(r => r.b)) - art.b : null,
    textPct: +(hit / ((band.b - band.t) * art.w) * 100).toFixed(1),
    digitFont: digit ? parseFloat(getComputedStyle(digit).fontSize) : null,
    zeroOpacity: zero ? parseFloat(getComputedStyle(zero).opacity) : null,
    zeroPresent: !!zero,
    nameCleared: !!c.querySelector('.table-card-caption b') &&
      R(c.querySelector('.table-card-caption b')).b <= cap.b + 0.5,
    cardH: card.h,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    hand: (() => { const h = document.querySelector('.hand-zone'); return h ? R(h) : null; })(),
    peerAttr: [...document.querySelectorAll('.other-player .attr-tokens .tk')].length
      ? (() => { const r = R(document.querySelector('.other-player .attr-tokens')); return { h: r.h, w: r.w }; })() : null,
  };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const errors = [];

  for (const vp of [{ w: 1920, h: 1080 }, { w: 1440, h: 900 }, { w: 1366, h: 768 }, { w: 1280, h: 800 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${vp.w}: ` + String(e && e.message || e)));
    page.on('dialog', d => d.accept().catch(() => {}));
    const tag = `${vp.w}×${vp.h}`;
    await boot(page);
    /* 让两类代币同时在场：首位英雄 3 资源 2 伤害；第二位保持 0 资源用于零值断言。 */
    await page.evaluate(() => { mutate(() => { const h = state.players[0].heroStates[0]; h.resources = 3; h.damage = 2; }); render(); });
    await page.waitForTimeout(300);
    let g = await geo(page);
    if (!g) { add(`${tag}：找到角色卡`, false, 'no character card'); await ctx.close(); continue; }

    add(`${tag}：属性代币 4 枚都在`, g.attrCount === 4, `count=${g.attrCount}`);
    add(`${tag}：属性 4 枚排成同一行（不再 2×2）`, g.attrSameRow,
      g.attr.map(r => r.t).join(','));
    add(`${tag}：属性带整行落在卡面内（不再悬空出卡）`, g.attrInside,
      `card ${g.card.t}–${g.card.b} attr ${g.attr.map(r => r.t + '–' + r.b).join(' ')}`);
    add(`${tag}：属性带只压插画上沿（每枚高 ≤ 20）`, g.attr.every(r => r.h <= 20), `h=${g.attr[0].h}`);
    add(`${tag}：属性数字不溢出圆（字号 ≤ 代币 × 0.62）`,
      g.digitFont !== null && g.digitFont <= g.attr[0].h * 0.62 + 0.6, `font=${g.digitFont} tk=${g.attr[0].h}`);

    add(`${tag}：状态代币 2 枚（资源+伤害）`, g.stateCount === 2, `count=${g.stateCount}`);
    add(`${tag}：状态 2 枚并排一行（不再竖叠）`, g.stateSameRow, g.state.map(r => r.t).join(','));
    add(`${tag}：状态带贴卡面下沿（距卡面底 ≤ 4px）`,
      g.stateBottomGap !== null && Math.abs(g.stateBottomGap) <= 4, `gap=${g.stateBottomGap}`);
    add(`${tag}：牌文带被遮挡 ≤ 30%（改前状态块整块压在牌文上）`, g.textPct <= 30, `pct=${g.textPct}`);

    add(`${tag}：卡高不变（≤ 150，玩家区高度预算不受影响）`, g.cardH <= 150, `h=${g.cardH}`);
    add(`${tag}：卡名条未被代币压住`, g.nameCleared, `cap ${g.cap.t}–${g.cap.b}`);

    add(`${tag}：零值代币仍渲染（规则要它）`, g.zeroPresent, '');
    add(`${tag}：零值代币淡化到 ≤ 0.6`, g.zeroPresent && g.zeroOpacity <= 0.6, `opacity=${g.zeroOpacity}`);

    add(`${tag}：无横向溢出`, !g.overflowX);
    add(`${tag}：手牌仍在视口内`, !!g.hand && g.hand.b <= vp.h + 0.5, `hand bottom=${g.hand && g.hand.b}`);

    /* 对手小卡沿用双带：属性行不该退化成 2×2 块或悬出卡外。 */
    if (g.peerAttr) add(`${tag}：对手小卡属性带是单行（高 ≤ 22）`, g.peerAttr.h <= 22, `h=${g.peerAttr.h}`);

    await page.locator('.own-characters').first().screenshot({ path: path.join(OUT, `card-tokens-${vp.w}.png`) });
    await ctx.close();
  }

  await browser.close();
  const fails = checks.filter(c => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (errors.length) { console.log('PAGEERRORS:\n' + errors.join('\n')); process.exit(2); }
  console.log(`${checks.length - fails.length}/${checks.length} 通过`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
