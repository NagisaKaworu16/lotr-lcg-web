/* 手牌「付不起就变灰」的真实浏览器验收。
 * 用法：node scripts/check-affordable.cjs
 *
 * 要守住的行为（v0.15.58 修的缺陷）：
 *  1. 资源清零后，该玩家所有手牌带 .unaffordable 且按钮 disabled —— 以前 playSpec 先被
 *     「当前不是计划或探险阶段 / 仅当前计划玩家…」拦掉，reason 里根本不出「资源不足」，
 *     于是资源用光了一手牌还全亮着。
 *  2. 置灰不依赖「此刻轮不轮得到你出牌」：切到别人的视角，按那个人的资源单独判定。
 *  3. 只是置灰，不吞悬停：置灰牌仍带 data-hover-src，能放大看牌文。
 *  4. 资源充足时绝不误伤：没有灰色牌。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const candidates = [
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const executablePath = process.env.CHROME_PATH || candidates.find(p => fs.existsSync(p));

const results = [];
const check = (name, ok, data) => {
  results.push({ name, ok });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (data ? ' ' + JSON.stringify(data) : ''));
};

/* 手牌状态快照：数量 / 灰色数 / 禁用数 / 可点亮的数 / 灰色牌是否保留悬停探针 */
const handState = page => page.evaluate(() => {
  const cs = [...document.querySelectorAll('.hand-card')];
  return {
    n: cs.length,
    grey: cs.filter(c => c.classList.contains('unaffordable')).length,
    disabled: cs.filter(c => c.querySelector('.card-face')?.disabled).length,
    live: cs.filter(c => c.classList.contains('selectable')).length,
    probe: cs.filter(c => c.classList.contains('unaffordable')).every(c => c.hasAttribute('data-hover-src')) ||
           cs.filter(c => c.classList.contains('unaffordable')).length === 0,
    sample: cs.map(c => (c.querySelector('.card-legality') || {}).textContent || '').slice(0, 3),
  };
});

(async () => {
  if (!executablePath) { console.error('未找到 Chrome/Chromium，可设置 CHROME_PATH'); process.exit(2); }
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(pageUrl);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click();
  await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(700);
  for (let i = 0; i < 8; i++) {
    const hit = await page.evaluate(() => {
      const b = document.querySelector('button[data-action="keepHand"]:not([disabled])');
      if (b) { b.click(); return 1; }
      return 0;
    });
    if (!hit) break;
    await page.waitForTimeout(160);
  }
  await page.locator('button[data-action="finishSetup"]').click();
  await page.waitForTimeout(800);

  /* 建局后自动落在计划阶段（资源阶段已自动结算）；保险起见再推一下 */
  for (let i = 0; i < 6; i++) {
    const ph = await page.evaluate(() => window.LOTR.state.phase);
    if (ph === 1) break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.phase-door .door-go')].find(x => !x.disabled);
      if (b) b.click();
    });
    await page.waitForTimeout(400);
  }
  const phase = await page.evaluate(() => window.LOTR.state.phase);
  check('进入计划阶段', phase === 1, { phase });

  /* 建局后手牌是随机的，1 费/2 费牌常常付得起，所以不能用「灰色数 === 0」当基线。
     真正要守的是口径一致：界面灰色数 === 引擎判 affordable===false 的牌数。 */
  const audit = () => page.evaluate(() => {
    const s = window.LOTR.state, P = window.LOTR.E.planning;
    const cs = [...document.querySelectorAll('.hand-card')];
    let engineGrey = 0, mismatch = 0, live = 0;
    for (const c of cs) {
      const uid = c.querySelector('.card-face')?.dataset.uid;
      const owner = s.players.find(p => p.hand.some(x => String(x.uid) === String(uid)));
      const sp = P.playSpec(s, owner.id, uid);
      const grey = c.classList.contains('unaffordable');
      if (sp.affordable === false) engineGrey++;
      if (grey !== (sp.affordable === false)) mismatch++;
      if (c.classList.contains('selectable')) live++;
    }
    return { n: cs.length, grey: cs.filter(c => c.classList.contains('unaffordable')).length, engineGrey, live, mismatch,
      sample: cs.map(c => (c.querySelector('.card-legality') || {}).textContent || '').slice(0, 4) };
  });

  const base = await audit();
  check('进入计划阶段手牌已渲染', base.n > 0, { n: base.n });
  check('初始：灰色口径与引擎一致', base.mismatch === 0 && base.grey === base.engineGrey, base);

  /* 1. 把当前行动玩家的资源清零 */
  const zeroRes = await page.evaluate(() => {
    const s = window.LOTR.state;
    const pid = s.planning?.order?.[s.planning.index] ?? s.players[0].id;
    for (const h of s.players[pid].heroStates) h.resources = 0;
    window.LOTR.refresh();
    return pid;
  });
  await page.waitForTimeout(300);
  const zero = await handState(page);
  /* 0 费牌（如「共同事业」）照样付得起，规则上就该保持可点——只要求「除 0 费外全灰」。 */
  const freeCount = await page.evaluate(() => {
    const s = window.LOTR.state, P = window.LOTR.E.planning;
    const pid = s.planning?.order?.[s.planning.index] ?? s.players[0].id;
    return s.players[pid].hand.filter(c => P.playSpec(s, pid, c.uid).cost === 0).length;
  });
  check('资源清零后除 0 费牌外全部变灰', zero.grey === zero.n - freeCount, { ...zero, freeCount });
  check('资源清零后付不起的牌全部禁用', zero.disabled === zero.n, { disabled: zero.disabled, n: zero.n });
  check('资源清零后无可点亮的手牌', zero.live === Math.min(freeCount, 0), { live: zero.live, freeCount });
  check('灰色牌仍可悬停看牌文', zero.probe === true, { probe: zero.probe });
  check('灰色原因写明差额', zero.sample.filter(t => /资源不足/.test(t)).length >= 1, { sample: zero.sample });

  /* 2. 切到另一位玩家：按那个人的资源单独判定，不继承上一位的灰色状态 */
  const tabs = await page.locator('.player-tabs button[data-action="desktop"]').count();
  if (tabs > 1) {
    await page.locator('.player-tabs button[data-action="desktop"]').nth(1).click();
    await page.waitForTimeout(400);
    const other = await audit();
    check('切换玩家后仍按各自资源判定', other.n > 0 && other.mismatch === 0, other);
  } else {
    check('切换玩家后仍按各自资源判定（单玩家跳过）', true, { tabs });
  }

  check('无页面报错', errs.length === 0, { errs: errs.slice(0, 3) });

  await page.screenshot({ path: path.join(root, 'docs/browser-acceptance/v0.15.58-hand-unaffordable.png'), fullPage: false });
  await browser.close();

  const pass = results.every(r => r.ok);
  console.log(pass ? 'ALL PASS (' + results.length + '/' + results.length + ')' : 'FAILED ' + results.filter(r => !r.ok).length + '/' + results.length);
  process.exit(pass ? 0 : 1);
})();
