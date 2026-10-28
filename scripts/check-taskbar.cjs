/* Acceptance for the four tabletop requirements, verified in a real browser:
   1. BGA-style sticky operation dock that concentrates the current task.
   2. Arkham-style public board + bottom player area + right rail (phases, log).
   3. Direct card picking drafts commitments/defence/attacks; nothing executes
      until every player confirms.
   4. Rule automation, smart windows and per-player view switching survive.
   Run: NODE_PATH=... node scripts/check-taskbar.cjs [--width 1440] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? Number(process.argv[i + 1]) : d; };
const WIDTH = arg('width', 1440);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

  /* v0.15.70：派遣面板就地渲染在手牌区「结束阶段」同一块（.decide-box），
     旧的 .mat-phase 已随 v0.15.69 移除；三处都要找。 */
  const PANEL = ':is(.operation-content, .decide-box, .planning-strip, .mat-phase)';
  const clickBtn = async t => { const el = page.locator(PANEL + ' button:not([disabled])', { hasText: t }).first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(260); return true; };
  /* v0.15.70：派遣的提交／确认收成 data-quest 上的唯一主按钮，文字标签会随状态变（提交名单／提交空名单）。
     v0.15.69 起提交名单会弹 choose() 模态确认框（quest-ui.js commit 分支），点完按钮要顺手点掉它。 */
  const acceptChoose = async () => { const ok = page.locator('dialog[open] #ok'); if (await ok.count()) { await ok.click(); await page.waitForTimeout(320); return true; } return false; };
  const clickQuest = async k => { const el = page.locator(PANEL + ' [data-quest="' + k + '"]:not([disabled])').first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(320); await acceptChoose(); return true; };
  const clickNext = async () => { const el = page.locator('.operation-title button.primary:not([disabled])').first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(400); return true; };
  const dockText = () => page.evaluate(() => document.querySelector('.operation-title')?.innerText.replace(/\n/g, ' | ') || '');
  const chips = () => page.evaluate(() => [...document.querySelectorAll('.op-chip')].map(x => x.textContent.trim()));

  // ---- 2. layout landmarks -------------------------------------------------
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  /* v0.15.67 起全员确认后自动执行剧本设置（app.js keepHand 分支内联 startScenario），
     finishSetup 按钮只在确认不齐时才存在；留一行兜底给老路径。 */
  const fin = page.locator('button[data-action="finishSetup"]');
  if (await fin.count()) await fin.click();
  await page.waitForTimeout(600);

  const marks = await page.evaluate(() => {
    const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + window.scrollY), w: Math.round(b.width) }; };
    return { dock: box('.operation-dock'), board: box('.public-table'), mat: box('.player-mat'), rail: box('.tabletop-rail'), log: box('.table-log'), rail2: box('.phase-rail-v')  /* v0.15.44：横排阶段胶囊已移除，改指右栏竖轴 */ };
  });
  /* v0.15.51：操作栏改为顶部通栏，右栏（阶段+日志）占满右侧全高。 */
  add('操作栏为顶部通栏、右栏居右', marks.board && marks.dock
    && marks.dock.x === marks.board.x && marks.dock.w > marks.board.w && marks.rail && marks.rail.x > marks.board.x, `dock x=${marks.dock?.x} w=${marks.dock?.w} board w=${marks.board?.w} rail x=${marks.rail?.x}`);
  add('底部玩家区位于公共桌面之下', marks.mat && marks.mat.y > marks.board.y, `${marks.board?.y} → ${marks.mat?.y}`);
  add('右侧牌堆与日志同栏且靠右', marks.rail && marks.rail.x > marks.board.x && marks.rail2 && marks.log, `rail x=${marks.rail?.x} board x=${marks.board?.x}`);
  add('玩家区与公共桌面同宽同起点', marks.mat.w === marks.board.w && marks.mat.x === marks.board.x, `${marks.mat.w}/${marks.board.w}`);

  // ---- 1. sticky dock keeps the task visible ------------------------------
  /* v0.15.41：整页锁定视口高度，页面本身不再滚动；操作栏始终在视口内。 */
  const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  add('对局页面不产生纵向滚动', noScroll, `docH=${await page.evaluate(() => document.documentElement.scrollHeight)} vh=${await page.evaluate(() => innerHeight)}`);
  const dockInView = await page.evaluate(() => {
    const b = document.querySelector('.operation-dock').getBoundingClientRect();
    return b.top >= 0 && b.bottom <= innerHeight + 0.5;
  });
  add('操作栏完整位于视口内', dockInView, 'dock in viewport');
  const baseTitle = await dockText();
  add('操作栏标题显示当前任务与阶段', /阶段/.test(baseTitle) && baseTitle.length > 4, baseTitle);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // walk to the quest commit step
  /* v0.15.46：阶段收尾改成「角色卡下方唯一的结束阶段按钮」，操作条里的下一阶段按钮已移除。
     这里改为直接点 .phase-door 的推进按钮（它是引擎 endPhase 的唯一入口）。 */
  const clickDoor = async () => {
    const el = page.locator('.phase-door .door-go:not([disabled])').first();
    if (!await el.count()) return false;
    await el.click(); await page.waitForTimeout(500); return true;
  };
  for (let i = 0; i < 24; i++) {
    const st = await page.evaluate(() => ({ phase: state.phase, step: state.questing && state.questing.step }));
    if (st.phase === 2 && st.step === 'commit') break;
    if (!await clickDoor()) break;
  }
  add('能到达探险投入步骤', await page.evaluate(() => state.phase === 2 && state.questing?.step === 'commit'), await page.evaluate(() => state.phase + '/' + state.questing?.step));

  /* v0.15.80：投入浮层自动弹出时会盖住桌面角色卡（非模态、从 decide-box 向上弹）。
     点桌面卡前先点触发按钮收起浮层（纯视图操作，草稿不丢）。 */
  const collapsePick = async () => {
    const t = page.locator('.pick-trigger[aria-expanded="true"]').first();
    if (await t.count()) { await t.click(); await page.waitForTimeout(200); return true; }
    return false;
  };

  // ---- 3. picking is a draft; execution waits for every player ------------
  await page.locator('.player-tabs button').nth(1).click();
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => ({ log: state.log.length, exhausted: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => h.exhausted))), committed: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => !!h.committed))) }));
  const card = page.locator('.player-mat .character-card.selectable .card-face').first();
  add('投入步骤有可选角色', await card.count() > 0, `count=${await card.count()}`);
  if (await card.count()) { await collapsePick(); await card.click(); await page.waitForTimeout(200); }
  const draft = await page.evaluate(() => ({ log: state.log.length, exhausted: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => h.exhausted))), committed: JSON.stringify(state.players.flatMap(p => p.heroStates.map(h => !!h.committed))), selected: document.querySelectorAll('.player-mat .table-card.selected').length }));
  add('点牌只产生草稿：日志/横置/已投入均不变', draft.log === before.log && draft.exhausted === before.exhausted && draft.committed === before.committed, `selected=${draft.selected}`);
  add('点牌后有金色选中标记', draft.selected > 0, `selected=${draft.selected}`);

  await clickQuest('commit');
  const mid = await page.evaluate(() => ({ locked: !!state.questing.deploymentLocked, chips: [...document.querySelectorAll('.op-chip')].map(x => x.textContent.trim()), title: document.querySelector('.operation-title').innerText.replace(/\n/g, ' | '), view: handView }));
  add('单人提交后不执行、不锁定', !mid.locked, `locked=${mid.locked}`);
  add('操作栏显示全员确认进度', mid.chips.length === 2 && mid.chips.some(c => c.includes('待提交')) && mid.chips.some(c => c.includes('已提交')), mid.chips.join(' | '));
  add('提交后视图切到待提交玩家', mid.view === 0, `view=${mid.view}`);

  const card2 = page.locator('.player-mat .character-card.selectable .card-face').first();
  if (await card2.count()) { await collapsePick(); await card2.click(); await page.waitForTimeout(150); }
  await clickQuest('commit');
  const ready = await page.evaluate(() => ({ locked: !!state.questing.deploymentLocked, committed: state.players.flatMap(p => p.heroStates.filter(h => h.committed).length).reduce((a, b) => a + b, 0), title: document.querySelector('.operation-title').innerText.replace(/\n/g, ' | '), chips: [...document.querySelectorAll('.op-chip')].map(x => x.textContent.trim()), approvals: (state.questing.deploymentApprovals || []).length, confirmButtons: document.querySelectorAll('.decide-box [data-quest="approveDeployment"]:not([disabled])').length }));
  add('两人都提交后仍不执行，进入二次确认', !ready.locked && ready.committed === 0, `locked=${ready.locked} committed=${ready.committed}`);
  add('操作栏提示二次确认进度', /二次确认/.test(ready.title) && ready.chips.length === 2 && ready.chips.every(c => c.includes('待确认')), ready.title + ' :: ' + ready.chips.join(' | '));
  add('二次确认收成单颗「确认派遣」', ready.confirmButtons === 1 && ready.approvals === 0, `buttons=${ready.confirmButtons} approvals=${ready.approvals}`);

  for (let i = 0; i < 4; i++) {
    /* 确认是按人来的：确认后 UI 自动把操作权交给下一位未确认玩家，所以这里可以连点。 */
    if (!await clickQuest('approveDeployment')) break;
  }
  const after = await page.evaluate(() => ({ locked: !!state.questing.deploymentLocked, committed: state.players.flatMap(p => p.heroStates.filter(h => h.committed).length).reduce((a, b) => a + b, 0), exhausted: state.players.flatMap(p => p.heroStates.filter(h => h.exhausted).length).reduce((a, b) => a + b, 0), approvals: (state.questing.deploymentApprovals || []).length }));
  add('确认后 approvals 递增', after.approvals >= 2, `approvals=${after.approvals}`);
  add('全员二次确认后才执行投入', after.locked && after.committed > 0 && after.exhausted > 0, `locked=${after.locked} committed=${after.committed} exhausted=${after.exhausted}`);

  // ---- 4. automation, smart windows, per-player switching ----------------
  const auto = await page.evaluate(() => {
    const before = JSON.stringify(state);
    const mode0 = ScenarioEngine.windows.settings(state).mode;
    ScenarioEngine.windows.setMode(state, 'detailed'); const mode1 = ScenarioEngine.windows.settings(state).mode;
    ScenarioEngine.windows.setMode(state, mode0); const mode2 = ScenarioEngine.windows.settings(state).mode;
    return { mode0, mode1, mode2, unchanged: JSON.stringify(state) === before };
  });
  add('智能窗口可切换且不改变规则状态', auto.mode1 === 'detailed' && auto.mode2 === auto.mode0 && auto.unchanged, `${auto.mode0}→${auto.mode1}→${auto.mode2}`);

  const sw = await page.evaluate(() => { const before = JSON.stringify(state); const v0 = handView; handView = v0 === 0 ? 1 : 0; render(); const v1 = handView; handView = v0; render(); return { before, after: JSON.stringify(state), v0, v1 }; });
  add('多人切换只改视图不改游戏状态', sw.before === sw.after && sw.v1 !== sw.v0, `view ${sw.v0}→${sw.v1}`);

  const autoRun = await page.evaluate(() => ({ log: state.log.slice(0, 10).join(' || '), tasks: state.questing?.tasks?.length || 0, step: state.questing?.step, dock: document.querySelector('.operation-title').innerText.replace(/\n/g, ' | '), committed: state.players.flatMap(p => p.heroStates.filter(h => h.committed).length).reduce((a, b) => a + b, 0) }));
  add('规则自动按顺序执行投入', /投入/.test(autoRun.log) && autoRun.committed >= 1, `committed=${autoRun.committed} log=${autoRun.log.slice(0, 80)}`);
  add('投入后的强制效果被接管为当前任务', autoRun.tasks > 0 && /强制/.test(autoRun.dock), `tasks=${autoRun.tasks} dock=${autoRun.dock}`);
  add('无脚本错误', errors.length === 0, errors.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(OUT, `24-taskbar-${WIDTH}.png`) });
  await browser.close();

  const failed = checks.filter(c => !c.ok);
  fs.writeFileSync(path.join(OUT, `taskbar-report-${WIDTH}.json`), JSON.stringify({ width: WIDTH, at: new Date().toISOString(), ok: failed.length === 0, checks }, null, 1));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  [${c.detail}]`);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed @ ${WIDTH}px`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
