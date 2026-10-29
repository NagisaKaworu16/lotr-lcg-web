/* 顶栏一行化验收（v0.15.88）。
   改前：header 第一行是导航，#gameHud 因 flex-basis:100% 独占第二行（≈49px），
         其下还有 .operation-dock 一行（≈34px）写「提示语 + 品牌行」。
   改后：HUD 与导航同一行；操作条只剩「有输入才有的一行」（状态 chip / 推进按钮），
         两者都没有时高度归零；品牌行搬到说明页。
   断言分三组：
     A. 四档宽度下顶栏只有一行、无横向溢出、牌桌确实变高；
     B. 「只在游戏中显示」——非牌桌页签、对局结束后 #gameHud 必须 hidden；
     C. 该展开时仍然展开——开局待确认阶段 chip 行在、提示语降级到 title/aria-label。
   运行：NODE_PATH=<node_modules> node scripts/check-hud-row.cjs */
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

/* 从首页走到「设置揭示完成、进入对局」。keepHand=false 时停在起始手牌确认（待确认 chip 态）。 */
async function boot(page, { keepHand = true, players = 1 } = {}) {
  await page.goto(FILE);
  await page.waitForTimeout(420);
  if (players > 1) { await page.selectOption('#playerCount', String(players)); await page.waitForTimeout(200); }
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  if (!keepHand) return;
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
}

