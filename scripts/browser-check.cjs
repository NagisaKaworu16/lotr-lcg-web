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
  /* v0.15.70：派遣面板就地渲染在手牌区「结束阶段」同一块（.decide-box），
     不再是操作条里的一块；三处都要找。 */
  const PANEL = ':is(.operation-content, .decide-box, .planning-strip)';
  const clickBtn = async text => {
    const el = page.locator(`${PANEL} button:not([disabled])`, { hasText: text }).first();
    if (!await el.count()) return false;
    await el.click(); idle = 0; await page.waitForTimeout(280); return true;
  };
  /* 派遣的提交／二次确认收成 data-quest 上的唯一主按钮（文字会随状态变，不能靠文字定位）。 */
  const clickQuest = async k => {
    const el = page.locator(`${PANEL} [data-quest="${k}"]:not([disabled])`).first();
    if (!await el.count()) return false;
    await el.click(); idle = 0; await page.waitForTimeout(300); return true;
  };
  /* v0.15.70：派遣主按钮收成 data-quest，但战斗的「二次确认」在 combat-ui.js 里走 data-combat。
     原先按文案「二次确认」匹配的通用写法被改成只认 data-quest，战斗路径因此点不到——这里两类都认。 */
  const approve = async () => {
    for (const sel of ['[data-combat="approve"]', '[data-quest="approveDeployment"]']) {
      const el = page.locator(`${PANEL} ${sel}:not([disabled])`).first();
      if (await el.count()) { await el.click(); idle = 0; await page.waitForTimeout(300); return true; }
    }
    return false;
  };
  const clickNext = async () => {
    const el = page.locator('.operation-title button.primary:not([disabled])').first();
    if (!await el.count()) return false;
    await el.click(); idle = 0; await page.waitForTimeout(380); return true;
  };
  /* 兜底：智能/强制窗口的选项按钮（卡名目标、响应选项、关闭窗口等）。
     排除回退／详细模式／重置等危险或不推进流程的按钮。
     v0.15.77：扫描范围扩到整个 PANEL——战斗响应窗口等选项在 .decide-box 里，
     只扫 .operation-content 会漏点导致 stall（2026-10-27 实测防御响应窗口卡死）。 */
  const windowOption = async () => {
    const els = page.locator(`${PANEL} button:not([disabled])`);
    const n = await els.count();
    for (let k = 0; k < n; k++) {
      const t = (await els.nth(k).textContent() || '').trim();
      if (/回退|详细模式|重新选择剧本|导出|重置|结束当前/.test(t)) continue;
      await els.nth(k).click(); idle = 0; await page.waitForTimeout(280); return true;
    }
    return false;
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

  const startGame = async (players, scenario) => {
    await page.selectOption('#playerCount', String(players));
    await page.waitForTimeout(200);
    await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
    await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
    if (scenario) {
      await page.locator('button[data-action="ngMode"][data-value="standalone"]').click(); await page.waitForTimeout(250);
      await page.locator('.ng-card', { hasText: scenario }).first().click(); await page.waitForTimeout(300);
    }
    await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
    await page.locator('[data-action="chooserConfirm"]').click();
    await page.waitForTimeout(600);
    for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
    await page.waitForTimeout(200);
    /* v0.15.64 起：全员确认手牌后引擎自动执行剧本设置并进入计划阶段，
       「确认手牌并执行剧本设置」按钮随面板一起消失。这里改为「有就点、没有就直接走」，
       并用 setupPending 断言兜住——否则脚本会死在等待一颗永远不存在的按钮上。 */
    const finish = page.locator('button[data-action="finishSetup"]');
    if (await finish.count()) { await finish.click(); await page.waitForTimeout(400); }
  };

  // ============ 2人 幽暗密林 @1440 ============
  await startGame(2);
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
  /* v0.15.80：浮层自动弹出且盖住桌面角色卡时，改点浮层缩略图（同一草稿路径，
     R3 双向同步会让桌面角色卡同样出现 .selected 金标记，断言不变）。 */
  const collapsePick = async () => {
    const t = page.locator('.pick-trigger[aria-expanded="true"]').first();
    if (await t.count()) { await t.click(); await page.waitForTimeout(200); return true; }
    return false;
  };
  const pickThumb = page.locator('.quest-pick .qp-card .card-face:not([aria-disabled])').first();
  const pick = (await pickThumb.count()) ? pickThumb : page.locator('.player-mat .character-card.selectable .card-face').first();
  const draftOk = { selectable: await page.locator('.player-mat .character-card.selectable .card-face').count() };
  if (draftOk.selectable) {
    await pick.click(); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ log: state.log.length, exhausted: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => h.exhausted))), selected: document.querySelectorAll('.player-mat .character-card.selected').length }));
    draftOk.stateUnchanged = after.log === before.log && after.exhausted === before.exhausted;
    draftOk.marked = after.selected > 0;
    await shot('03-2p-quest-pick-1440');
    /* v0.15.80：浮层脚部的橡皮擦可见文案改为「重置选择」（aria-label 仍含「清空选择」）。 */
    await clickBtn('重置选择');
  }
  note('pick-is-draft-only', draftOk.stateUnchanged === true && draftOk.marked === true, draftOk);

  // 派遣提交 → 自动切换到下一位待提交玩家
  let autoSwitch = {};
  for (let i = 0; i < 6; i++) {
    const pending = await page.evaluate(() => state.questing?.step === 'commit' && !state.questing.deploymentLocked ? state.questing.order.filter(id => !state.questing.deployments?.[id]?.confirmed) : []);
    if (!pending.length) break;
    await page.locator('.player-tabs button').nth(pending[0]).click(); await page.waitForTimeout(200);
    const card = page.locator('.player-mat .character-card.selectable .card-face').first();
    if (await card.count()) { await collapsePick(); await card.click(); await page.waitForTimeout(150); }
    const viewBefore = await page.evaluate(() => handView);
    if (!await clickQuest('commit')) break;
    /* 提交名单会弹「确认派遣」对话框（单人/多人一致）；不点确认则名单永远不会 confirmed，
       断言会读到一个「点了但什么都没发生」的现场。 */
    await handleDialog();
    await page.waitForTimeout(150);
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
        if (await card.count()) { await collapsePick(); await card.click(); await page.waitForTimeout(150); }
        if (await clickQuest('commit')) continue;
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
    if (await clickBtn('处理强制选择')) continue;
    if (await clickBtn('处理响应／选择')) continue;
    if (await clickBtn('处理卡牌响应')) continue;
    if (await clickBtn('结算本张暗影／继续')) continue;
    if (await clickBtn('二次确认旅行')) continue;
    if (await clickBtn('暂定本次不旅行')) continue;
    if (await clickBtn('暂定：')) continue;
    if (await clickBtn('暂定不主动交战')) continue;
    if (await clickBtn('选择并结算')) continue;
    /* 交战同值敌人：起始玩家要从同值敌人里挑一个接战（面板按钮 data-encounter="tie"）。 */
    { const tie = page.locator(PANEL + ' [data-encounter="tie"]:not([disabled])').first(); if (await tie.count()) { await tie.click(); await page.waitForTimeout(300); continue; } }
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
    if (await windowOption()) continue;
    if (++idle > 3) {
      const stall = await page.evaluate(() => ({
        title: document.querySelector('.operation-title')?.textContent.trim(),
        buttons: [...document.querySelectorAll('.operation-content button')].map(b => (b.disabled ? 'X ' : '+ ') + b.textContent.trim()).slice(0, 20),
        boxButtons: [...document.querySelectorAll('.decide-box button')].map(b => (b.disabled ? 'X ' : '+ ') + b.textContent.trim()).slice(0, 20),
        badge: [...document.querySelectorAll('.decide-badge')].map(b => b.textContent.trim()),
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
  await page.locator('.game-hud button[data-action="desktop"][data-desktop="reset"]').click();
  await page.waitForTimeout(400);
  await startGame(4, '逃离多尔哥多');
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
