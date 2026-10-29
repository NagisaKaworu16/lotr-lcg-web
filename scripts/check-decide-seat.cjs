/* 决策条归位验收（v0.15.93）。
   改前：决策盒独占一行（963×42px）夹在「角色行」与「手牌」之间，既不属于牌桌也不属于手牌；
   浮层 880×425 向上弹，盖住公共牌桌 51%；「遭遇阶段」这种标题在触发条、浮层头、面板 h2 出现三次。
   改后：触发条并入「队伍与手牌」标题行、压成 26px 胶囊（与「结束阶段」同排）；浮层收窄到 680px
   贴右，且按「触发条到视口顶」的实际距离限高（不越过视口）；单人局不再渲染「操作玩家」下拉。
   断言（每档视口 ≥1440）：
     A. 触发条在 .bottom-deck > .zone-heading 内、高 ≤ 28、与「结束阶段」同一行；
     B. 角色行与手牌之间不再有决策盒（那条横杠消失）；
     C. 浮层顶部不越过视口（≥ 0）、宽 ≤ 700、右缘与触发条右缘对齐；
     D. 单人局 #planning-actor = 0；
     E. 无横向溢出、手牌仍在视口内。
   运行：NODE_PATH=<node_modules> node scripts/check-decide-seat.cjs */
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

async function boot(page) {
  await page.goto(FILE);
  await page.waitForTimeout(420);
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
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });
  /* 进入探险阶段：那里一定有决策（投入前行动窗口），触发条与浮层同时在场。 */
  await page.locator('button[data-action="endPhase"]').click();
  await page.waitForTimeout(600);
}

const geo = page => page.evaluate(() => {
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), r: +r.right.toFixed(1) }; };
  const trig = document.querySelector('.decide-trigger');
  const box = document.querySelector('.decide-box');
  const pop = document.querySelector('.decide-pop');
  const door = document.querySelector('.phase-door .door-go') || document.querySelector('.phase-door');
  const head = document.querySelector('.bottom-deck > .zone-heading');
  const chars = document.querySelector('.own-characters');
  const hand = document.querySelector('.hand-zone');
  /* 角色行与手牌之间的纵向区间里是否还有决策盒（改前那条横杠） */
  let bar = null;
  if (box && chars && hand) {
    const bb = box.getBoundingClientRect(), cb = chars.getBoundingClientRect(), hb = hand.getBoundingClientRect();
    bar = { y: +bb.top.toFixed(1), between: bb.top >= cb.bottom - 1 && bb.bottom <= hb.top + 1 };
  }
  return {
    hasBox: !!box, hasPop: !!pop,
    inHeading: !!(box && head && head.contains(box)),
    trigger: R(trig), door: R(door), pop: R(pop), heading: R(head),
    popTop: pop ? +pop.getBoundingClientRect().top.toFixed(1) : null,
    selectors: document.querySelectorAll('#planning-actor').length,
    bar,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    hand: R(hand),
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
    const g = await geo(page);

    add(`${tag}：探险阶段确实有决策条（局面可用）`, g.hasBox, '');
    add(`${tag}：决策盒在「队伍与手牌」标题行内`, g.inHeading, g.hasBox ? 'ok' : 'no box');
    add(`${tag}：触发条压成胶囊（高 ≤ 28）`, !!g.trigger && g.trigger.h <= 28, g.trigger ? `h=${g.trigger.h}` : 'missing');
    add(`${tag}：触发条与「结束阶段」同一行（顶差 ≤ 3px）`,
      !!g.trigger && !!g.door && Math.abs(g.trigger.y - g.door.y) <= 3,
      g.trigger && g.door ? `trigger y=${g.trigger.y} door y=${g.door.y}` : 'missing');
    add(`${tag}：角色行与手牌之间不再有决策横杠`, !g.bar || !g.bar.between,
      g.bar ? `box y=${g.bar.y} between=${g.bar.between}` : 'no box');
    add(`${tag}：标题行高回到一行（≤ 32）`, !!g.heading && g.heading.h <= 32, g.heading ? `h=${g.heading.h}` : 'missing');

    add(`${tag}：浮层顶部不越过视口（≥ 0）`, g.hasPop && g.popTop !== null && g.popTop >= 0, `top=${g.popTop}`);
    add(`${tag}：浮层收窄（宽 ≤ 700）`, !!g.pop && g.pop.w <= 700, g.pop ? `w=${g.pop.w}` : 'no pop');
    add(`${tag}：浮层右缘与触发条右缘对齐（浮层挂在触发条上）`,
      !!g.pop && !!g.trigger && Math.abs(g.pop.r - g.trigger.r) <= 4,
      g.pop && g.trigger ? `pop r=${g.pop.r} trigger r=${g.trigger.r}` : 'missing');

    add(`${tag}：单人局不渲染「操作玩家」下拉`, g.selectors === 0, `n=${g.selectors}`);
    add(`${tag}：无横向溢出`, !g.overflowX);
    add(`${tag}：手牌仍在视口内`, !!g.hand && g.hand.b <= vp.h + 0.5, g.hand ? `bottom=${g.hand.b}` : 'missing');

    await page.screenshot({ path: path.join(OUT, `decide-seat-${vp.w}.png`) });
    await ctx.close();
  }

  await browser.close();
  const fails = checks.filter(c => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (errors.length) { console.log('PAGEERRORS:\n' + errors.join('\n')); process.exit(2); }
  console.log(`${checks.length - fails.length}/${checks.length} 通过`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
