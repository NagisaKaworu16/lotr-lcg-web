'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', e => console.log('PAGEERROR ' + String(e).slice(0, 300)));
  await page.goto(pageUrl);
  await page.waitForTimeout(500);
  const dump = async (tag) => {
    const d = await page.evaluate(() => {
      const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden'; };
      const btns = [...document.querySelectorAll('button')].filter(vis).map(b => (b.getAttribute('data-action') || '') + '|' + b.textContent.trim().slice(0, 14));
      return { phase: window.state && state.phase, step: window.state && state.questing && state.questing.step,
        hasPC: !!document.querySelector('#playerCount'), sel: document.querySelector('#playerCount') ? document.querySelector('#playerCount').value : null,
        toast: !!document.querySelector('.draw-toast'),
        top: [...document.querySelectorAll('h1,h2,h3,.operation-title')].filter(vis).map(e => e.textContent.trim().slice(0, 20)).slice(0, 6),
        btns: btns.slice(0, 14) };
    });
    console.log(tag + ' ' + JSON.stringify(d));
  };
  await dump('load   ');
  await page.selectOption('#playerCount', '4').catch(e => console.log('SEL FAIL ' + e.message.slice(0, 120)));
  await page.waitForTimeout(250);
  await dump('pcount ');
  const tap = async (sel, text) => {
    const loc = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    if (!await loc.count()) { console.log('  MISS ' + sel + ' ' + (text || '')); return false; }
    try { await loc.click({ timeout: 2000 }); } catch (e) { console.log('  CLICKFAIL ' + sel + ' ' + (text || '') + ' :: ' + e.message.split('\n')[0].slice(0, 100)); return false; }
    await page.waitForTimeout(300); return true;
  };
  await tap('.ng-tabs button', '新版扩展'); await dump('ngtab  ');
  await tap('.ng-card', '基础剧本合集'); await dump('ngcard ');
  await tap('[data-action="ngNext"]'); await dump('ngnext ');
  await tap('[data-action="chooserConfirm"]'); await dump('confirm');
  for (let i = 0; i < 8; i++) { const k = page.locator('button[data-action="keepHand"]'); if (!await k.count()) break; if (!await tap('button[data-action="keepHand"]')) break; await dump('keep' + i + ' '); }
  await tap('button[data-action="finishSetup"]'); await dump('finish ');
  await browser.close();
})();
