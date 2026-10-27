/* 探针 2：定位 (a) 角色切换 radio 的命中归属、(b) roster 行与 rail-win 的重叠真相。
 * 上一版 _hitcheck 把这两者判成「遮挡」，需先确认是不是探针自己的测错量。
 */
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].filter(Boolean).find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  const p = await (await b.newContext({viewport: {width: 390, height: 844}})).newPage();
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await sleep(450);
  await p.selectOption('#playerCount', '2'); await sleep(150);
  await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
  await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
  await p.locator('[data-action="ngNext"]').click(); await sleep(280);
  await p.locator('[data-action="chooserConfirm"]').click(); await sleep(600);
  for (const x of await p.locator('button[data-action="keepHand"]').all()) await x.click();
  await sleep(200);
  const fin = p.locator('button[data-action="finishSetup"]');
  if (await fin.count()) await fin.click();
  await sleep(400);
  await p.evaluate(() => { for (let i = 0; i < 12; i++) { if (state.phase >= 2) break; try { ScenarioEngine.endPhase(state); } catch (e) { break; } } render(); });
  await sleep(250);
  await p.evaluate(() => document.querySelector('.phase-door .door-go:not([disabled])')?.click());
  await sleep(400);
  await p.evaluate(() => { handView = 0; render(); }); await sleep(200);

  const r = await p.evaluate(() => {
    const chain = el => { const a = []; let e = el; while (e && e !== document.documentElement) { const cs = getComputedStyle(e); a.push({ t: e.tagName.toLowerCase(), c: String(e.className || '').slice(0, 44), d: cs.display, pos: cs.position, z: cs.zIndex, ov: cs.overflow, r: [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)] }); e = e.parentElement; } return a; };
    const det = document.querySelector('#quest-rules');
    const row = document.querySelector('[data-roster-player="0"]');
    const inp = document.querySelector('input[data-quest-actor="0"]');
    const lab = inp && inp.closest('label');
    const ir = inp.getBoundingClientRect(), lr = lab.getBoundingClientRect();
    const hitAt = (x, y) => { const h = document.elementFromPoint(x, y); return h ? h.tagName.toLowerCase() + '.' + String(h.className || '').split(' ')[0] : null; };
    return {
      detailsOpen: det ? det.open : 'no #quest-rules',
      detailsClientH: det ? det.clientHeight : null,
      rowExists: !!row,
      rowDisplay: row ? getComputedStyle(row).display : null,
      rowVisible: row ? row.checkVisibility ? row.checkVisibility() : null : null,
      rowRect: row ? [row.getBoundingClientRect().left, row.getBoundingClientRect().top, row.getBoundingClientRect().width, row.getBoundingClientRect().height].map(n => +n.toFixed(1)) : null,
      rowChain: row ? chain(row).slice(0, 8) : null,
      // roster 行中心点上压着谁 + 那个东西的祖先链
      rowCenterHit: row ? hitAt(row.getBoundingClientRect().left + row.getBoundingClientRect().width / 2, row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2) : null,
      rowCenterHitChain: row ? (() => { const h = document.elementFromPoint(row.getBoundingClientRect().left + row.getBoundingClientRect().width / 2, row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2); return h ? chain(h).slice(0, 8) : null; })() : null,
      // radio 是不是被 label 包着（决定「点 span.dot 算不算点到 radio」）
      radioWrappedByLabel: !!(inp && lab),
      radioRect: [ir.left, ir.top, ir.width, ir.height].map(n => +n.toFixed(1)),
      labelRect: [lr.left, lr.top, lr.width, lr.height].map(n => +n.toFixed(1)),
      labelCenterHit: hitAt(lr.left + lr.width / 2, lr.top + lr.height / 2),
      labelCenterHitIsInsideLabel: (() => { const h = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2); return !!(h && lab && (h === lab || lab.contains(h))); })(),
    };
  });
  console.log(JSON.stringify(r, null, 1));

  // 行为验证：点 label 中心能不能切到玩家 1
  const before = await p.evaluate(() => handView);
  const box = await p.evaluate(() => { const l = document.querySelectorAll('label.actor-chip')[1]; const r = l.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; });
  await p.mouse.click(box.x, box.y);
  await sleep(250);
  const after = await p.evaluate(() => handView);
  console.log('\n点 label.actor-chip[1] 中心：handView ' + before + ' → ' + after + (after === 1 ? '  OK（label 包裹生效，radio 1×1 不影响可点）' : '  FAIL'));
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