/* 顶栏 / 操作条几何取样。 */
const geo = page => page.evaluate(() => {
  const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const q = s => document.querySelector(s);
  const hud = q('#gameHud'), head = q('header'), nav = q('header nav');
  const tab = q('#gameHud .player-tabs button');
  return {
    header: R(head), hud: R(hud), nav: R(nav), hudHidden: hud ? hud.hidden : null,
    reset: R(q('#gameHud button[data-desktop="reset"]')),
    tab: R(tab),
    tabCount: document.querySelectorAll('#gameHud .player-tabs button').length,
    tabsScroll: (() => { const t = q('#gameHud .player-tabs'); return t ? { clientW: t.clientWidth, scrollW: t.scrollWidth, overflowX: getComputedStyle(t).overflowX } : null; })(),
    navH: R(nav) ? R(nav).h : null,
    tabLayout: tab ? getComputedStyle(tab).flexDirection : null,
    dock: R(q('.operation-dock')),
    flowLine: R(q('.operation-title')),
    chips: document.querySelectorAll('.operation-dock .op-chip').length,
    dockLabel: q('.operation-dock') ? (q('.operation-dock').getAttribute('aria-label') || '') : '',
    dockTitle: q('.operation-dock') ? (q('.operation-dock').getAttribute('title') || '') : '',
    brandInDesk: /MIDDLE-EARTH EXPEDITION/.test((q('.desktop-table') || { textContent: '' }).textContent),
    publicTable: R(q('.public-table')),
    mat: R(q('.player-mat')),
    hand: R(q('.hand-zone')),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overflowY: document.documentElement.scrollHeight > innerHeight + 1,
    hudText: hud ? hud.textContent.replace(/\s+/g, ' ').trim() : '',
  };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const errors = [];

  /* ── A. 四档宽度：一行顶栏 + 牌桌收益 ─────────────────────────── */
  for (const vp of [{ w: 1920, h: 1080 }, { w: 1440, h: 900 }, { w: 1366, h: 768 }, { w: 1280, h: 800 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${vp.w}: ` + String(e && e.message || e)));
    page.on('dialog', d => d.accept().catch(() => {}));
    await boot(page);
    const g = await geo(page);
    const tag = `${vp.w}×${vp.h}`;

    add(`${tag}：顶栏只有一行（HUD 与导航同排）`,
      !!g.hud && g.hud.y >= g.header.y - 0.5 && g.hud.y + g.hud.h <= g.header.y + g.header.h + 0.5 && g.hud.h <= 40,
      `header h=${g.header.h} hud y=${g.hud && g.hud.y} h=${g.hud && g.hud.h}`);
    add(`${tag}：顶栏总高 ≤ 56px（改前 101）`, g.header.h <= 56, `h=${g.header.h}`);
    add(`${tag}：HUD 排在导航右侧、与其垂直居中对齐`,
      !!g.nav && g.hud.x > g.nav.x + g.nav.w - 1 && Math.abs((g.hud.y + g.hud.h / 2) - (g.nav.y + g.nav.h / 2)) <= 6,
      `nav right=${g.nav && (g.nav.x + g.nav.w).toFixed(1)} hud x=${g.hud && g.hud.x}`);
    add(`${tag}：玩家标签是一行（名字+数值同排，高 ≤ 30）`,
      g.tabLayout === 'row' && g.tab.h <= 30, `flex=${g.tabLayout} h=${g.tab && g.tab.h}`);
    add(`${tag}：「重新选择剧本」完整落在顶栏内`, !!g.reset && g.reset.x + g.reset.w <= g.header.w + 0.5,
      g.reset ? `right=${(g.reset.x + g.reset.w).toFixed(1)} / ${g.header.w}` : 'missing');
    add(`${tag}：无横向溢出`, !g.overflowX);
    /* 计划阶段仍有一颗「结算计划阶段结束」（结束阶段的门副本）——它必须留着，
       但整条不再有提示语大标题与品牌行，高度压到 30px 以内。 */
    add(`${tag}：操作条只剩推进按钮（无提示语大标题、高度 ≤ 30）`,
      await page.locator('.operation-title strong').count() === 0 && g.dock.h > 0 && g.dock.h <= 30,
      `dock h=${g.dock.h}`);
    add(`${tag}：牌桌 DOM 里不再有品牌行`, !g.brandInDesk);
    add(`${tag}：提示语降级到 title/aria-label 且非空`, g.dockLabel.length > 2 && g.dockTitle.length > 2, g.dockLabel);

    /* 无任何决策与推进按钮的阶段（战斗阶段、引擎未开窗）：整条高度归零。 */
    await page.evaluate(() => { state.phase = 5; render(); });
    await page.waitForTimeout(250);
    const idle = await geo(page);
    add(`${tag}：无决策无推进时操作条高度归零`, idle.dock.h === 0 && (!idle.flowLine || idle.flowLine.h === 0),
      `dock h=${idle.dock.h}`);
    add(`${tag}：公共牌桌因此变高（1366 档 220 → ${idle.publicTable.h}）`, idle.publicTable.h >= 280, `table h=${idle.publicTable.h}`);
    add(`${tag}：手牌仍在视口内且未被裁`, idle.hand.y + idle.hand.h <= vp.h + 0.5, `hand bottom=${(idle.hand.y + idle.hand.h).toFixed(1)} / ${vp.h}`);
    await page.screenshot({ path: path.join(OUT, `hud-row-${vp.w}.png`) });
    await ctx.close();
  }

  /* ── A2. 四人局：标签多了不能让顶栏折行/挤压别人 ──────────────────
     4 人局 1280 下 4 个标签约 760px，光靠压缩放不下——标签区改成横向滚动，
     导航/撤销/导出/重新选择剧本全部不收缩（否则 nav 会折成三行、顶栏 37→50）。 */
  for (const vp of [{ w: 1366, h: 768 }, { w: 1280, h: 800 }]) {
    const ctx4 = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page4 = await ctx4.newPage();
    page4.on('pageerror', e => errors.push(`4p ${vp.w}: ` + String(e && e.message || e)));
    page4.on('dialog', d => d.accept().catch(() => {}));
    await boot(page4, { players: 4 });
    await page4.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });
    const g4 = await geo(page4);
    const tag4 = `4人局 ${vp.w}×${vp.h}`;
    add(`${tag4}：顶栏仍是一行（≤ 56px）`, g4.header.h <= 56, `h=${g4.header.h}`);
    add(`${tag4}：导航不折行（nav 单行高 ≤ 30）`, g4.navH <= 30, `nav h=${g4.navH}`);
    add(`${tag4}：四个玩家标签都在（多出的靠横向滚动）`,
      g4.tabCount === 4 && !!g4.tabsScroll && g4.tabsScroll.overflowX === 'auto',
      `chips=${g4.tabCount} ${JSON.stringify(g4.tabsScroll)}`);
    add(`${tag4}：「重新选择剧本」仍在顶栏内且完整`,
      !!g4.reset && g4.reset.x + g4.reset.w <= g4.header.w + 0.5,
      g4.reset ? `right=${(g4.reset.x + g4.reset.w).toFixed(1)} / ${g4.header.w}` : 'missing');
    add(`${tag4}：无横向溢出`, !g4.overflowX);
    await page4.screenshot({ path: path.join(OUT, `hud-row-${vp.w}-4p.png`) });
    await ctx4.close();
  }

  /* ── B/C. 只在游戏中显示；该展开时仍展开（1440 档） ─────────────── */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('state: ' + String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  await boot(page, { keepHand: false });
  const setup = await geo(page);
  add('开局待确认阶段：操作条仍展开并给出状态 chip', setup.chips > 0 && setup.dock.h > 0,
    `chips=${setup.chips} dock h=${setup.dock.h}`);
  add('开局待确认阶段：chip 行不再带提示语大标题',
    await page.locator('.operation-title strong').count() === 0);

  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
  const playing = await geo(page);
  add('对局中：HUD 可见', playing.hudHidden === false && playing.hud.h > 0);
  add('对局中：HUD 元信息只留回合与阶段（不再写人数/难度）',
    /第 \d+ 回合 · (资源|计划|探险|旅行|遭遇|战斗|刷新)/.test(playing.hudText) && !/人同机/.test(playing.hudText),
    playing.hudText);
  add('对局中：剧本名 title 里保留了难度与人数（悬停可查）',
    await page.evaluate(() => /人同机/.test(document.querySelector('.hud-name').getAttribute('title') || '')));

  /* 非牌桌页签：HUD 必须隐藏（用户要求「只在游戏中才显示」）。 */
  await page.evaluate(() => { tab = 'catalog'; render(); });
  await page.waitForTimeout(300);
  const catalog = await geo(page);
  add('切到卡牌页签：HUD 隐藏', catalog.hudHidden === true && (!catalog.hud || catalog.hud.h === 0));
  await page.evaluate(() => { tab = 'help'; render(); });
  await page.waitForTimeout(300);
  const help = await geo(page);
  add('切到说明页：HUD 隐藏', help.hudHidden === true);
  const version = await page.evaluate(() => APP_VERSION);
  add('说明页承接品牌行与版本号',
    await page.evaluate(v => document.querySelector('main').textContent.includes('MIDDLE-EARTH EXPEDITION · ' + v), version), version);

  /* 回到牌桌：恢复显示 */
  await page.evaluate(() => { tab = 'table'; render(); });
  await page.waitForTimeout(300);
  add('切回牌桌：HUD 自动恢复', (await geo(page)).hudHidden === false);

  /* 对局结束：HUD 收起 */
  await page.evaluate(() => { state.status = 'won'; render(); });
  await page.waitForTimeout(300);
  add('对局结束（won）：HUD 不再显示', (await geo(page)).hudHidden === true);

  await page.screenshot({ path: path.join(OUT, 'hud-row-endgame.png') });
  await ctx.close();

  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, 'hud-row.json'), JSON.stringify({ ok, version, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
