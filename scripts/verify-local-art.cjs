/* Verifies that card art renders from the local mirror: no request may leave
   for ringsdb.com / hallofbeorn.com, and every visible <img> must decode. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'browser-acceptance');
const executablePath = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const remote = [];
  page.on('request', r => {
    const u = r.url();
    if (/ringsdb\.com|hallofbeorn\.com/.test(u)) remote.push(u);
  });
  page.on('dialog', d => d.accept());

  await page.goto('file:///' + path.join(root, 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(700);

  const stat = async sel => page.evaluate(async s => {
    const imgs = [...document.querySelectorAll(s + ' img')].filter(i => i.getAttribute('src'));
    // Force lazy images into the viewport and decode before judging.
    for (const i of imgs) i.loading = 'eager';
    await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => null) : null)));
    return {
      total: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      failed: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 5),
      sample: imgs.slice(0, 3).map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight })),
    };
  }, sel);

  const report = { remoteRequests: remote, pages: [] };

  // 1. Art library, player cards page 1-2
  await page.locator('#imagesTab').click();
  await page.waitForTimeout(1600);
  report.pages.push({ name: 'library-main-p1', ...(await stat('#image-results')) });
  await page.screenshot({ path: path.join(outDir, '09-library-local-art-1440.png') });
  await page.locator('#image-next').click();
  await page.waitForTimeout(1400);
  report.pages.push({ name: 'library-main-p2', ...(await stat('#image-results')) });

  // 2. Encounter faces
  await page.selectOption('#image-type', 'encounter');
  await page.waitForTimeout(1500);
  report.pages.push({ name: 'library-encounter', ...(await stat('#image-results')) });
  await page.screenshot({ path: path.join(outDir, '10-library-encounter-art-1440.png') });

  // 3. In-game table: quest card + encounter card art
  await page.locator('#tableTab').click();
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2').catch(() => {});
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(900);
  for (const b of await page.locator('button[data-action="keepHand"]').all()) await b.click();
  await page.waitForTimeout(300);
  await page.locator('button[data-action="finishSetup"]').click().catch(() => {});
  await page.waitForTimeout(1200);
  report.pages.push({ name: 'table-quest-art', ...(await stat('.quest-zone, .quest-display, .desktop-table')) });
  await page.screenshot({ path: path.join(outDir, '11-table-local-art-1440.png') });

  report.remoteRequestCount = remote.length;
  report.ok = remote.length === 0 && report.pages.every(p => p.total > 0 && p.failed.length === 0 && p.loaded / p.total >= 0.95);
  fs.writeFileSync(path.join(outDir, 'local-art-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.ok ? 0 : 1);
})().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(2);
});
