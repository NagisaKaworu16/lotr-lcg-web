/* 调色板回归：断言「四个面**实际渲染**出的 CSS 颜色 ⊆ 调色板 ∪ 显式允许清单」。
 *
 * 为什么不能数源码声明：style.css 里 359 个去重色值中大量已被后面的 Vintage 块覆盖成死值，
 * 数声明会严重高估。这里一律读 computed style，只看真正画到屏幕上的颜色。
 *
 * 三个口径（都很重要）：
 *   ① 按 RGBA 处理：alpha < 1 时先把颜色**合成**到它的实际底色上再比对。
 *      `rgba(0,0,0,.28)` 不是 `#000000`——它压深底后是 #2a2d33，既不是黑也不是底色。
 *      纯黑/纯白且 alpha ≤ 0.35 的视为「叠加灰」（分隔线、遮罩），单独计数放行：
 *      它们是明暗工具，不是调色板色。
 *   ② 阴影单独放行：低位投影合法，不参与调色板判定（只统计数量）。
 *   ③ 调色板不是硬编码的常量，而是**从构建产物 :root 里读回来的令牌值**，
 *      令牌一改这里自动跟随，不会出现「令牌换了、白名单没换」的漂移。
 *      `--pc`（阶段色）是 JS 里 PHASE_COLOR 注入的，不属于 :root，按「派生色」处理：
 *      把 7 个 --pc 原值 + style.css 里仅有的三种 color-mix(--pc …) 实算出来一起放行。
 *
 * 允许清单里的每一条都必须写理由。只允许放「等 visual 裁定的 --pc 系 / 选中环」和
 * 「§6-32 领域色保留原值」这两类，别的一律要改令牌。
 *
 * 用法：NODE_PATH=… node scripts/check-palette.cjs [--width 1440]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const i = process.argv.indexOf('--width');
const WIDTH = i > -1 ? Number(process.argv[i + 1]) : 1440;

/* 允许清单：hex → 理由。只许放两类，见文件头。 */
const ALLOW = {
  /* 注：PHASE_COLOR 的 7 个阶段色**不在这里**——它们由下面的 --pc 派生机制自动覆盖
     （七色 × 那三种 mix 实算），写死在这里反而会掩盖「派生链断了」这种失效。
     它们仍是 §4 待 visual 裁定的项目，届时改 phase-log.js 一处即可。 */
  /* §5.11-A：活跃玩家标签底。规范明示「不新增令牌」的唯一一处新增字面量
     （三级台阶 28.7→35.4→42.6 的第三级，锁在顶栏自己的绿色相 H143 上） */
  '#4b6d48': '§5.11-A active 玩家标签底',
  /* §5.7-b：时机线数据色。与 forced（--accent-red-on-dark 4.51）等亮度、
     OKLCh 彩度 0.112–0.119、L* 69.2–69.3 钉死，色相是唯一变量——
     单独定值，不许复用 --on-dark-gold 等语义令牌 */
  '#cda351': '§5.7-b trigger 时机线',
  '#72b97d': '§5.7-b action 时机线',
  /* §6-32：领域色五色，规范明示「保留原值不动」——只做 border-top 4px 竖带，
     从不承载文字，是「领域识别」的唯一线索 */
  '#6e9db5': '§6-32 领域色 knowledge',
  '#886a9b': '§6-32 领域色 leadership',
  '#ad6155': '§6-32 领域色 tactics',
  '#699875': '§6-32 领域色 spirit',
  '#a49777': '§6-32 领域色 neutral',
};

/* --pc 派生色：style.css 里与 --pc 有关的 color-mix 只有这三种（新增第四种请同步这里） */
const PC_MIXES = [
  'var(--pc)',
  'color-mix(in srgb,var(--pc) 46%,var(--surface-rail))',  /* 命中窗口行 */
  'color-mix(in srgb,var(--pc) 38%,var(--surface-rail))',  /* 已过阶段头 */
  'color-mix(in srgb,var(--pc) 10%,var(--surface-pop))',   /* 日志条目底 */
];

