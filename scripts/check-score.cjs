/* 结算计分面板的真实浏览器验收。
   验证：进行中无面板 → 胜利后出现分项明细 → 总分与公式一致 → 失败局改为过程计分 → 无脚本错误。
   运行：node scripts/check-score.cjs [--width 1440] */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
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
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

  await page.fill('#seed', '12345');
  await page.evaluate(() => document.querySelector('#seed').dispatchEvent(new Event('input', { bubbles: true })));
  // 新游戏流程：产品墙 → 基础剧本合集 → 单场冒险 → 穿越幽暗密林 → 选牌组。
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngMode"][data-value="standalone"]').click(); await page.waitForTimeout(250);
  await page.locator('.ng-pack', { hasText: '穿越幽暗密林' }).first().click(); await page.waitForTimeout(250);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(400);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(800);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  await page.locator('button[data-action="finishSetup"]').click();
  await page.waitForTimeout(500);

  add('进行中不显示计分面板', await page.locator('.score-panel').count() === 0);

  // 构造终局：威胁 33、回合 6、一名英雄 3 伤、胜利区 山丘巨魔 5 分。
  const expected = await page.evaluate(() => {
    const s = window.LOTR.state;
    s.status = 'won';
    s.round = 6;
    s.players[0].threat = 33;
    if (s.players[1]) s.players[1].threat = 27;
    s.players[0].heroStates[0].damage = 3;
    s.victory.push({ id: 82, name: '山丘巨魔', type: 'Enemy', victory: 5, uid: ++s.serial });
    window.LOTR.refresh();
    return window.LOTR.state && (33 + (s.players[1] ? 27 : 0) + 6 * 10 + 3 - 5);
  });
  await page.waitForTimeout(350);

  const panel = page.locator('.score-panel');
  add('胜利后出现计分面板', await panel.count() > 0);
  const text = await panel.innerText().catch(() => '');
  add('标题标明剧本胜利', /剧本胜利 · 结算计分/.test(text), text.split('\n')[0] || '');
  for (const [label, re] of [['威胁合计', /威胁/], ['回合数', /回合数/], ['淘汰人数', /淘汰/], ['英雄伤害', /英雄伤害/], ['胜利区', /胜利区/]]) {
    add(`分项含${label}`, re.test(text));
  }
  const shown = await page.evaluate(() => [...document.querySelectorAll('.score-table .score-value')].map(x => x.textContent.trim()));
  add('分项逐条列出数值', shown.length === 5, shown.join(' / '));
  const totalText = await page.locator('.score-total strong').first().innerText().catch(() => '');
  add('总分与官方公式一致', Number(totalText) === expected, `面板 ${totalText} · 预期 ${expected}`);
  add('给出评级说明', /史诗级胜利|优秀|良好|勉强通过|惨胜/.test(text));
  add('显示每名玩家归一化分数', /每名玩家归一化/.test(text));
  // 总分必须在不滚动的情况下可见（终局核心结论不能被 30vh 上限折叠）
  const totalVisible = await page.locator('.score-total').first().isVisible().catch(() => false);
  const clipped = await page.locator('.operation-content').first().evaluate(el => el.scrollHeight > el.clientHeight + 2).catch(() => true);
  add('总分无需滚动即可见', totalVisible && !clipped, `visible=${totalVisible} clipped=${clipped}`);
  const btnBox = await page.locator('.score-panel button[data-action="reset"]').first().boundingBox().catch(() => null);
  add('底部操作按钮完整渲染', !!btnBox && btnBox.height > 20, btnBox ? `${Math.round(btnBox.height)}px` : '未找到');

  // 数值自洽：把数值逐项相加应等于总分（胜利项为负）。
  const sum = shown.reduce((n, v) => n + (v.startsWith('-') ? -Number(v.slice(1)) : Number(v.replace('+', ''))), 0);
  add('分项加减等于总分', sum === Number(totalText), `${sum} vs ${totalText}`);

  const shotWin = path.join(OUT, `score-win-${WIDTH}.png`);
  await page.locator('.score-panel').screenshot({ path: shotWin }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `score-win-full-${WIDTH}.png`) });

  // 失败局：改为过程计分
  await page.evaluate(() => { window.LOTR.state.status = 'lost'; window.LOTR.refresh(); });
  await page.waitForTimeout(300);
  const lostText = await page.locator('.score-panel').innerText().catch(() => '');
  add('失败局改为过程计分', /远征失败 · 过程计分/.test(lostText), lostText.split('\n')[0] || '');
  add('失败局说明不计入战绩', /失败局不计入战绩/.test(lostText));

  // 小屏不溢出
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  add('390px 宽度下无横向溢出', !overflow);
  await page.screenshot({ path: path.join(OUT, `score-mobile-${WIDTH}.png`) });

  add('无脚本错误', errors.length === 0, errors.join(' | '));

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, `score-${WIDTH}.json`), JSON.stringify({ ok, width: WIDTH, expected, totalText, shown, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
