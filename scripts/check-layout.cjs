/* Layout alignment audit in a real browser.
   Opens the offline build in local Chrome, enters a 2-player Mirkwood game and
   asserts that every frame (panels, card rows, zone headings, rail sections)
   shares the same width ladder, padding, radius and edge alignment.
   Run: NODE_PATH=... node scripts/check-layout.cjs [--width 1440] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');

const argWidth = (() => {
  const i = process.argv.indexOf('--width');
  return i > -1 ? Number(process.argv[i + 1]) : 1440;
})();

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: argWidth, height: 950 } })).newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.locator('button[data-action="finishSetup"]').click();
  await page.waitForTimeout(700);

  const geo = await page.evaluate(() => {
    const r = e => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const st = (e, p) => getComputedStyle(e)[p];
    const one = s => document.querySelector(s);
    const all = s => [...document.querySelectorAll(s)];
    const panels = ['.operation-dock', '.public-table', '.player-mat'].map(s => { const e = one(s); return { sel: s, ...r(e), pad: st(e, 'padding'), radius: st(e, 'borderRadius') }; });
    const rail = one('.tabletop-rail');
    /* v0.15.45：牌堆/说明框已移除，右栏只剩竖轴与无框日志，取样改为日志面板本身。 */
    const railBoxes = all('.tabletop-rail>.table-log')
      .map(e => ({ ...r(e), pad: st(e, 'padding'), radius: st(e, 'borderRadius') }));
    const headingBoxes = all('.zone-heading').map(e => ({ text: e.textContent.trim().slice(0, 10), ...r(e) }));
    const rows = all('.table-card-row').map(row => all('.table-card').filter(c => c.parentElement === row).map(c => ({ ...r(c), radius: st(c, 'borderRadius') })));
    const cardWidths = [...new Set(all('.table-card').map(c => +c.getBoundingClientRect().width.toFixed(1)))];
    const dockInner = one('.operation-content .panel') || one('.operation-title strong');
    const boardZone = one('.public-table .table-zone');
    const matZone = one('.player-mat .table-zone');
    const innerX = [dockInner, boardZone, matZone].filter(Boolean).map(e => +e.getBoundingClientRect().x.toFixed(1));
    const rowGaps = rows.map((row, i) => { const el = all('.table-card-row')[i]; if (el && el.closest('.hand-zone')) return null; return row.length > 1 ? +(row[1].x - row[0].x).toFixed(1) : null; }).filter(v => v !== null);
    const handGaps = rows.map((row, i) => { const el = all('.table-card-row')[i]; if (!el || !el.closest('.hand-zone') || row.length < 2) return null; return +(row[1].x - row[0].x).toFixed(1); }).filter(v => v !== null);
    return { panels, railBoxes, headingBoxes, rows, cardWidths, innerX, rowGaps, handGaps,
      rail: rail ? r(rail) : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      overflowY: document.documentElement.scrollHeight > innerHeight + 1,
      cardWidthsByZone: { pub: [...new Set(all('.public-table>.table-zone .table-card').map(c => +c.getBoundingClientRect().width.toFixed(1)))],
                          mat: [...new Set(all('.player-mat>.own-characters .table-card').map(c => +c.getBoundingClientRect().width.toFixed(1)))],
                          peer: [...new Set(all('.other-player .table-card').map(c => +c.getBoundingClientRect().width.toFixed(1)))] } };
  });

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const [dock, board, mat] = geo.panels;
  /* v0.15.41 单屏布局（左桌右栏）：
       - board 与 mat 同列同宽同起点，上下堆叠；
       - dock 与 rail 同列同宽同起点，上下堆叠；
       - 整页不产生纵向滚动，八项关键区全部落在视口内。 */
  add('左列：公共桌面与玩家区同宽同起点', near(board.x, mat.x) && near(board.w, mat.w), `${board.x}/${mat.x} | ${board.w}/${mat.w}`);
  add('右列：操作栏与牌堆栏同宽同起点', near(dock.x, geo.rail.x) && near(dock.w, geo.rail.w), `${dock.x}/${geo.rail.x} | ${dock.w}/${geo.rail.w}`);
  add('左列在右列之左且不重叠', board.x + board.w <= dock.x + 1, `board right=${(board.x + board.w).toFixed(1)} dock left=${dock.x}`);
  add('公共桌面与操作栏顶部对齐', near(board.y, dock.y, 2), `${board.y} / ${dock.y}`);
  add('玩家区与牌堆栏顶部对齐', near(mat.y, geo.rail.y, 2), `${mat.y} / ${geo.rail.y}`);
  add('公共桌面在玩家区之上', board.y + board.h <= mat.y + 1, `${(board.y + board.h).toFixed(1)} → ${mat.y}`);
  add('面板圆角统一 10px', [dock, board, mat].every(p => p.radius === '10px'), geo.panels.map(p => `${p.sel}:${p.radius}`).join(' | '));
  add('右侧栏各框宽度一致', new Set(geo.railBoxes.map(b => b.w)).size === 1, [...new Set(geo.railBoxes.map(b => b.w))].join(','));
  add('右侧栏各框圆角一致', new Set(geo.railBoxes.map(b => b.radius)).size === 1, [...new Set(geo.railBoxes.map(b => b.radius))].join(','));
  add('右侧栏各框内边距一致', new Set(geo.railBoxes.map(b => b.pad)).size === 1, [...new Set(geo.railBoxes.map(b => b.pad))].join(','));
  add('卡牌宽度按分区统一（公共牌/玩家牌/对手牌各一档）', [geo.cardWidthsByZone.pub, geo.cardWidthsByZone.mat, geo.cardWidthsByZone.peer].every(a => a.length <= 1), JSON.stringify(geo.cardWidthsByZone));
  const rowHeights = geo.rows.filter(r => r.length > 1).map(r => [...new Set(r.map(c => c.h))]);
  add('同一行卡牌等高', rowHeights.every(h => h.length === 1), rowHeights.map(h => h.join('/')).join(' | ') || '无多卡行');
  add('手牌重叠间距统一', geo.handGaps.length === 0 || new Set(geo.handGaps).size <= 1, geo.handGaps.join(',') || '无多卡手牌行');
  add('无横向溢出', !geo.overflowX, String(geo.overflowX));
  add('无纵向溢出（单屏）', !geo.overflowY, String(geo.overflowY));
  const vh = await page.evaluate(() => innerHeight);
  const inView = await page.evaluate(() => ['.operation-dock', '.public-table', '.player-mat', '.tabletop-rail', '.hand-zone', '.phase-rail-v']
    .every(sel => { const e = document.querySelector(sel); if (!e) return true; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 0.5; }));
  add('关键区全部落在视口内', inView, `vh=${vh}`);

  await page.screenshot({ path: path.join(OUT, `20-layout-${argWidth}.png`), fullPage: false });
  await browser.close();

  const failed = checks.filter(c => !c.ok);
  const report = { width: argWidth, at: new Date().toISOString(), cardWidths: geo.cardWidths, checks };
  fs.writeFileSync(path.join(OUT, `layout-report-${argWidth}.json`), JSON.stringify(report, null, 1));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  [${c.detail}]`);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed @ ${argWidth}px`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
