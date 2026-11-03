/* v0.17.2 中文卡图（DragnCards 摄取）接线验收：real-browser，file:// 协议。
 * 卡图库已并入桌面/卡牌视图（v0.16.5），无独立 tab——直接驱动 ImageLibrary 弹窗验收：
 * ①King-Spider（enc-74）放大窗主图=中文 webp 且真实加载，可切英文原版；
 * ②玩家卡 01001 放大窗主图=基础版中文卡图（既有优先，零回归）；
 * ③探险卡 121 B 面=中文 webp；④file:// 下无 CORS/资源加载报错。
 * 用法：NODE_PATH=<playwright-core> node scripts/check-zh-images.cjs
 * 产出：docs/browser-acceptance/zh-images-report.json + 截图。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'browser-acceptance');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const report = { checks: [], consoleErrors: [], pageErrors: [] };
const note = (name, ok, extra) => { report.checks.push({ name, ok, ...extra }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, extra || ''); };

async function shotDlg(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, name) });
  const src = await page.locator('#image-full').getAttribute('src');
  const loaded = await page.locator('#image-full').evaluate(img => img.complete && img.naturalWidth > 0).catch(() => false);
  await page.evaluate(() => { const d = document.querySelector('dialog.image-dialog'); if (d) { d.close(); d.remove(); } });
  return { src, loaded };
}

(async () => {
  let executablePath = null;
  for (const c of chromeCandidates) if (fs.existsSync(c)) { executablePath = c; break; }
  if (!executablePath) throw new Error('no chrome/edge found');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(8000);
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  await page.goto(pageUrl);
  await page.waitForTimeout(700);

  // ① King-Spider（遭遇卡 enc-74）：主图 = 中文 webp
  await page.evaluate(() => ImageLibrary.handle({ dataset: { imageAction: 'open', code: 'enc-74' } }));
  let r = await shotDlg(page, 'zh-images-king-spider.png');
  note('spider-dialog-zh-webp', /assets\/cards-zh-enc\/King-Spider-Core\.webp$/.test(r.src || ''), { src: r.src });
  note('spider-loaded', r.loaded);

  // 印刷版本切换：切到英文原版（本地镜像 webp）
  await page.evaluate(() => ImageLibrary.handle({ dataset: { imageAction: 'open', code: 'enc-74' } }));
  const opts = await page.locator('#image-print option').allTextContents();
  note('spider-printings-offer-english', opts.some(t => /正面/.test(t) && !/中文/.test(t)), { options: opts });
  const idx = opts.findIndex(t => /正面/.test(t) && !/中文/.test(t));
  await page.selectOption('#image-print', String(idx));
  await page.waitForTimeout(250);
  const switched = await page.locator('#image-full').getAttribute('src');
  note('spider-switch-english', /assets\/cards-encounter\/king-spider\.webp$/.test(switched || ''), { src: switched });
  await page.evaluate(() => { const d = document.querySelector('dialog.image-dialog'); if (d) { d.close(); d.remove(); } });

  // ② 玩家卡 01001：主图 = 基础版中文卡图（既有优先）
  await page.evaluate(() => ImageLibrary.handle({ dataset: { imageAction: 'open', code: '01001' } }));
  r = await shotDlg(page, 'zh-images-01001.png');
  note('hero-01001-zh', /assets\/cards-zh-core\/01001\.jpg$/.test(r.src || ''), { src: r.src });
  note('hero-01001-loaded', r.loaded);

  // ③ 探险卡 121 B 面：中文 webp（questFaces 桌面入口同源）
  const questHtml = await page.evaluate(() => ImageLibrary.questFaces(121));
  note('quest121-faces-zh', questHtml.includes("A-Chosen-Path-Don&#39;t-Leave-the-Path-Core.B.webp"), {});
  await page.evaluate(() => ImageLibrary.handle({ dataset: { imageAction: 'open', code: 'enc-121', face: 'B' } }));
  r = await shotDlg(page, 'zh-images-quest121-dialog.png');
  note('quest121-dialog-zh-b', /A-Chosen-Path-Don.*\.B\.webp$/.test(r.src || ''), { src: r.src });
  note('quest121-loaded', r.loaded);

  // ④ file:// 报错审计（CORS / 资源加载失败都会进 console error）
  note('no-console-errors', report.consoleErrors.length === 0, { errors: report.consoleErrors.slice(0, 5) });
  note('no-page-errors', report.pageErrors.length === 0, { errors: report.pageErrors.slice(0, 5) });

  report.ok = report.checks.every(c => c.ok);
  fs.writeFileSync(path.join(outDir, 'zh-images-report.json'), JSON.stringify(report, null, 1));
  console.log(report.ok ? 'ALL PASS' : 'HAS FAILURES');
  await browser.close();
  process.exit(report.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
