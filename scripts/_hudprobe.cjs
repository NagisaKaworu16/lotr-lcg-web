/* 取证：顶部 header / .game-hud / 操作条 的几何与文字，用于「把两块信息搬进顶栏」改造前基线。 */
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'browser-acceptance', '_hudprobe');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  for (const vp of [{w: 1920, h: 1080}, {w: 1440, h: 900}, {w: 1366, h: 768}, {w: 1280, h: 800}]) {
    const p = await (await b.newContext({viewport: {width: vp.w, height: vp.h}})).newPage();
    await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
    await sleep(450);
    await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
    await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
    await p.locator('[data-action="ngNext"]').click(); await sleep(280);
    await p.locator('[data-action="chooserConfirm"]').click(); await sleep(600);
    /* 保留手牌 → 进入对局 */
    for (const btn of await p.locator('button[data-action="keepHand"]:not([disabled])').all()) {
      await btn.click().catch(() => {});
    }
    await sleep(700);
    await p.evaluate(() => { if (state) { state.phase = 5; render(); } });
    await sleep(400);
    const geo = await p.evaluate(() => {
      const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return {x: +b.left.toFixed(0), y: +b.top.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0)}; };
      const q = s => document.querySelector(s);
      return {
        header: R(q('header')),
        hud: R(q('#gameHud')),
        hudHidden: q('#gameHud')?.hidden,
        hudText: q('#gameHud')?.textContent.replace(/\s+/g, ' ').slice(0, 160),
        dock: R(q('.operation-dock')),
        dockText: q('.operation-dock')?.textContent.replace(/\s+/g, ' ').slice(0, 160),
        mat: R(q('.player-mat')),
        layout: R(q('.tabletop-layout')),
        hand: R(q('.hand-zone')),
        phaseHint: R(q('.phase-hint-wrap')),
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        scrollH: document.documentElement.scrollHeight,
        innerH: innerHeight,
      };
    });
    console.log('--- ' + vp.w + 'x' + vp.h + ' ---');
    console.log(JSON.stringify(geo, null, 1));
    await p.screenshot({path: path.join(OUT, vp.w + '-hud.png')});
    await p.context().close();
  }
  await b.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
