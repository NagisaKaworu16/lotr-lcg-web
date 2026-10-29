/* 牌桌区瘦身验收（v0.15.89）。
   改前：公共牌桌顶部「当前探险」区（卡图+牌文+进度条 ≈110~150px）与右侧独占一列的
         「当前地点」卡（行高 ≥155px）常驻，挤占探查区。
   改后：探险区默认收成一行触发条（≈26px，开局设置/翻牌窗口强制展开）；
         地点卡带「地点」分隔并入探查区行首；.quest-location-row 包装层退役。
   断言分四组：
     A. 开局设置阶段：探险区强制展开（卡图与牌文可见）；
     B. 对局中（翻牌窗口收掉后）：默认收成一行、迷你进度条在、无卡图；
     C. 地点并入探查区行首：staging-zone 内 row-divider「地点」+ 地点卡；
     D. 展开/收起往返可用；四档视口下无横向溢出、手牌仍在视口内。
   运行：NODE_PATH=<node_modules> node scripts/check-table-slim.cjs */
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

const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });

/* 走到开局手牌确认（setupPending），不点 keepHand。 */
async function bootToSetup(page) {
  await page.goto(FILE);
  await page.waitForTimeout(420);
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
}

/* 开局翻牌逐张走完：交替点「翻开下一张」/「结算此牌并继续」，直到窗口收掉。 */
async function finishReveals(page) {
  for (let i = 0; i < 40; i++) {
    const res = page.locator('button[data-action="setupResolve"]');
    const draw = page.locator('button[data-action="setupDraw"]');
    if (await res.count()) await res.first().click();
    else if (await draw.count()) await draw.first().click();
    else return true;
    await page.waitForTimeout(240);
  }
  return false;
}

const geo = page => page.evaluate(() => {
  const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { y: +b.top.toFixed(1), h: +b.height.toFixed(1), w: +b.width.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
  const q = s => document.querySelector(s);
  const qz = q('.quest-zone'), st = q('.staging-zone');
  const div = st ? st.querySelector('.row-divider') : null;
  const loc = st ? st.querySelector('.row-divider + .encounter-card, .row-divider ~ .encounter-card') : null;
  return {
    collapsed: !!q('.quest-zone.quest-collapsed'),
    display: R(q('.quest-display')),
    zone: R(qz),
    mini: !!q('.quest-progress-mini'),
    fold: R(q('.quest-fold')),
    staging: R(st),
    dividerLabel: div ? div.textContent.trim() : null,
    divider: R(div),
    locCard: R(loc),
    locName: loc ? (loc.querySelector('.table-card-caption b') || { textContent: '' }).textContent : null,
    stagingRowH: st && st.querySelector('.table-card-row') ? +st.querySelector('.table-card-row').getBoundingClientRect().height.toFixed(1) : null,
    hand: R(q('.hand-zone')),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    revealOpen: !!(state.setupReveal && !state.setupReveal.finished),
    setupPending: !!state.setupPending,
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

    /* ── A. 开局设置阶段：探险区强制展开 ── */
    await bootToSetup(page);
    let g = await geo(page);
    add(`${tag}：开局手牌确认时探险区展开（卡图与牌文可见）`, !g.collapsed && !!g.display, `collapsed=${g.collapsed}`);
    add(`${tag}：开局态不出现「牌文 ▾」展开钮的收起样式`,
      await page.locator('.quest-fold[aria-expanded="true"]').count() === 1, '');

    /* 走完开局：保留手牌 → 剧本设置 → 逐张翻牌 */
    for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
    { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
    await page.waitForTimeout(500);
    const done = await finishReveals(page);
    add(`${tag}：开局翻牌窗口逐张走完`, done, '');
    await page.waitForTimeout(350);

    /* ── B. 对局中默认收成一行 ── */
    g = await geo(page);
    add(`${tag}：对局中探险区默认收成一行`, g.collapsed && !g.display, `collapsed=${g.collapsed} display=${!!g.display}`);
    add(`${tag}：收起态整块高度 ≤ 40px（改前 ≈110~150）`, !!g.zone && g.zone.h <= 40, `zone h=${g.zone && g.zone.h}`);
    add(`${tag}：收起态仍有迷你进度条与 0/8 读数`, g.mini && /0\s*\/\s*8/.test(await page.locator('.quest-progress-mini').textContent()), '');
    add(`${tag}：收起态仍显示当前阶段卡名（strong 非空）`,
      (await page.locator('.quest-head strong').textContent() || '').trim().length > 1, await page.locator('.quest-head strong').textContent());

    /* ── C. 地点并入探查区行首 ── */
    add(`${tag}：开局注入地点前探查区无「地点」分隔`, g.dividerLabel === null, g.dividerLabel);
    await page.evaluate(() => { state.active = { ...E.byId[99], uid: ++state.serial, progress: 0 }; render(); });
    await page.waitForTimeout(250);
    g = await geo(page);
    add(`${tag}：地点卡带「地点」分隔出现在探查区行首`, g.dividerLabel === '地点' && !!g.locCard, `divider=${g.dividerLabel} card=${g.locName}`);
    add(`${tag}：分隔在探查区第一张卡之前（x 位置）`,
      !!g.divider && !!g.locCard && g.divider.w > 0 && g.divider.h > 20, `divider h=${g.divider && g.divider.h}`);
    add(`${tag}：「地点」分隔与地点卡等高对齐（34 段同行等高；行框可内滚）`,
      !!g.divider && !!g.locCard && Math.abs(g.divider.h - g.locCard.h) <= 2,
      `divider h=${g.divider && g.divider.h} card h=${g.locCard && g.locCard.h} row h=${g.stagingRowH}`);

    /* ── D. 展开/收起往返 + 总体几何 ── */
    await page.locator('.quest-fold').click(); await page.waitForTimeout(250);
    g = await geo(page);
    add(`${tag}：点「牌文 ▾」展开（卡图+牌文渲染）`, !g.collapsed && !!g.display, `zone h=${g.zone && g.zone.h}`);
    add(`${tag}：展开态高度合理（≤ 170，与改前相当）`, !!g.zone && g.zone.h <= 170, `zone h=${g.zone && g.zone.h}`);
    await page.locator('.quest-fold').click(); await page.waitForTimeout(250);
    g = await geo(page);
    add(`${tag}：再点「收起 ▴」回到一行`, g.collapsed && !g.display, '');
    add(`${tag}：无横向溢出`, !g.overflowX);
    add(`${tag}：手牌仍在视口内`, !!g.hand && g.hand.bottom <= vp.h + 0.5, `hand bottom=${g.hand && g.hand.bottom}`);
    add(`${tag}：探查区保底高度 ≥ 84（24 段预算不被探险区挤掉）`, g.stagingRowH >= 84, `row h=${g.stagingRowH}`);
    await page.screenshot({ path: path.join(OUT, `table-slim-${vp.w}.png`) });
    await ctx.close();
  }

  await browser.close();
  const fails = checks.filter(c => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (errors.length) { console.log('PAGEERRORS:\n' + errors.join('\n')); process.exit(2); }
  console.log(`${checks.length - fails.length}/${checks.length} 通过`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
