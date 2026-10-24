/* 单屏体检：量出对局桌面在常见分辨率下的总高度、各区块高度，
   以及「必须滚动才能看到」的关键信息（手牌/探查区/操作区/牌堆）。
   Run: node scripts/check-onescreen.cjs [--width 1440] [--height 900] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'onescreen');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? Number(process.argv[i + 1]) : d; };
const W = arg('width', 1440), H = arg('height', 900);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(200);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(250);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(250);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(600);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.locator('button[data-action="finishSetup"]').click(); await page.waitForTimeout(1400);

  const m = await page.evaluate(() => {
    const g = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const vh = innerHeight;
    const inView = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh + 0.5; };
    return {
      vh,
      docH: Math.round(document.documentElement.scrollHeight),
      bodyH: Math.round(document.body.scrollHeight),
      header: g('header'),
      table: g('.desktop-table'),
      title: g('.expedition-title'),
      dock: g('.operation-dock'),
      dockContent: g('.operation-content'),
      layout: g('.tabletop-layout'),
      publicTable: g('.public-table'),
      playerMat: g('.player-mat'),
      rail: g('.tabletop-rail'),
      hand: g('.hand-zone'),
      staging: g('.table-zone'),
      visible: {
        dock: inView('.operation-dock'),
        hand: inView('.hand-zone'),
        activeZone: inView('.active-zone'),
        deckRail: inView('.deck-rail'),
        log: inView('.table-log'),
      },
      cards: document.querySelectorAll('.table-card').length,
      dbg: (()=>{const L=document.querySelector('.tabletop-layout');const M=document.querySelector('.tabletop-main');
        const c=L?getComputedStyle(L):null;return {cols:c&&c.gridTemplateColumns,rows:c&&c.gridTemplateRows,main:c&&getComputedStyle(M).display,
          layoutH:L?Math.round(L.getBoundingClientRect().height):null};})(),
    };
  });

  console.log(`视口 ${W}×${H}`);
  console.log(`文档总高 ${m.docH}（超出 ${m.docH - H}px，约 ${((m.docH / H - 1) * 100).toFixed(0)}%）`);
  for (const k of ['header', 'title', 'dock', 'dockContent', 'publicTable', 'playerMat', 'rail', 'hand']) {
    if (m[k]) console.log(`  ${k.padEnd(14)} y=${String(m[k].y).padStart(4)} h=${String(m[k].h).padStart(4)} bottom=${m[k].bottom}`);
  }
  console.log('  dbg cols=', m.dbg.cols, '| rows=', m.dbg.rows, '| main=', m.dbg.main, '| layoutH=', m.dbg.layoutH);
  console.log('单屏可见：', Object.entries(m.visible).map(([k, v]) => `${k}=${v ? '✓' : '✗'}`).join('  '));

  await page.screenshot({ path: path.join(OUT, `onescreen-${W}x${H}.png`), fullPage: false });
  await page.screenshot({ path: path.join(OUT, `onescreen-${W}x${H}-full.png`), fullPage: true });
  if (errors.length) console.log('脚本错误:', errors);
  await browser.close();
})();
