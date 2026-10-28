/* 浮层内「图形化表达」验收（v0.15.86）。
   用户反馈：「弹窗内如果能以图形化显示的，最好不要用文字展示」——截图里战斗浮层
   两处空态只是「没有合法攻击目标」「该目标没有可派出的角色」两行灰字，
   底部草稿也只是一条长句。这次改成：空态卡（图标 + 结论 + 出路）、步骤条（编号圆点 +
   连线 + 状态色）、草稿代币摘要（assets/tokens 素材 + 大字数字）。
   做法：真实开一局 → 摆到战斗「玩家攻击选择」→ 依次断言三种状态并各拍一张截图：
     ① 未选目标（aim 空态 + 第一步高亮）
     ② 已选目标（第一步打勾 + 角色网格）
     ③ 目标全不合法（none 空态，且草稿必须同步清空，不再出现「没有敌人却有已选 2 名」）
   运行：NODE_PATH=<node_modules> node scripts/check-pick-graphic.cjs [--width 1440] */
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
const WIDTH = (() => { const i = process.argv.indexOf('--width'); return i > -1 ? Number(process.argv[i + 1]) : 1440; })();

/* 摆局：把对局推进到战斗阶段「玩家攻击选择」，桌面挂一名敌人（与 combat-pick-tests 同一套字段）。 */
function setupCombat() {
  state.phase = 5;
  const enemy = { ...E.byId[97], uid: ++state.serial, shadows: [] };
  state.players[0].engaged.push(enemy);
  state.encountering = { ...(state.encountering || {}), completed: true };
  state.combat = {
    round: state.round, step: 'attackChoice', order: [0, 1], turnOrder: [0, 1], index: 0,
    enemyIndex: 0, playerIndex: 0, doneEnemies: [], doneAttacks: [], finalPasses: [], queue: [],
    tasks: [], discussion: true, approvals: [], proposal: null, riders: [], stack: [],
    returnShadows: [], completed: false, closing: false,
    attack: { kind: 'enemy', player: 0, uid: enemy.uid, defenders: [], bonus: 0, shadowIndex: 0, usedResponses: [], attackers: [] },
  };
  handView = 0;
  render();
  return enemy.uid;
}

