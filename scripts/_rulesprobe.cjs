/* 390×844 下 `#quest-rules`（<details>）展开 / 收起 / 重绘后三张截图 + 判定
 *
 * ux 要的证据：`rulesOpen` 是否活过 render()。她的顾虑是「open 属性对、视觉没变」
 * （例如 summary 被强制 block、或 p 被 display:none），所以这里除了 open 属性
 * 还量 `<p>` 的高度与 checkVisibility()，并落三张图。
 *
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     node scripts/_rulesprobe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'browser-acceptance', 'vaccept');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean).find(p => fs.existsSync(p));

const readRules = () => {
  const d = document.querySelector('#quest-rules');
  if (!d) return { missing: true };
  const p = d.querySelector('p');
  const rows = [...d.querySelectorAll('li[data-roster-player]')];
  const pb = p ? p.getBoundingClientRect() : null;
  return {
    open: d.open,
    属性: d.hasAttribute('open'),
    summary高: (() => { const s = d.querySelector('summary'); return s ? +s.getBoundingClientRect().height.toFixed(1) : null; })(),
    p高: pb ? +pb.height.toFixed(1) : null,
    p可见: p ? p.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : null,
    p文本长: p ? p.textContent.trim().length : 0,
    名单行数: rows.length,
    名单行可见: rows.filter(r => r.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })).length,
    details总高: +d.getBoundingClientRect().height.toFixed(1),
  };
};

(async () => {
  if (!executablePath) throw new Error('未找到本机 Chrome');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(pageUrl);
  await page.waitForTimeout(450);

  const tap = async (loc, ms = 260) => {
    if (!await loc.count()) return false;
    try { await loc.first().click({ timeout: 1800 }); }
    catch (e) { try { await loc.first().evaluate(el => el.click()); } catch (e2) { return false; } }
    await page.waitForTimeout(ms); return true;
  };
  await page.selectOption('#playerCount', '2');
  await page.waitForTimeout(200);
  await tap(page.locator('.ng-tabs button', { hasText: '新版扩展' }));
  await tap(page.locator('.ng-card', { hasText: '基础剧本合集' }));
  await tap(page.locator('[data-action="ngNext"]'));
  await tap(page.locator('[data-action="chooserConfirm"]'), 600);
  for (let i = 0; i < 8; i++) {
    const k = page.locator('button[data-action="keepHand"]:not([disabled])');
    if (!await k.count()) break;
    if (!await tap(k, 200)) break;
  }
  await page.evaluate(() => {
    const s = state;
    let g = 0;
    while (g++ < 8 && s.players.some(p => !p.openingConfirmed)) {
      for (const p of s.players) if (!p.openingConfirmed) { try { ScenarioEngine.openingChoice(s, p.id, false); } catch (e) {} }
    }
    if (s.phase === 0) { try { ScenarioEngine.startScenario(s); } catch (e) {} }
    render();
  });
  await page.waitForTimeout(240);

  const PANEL = ':is(.operation-content, .decide-box, .planning-strip)';
  const clickAny = async (sel, text) => {
    const el = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    if (!await el.count()) return false;
    return tap(el, 300);
  };
  let at = false;
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({ p: state.phase, st: state.questing && state.questing.step, locked: !!(state.questing && state.questing.deploymentLocked) }));
    if (s.p === 2 && s.st === 'commit' && !s.locked) { at = true; break; }
    const dc = page.locator('#draw-close');
    if (await dc.count() && await dc.isVisible()) { await dc.click({ force: true }).catch(() => {}); await page.waitForTimeout(140); continue; }
    if (await clickAny(PANEL + ' button:not([disabled])', '结束我的盟友／附属出牌步骤')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '继续到下一决策点')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '：放弃剩余行动')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '开始投入角色')) continue;
    if (await clickAny('.operation-title button.primary:not([disabled])')) continue;
    await page.waitForTimeout(220);
  }
  if (!at) throw new Error('未进入 commit');

  const shot = async (name) => {
    const box = await page.evaluate(() => {
      const d = document.querySelector('#quest-rules') || document.querySelector('.decide-box');
      const b = d.getBoundingClientRect();
      return { x: Math.max(0, b.left - 8), y: Math.max(0, b.top - 8), width: Math.min(b.width + 16, 390), height: Math.min(b.height + 16, 844) };
    });
    await page.screenshot({ path: path.join(outDir, `390x844-rules-${name}.png`), clip: box }).catch(() => {});
    await page.screenshot({ path: path.join(outDir, `390x844-rules-${name}-full.png`) }).catch(() => {});
  };

  const steps = [];
  // 1) 初始（默认 per-state 值）
  steps.push({ 步骤: '初始', ...(await page.evaluate(readRules)) });
  await shot('0-初始');

  // 2) 收起（若已收起则先展开再收，保证是从开→关）
  const d0 = page.locator('#quest-rules');
  if (!steps[0].open) { await tap(d0.locator('summary')); }
  if (await page.evaluate(() => document.querySelector('#quest-rules').open)) await tap(d0.locator('summary'));
  steps.push({ 步骤: '收起', ...(await page.evaluate(readRules)) });
  await shot('1-收起');

  // 3) 展开
  await tap(d0.locator('summary'));
  steps.push({ 步骤: '展开', ...(await page.evaluate(readRules)) });
  await shot('2-展开');

  // 4) 重绘后（这是 ux 要验的那一步：rulesOpen 活过 render()）
  await page.evaluate(() => { render(); });
  await page.waitForTimeout(260);
  steps.push({ 步骤: 'render() 后', ...(await page.evaluate(readRules)) });
  await shot('3-render后');

  // 5) 再走一次「点勾选框触发重绘」——真实交互路径，不是脚本直接 render
  const cb = page.locator('.decide-box input[type=checkbox]:not([disabled])').first();
  if (await cb.count()) {
    try { await cb.check({ timeout: 1500 }); } catch (e) { await cb.evaluate(n => n.click()).catch(() => {}); }
    await page.waitForTimeout(320);
  }
  steps.push({ 步骤: '点勾选框后', ...(await page.evaluate(readRules)), 勾选框: await cb.count() });
  await shot('4-交互后');

  // 6) 重建一次整页再回到同一态不可行（会丢局面），改为再 render 两次看是否稳定
  await page.evaluate(() => { render(); }); await page.waitForTimeout(120);
  await page.evaluate(() => { render(); }); await page.waitForTimeout(220);
  steps.push({ 步骤: '连续 render ×2 后', ...(await page.evaluate(readRules)) });

  console.log('构建 md5 ' + require('crypto').createHash('md5').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'));
  for (const s of steps) console.log(JSON.stringify(s));
  if (errs.length) console.log('pageerror ' + errs.join(' | '));
  fs.writeFileSync(path.join(outDir, '_rulesprobe.json'), JSON.stringify({ steps, errs }, null, 2), 'utf8');
  await browser.close();
})();
