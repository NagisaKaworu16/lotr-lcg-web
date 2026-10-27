'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));

const dumpKeeps = () => {
  const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden'; };
  return [...document.querySelectorAll('button[data-action="keepHand"]')].map((b, i) => {
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (r.width > 0 && cy > 0 && cy < innerHeight) ? document.elementFromPoint(cx, cy) : null;
    return { i, text: b.textContent.trim().slice(0, 10), vis: vis(b), disabled: b.disabled,
      rect: [+r.left.toFixed(0), +r.top.toFixed(0), +r.width.toFixed(0), +r.height.toFixed(0)],
      hit: hit ? (hit.tagName + '.' + (hit.className || '')).slice(0, 40) : null,
      isSelf: hit === b || b.contains(hit) };
  });
};

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', e => console.log('PAGEERROR ' + String(e).slice(0, 300)));
  await page.goto(pageUrl); await page.waitForTimeout(500);
  await page.selectOption('#playerCount', '4'); await page.waitForTimeout(200);
  const tap = async (sel, text, ms = 300) => {
    const loc = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    if (!await loc.count()) return false;
    try { await loc.click({ timeout: 2500 }); } catch (e) { return false; }
    await page.waitForTimeout(ms); return true;
  };
  await tap('.ng-tabs button', '新版扩展');
  await tap('.ng-card', '基础剧本合集');
  await tap('[data-action="ngNext"]');
  await tap('[data-action="chooserConfirm"]', null, 600);
  console.log('before any keep: ' + JSON.stringify(await page.evaluate(dumpKeeps), null, 0));
  // 第一次：真实点击 .first()
  const first = page.locator('button[data-action="keepHand"]').first();
  try { await first.click({ timeout: 2500 }); console.log('keep#0 click OK'); }
  catch (e) { console.log('keep#0 click FAIL :: ' + String(e.message).split('\n').slice(0, 4).join(' | ')); }
  await page.waitForTimeout(400);
  console.log('after keep#0: ' + JSON.stringify(await page.evaluate(dumpKeeps), null, 0));
  const st = await page.evaluate(() => ({ phase: state.phase, setup: state.setup && state.setup.step, keeps: (state.setup && state.setup.keep) || null }));
  console.log('state: ' + JSON.stringify(st).slice(0, 300));
  await browser.close();
})();
