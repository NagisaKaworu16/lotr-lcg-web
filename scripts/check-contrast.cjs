/* Contrast audit for interactive controls (buttons, inputs, selects, chips).
   Walks the rendered offline build in local Chrome, resolves each element's
   effective background by climbing ancestors, and reports WCAG contrast below
   the threshold. Run: NODE_PATH=... node scripts/check-contrast.cjs [--width 1440] [--min 3] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const WIDTH = arg('width', 1440);
const MIN = arg('min', 3);

const AUDIT = (min) => {
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const parse = s => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const bgOf = el => {
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > .5)) return c.slice(0, 3);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const seen = new Set(), out = [];
  for (const el of document.querySelectorAll('button,.button,select,input,.op-chip,.rail-step,.table-card-caption b,.table-card-caption span')) {
    if (el.closest('[hidden]') || el.offsetParent === null) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) < .5) continue;
    const fg = parse(s.color).slice(0, 3), bg = bgOf(el);
    const ratio = (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
    if (ratio < min) {
      const key = el.className + '|' + s.color + '|' + bg.join(',');
      if (!seen.has(key)) { seen.add(key); out.push({ text: (el.textContent || el.tagName).trim().slice(0, 24), cls: String(el.className).slice(0, 40), fg: s.color, bg: `rgb(${bg.join(',')})`, ratio: +ratio.toFixed(2) }); }
    }
  }
  return out;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 950 } })).newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const report = { width: WIDTH, min: MIN, at: new Date().toISOString(), stages: [] };
  const audit = async label => {
    const bad = await page.evaluate(AUDIT, MIN);
    report.stages.push({ stage: label, bad });
    console.log(`== ${label} == low-contrast: ${bad.length}`);
    for (const x of bad) console.log('   ' + JSON.stringify(x));
  };

  await audit('landing');
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(700);
  await audit('setup');
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.locator('button[data-action="finishSetup"]').click();
  await page.waitForTimeout(700);
  await audit('resource');

  const clickBtn = async text => { const el = page.locator('.operation-content button:not([disabled])', { hasText: text }).first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(250); return true; };
  const clickNext = async () => { const el = page.locator('.operation-title button.primary:not([disabled])').first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(380); return true; };
  for (let i = 0; i < 26; i++) {
    if (await clickBtn('结束我的盟友')) continue;
    if (await clickBtn('：放弃剩余行动')) continue;
    if (await clickBtn('开始投入角色')) continue;
    if (await clickBtn('提交暂定派遣名单')) continue;
    if (await clickBtn('继续到下一决策点')) continue;
    if (!await clickNext()) {
      const phase = await page.evaluate(() => state.phase);
      await audit('phase' + phase);
      break;
    }
    const phase = await page.evaluate(() => state.phase);
    await audit('phase' + phase);
    if (phase >= 6) break;
  }
  await page.screenshot({ path: path.join(OUT, `22-contrast-${WIDTH}.png`) });
  await browser.close();

  const failed = report.stages.flatMap(s => s.bad);
  report.ok = failed.length === 0;
  fs.writeFileSync(path.join(OUT, `contrast-report-${WIDTH}.json`), JSON.stringify(report, null, 1));
  console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${report.stages.length} stages, ${failed.length} low-contrast controls @ ${WIDTH}px (min ${MIN})`);
  process.exit(report.ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
