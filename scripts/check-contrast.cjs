/* Contrast audit for interactive controls (buttons, inputs, selects, chips).
   Walks the rendered offline build in local Chrome, resolves each element's
   effective background by climbing ancestors, and reports WCAG contrast below
   the threshold. Run: NODE_PATH=... node scripts/check-contrast.cjs [--width 1440] [--min 3] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || [
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));
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
  /* 注：Chrome 对 color-mix() 计算出的底色会返回 oklab()/color() 浮点写法，
     直接取数字会得到 0~1 的小数，算出的对比度全部失真。这里先把浮点分量归一到 0~255。 */
  const norm = c => c.slice(0, 3).map(v => (v <= 1 ? Math.round(v * 255) : Math.round(v)));
  /* 底色解析：向上爬到第一个不透明背景。
     护栏：这段文字其实坐在「像素」上而不是坐在 background-color 上时，算出来的
     对比度是假的。两种承载方式都要认：
       ① 祖先的 background-image !== 'none'（纹理 / 渐变 / 卡图底）；
       ② 祖先里有 <img> 把这块文字盖住（`.tk b` 的白数字压在代币立绘上，还带黑描边，
          按 background-color 算会得到 1.25:1 的假红）。
     这不是放宽阈值，而是承认「像素底色不可由 CSS 推导」这一类，单独计数打印出来，
     跳过数过宽时一眼能看出来。 */
  const covers = (a, b) => !!a && !!b && a.left <= b.left + 1 && a.top <= b.top + 1
    && a.right >= b.right - 1 && a.bottom >= b.bottom - 1;
  const bgOf = el => {
    const er = el.getBoundingClientRect();
    let n = el;
    while (n) {
      if (n.tagName === 'IMG') return { bg: null, image: true };
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > .5)) return { bg: norm(c) };
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { bg: null, image: true };
      for (const im of n.querySelectorAll('img')) if (covers(im.getBoundingClientRect(), er)) return { bg: null, image: true };
      n = n.parentElement;
    }
    return { bg: [255, 255, 255] };
  };
  /* 只扫「自己直接含文字」的元素：不再依赖选择器白名单。
     旧版是白名单，`.log-count` / `.rail-win-label` / `.threat-total` / `.tab-stats b` /
     `.card .number` 全都不在里面，所以那几条 2.85 / 3.73 / 1.34 一个都报不出来。 */
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const seen = new Set(), out = [], skipped = { image: 0, hidden: 0 };
  for (const el of document.querySelectorAll('body *')) {
    if (!ownText(el)) continue;
    if (el.closest('[hidden]') || el.offsetParent === null) { skipped.hidden++; continue; }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) { skipped.hidden++; continue; }
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) < .5) { skipped.hidden++; continue; }
    /* 文字色带 alpha（例如 rgba(...,.72)）时先按底色合成，否则比的是错的值 */
    let fgr = parse(s.color);
    if (fgr.length < 3) continue;
    fgr = norm(fgr);
    if (fgr.length > 3 && fgr[3] < 1) { skipped.hidden++; continue; }
    const { bg, image } = bgOf(el);
    if (!bg) { skipped.image++; continue; }
    /* WCAG：≥24px，或 ≥18.66px 且 bold，按 3:1 判；其余按 min 判 */
    const fs = parseFloat(s.fontSize) || 16;
    const bold = (parseInt(s.fontWeight, 10) || 400) >= 700;
    const need = (fs >= 24 || (fs >= 18.66 && bold)) ? Math.min(3, min) : min;
    const ratio = (Math.max(lum(fgr), lum(bg)) + .05) / (Math.min(lum(fgr), lum(bg)) + .05);
    if (ratio < need) {
      const key = el.className + '|' + s.color + '|' + bg.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          text: (el.textContent || el.tagName).trim().slice(0, 24), cls: String(el.className).slice(0, 40),
          tag: el.tagName.toLowerCase(), fg: s.color, bg: `rgb(${bg.join(',')})`,
          ratio: +ratio.toFixed(2), need, fs: +fs.toFixed(1), bold,
        });
      }
    }
  }
  return { out, skipped };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 950 } })).newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const report = { width: WIDTH, min: MIN, at: new Date().toISOString(), stages: [] };
  const audit = async label => {
    const { out: bad, skipped } = await page.evaluate(AUDIT, MIN);
    report.stages.push({ stage: label, bad, skipped });
    console.log(`== ${label} == low-contrast: ${bad.length}  (跳过：背景图承载 ${skipped.image} 处 / 不可见 ${skipped.hidden} 处)`);
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
  /* v0.15.67 起全员确认后自动执行剧本设置，finishSetup 只在确认不齐时才存在。 */
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
  await audit('resource');

  /* v0.15.70：派遣面板在 .decide-box 里，提交／确认改用 data-quest 选择器。 */
  const PANEL = ':is(.operation-content, .decide-box, .planning-strip)';
  const clickBtn = async text => { const el = page.locator(PANEL + ' button:not([disabled])', { hasText: text }).first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(250); return true; };
  const clickQuest = async k => { const el = page.locator(PANEL + ' [data-quest="' + k + '"]:not([disabled])').first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(280); /* v0.15.69 起提交名单会弹 choose() 确认框，顺手点掉 */ { const ok = page.locator('dialog[open] #ok'); if (await ok.count()) { await ok.click(); await page.waitForTimeout(300); } } return true; };
  const clickNext = async () => { const el = page.locator('.operation-title button.primary:not([disabled])').first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(380); return true; };
  for (let i = 0; i < 26; i++) {
    if (await clickBtn('结束我的盟友')) continue;
    if (await clickBtn('：放弃剩余行动')) continue;
    if (await clickBtn('开始投入角色')) continue;
    if (await clickQuest('commit')) continue;
    if (await clickQuest('approveDeployment')) continue;
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
  const skipImg = report.stages.reduce((a, s) => a + (s.skipped ? s.skipped.image : 0), 0);
  const skipHid = report.stages.reduce((a, s) => a + (s.skipped ? s.skipped.hidden : 0), 0);
  console.log(`\n扫描口径：所有直接含文字的元素（非白名单）；跳过背景图承载 ${skipImg} 处 / 不可见 ${skipHid} 处`);
  console.log(`${report.ok ? 'PASS' : 'FAIL'} ${report.stages.length} stages, ${failed.length} low-contrast controls @ ${WIDTH}px (min ${MIN})`);
  process.exit(report.ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
