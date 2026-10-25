/* Regression for v0.15.54: playing an attachment used to push the hand row and
   the phase door out of .player-mat (overflow:hidden clipped both).
   Run: NODE_PATH=... node scripts/check-attachment.cjs */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.dirname(__dirname);
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE); await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.locator('button[data-action="finishSetup"]').click(); await page.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { if (await page.evaluate(() => state.phase === 1)) break; const d = page.locator('.phase-door .door-go:not([disabled])'); if (await d.count()) await d.first().click(); await page.waitForTimeout(500); }
  const uid = await page.evaluate(() => {
    state.players[0].heroStates.forEach(h => h.resources = 9);
    const card = { code: '01026', uid: ++state.serial, damage: 0, exhausted: false, resources: 0 };
    state.players[0].hand.push(card); render(); return card.uid;
  });
  await page.locator(`.player-mat button[data-action="planning"][data-plan="play"][data-uid="${uid}"]`).first().click();
  await page.waitForTimeout(300);
  await page.locator('.planning-dialog #plan-confirm').click(); await page.waitForTimeout(450);
  const m = await page.evaluate(() => {
    const mat = document.querySelector('.player-mat');
    return { scroll: mat.scrollHeight, h: Math.round(mat.getBoundingClientRect().height), hand: !!document.querySelector('.player-mat .hand-zone'), handCards: document.querySelectorAll('.player-mat .hand-zone .card-face').length, door: !!document.querySelector('.phase-door .door-go'), atts: state.players[0].attachments.length };
  });
  const checks = [
    ['附属已入场', m.atts === 1, 'atts=' + m.atts],
    ['玩家区内容不再溢出', m.scroll <= m.h + 2, `scroll=${m.scroll} h=${m.h}`],
    ['手牌区仍可见', m.hand && m.handCards >= 5, 'handCards=' + m.handCards],
    ['结束阶段按钮仍可见', m.door, 'door=' + m.door],
    ['无脚本错误', errors.length === 0, errors.join('/')],
  ];
  const bad = checks.filter(c => !c[1]);
  for (const [n, ok, d] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  [${d}]`);
  await page.screenshot({ path: path.join(ROOT, 'docs', 'browser-acceptance', '27-attachment-fixed.png') });
  await browser.close();
  console.log(`\n${checks.length - bad.length}/${checks.length} passed`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