/* 量算浮层里的图形化节点：空态尺寸、步骤条状态、代币图标是否真的加载成功。 */
const MEASURE = () => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const pop = document.querySelector('.decide-pop');
  const body = pop && pop.querySelector('.decide-body');
  const voids = [...document.querySelectorAll('.decide-pop .pick-void')].map(v => ({
    box: r(v), ico: r(v.querySelector('.pick-void-ico')),
    svg: r(v.querySelector('.pick-void-ico svg')),
    title: v.querySelector('b')?.textContent || '', why: v.querySelector('em')?.textContent || '',
  }));
  const steps = [...document.querySelectorAll('.decide-pop .pick-col-head')].map(h => {
    const dot = h.querySelector('.pick-step-dot');
    return {
      box: r(h), label: h.querySelector('.pick-col-label')?.textContent || '',
      done: dot.classList.contains('is-done'), active: dot.classList.contains('is-active'),
      dotBorder: getComputedStyle(dot).borderColor,
      check: !!dot.querySelector('svg'),
      count: h.querySelector('.pick-step-count')?.textContent || null,
    };
  });
  const cols = [...document.querySelectorAll('.decide-pop .pick-col')].map(c => r(c));
  const chips = [...document.querySelectorAll('.decide-pop .draft-chip')].map(c => ({
    box: r(c), ico: (() => { const i = c.querySelector('.draft-chip-ico'); return i ? { w: i.naturalWidth, display: getComputedStyle(i).display, box: r(i) } : null; })(),
    num: r(c.querySelector('.draft-num')), numSize: parseFloat(getComputedStyle(c.querySelector('.draft-num') || c).fontSize),
    text: c.textContent.trim(),
  }));
  const submit = document.querySelector('.decide-pop .table-selection .actions button[data-desktop="submit"]');
  return {
    title: pop ? (pop.querySelector('h2')?.textContent || '') : null,
    pop: r(pop), body: r(body),
    bodyScrollW: body ? body.scrollWidth : 0, bodyClientW: body ? body.clientWidth : 0,
    bodyScrollH: body ? body.scrollHeight : 0,
    voids, steps, cols, chips,
    counts: [...document.querySelectorAll('.decide-pop .draft-count')].map(n => n.textContent.trim()),
    notes: [...document.querySelectorAll('.decide-pop .draft-note')].map(n => n.textContent.trim()),
    submitBeforeW: submit ? getComputedStyle(submit, '::before').width : null,
    thumbs: document.querySelectorAll('.decide-pop .qp-card').length,
    pickEmpty: document.querySelectorAll('.decide-pop .pick-empty').length,
    vh: window.innerHeight,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });
  const shot = async tag => {
    await page.waitForTimeout(220);
    const el = page.locator('.decide-pop');
    const p = path.join(OUT, `pick-graphic-${tag}-${WIDTH}.png`);
    if (await el.count()) await el.screenshot({ path: p }); else await page.screenshot({ path: p });
    return p;
  };

  /* 真实开一局（与 check-draw-toast / browser-check 同一套入口）。 */
  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
  add('对局已开始（有 state）', await page.evaluate(() => !!(typeof state !== 'undefined' && state && state.status === 'playing')));

  const enemyUid = await page.evaluate(setupCombat);
  await page.waitForTimeout(400);
  /* 浮层没自动开就手动开一次（actionable 判据应当已经让它自己开了）。 */
  if (!(await page.locator('.decide-pop').count())) { await page.locator('.decide-trigger').first().click().catch(() => {}); await page.waitForTimeout(300); }

  /* ── 状态 ①：还没选目标 —— 第二步位置应是一张「先选目标敌人」的引导图，第一步高亮 ── */
  const s1 = await page.evaluate(MEASURE);
  const p1 = await shot('aim');
  add('浮层已打开且是攻击选择', /选择攻击目标与角色/.test(s1.title || ''), s1.title);
  add('空态不再是裸文字条（.pick-empty 已清零）', s1.pickEmpty === 0, `剩 ${s1.pickEmpty} 条`);
  add('未选目标时给出图形化引导空态', s1.voids.length === 1 && /先选目标敌人/.test(s1.voids[0].title), s1.voids.map(v => v.title).join(' | '));
  add('空态含图标（22px 线稿 + 42px 圆底）', !!s1.voids[0] && Math.abs(s1.voids[0].svg.w - 22) <= 1 && Math.abs(s1.voids[0].ico.w - 42) <= 1, s1.voids[0] ? `图标 ${s1.voids[0].svg.w}px / 圆底 ${s1.voids[0].ico.w}px` : '');
  add('空态高度受控（52–150px，不再是一行 38px 灰字）', !!s1.voids[0] && s1.voids[0].box.h >= 52 && s1.voids[0].box.h <= 150, s1.voids[0] ? `${s1.voids[0].box.w}×${s1.voids[0].box.h}px` : '');
  add('步骤条两步俱在', s1.steps.length === 2, s1.steps.map(x => x.label).join(' → '));
  add('第一步为当前步（金字金圈），第二步未开始', !!s1.steps[0] && s1.steps[0].active && !s1.steps[0].done && !!s1.steps[1] && !s1.steps[1].active, s1.steps.map(x => `${x.label}:${x.active ? 'active' : x.done ? 'done' : 'wait'}`).join(' '));
  add('当前步圆点有金圈（不是灰底默认态）', !!s1.steps[0] && /201|165|78/.test(s1.steps[0].dotBorder), s1.steps[0] && s1.steps[0].dotBorder);

  /* ── 状态 ②：选中目标 —— 第一步变绿勾，第二步高亮并给出角色网格与草稿代币 ── */
  const target = await page.evaluate(() => CombatUI.popExtra(state, 0) && E.combat.attackTargets(state, 0)[0].uid);
  await page.evaluate(uid => {
    const m = DesktopUI.mode(state, 0);
    DesktopUI.handle({ dataset: { desktop: 'target', uid: String(uid) } });
    render();
  }, target);
  await page.waitForTimeout(350);
  if (!(await page.locator('.decide-pop').count())) { await page.locator('.decide-trigger').first().click().catch(() => {}); await page.waitForTimeout(300); }
  const s2 = await page.evaluate(MEASURE);
  const p2 = await shot('target');
  add('选完目标后第一步打勾（done 态 + 勾图标）', !!s2.steps[0] && s2.steps[0].done && s2.steps[0].check, s2.steps[0] ? `done=${s2.steps[0].done} check=${s2.steps[0].check}` : '');
  add('第二步转为当前步', !!s2.steps[1] && s2.steps[1].active && !s2.steps[1].done);
  add('未选角色时步骤条不挂 0 徽章', !!s2.steps[1] && s2.steps[1].count === null, s2.steps[1] ? `count=${s2.steps[1].count}` : '');
  add('角色缩略图网格照常给出', s2.thumbs > 0, `${s2.thumbs} 张`);
  add('草稿摘要用代币 chip 呈现', s2.chips.length >= 1, s2.chips.map(c => c.text).join(' | '));
  add('代币图标真的加载成功（naturalWidth > 0）', s2.chips.length > 0 && s2.chips.every(c => c.ico && c.ico.w > 0), s2.chips.map(c => c.ico && c.ico.w).join(','));
  add('数字比正文大（≥14px）', s2.chips.length > 0 && s2.chips.every(c => c.numSize >= 14), s2.chips.map(c => c.numSize).join(','));
  add('「已选 N 名」仍在（供读屏与测试定位）', (s2.counts || []).some(t => /已选 \d+ 名/.test(t)), (s2.counts || []).join(' | '));
  add('提交按钮带勾选图标', s2.submitBeforeW !== null && parseFloat(s2.submitBeforeW) >= 10, `::before 宽 ${s2.submitBeforeW}`);

  /* ── 状态 ③：目标全不合法 —— 图形化「没有可攻击的敌人」，且草稿必须同步清空 ── */
  await page.evaluate(uid => {
    const x = state.combat;
    x.doneAttacks.push('0:' + uid);
    DesktopUI.handle({ dataset: { desktop: 'target', uid: String(uid) } });
    render();
  }, target);
  await page.waitForTimeout(350);
  if (!(await page.locator('.decide-pop').count())) { await page.locator('.decide-trigger').first().click().catch(() => {}); await page.waitForTimeout(300); }
  const s3 = await page.evaluate(MEASURE);
  const p3 = await shot('empty');
  add('没有合法目标时给出斜杠靶心空态', s3.voids.length >= 1 && /没有可攻击的敌人/.test(s3.voids[0].title), s3.voids.map(v => v.title).join(' | '));
  add('空态写出路（不只说「没有」）', s3.voids.length >= 1 && s3.voids[0].why.length >= 6, s3.voids[0] && s3.voids[0].why);

  /* 关键一致性：没有合法目标 → 草稿 target 必须同时归零，
     否则就是用户截图那种「一边说没有敌人、一边报已选 2 名 · 暂定基础攻击 3」。 */
  const draftTarget = await page.evaluate(() => { const m = DesktopUI.mode(state, 0); return m ? DesktopUI.draft(state, m).target : 'no-mode'; });
  add('草稿 target 已归零（与「没有可攻击的敌人」一致）', draftTarget === null, `target=${JSON.stringify(draftTarget)}`);

  /* ── 版式体检 ──
     窄屏（≤760px）浮层是全宽底部抽屉、两栏改单列堆叠，滚动是预期行为；
     因此「并排」与「一屏放得下」只在桌面档断言。 */
  const desktop = WIDTH > 760;
  for (const [tag, s] of [['①', s1], ['②', s2], ['③', s3]]) {
    add(`${tag} 浮层无横向溢出`, s.bodyScrollW <= s.bodyClientW + 1, `${s.bodyScrollW} ≤ ${s.bodyClientW}`);
    add(`${tag} 浮层未触 62vh 高度上限`, !s.pop || s.pop.h <= s.vh * 0.62 + 1, s.pop ? `${s.pop.h}px / ${(s.vh * 0.62).toFixed(0)}px` : '');
    if (desktop) {
      /* 关键：内容一变多，浮层会顶到 62vh 上限并把提交按钮挤出可视区（上下堆叠版本的实测缺陷）。 */
      add(`${tag} 浮层体内无滚动（提交按钮不用滚就能看见）`, s.bodyScrollH <= s.body.h + 2, `内容 ${s.bodyScrollH}px / 容器 ${s.body.h}px`);
      if (s.cols.length === 2) add(`${tag} 目标与角色两栏并排（左 1 右 2）`, s.cols[0].x + s.cols[0].w <= s.cols[1].x + 2, `左栏右缘 ${(s.cols[0].x + s.cols[0].w).toFixed(0)} ≤ 右栏左缘 ${s.cols[1].x.toFixed(0)}`);
    }
  }
  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, `pick-graphic-${WIDTH}.json`), JSON.stringify({ ok, width: WIDTH, s1, s2, s3, shots: [p1, p2, p3], checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
