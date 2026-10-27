/* 320×568 取证：rail 与开局面板重叠，真点击被 span.rail-win-label 拦截。
 * 产出 docs/browser-acceptance/_ucheck/320-setup-overlap.png + 几何 JSON。
 */
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'browser-acceptance', '_ucheck');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].filter(Boolean).find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  for (const vp of [{w: 320, h: 568}, {w: 360, h: 640}, {w: 390, h: 844}]) {
  const p = await (await b.newContext({viewport: {width: vp.w, height: vp.h}})).newPage();
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await sleep(450);
  await p.selectOption('#playerCount', '2'); await sleep(150);
  await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
  await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
  await p.locator('[data-action="ngNext"]').click(); await sleep(280);
  await p.locator('[data-action="chooserConfirm"]').click(); await sleep(700);

  // 真点击 vs JS 点击
  const real = await p.locator('button[data-action="keepHand"]').first().click({timeout: 2000}).then(() => 'OK').catch(e => 'FAIL ' + e.message.split('\n')[0]);
  const keptAfterReal = await p.evaluate(() => state.handKept ? JSON.stringify(state.handKept) : 'none');
  console.log('真点击 keepHand：' + real + '   handKept=' + keptAfterReal);

  // 滚到按钮，截图 + 命中探针
  await p.evaluate(() => document.querySelector('button[data-action="keepHand"]').scrollIntoView({block: 'center'}));
  await sleep(300);
  const geo = await p.evaluate(() => {
    const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [+b.left.toFixed(1), +b.top.toFixed(1), +b.width.toFixed(1), +b.height.toFixed(1)]; };
    const btn = document.querySelector('button[data-action="keepHand"]');
    const bb = btn.getBoundingClientRect();
    const h = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    const own = h && (h === btn || btn.contains(h));
    const chain = e2 => { const a = []; let e = e2; while (e && e !== document.body) { a.push(e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')); e = e.parentElement; } return a; };
    return {
      scrollY: Math.round(scrollY),
      keepHand: R(btn),
      hit: h ? h.tagName.toLowerCase() + '.' + String(h.className || '').split(' ')[0] : null,
      hitIsButton: own,
      hitChain: h ? chain(h).slice(0, 6) : null,
      rail: R(document.querySelector('.tabletop-rail')),
      panel: R(document.querySelector('.decide-box')),
      railWin: R(document.querySelector('.rail-win-label')),
    };
  });
  console.log('--- ' + vp.w + 'x' + vp.h + ' ---');
  console.log('scrollIntoView 后：' + JSON.stringify(geo, null, 1));
  await p.screenshot({path: path.join(OUT, vp.w + '-setup-overlap.png')});

  // JS 点击能否推进（证明是「命中被拦」而不是「按钮坏了」）
  const before = await p.evaluate(() => JSON.stringify(state && state.opening ? Object.keys(state.opening) : null));
  await p.evaluate(() => document.querySelector('button[data-action="keepHand"]').click());
  await sleep(300);
  const after = await p.evaluate(() => document.querySelectorAll('[data-action="keepHand"]').length);
  console.log('JS click 前后 keepHand 按钮数：' + after + '   (state 键快照 ' + before + ')');
  await p.context().close();
  }
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
