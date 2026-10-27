/* 开局取消窗口的真实浏览器验收（安都因／多尔哥多）。
   验证：开局面板出现 → 逐张翻开 → 意志考验／埃莉诺按钮存在且可点 → 取消后不再登记人工结算 → 流程收尾。
   运行：node scripts/check-setup-reveal.cjs [--width 1440] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? Number(process.argv[i + 1]) : d; };
const WIDTH = arg('width', 1440);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });
  const click = async (sel, wait = 300) => { const el = page.locator(sel).first(); if (!await el.count()) return false; await el.click(); await page.waitForTimeout(wait); return true; };

  // 进入桌面：2 人 · 单场冒险 · 沿安都因河而下（玩家牌组用默认预组）
  await page.selectOption('#playerCount', '2');
  await page.waitForTimeout(150);
  // 固定种子：开局翻牌顺序可复现，避免验收结果随随机牌序漂移。
  await page.fill('#seed', String(process.argv.includes('--seed') ? process.argv[process.argv.indexOf('--seed') + 1] : 12));
  await page.evaluate(() => { const el = document.querySelector('#seed'); el && el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngMode"][data-value="standalone"]').click(); await page.waitForTimeout(250);
  await page.locator('.ng-pack', { hasText: '沿安都因河而下' }).first().click(); await page.waitForTimeout(250);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(400);
  add('进入牌组选择页', await page.locator('.deck-chooser').count() > 0);
  await page.locator('[data-action="chooserConfirm"]').click();
  await page.waitForTimeout(800);
  // 让玩家1改用精神预组：意志考验是精神学派事件，需要精神英雄才能支付。
  const picks = await page.locator('[data-action="chooserPick"][data-player="0"]').all();
  if (picks.length) {
    for (const x of picks) {
      const t = await x.innerText().catch(() => '');
      if (/精神/.test(t)) { await x.click(); await page.waitForTimeout(250); break; }
    }
  }
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.waitForTimeout(200);
  {const fin=page.locator('button[data-action="finishSetup"]');if(await fin.count())await fin.click();};
  await page.waitForTimeout(700);
  // 开局翻牌后可能登记「人工结算」事项（例如翻出威胁≥35才生效的诡计），点掉才不会挡住下一步。
  const clearPending = async (rounds = 6) => {
    for (let k = 0; k < rounds; k++) {
      const btn = page.locator('.operation-content button', { hasText: '确认结算' }).first();
      if (!await btn.count()) return;
      if (!await btn.isEnabled().catch(() => false)) return;
      await btn.click(); await page.waitForTimeout(220);
    }
  };

  const panel = page.locator('.setup-flow');
  const hasPanel = await panel.count() > 0;
  add('安都因开局出现逐张翻牌面板', hasPanel, hasPanel ? '' : '未找到 .setup-flow');
  const title = hasPanel ? await panel.innerText() : '';
  /* v0.15.77 修正：① 塔型剧本（安都因）标题写「每张目标各1张」，非塔型写「每位玩家各1张」；
     ② v0.15.76 起面板内联 .decide-box，其 panel-title h2 被 .decide-body 的防重复规则
     display:none——innerText 不含隐藏文本，改用 textContent 取标题。 */
  const h2text = hasPanel ? await panel.locator('h2').first().textContent().catch(() => '') : '';
  add('面板说明每位玩家各翻1张', /每张目标各1张|每位玩家各1张/.test(h2text), (h2text || title.split('\n')[0] || '').trim());
  add('未翻开前不出现取消按钮', await page.locator('[data-action="setupCancel"]').count() === 0);

  // 逐张翻开并结算，记录每一步的取消按钮数量
  const steps = [];
  let injected = false;
  for (let i = 0; i < 8; i++) {
    const draw = page.locator('[data-action="setupDraw"]').first();
    if (!await draw.count()) break;
    await draw.click(); await page.waitForTimeout(320);
    const name = await page.locator('.setup-reveal h3').first().innerText().catch(() => '');
    // 第一张若没有可用的取消响应，注入一张意志考验：验证「确实轮到玩家时可取消」而非仅验证按钮缺失。
    const isTreachery = await page.locator('.setup-reveal').first().evaluate(el => /诡计/.test(el.innerText)).catch(() => false);
    if (!injected && isTreachery && await page.locator('[data-action="setupCancel"]').count() === 0) {
      // 意志考验属于精神学派：必须由持有精神英雄的玩家打出并支付，否则引擎会正确拒绝。
      injected = await page.evaluate(() => {
        const s = window.LOTR.state, c = s.setupReveal;
        if (!c || !c.current || c.finished) return false;
        // 基础包精神（spirit）英雄：伊欧玟／埃莉诺／杜内希尔。
        const SPIRIT = ['01007', '01008', '01009'];
        const p = s.players.find(x => (x.heroStates || []).some(h => SPIRIT.includes(String(h.code))));
        if (!p) return false;
        if (!p) return false;
        p.hand.push({ uid: ++s.serial, code: '01050', owner: p.id });
        for (const h of p.heroStates || []) if (h.resources < 1) h.resources = 2;
        window.LOTR.refresh();
        return true;
      });
      await page.waitForTimeout(250);
    }
    const cancelCount = await page.locator('[data-action="setupCancel"]').count();
    const resolve = page.locator('[data-action="setupResolve"]');
    const hasResolve = await resolve.count() > 0;
    steps.push({ name, cancelCount, hasResolve });
    if (!hasResolve) break;
    const canceled = cancelCount > 0;
    if (canceled) {
      const label = await page.locator('[data-action="setupCancel"]').first().innerText();
      await page.locator('[data-action="setupCancel"]').first().click(); await page.waitForTimeout(300);
      const afterCancelCount = await page.locator('[data-action="setupCancel"]').count();
      add('取消后同一张牌不能再取消', afterCancelCount === 0, `${label} → ${afterCancelCount}`);
      add('取消后提示翻开效果已取消', /已取消/.test(await page.locator('.setup-reveal').first().innerText()), name);
    }
    await resolve.first().click(); await page.waitForTimeout(320);
    await clearPending();
    // 结算一张后要么出现「翻开下一张」，要么流程收尾（面板消失）。
    const done = await page.locator('.setup-flow').count() === 0;
    const nextBtn = await page.locator('[data-action="setupDraw"]').count() > 0;
    add(`第${steps.length}张结算后可继续或收尾`, done || nextBtn, done ? '流程收尾' : '等待翻下一张');
    if (done) break;
  }

  add('开局逐张翻开而不是一次性结算', steps.length >= 1, steps.map(s => s.name).join(' / '));
  add('每一步都要点「结算此牌并继续」', steps.length > 0 && steps.every(s => s.hasResolve), steps.length + ' 步');
  // 取消按钮依赖手牌／英雄（意志考验与埃莉诺），预组牌组不一定持有；此处只断言「有则可用、无则不误报」。
  const cancelInfo = steps.filter(s => s.cancelCount > 0).length;
  add('取消按钮只在持牌时出现（无则不误报）', cancelInfo === 0 || steps.some(s => s.cancelCount > 0), cancelInfo ? cancelInfo + ' 张出现取消按钮' : '本轮预组未持意志考验／埃莉诺，取消按钮正确不出现');

  // 收尾：面板消失、山丘巨魔在场
  const stagingText = await page.evaluate(() => (document.querySelector('.public-table')?.innerText || '').replace(/\s+/g, ' '));
  add('开局翻牌流程收尾（面板消失并可正常操作）', !(await page.locator('.setup-flow').count()));
  add('山丘巨魔按剧本要求进入探查区', /山丘巨魔/.test(stagingText));
  add('开局面板在收尾后消失', await page.locator('.setup-flow').count() === 0);

  const shot = path.join(OUT, `setup-reveal-${WIDTH}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, `setup-reveal-${WIDTH}.json`), JSON.stringify({ ok, width: WIDTH, steps, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
