/* 资源阶段抽牌浮层的「重播」验收（v0.15.85）。
   问题：resourceDraw 会随存档落盘，而「已展示过」的标记只存在内存里——
   于是每次强制刷新，render() 都拿存档里那笔旧抽牌重新弹一遍（用户反馈）。
   做法：真实开一局 → 走一次真实抽牌（mutate → 引擎 resourcePhase）→ 断言弹出；
   再 render() 一次、再整页 reload 一次 → 断言都不再弹；最后再抽一次 → 断言仍会弹
   （防止「一刀切不弹」把正常提示也砍掉）。
   运行：NODE_PATH=<node_modules> node scripts/check-draw-toast.cjs [--width 1440] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const WIDTH = (() => { const i = process.argv.indexOf('--width'); return i > -1 ? Number(process.argv[i + 1]) : 1440; })();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });
  const toastCount = () => page.locator('.draw-toast').count();
  const clearToast = () => page.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });

  /* 真实开一局（与 check-layout / browser-check 同一套入口）。 */
  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(700);
  add('对局已开始（有 state）', await page.evaluate(() => !!(typeof state !== 'undefined' && state && state.status === 'playing')));

  /* ① 真实抽牌：走 mutate → 引擎 resourcePhase，等同于玩家推进到资源阶段。 */
  const draw1 = await page.evaluate(() => {
    const before = state.resourceDraw ? state.resourceDraw.id : null;
    state.round += 1; state.phase = 0;
    mutate(() => ScenarioEngine.resourcePhase(state));
    return { before, after: state.resourceDraw ? state.resourceDraw.id : null };
  });
  await page.waitForTimeout(300);
  add('推进到资源阶段后弹出抽牌浮层', (await toastCount()) === 1, `draw id ${draw1.before} → ${draw1.after}`);
  const toastText = await page.locator('.draw-toast').first().innerText().catch(() => '');
  add('浮层列出抽到的牌与费用', /抽到/.test(toastText) && /费用/.test(toastText), toastText.replace(/\s+/g, ' ').slice(0, 60));

  /* ② 同一笔抽牌重复重绘（切页签／开合浮层都会 render）不应重弹。 */
  await clearToast();
  await page.evaluate(() => render());
  await page.waitForTimeout(250);
  add('同一笔抽牌重复 render 不再弹', (await toastCount()) === 0);

  /* ③ 硬刷新：存档里仍有 resourceDraw，但不该再弹（本次修复的核心）。 */
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lotr-core-v02') || '{}').resourceDraw || null);
  add('存档里确实留着那笔抽牌记录（复现前提）', !!saved && !!saved.id, saved ? `id=${saved.id} round=${saved.round}` : 'none');
  await page.reload();
  await page.waitForTimeout(1200);
  add('强制刷新后不再自动弹抽牌浮层', (await toastCount()) === 0);
  const afterReload = await page.evaluate(() => (typeof state !== 'undefined' && state && state.resourceDraw) ? state.resourceDraw.id : null);
  add('刷新后存档内容未丢（同一条记录仍在 state 里）', afterReload === (saved && saved.id), `state.resourceDraw.id=${afterReload}`);

  /* ④ 刷新后再抽一次牌：必须照常弹，避免「一刀切不弹」把正常提示砍掉。 */
  const draw2 = await page.evaluate(() => {
    const before = state.resourceDraw ? state.resourceDraw.id : null;
    state.round += 1; state.phase = 0;
    mutate(() => ScenarioEngine.resourcePhase(state));
    return { before, after: state.resourceDraw ? state.resourceDraw.id : null };
  });
  await page.waitForTimeout(300);
  add('刷新后新一次的抽牌仍然会弹', (await toastCount()) === 1 && draw2.after !== draw2.before, `draw id ${draw2.before} → ${draw2.after}`);

  /* ⑤ × 关闭与 4 秒自动关闭都得在（防止只修了重播、把交互改坏）。 */
  await page.locator('.draw-toast #draw-close').click().catch(() => {});
  await page.waitForTimeout(250);
  add('点 × 可关闭浮层', (await toastCount()) === 0);
  await page.evaluate(() => { state.round += 1; state.phase = 0; mutate(() => ScenarioEngine.resourcePhase(state)); });
  await page.waitForTimeout(300);
  const autoShown = (await toastCount()) === 1;
  await page.waitForTimeout(4200);
  add('约 4 秒后自动关闭', autoShown && (await toastCount()) === 0, autoShown ? '出现后 4.2s 已消失' : '未出现');

  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const shot = path.join(OUT, `draw-toast-${WIDTH}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, `draw-toast-${WIDTH}.json`), JSON.stringify({ ok, width: WIDTH, draw1, draw2, saved, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
