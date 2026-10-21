/* Real-browser acceptance for the offline build (v0.14.x tabletop).
 * Uses the locally installed Chrome/Edge via playwright-core; no browser download.
 *   NODE_PATH=<playwright-core node_modules> node scripts/browser-check.cjs
 * Writes screenshots and report.json into docs/browser-acceptance/.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'browser-acceptance');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const chromeCandidates = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = chromeCandidates.find(p => fs.existsSync(p));
const report = { pageUrl, executablePath, startedAt: new Date().toISOString(), checks: [], screenshots: [], consoleErrors: [], pageErrors: [], failedImages: [] };
const note = (name, ok, data) => { report.checks.push({ name, ok, ...data }); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' ' + JSON.stringify(data || {})); };

let browser;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  if (!executablePath) throw new Error('未找到本机 Chrome/Edge');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(6000);
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(pageUrl);
  await page.waitForTimeout(500);

  let idle = 0;
  const clickBtn = async text => {
    const el = page.locator(`.operation-content button:not([disabled])`, { hasText: text }).first();
    if (!await el.count()) return false;
    await el.click(); idle = 0; await page.waitForTimeout(280); return true;
  };
  const approve = async () => {
    const el = page.locator('.operation-content button:not([disabled])').filter({ hasText: '二次确认' }).filter({ hasNotText: '取消' }).first();
    if (!await el.count()) return false;
    await el.click(); await page.waitForTimeout(300); return true;
  };
  const clickNext = async () => {
    const el = page.locator('.operation-title button.primary:not([disabled])').first();
    if (!await el.count()) return false;
    await el.click(); idle = 0; await page.waitForTimeout(380); return true;
  };
  const handleDialog = async () => {
    if (!await page.locator('dialog[open]').count()) return false;
    const dlg = page.locator('dialog[open]').last();
    for (const sel of await dlg.locator('select:not([data-pay])').all()) {
      if (await sel.locator('option').count() > 1) { await sel.selectOption({ index: 1 }); await page.waitForTimeout(120); }
    }
    const paySels = await dlg.locator('select[data-pay]').all();
    if (paySels.length) {
      const cost = Number((await dlg.locator('.payment-panel h3').textContent().catch(() => '') || '').match(/\d+/)?.[0] || 0);
      let left = cost;
      for (const sel of paySels) {
        if (left <= 0) break;
        const vals = await sel.locator('option').evaluateAll(os => os.map(o => Number(o.value)));
        if (!vals.length) continue;
        const use = Math.min(left, Math.max(...vals));
        await sel.selectOption(String(use)); left -= use; await page.waitForTimeout(100);
      }
    }
    const ok = dlg.locator('#ok, #plan-confirm').first();
    if (await ok.count() && await ok.isEnabled()) { await ok.click(); await page.waitForTimeout(350); return true; }
    const cancel = dlg.locator('#plan-cancel, #cancel').first();
    if (await cancel.count()) { await cancel.click(); await page.waitForTimeout(200); return true; }
    return false;
  };
  const shot = async name => {
    const m = await page.evaluate(() => {
      const de = document.documentElement, dock = document.querySelector('.operation-dock');
      return { overflowX: de.scrollWidth > de.clientWidth + 1, scrollWidth: de.scrollWidth, dock: dock ? { sticky: ['sticky', 'fixed'].includes(getComputedStyle(dock).position), scrollable: dock.scrollHeight > dock.clientHeight + 1, overflowY: getComputedStyle(dock).overflowY } : null };
    });
    await page.screenshot({ path: path.join(outDir, name + '.png') });
    report.screenshots.push(name + '.png');
    note('layout:' + name, !m.overflowX, m);
  };
  const snap = () => page.evaluate(() => ({
    phase: state.phase, round: state.round, view: handView,
    quest: state.questing && { step: state.questing.step, locked: !!state.questing.deploymentLocked },
    travel: !!state.traveling, enc: !!state.encountering, combat: state.combat && { step: state.combat.step, proposal: !!state.combat.proposal },
    refresh: !!state.refreshing,
  }));

  const startGame = async (players, scenarioText) => {
    await page.selectOption('#playerCount', String(players));
    await page.waitForTimeout(200);
    await page.locator('.ng-tabs button', { hasText: '支线剧情' }).click(); await page.waitForTimeout(250);
    await page.locator('.ng-card', { hasText: scenarioText }).first().click(); await page.waitForTimeout(300);
    await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
    await page.locator('[data-action="chooserConfirm"]').click();
    await page.waitForTimeout(600);
    for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
    await page.waitForTimeout(200);
    await page.locator('button[data-action="finishSetup"]').click();
    await page.waitForTimeout(400);
  };

  // ============ 2人 幽暗密林 @1440 ============
  await startGame(2, '幽暗密林');
  note('start-2p', await page.evaluate(() => state.players.length === 2 && !state.setupPending));
  await shot('01-2p-setup-1440');
  await clickNext(); await page.waitForTimeout(300);
  await shot('02-2p-planning-1440');

  // 探险：点选只是草稿
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => state.phase === 2 && state.questing?.step === 'commit')) break;
    if (await clickBtn('结束我的盟友／附属出牌步骤')) continue;
    if (await clickBtn('继续到下一决策点')) continue;
    if (await clickBtn('：放弃剩余行动')) continue;
    await clickNext();
  }
  let st = await snap();
  note('enter-quest', st.phase === 2, st);
  const before = await page.evaluate(() => ({ log: state.log.length, exhausted: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => h.exhausted))) }));
  const pick = page.locator('.player-mat .character-card.selectable .card-face').first();
  const draftOk = { selectable: await pick.count() };
  if (draftOk.selectable) {
    await pick.click(); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ log: state.log.length, exhausted: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => h.exhausted))), selected: document.querySelectorAll('.player-mat .character-card.selected').length }));
    draftOk.stateUnchanged = after.log === before.log && after.exhausted === before.exhausted;
    draftOk.marked = after.selected > 0;
    await shot('03-2p-quest-pick-1440');
    await clickBtn('清空选择');
  }
  note('pick-is-draft-only', draftOk.stateUnchanged === true && draftOk.marked === true, draftOk);

  // 派遣提交 → 自动切换到下一位待提交玩家
  let autoSwitch = {};
  for (let i = 0; i < 6; i++) {
    const pending = await page.evaluate(() => state.questing?.step === 'commit' && !state.questing.deploymentLocked ? state.questing.order.filter(id => !state.questing.deployments?.[id]?.confirmed) : []);
    if (!pending.length) break;
    await page.locator('.player-tabs button').nth(pending[0]).click(); await page.waitForTimeout(200);
    const card = page.locator('.player-mat .character-card.selectable .card-face').first();
    if (await card.count()) { await card.click(); await page.waitForTimeout(150); }
    const viewBefore = await page.evaluate(() => handView);
    if (!await clickBtn('提交暂定派遣名单')) break;
    autoSwitch = await page.evaluate(vb => ({ viewBefore: vb, viewAfter: handView, confirmed: state.questing.order.map(id => !!state.questing.deployments?.[id]?.confirmed) }), viewBefore);
    if (pending.length > 1) break;
  }
  note('quest-submit-auto-switch', autoSwitch.viewAfter !== undefined && autoSwitch.viewAfter !== autoSwitch.viewBefore, autoSwitch);
  for (let i = 0; i < 4; i++) { if (await approve()) continue; break; }
  await shot('04-2p-quest-1440');

  // 走完剩余阶段直到第二回合
  let reached = null;
  for (let i = 0; i < 160; i++) {
    const s = await snap();
    reached = s;
    if (s.round >= 2 && s.phase === 0) break;
    if (await handleDialog()) { idle = 0; continue; }
    if (s.phase === 2 && s.quest?.step === 'commit' && !s.quest.locked) {
      const pending = await page.evaluate(() => state.questing.order.filter(id => !state.questing.deployments?.[id]?.confirmed));
      if (pending.length) {
        await page.locator('.player-tabs button').nth(pending[0]).click(); await page.waitForTimeout(200);
        const card = page.locator('.player-mat .character-card.selectable .card-face').first();
        if (await card.count()) { await card.click(); await page.waitForTimeout(150); }
        if (await clickBtn('提交暂定派遣名单')) continue;
      } else {
        if (await approve()) continue;
        if (await clickBtn('开始投入角色')) continue;
      }
    }
    if (s.phase === 4 && await page.evaluate(() => state.encountering?.step === 'optional')) {
      const need = await page.evaluate(() => state.encountering.turnOrder.filter(id => !state.encountering.choices[id]));
      if (need.length) {
        await page.locator('.player-tabs button').nth(need[0]).click(); await page.waitForTimeout(200);
        const skip = page.locator(`button[data-encounter="skip"][data-player="${need[0]}"]:not([disabled])`).first();
        if (await skip.count()) { await skip.click(); await page.waitForTimeout(280); continue; }
      }
      if (await clickBtn('二次确认交战方案')) continue;
    }
    if (s.phase === 5 && s.combat) {
      const cs = await page.evaluate(() => ({ step: state.combat?.step, proposal: !!state.combat?.proposal }));
      if (cs.proposal) { if (await approve()) continue; }
      if (cs.step === 'enemyChoice' && !cs.proposal && await clickBtn('暂定 ')) continue;
      if (cs.step === 'defenseChoice') {
        const chosen = await page.locator('.table-card.selected').count();
        const pickBtn = page.locator('[data-desktop="pick"]:not([disabled])').first();
        const submit = page.locator('button[data-desktop="submit"]:not([disabled])').first();
        if (!chosen && await pickBtn.count()) { await pickBtn.click(); await page.waitForTimeout(200); continue; }
        if (await submit.count()) { await submit.click(); await page.waitForTimeout(300); continue; }
      }
      if (cs.step === 'attackChoice') {
        const hasTarget = await page.locator('.encounter-card.selected').count();
        const chosen = await page.locator('.table-card.selected').count();
        const target = page.locator('[data-desktop="target"]:not([disabled])').first();
        const pickBtn = page.locator('[data-desktop="pick"]:not([disabled])').first();
        const submit = page.locator('button[data-desktop="submit"]:not([disabled])').first();
        const endAtk = page.locator('button[data-combat="endAttacks"]:not([disabled])').first();
        if (!hasTarget && await target.count()) { await target.click(); await page.waitForTimeout(200); continue; }
        if (hasTarget && !chosen && await pickBtn.count()) { await pickBtn.click(); await page.waitForTimeout(200); continue; }
        if (hasTarget && chosen && await submit.count()) { await submit.click(); await page.waitForTimeout(300); continue; }
        if (await endAtk.count()) { await endAtk.click(); await page.waitForTimeout(300); continue; }
      }
    }
    if (await clickBtn('处理卡牌响应')) continue;
    if (await clickBtn('结算本张暗影／继续')) continue;
    if (await clickBtn('二次确认旅行')) continue;
    if (await clickBtn('暂定：')) continue;
    if (await clickBtn('暂定不主动交战')) continue;
    if (await clickBtn('选择并结算')) continue;
    if (await clickBtn('结算此牌的关键词与效果')) continue;
    if (await clickBtn('翻开下一张遭遇牌')) continue;
    if (await clickBtn('结束探查')) continue;
    if (await clickBtn('自动结算探险')) continue;
    if (await clickBtn('开始探查')) continue;
    if (await clickBtn('结束探险阶段')) continue;
    if (await clickBtn('二次确认刷新')) continue;
    if (await clickBtn('二次确认')) continue;
    if (await clickBtn('推进探险')) continue;
    if (await clickBtn('结束我的盟友／附属出牌步骤')) continue;
    if (await clickBtn('：放弃剩余行动')) continue;
    if (await clickBtn('继续到下一决策点')) { idle = 0; continue; }
    if (await clickNext()) continue;
    if (++idle > 3) {
      const stall = await page.evaluate(() => ({
        title: document.querySelector('.operation-title')?.textContent.trim(),
        buttons: [...document.querySelectorAll('.operation-content button')].map(b => (b.disabled ? 'X ' : '+ ') + b.textContent.trim()).slice(0, 20),
        pending: state.pending.map(t => t.text), dialogs: document.querySelectorAll('dialog').length,
        combat: state.combat && { step: state.combat.step }, enc: state.encountering && state.encountering.step,
      }));
      note('stall', false, stall);
      break;
    }
  }
  note('full-round-loop', !!reached && reached.round >= 2, reached);
  await shot('05-2p-round2-1440');

  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
  report.failedImages = imgs.filter(i => i.complete && !i.ok).map(i => i.src).slice(0, 20);
  note('images-load', report.failedImages.length === 0, { total: imgs.length, failed: report.failedImages.length });

  // ============ 4人 都尔哥多 @1920 + 长手牌 ============
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.expedition-title button[data-action="desktop"][data-desktop="reset"]').click();
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '4');
  await page.waitForTimeout(200);
  await page.locator('.ng-tabs button', { hasText: '支线剧情' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '逃离多尔哥多' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(600);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.waitForTimeout(200);
  await page.locator('button[data-action="finishSetup"]').click();
  await page.waitForTimeout(400);
  note('start-4p', await page.evaluate(() => state.players.length === 4), { scenario: await page.evaluate(() => state.scenario) });
  await shot('06-4p-1920');
  await page.evaluate(() => { const p = state.players[0]; while (p.hand.length < 16) p.hand.push(structuredClone(p.hand[p.hand.length % 3] || p.hand[0])); render(); });
  await page.waitForTimeout(300);
  await shot('07-4p-long-hand-1920');
  const hand = await page.evaluate(() => {
    const de = document.documentElement;
    return { overflowX: de.scrollWidth > de.clientWidth + 1, handCards: document.querySelectorAll('.player-mat .hand-card').length };
  });
  note('long-hand-no-overflow', !hand.overflowX, hand);

  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.ok = report.checks.every(c => c.ok) && report.pageErrors.length === 0;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nreport:', path.join(outDir, 'report.json'), 'ok=' + report.ok);
  if (report.pageErrors.length) console.error('pageErrors:', report.pageErrors);
  if (!report.ok) process.exitCode = 1;
})().catch(e => {
  console.error('FAILED:', e.message);
  try { if (browser) Promise.resolve(browser.close()).catch(() => {}); } catch {}
  report.error = e.message;
  report.ok = false;
  try { fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2)); } catch {}
  process.exitCode = 1;
});
