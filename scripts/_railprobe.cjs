/* 探针：开局面板与 aside.tabletop-rail 的相互位置（320×568 下 keepHand 被 rail 拦截）。
 * 只测几何，不点按钮。
 */
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].filter(Boolean).find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const VPS = [{w: 320, h: 568}, {w: 360, h: 640}, {w: 390, h: 844}];

(async () => {
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  for (const vp of VPS) {
    const p = await (await b.newContext({viewport: {width: vp.w, height: vp.h}})).newPage();
    await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
    await sleep(450);
    await p.selectOption('#playerCount', '2'); await sleep(150);
    await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
    await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
    await p.locator('[data-action="ngNext"]').click(); await sleep(280);
    await p.locator('[data-action="chooserConfirm"]').click(); await sleep(700);

    const r = await p.evaluate(() => {
      const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const rail = document.querySelector('.tabletop-rail');
      const btn = document.querySelector('button[data-action="keepHand"]');
      const panel = document.querySelector('.decide-box') || document.querySelector('.decide-body');
      const cs = rail ? getComputedStyle(rail) : null;
      let hit = null, hitChain = null;
      if (btn) {
        const bb = btn.getBoundingClientRect();
        const h = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
        hit = h ? h.tagName.toLowerCase() + '.' + String(h.className || '').split(' ')[0] : null;
        hitChain = h ? (() => { const a = []; let e = h; while (e && e !== document.body) { a.push(e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')); e = e.parentElement; } return a.slice(0, 5); })() : null;
      }
      return {
        vw: innerWidth, vh: innerHeight,
        rail: R(rail), railPos: cs && cs.position, railZ: cs && cs.zIndex, railOv: cs && cs.overflowY,
        railScroll: rail ? [rail.scrollHeight, rail.clientHeight] : null,
        panel: R(panel), panelCls: panel ? String(panel.className).slice(0, 40) : null,
        keepHand: R(btn), keepHandCount: document.querySelectorAll('[data-action="keepHand"]').length,
        hitAtKeepHandCenter: hit, hitChain,
        docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
      };
    });
    console.log(vp.w + 'x' + vp.h + '  ' + JSON.stringify(r));
    await p.context().close();
  }
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
