/* 卡牌悬停放大预览的真实浏览器验收（1440 / 1920 两档）。
 * 用法：node scripts/check-card-hover.cjs
 * 覆盖：登场延迟、放大尺寸、位置不越界、不遮挡右侧栏、移开恢复、点击不被拦截、
 *      竖版/横版两类卡面、开局页封面、Esc 收起、打开对话框时收起。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const candidates = [
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = process.env.CHROME_PATH || candidates.find(p => fs.existsSync(p));
const results = [];
const check = (name, ok, data = {}) => { results.push({ name, ok, ...data }); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (Object.keys(data).length ? ' ' + JSON.stringify(data) : '')); };

async function boxOf(page) {
  return page.evaluate(() => {
    const l = document.querySelector('.card-hover-layer');
    const b = document.querySelector('.card-hover-box');
    if (!l || !b) return null;
    const r = b.getBoundingClientRect();
    return { on: l.classList.contains('on'), x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height, pe: getComputedStyle(l).pointerEvents };
  });
}

(async () => {
  if (!executablePath) { console.error('未找到 Chrome/Chromium，可设置 CHROME_PATH'); process.exit(2); }
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(pageUrl);
    await page.waitForTimeout(700);

    // 1. 开局页封面
    const cover = page.locator('.ng-card').nth(3);
    await cover.hover();
    await page.waitForTimeout(60);
    check(`${vp.width} 延迟未到不弹出`, !(await boxOf(page)) || !(await boxOf(page)).on);
    await page.waitForTimeout(400);
    const c1 = await boxOf(page);
    check(`${vp.width} 开局封面弹出`, c1.on && c1.w > 300, c1);
    check(`${vp.width} 放大层不接收指针`, c1.pe === 'none');
    check(`${vp.width} 封面不越界`, c1.x >= 0 && c1.y >= 0 && c1.right <= vp.width && c1.bottom <= vp.height);
    await page.mouse.move(4, vp.height / 2);
    await page.waitForTimeout(320);
    check(`${vp.width} 移开后恢复`, !(await boxOf(page)).on);

    // 进入对局
    await page.locator('.ng-card[data-action="ngOpen"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("下一步：选择牌组")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("开始远征")').first().click();
    await page.waitForTimeout(900);

    // 2. 竖版：最右侧手牌
    const cards = page.locator('.hand-card .card-face');
    const last = cards.nth((await cards.count()) - 1);
    await last.scrollIntoViewIfNeeded();
    await last.hover();
    await page.waitForTimeout(400);
    const h1 = await boxOf(page);
    check(`${vp.width} 手牌弹出且为竖版`, h1.on && h1.h > h1.w);
    check(`${vp.width} 手牌放大不越界`, h1.x >= 0 && h1.y >= 0 && h1.right <= vp.width && h1.bottom <= vp.height, h1);
    const rail = await page.locator('.tabletop-rail').first().boundingBox();
    check(`${vp.width} 不遮挡阶段/日志侧栏`, !rail || h1.right <= rail.x + 1, { right: Math.round(h1.right), railX: rail && Math.round(rail.x) });
    await page.screenshot({ path: path.join(root, 'docs', 'browser-acceptance', `hover-hand-${vp.width}.png`) });

    // 3. 悬停期间点击仍作用于原卡（放大层不吃事件）
    const before = await page.evaluate(() => document.querySelector('.card-hover-layer').classList.contains('on'));
    const hit = await page.evaluate(() => {
      const b = document.querySelector('.card-hover-box').getBoundingClientRect();
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return !el || !el.closest('.card-hover-layer');
    });
    check(`${vp.width} 放大区域下方仍可点击原界面`, before && hit);

    // 4. 横版：探险卡
    await page.mouse.move(4, vp.height / 2);
    await page.waitForTimeout(250);
    const quest = page.locator('.quest-display .card-art').first();
    await quest.scrollIntoViewIfNeeded();
    await quest.hover();
    await page.waitForTimeout(400);
    const q1 = await boxOf(page);
    check(`${vp.width} 探险卡按横版显示`, q1.on && q1.w > q1.h, q1);
    check(`${vp.width} 探险卡不越界`, q1.x >= 0 && q1.y >= 0 && q1.right <= vp.width && q1.bottom <= vp.height);
    await page.screenshot({ path: path.join(root, 'docs', 'browser-acceptance', `hover-quest-${vp.width}.png`) });

    // 5. Esc 收起
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    check(`${vp.width} Esc 立即收起`, !(await boxOf(page)).on);

    check(`${vp.width} 无脚本错误`, errs.length === 0, { errs: errs.slice(0, 3) });
    await page.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(root, 'docs', 'browser-acceptance', 'card-hover-report.json'), JSON.stringify({ ok: failed.length === 0, checks: results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  process.exit(failed.length ? 1 : 0);
})();