const COLLECT = ([pcMixes, allowKeys]) => {
  const ALLOWSET = new Set(allowKeys);
  const hexOf = str => {
    const n = (str.match(/[\d.]+/g) || []).map(Number);
    if (n.length < 3) return null;
    /* color-mix 会算成 oklab()/color() 浮点，0~1 的分量先归一到 0~255 */
    const rgb = n.slice(0, 3).map(v => (v <= 1 ? Math.round(v * 255) : Math.round(v)));
    return { hex: '#' + rgb.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''), rgb, a: n[3] === undefined ? 1 : n[3] };
  };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const over = (fg, bg) => fg.rgb.map((v, k) => Math.round(v * fg.a + bg[k] * (1 - fg.a)));

  /* ① 调色板 = 构建产物 :root 里所有「颜色型」令牌值 */
  const cs0 = getComputedStyle(document.documentElement);
  const palette = new Set();
  for (const name of cs0) {
    if (!name.startsWith('--')) continue;
    const v = cs0.getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v) || /^#([0-9a-f]{3})$/i.exec(v);
    if (m) { const h = m[1].length === 3 ? '#' + m[1].split('').map(c => c + c).join('') : '#' + m[1]; palette.add(h.toLowerCase()); }
  }

  /* ② --pc 派生色：把 7 个阶段色分别代入那三种 mix，实算出来 */
  const pcVals = [...new Set([...document.querySelectorAll('[style*="--pc"]')]
    .map(e => e.style.getPropertyValue('--pc').trim()).filter(Boolean))];
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px';
  document.body.appendChild(probe);
  const derived = new Set();
  for (const pc of pcVals) {
    probe.style.setProperty('--pc', pc);
    for (const expr of pcMixes) {
      probe.style.background = '';
      probe.style.background = expr;
      const h = hexOf(getComputedStyle(probe).backgroundColor);
      if (h && h.a === 1) derived.add(h.hex);
    }
  }
  probe.remove();

  /* ③ 底色解析（供 alpha 合成用）：爬到第一个不透明背景 */
  const backdrop = el => {
    let n = el;
    while (n) {
      const c = hexOf(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 1) return c.rgb;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };

  const out = new Map();
  const skipped = { overlay: 0, shadow: 0, alphaToken: 0 };
  const add = (raw, prop, el) => {
    const c = hexOf(raw);
    if (!c) return;
    if (c.a === 0) return;
    let hex = c.hex;
    if (c.a < 1) {
      /* alpha 的三种合法来源，都算「调色板内的颜色带透明度」，不合成、不判越界：
         ① 基色本身就是令牌（例如 --surface-header 的 25% 遮罩、--on-gold 的 72% 小字）；
         ② 基色是 --pc 派生色；
         ③ 纯黑/纯白且 alpha ≤ .35 —— 明暗工具（分隔线、压暗层），不是调色板色。 */
      if (palette.has(c.hex) || derived.has(c.hex) || ALLOWSET.has(c.hex)) { skipped.alphaToken++; return; }
      const pure = (c.rgb[0] === c.rgb[1] && c.rgb[1] === c.rgb[2] && (c.rgb[0] === 0 || c.rgb[0] === 255));
      if (pure && c.a <= .35) { skipped.overlay++; return; }
      const [r, g, b] = over(c, backdrop(el));
      hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    if (palette.has(hex) || derived.has(hex)) return;
    const sel = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    if (!out.has(hex)) out.set(hex, { hex, props: new Set(), sels: new Set(), n: 0 });
    const r = out.get(hex); r.props.add(prop); r.n++; if (r.sels.size < 4) r.sels.add(sel);
  };

  for (const el of document.querySelectorAll('*')) {
    if (el === probe) continue;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const s = getComputedStyle(el);
    add(s.color, 'color', el);
    add(s.backgroundColor, 'background', el);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none') add(s['border' + side + 'Color'], 'border', el);
    }
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) add(s.outlineColor, 'outline', el);
    /* 阴影单独放行，只统计 */
    if (s.boxShadow && s.boxShadow !== 'none') skipped.shadow++;
  }
  return {
    bad: [...out.values()].map(v => ({ hex: v.hex, props: [...v.props].sort(), sels: [...v.sels], n: v.n }))
      .sort((a, b) => b.n - a.n || a.hex.localeCompare(b.hex)),
    paletteSize: palette.size, derived: [...derived].sort(), pcVals,
    skipped,
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: 950 } })).newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const report = { width: WIDTH, at: new Date().toISOString(), faces: [] };
  let paletteInfo = null;
  const sweep = async label => {
    const r = await page.evaluate(COLLECT, [PC_MIXES, Object.keys(ALLOW)]);
    if (!paletteInfo || r.derived.length > paletteInfo.derived.length) paletteInfo = r;
    /* 允许清单不在脚本里硬判通过，而是逐条核验「确实只出现在它该出现的地方」：
       清单里有、但渲染中已经消失的，打印提示（说明可以删条目了）；
       渲染中出现、但不在清单里的，就是 violation。 */
    const bad = r.bad.filter(b => !ALLOW[b.hex]);
    const allowedSeen = r.bad.filter(b => ALLOW[b.hex]).map(b => b.hex);
    report.faces.push({ face: label, violations: bad, allowed: allowedSeen, skipped: r.skipped });
    console.log(`\n===== ${label} =====  越界色值 ${bad.length} 个（放行 ${allowedSeen.length} 个）  alpha 令牌 ${r.skipped.alphaToken} / 叠加灰 ${r.skipped.overlay} / 阴影 ${r.skipped.shadow}`);
    for (const b of bad) console.log(`  ✗ ${b.hex}  ${String(b.n).padStart(4)} 处  [${b.props.join(',')}]  ${b.sels.join(' / ')}`);
    for (const b of r.bad.filter(x => ALLOW[x.hex])) console.log(`  · ${b.hex}  ${String(b.n).padStart(4)} 处  [${b.props.join(',')}]  ${ALLOW[b.hex]}`);
  };

  await sweep('1-开局设置');
  await page.selectOption('#playerCount', '2');
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  await sweep('2-组卡/英雄选择');
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const fin = page.locator('button[data-action="finishSetup"]'); if (await fin.count()) await fin.click(); }
  await page.waitForTimeout(800);
  await sweep('3-对局桌面');
  for (const name of ['卡牌', '我的卡组', '说明与完成范围']) {
    const b = page.locator('nav button, nav a', { hasText: name }).first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(600); await sweep('4-' + name); }
  }
  await browser.close();

  const allBad = report.faces.flatMap(f => f.violations);
  report.ok = allBad.length === 0;
  report.palette = { size: paletteInfo.paletteSize, derived: paletteInfo.derived, pcVals: paletteInfo.pcVals };
  report.allowUsed = [...new Set(report.faces.flatMap(f => f.allowed))].sort();
  report.allowUnused = Object.keys(ALLOW).filter(h => !report.allowUsed.includes(h)).sort();
  fs.writeFileSync(path.join(OUT, `palette-report-${WIDTH}.json`), JSON.stringify(report, null, 1));

  console.log(`\n调色板：从构建产物 :root 读到 ${paletteInfo.paletteSize} 个颜色令牌；--pc 派生色 ${paletteInfo.derived.length} 个（${paletteInfo.pcVals.length} 个阶段色 × ${PC_MIXES.length} 种 mix）`);
  console.log(`允许清单命中 ${report.allowUsed.length} / ${Object.keys(ALLOW).length} 条` + (report.allowUnused.length ? `；未出现（可删）：${report.allowUnused.join(' ')}` : ''));
  console.log(`${report.ok ? 'PASS' : 'FAIL'} ${report.faces.length} faces, ${allBad.length} 个调色板外色值 @ ${WIDTH}px`);
  process.exit(report.ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
