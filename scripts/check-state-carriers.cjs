/* 状态载体验收（v0.15.94 / DESIGN_SYSTEM v1.2 §5.8 + §5.9 + §4 + §2）。
   这一轮把「卡图零滤镜」落到实处：卡图不许再被 filter 污染色准，也不许用整体 opacity
   做文字衰减。所有状态改由**卡框外侧**的几何与色块承担。这份脚本守三件事：

     A. §5.9 的 7 处 card-图滤镜全部归零（运行期逐条读 computed filter）；
        —— `.table-card.selectable .card-face:hover` / `.table-card.exhausted img` /
           `.hand-card.unaffordable img` / `.qp-card.is-gone img` /
           `.ng-card.locked .ng-card-art( img )` / `.rail-grp.past>.rail-head`
        另加一条**静态**守卫：style.css 里剩下的 filter 只允许三种合法形态
        （drop-shadow 投影 / 图案背景层 / filter:none 防复活），否则整类缺陷会悄悄回流。

     B. §5.8 的 8 个状态载体各自可用：虚线框、角标、旋转、底色、描边——
        且**不靠 opacity**。横置三处（character-card / table-card / qp-card）系数必须
        同为 .7 且都带 rotate(90deg)：transform 是几何变换、不是滤镜，删不得（§7.1 边界）。

     C. 配套的结构项：四层表面明度单调上行（§2）、纹理只挂三处且不上卡面（§4）、
        状态点四态共用同一强度的光环（§5.6）、阶段竖轴三条 3px 线的 forced 用暗底红（§5.7-b）、
        阶段栏「唯一的 700 / 唯一的金条」（§5.7）、圆角只剩令牌（§7.13）。

   运行：NODE_PATH=<node_modules> node scripts/check-state-carriers.cjs [--width 1440] */
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

const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

/* ── 期望的令牌字面值（与 style.css :root 同源；改令牌必须同步改这里）── */
const TOK = {
  ink2: 'rgb(84, 91, 77)',          // --ink-2 #545b4d
  onDark2: 'rgb(200, 207, 190)',    // --on-dark-2 #c8cfbe
  goldLine: 'rgb(183, 154, 98)',    // --gold-line #b79a62
  sunken: 'rgb(233, 224, 200)',     // --surface-sunken #e9e0c8
  redOnDark: 'rgb(239, 143, 132)',  // --accent-red-on-dark #ef8f84
  dotRing: 'rgba(35, 52, 43, 0.15)',// --dot-ring #23342b26
  ink3: 'rgb(111, 117, 102)',       // --ink-3 #6f7566
};

async function boot(page) {
  await page.goto(FILE);
  await page.waitForTimeout(420);
  await page.selectOption('#playerCount', '2').catch(() => {});
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(250);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(300);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(300);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(700);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  { const f = page.locator('button[data-action="finishSetup"]'); if (await f.count()) await f.click(); }
  await page.waitForTimeout(500);
  for (let i = 0; i < 40; i++) {
    const r = page.locator('[data-action="setupResolve"]'), d = page.locator('[data-action="setupDraw"]');
    if (await r.count()) await r.first().click();
    else if (await d.count()) await d.first().click();
    else break;
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });
  /* 推进到探险阶段：此时阶段 0/1 已成「已过」，竖轴的 past/current 两态同时在场。 */
  await page.locator('button[data-action="endPhase"]').click();
  await page.waitForTimeout(600);
  /* 再点「开始投入角色」把选人网格（.qp-card）拉出来；点不到也不影响 B-1..B-6 的断言。 */
  const start = page.locator('.decide-pop button:not([disabled])', { hasText: '开始投入角色' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(400); }
}

/* ── 运行期量测：全部在页面里跑，读 getComputedStyle ── */
const MEASURE = () => {
  /* 关键：.card-face img 上有 transition:transform .25s。刚挂上 .exhausted 就同步读
     getComputedStyle，过渡还停在 t=0，读到的是 identity——会误判成「旋转没生效」。
     量测期间把 transition 关掉即可（只关过渡，动画留着，否则 wait 态的点读不到描边）。 */
  const noTr = document.createElement('style');
  noTr.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(noTr);
  const cs = el => (el ? getComputedStyle(el) : null);
  const q = s => document.querySelector(s);
  const boxShadowOf = el => { const c = cs(el); return c ? c.boxShadow : null; };
  const lstar = rgbStr => {
    const m = (rgbStr.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (m.length < 3) return null;
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const Y = 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  };
  const out = {};

  /* —— 临时挂类：只为读计算样式，读完立刻还原（不改游戏状态）—— */
  const withClass = (el, cls, extra) => {
    if (!el) return null;
    const before = { c: el.className, a: extra ? el.getAttribute(extra[0]) : null };
    el.classList.add(...cls.split(' '));
    if (extra) el.setAttribute(extra[0], extra[1]);
    const res = {};
    const face = el.querySelector('.card-face');
    const img = el.querySelector('.card-face img') || el.querySelector('img');
    const c = cs(el), fc = cs(face), ic = cs(img);
    res.el = { bg: c.backgroundColor, border: c.borderTopStyle + ' ' + c.borderTopColor, opacity: c.opacity, radius: c.borderRadius };
    res.face = fc ? { bg: fc.backgroundColor, border: fc.borderTopStyle + ' ' + fc.borderTopColor, filter: fc.filter, overflow: fc.overflow } : null;
    res.img = ic ? { filter: ic.filter, transform: ic.transform, opacity: ic.opacity } : null;
    const pc = getComputedStyle(el, '::after');
    res.after = { content: pc.content, color: pc.color, font: pc.fontSize, display: pc.display };
    el.className = before.c;
    if (extra) { if (before.a === null) el.removeAttribute(extra[0]); else el.setAttribute(extra[0], before.a); }
    return res;
  };

  /* B-1/B-2/B-3 不可支付的手牌 */
  const hand = q('.hand-card') || q('.table-card.hand-card');
  out.unaffordable = withClass(hand, 'unaffordable', ['data-short', '3']);
  /* B-2 同一条规则也作用在非手牌的 .table-card 上 */
  out.unavailable = withClass(q('.public-table .table-card'), 'unavailable');
  /* B-3/B-4 横置：table-card / character-card / qp-card 三处必须同系数 */
  out.exhaustedTable = withClass(q('.public-table .table-card'), 'exhausted');
  out.exhaustedChar = withClass(q('.player-mat .own-characters .character-card'), 'exhausted');
  out.exhaustedQp = withClass(q('.qp-card'), 'is-exhausted');
  /* B-5/B-6 已离场 */
  out.goneQp = withClass(q('.qp-card'), 'is-gone');
  out.goneFlag = !!q('.qp-card.is-gone .qp-flag.gone-flag') || (() => {
    const c = q('.qp-card'); if (!c) return false; c.classList.add('is-gone');
    const has = !!c.querySelector('.qp-flag.gone-flag'); c.classList.remove('is-gone'); return has;
  })();
  /* B-7 .ng-card.locked：首页产品卡，直接读（不需要进对局） */
  out.locked = (() => {
    const c = q('.ng-card'); if (!c) return null;
    c.classList.add('locked');
    const art = c.querySelector('.ng-card-art'), img = c.querySelector('.ng-card-art img');
    const r = { art: cs(art) ? cs(art).filter : null, img: img ? cs(img).filter : null, opacity: cs(c).opacity };
    c.classList.remove('locked'); return r;
  })();

  /* B-8 阶段竖轴「已过」载体 */
  const pastHead = q('.rail-grp.past>.rail-head');
  out.pastHead = pastHead ? {
    filter: cs(pastHead).filter, bg: cs(pastHead).backgroundColor,
    span: cs(pastHead.querySelector('span')) ? cs(pastHead.querySelector('span')).color : null,
    weight: cs(pastHead.querySelector('span')) ? cs(pastHead.querySelector('span')).fontWeight : null,
  } : null;
  const pastNo = q('.rail-grp.past .rail-win .rail-win-no');
  const pastLabel = q('.rail-grp.past .rail-win .rail-win-label');
  const pastLine = q('.rail-grp.past .rail-win .rail-win-line');
  out.pastWins = {
    no: pastNo ? cs(pastNo).color : null,
    noWeight: pastNo ? cs(pastNo).fontWeight : null,
    label: pastLabel ? cs(pastLabel).color : null,
    lineBg: pastLine ? cs(pastLine).backgroundColor : null,
  };
  const curHead = q('.rail-grp.current>.rail-head');
  const curSpan = curHead && curHead.querySelector('span');
  const hitNo = q('.rail-win.hit .rail-win-no');
  const plainNo = [...document.querySelectorAll('.rail-win .rail-win-no')].find(n => !n.closest('.rail-win.hit'));
  out.railWeight = {
    curHeadFilter: curHead ? cs(curHead).filter : null,
    curHeadShadow: curHead ? cs(curHead).boxShadow : null,
    curSpanWeight: curSpan ? cs(curSpan).fontWeight : null,
    hitNoWeight: hitNo ? cs(hitNo).fontWeight : null,
    plainNoWeight: plainNo ? cs(plainNo).fontWeight : null,
    headIsDiv: !!curHead && curHead.tagName === 'DIV',
    headDataAction: curHead ? curHead.getAttribute('data-action') : 'x',
    headAriaExpanded: curHead ? curHead.getAttribute('aria-expanded') : 'x',
    headsWithoutAction: [...document.querySelectorAll('.rail-head')].every(h => !h.hasAttribute('data-action')),
    headCount: document.querySelectorAll('.rail-head').length,
  };

  /* 竖轴 forced 3px 线 */
  const forcedLine = q('.rail-win .rail-win-line[data-timing="forced"]');
  out.forcedLine = forcedLine ? { bg: cs(forcedLine).backgroundColor, h: forcedLine.getBoundingClientRect().width } : null;

  /* 状态点四态：光环必须同值 */
  const tg = q('.decide-trigger'); const dot = tg && tg.querySelector('.decide-dot');
  out.dots = (() => {
    if (!dot) return null;
    const old = tg.getAttribute('data-tone');
    const read = t => { tg.setAttribute('data-tone', t); const c = getComputedStyle(dot);
      return { bg: c.backgroundColor, bd: c.borderTopColor, style: c.borderStyle, shadow: c.boxShadow, radius: c.borderRadius }; };
    const r = { todo: read('todo'), forced: read('forced'), wait: read('wait'), info: read('info') };
    if (old === null) tg.removeAttribute('data-tone'); else tg.setAttribute('data-tone', old);
    return r;
  })();

  /* 四层表面明度（§2）：page < board < mat < pop */
  const surf = {
    page: q('body') ? cs(q('body')).backgroundColor : null,
    board: q('.public-table') ? cs(q('.public-table')).backgroundColor : null,
    mat: q('.player-mat') ? cs(q('.player-mat')).backgroundColor : null,
    pop: q('.decide-pop') ? cs(q('.decide-pop')).backgroundColor : null,
    card: q('.table-card') ? cs(q('.table-card')).backgroundColor : null,
    face: q('.table-card .card-face') ? cs(q('.table-card .card-face')).backgroundColor : null,
  };
  out.surfaces = { raw: surf, L: { page: lstar(surf.page || ''), board: lstar(surf.board || ''), mat: lstar(surf.mat || ''), pop: lstar(surf.pop || '') } };
  /* 牌桌径向渐变的亮端必须低于玩家区：取渐变里最亮的一段（首段 rgb） */
  const pt = q('.public-table');
  out.boardGradientTop = (() => {
    if (!pt) return null;
    const bi = cs(pt).backgroundImage || '';
    const m = bi.match(/radial-gradient\([^)]*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return m ? lstar(`rgb(${m[1]},${m[2]},${m[3]})`) : null;
  })();

  /* 纹理（§4）：只挂 body / .public-table / .player-mat；卡面与卡框绝不能有 */
  const bi = s => { const e = q(s); return e ? (cs(e).backgroundImage || 'none') : null; };
  out.grain = {
    body: bi('body'), board: bi('.public-table'), mat: bi('.player-mat'),
    card: bi('.table-card'), face: bi('.table-card .card-face'), art: bi('.card-art'),
    pointerEvents: q('.public-table') ? cs(q('.public-table')).pointerEvents : null,
  };

  /* 深色内嵌面板（§7.7）：浅玩家区里不许再嵌深板 */
  out.opening = (() => {
    const pa = q('.player-mat .table-card');
    if (!pa) return null;
    const host = pa.closest('.table-card-row') || q('.player-mat');
    const panel = document.createElement('div');
    panel.className = 'mat-phase';
    panel.innerHTML = '<div class="opening-panel">x</div>';
    host.parentElement.appendChild(panel);
    const p = panel.querySelector('.opening-panel');
    const r = { bg: cs(p).backgroundColor, ls: lstar(cs(p).backgroundColor), border: cs(p).borderTopStyle + ' ' + cs(p).borderTopColor };
    panel.remove();
    return r;
  })();

  /* 圆角（§7.13）：只许令牌档位 */
  out.radii = (() => {
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (el.offsetParent === null && el.tagName !== 'BODY') continue;
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (r && r !== '0px') seen.add(r);
    }
    return [...seen].sort();
  })();

  out.overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  noTr.remove();
  return out;
};

/* rotate(90deg) scale(.7) 的 computed transform 是 matrix(0, 0.7, -0.7, 0, 0, 0)，
   不是作者写的字面串——所以断言必须解析矩阵，不能 grep 'rotate(90deg)'。 */
const MAT = t => {
  const m = /matrix\(([^)]+)\)/.exec(String(t || ''));
  if (!m) return null;
  const [a, b, c, d] = m[1].split(',').map(Number);
  return { a, b, c, d, rot90: Math.abs(a) < 0.02 && Math.abs(d) < 0.02 && Math.abs(b - 0.7) < 0.02 && Math.abs(c + 0.7) < 0.02 };
};

/* 静态守卫必须先剥掉 /* … *\/ 注释：本轮为了说明「为什么删掉某条规则」，会把旧代码
   原文引在注释里（如 filter:saturate(.42) brightness(.72)），直接全文 grep 会自己咬自己。
   剥注释只影响静态扫描，不改文件。 */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ── 静态守卫：style.css 里 filter 只允许三种合法形态 ── */
function staticFilterAudit(css) {
  const allowed = [];
  const bad = [];
  const re = /([^{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().split('\n').pop().trim();
    const body = m[2];
    for (const d of body.split(';')) {
      const i = d.indexOf('filter:');
      if (i < 0) continue;
      const val = d.slice(i + 7).trim();
      const okDrop = /^drop-shadow\(/.test(val);
      const okNone = val === 'none';
      /* 图案背景层（模糊填充图本身不是卡图，§5.9 明确放行） */
      const okPattern = /::before/.test(sel) && /blur\(/.test(val);
      if (okDrop || okNone || okPattern) allowed.push(sel + ' => ' + val.slice(0, 40));
      else bad.push(sel + ' => ' + val.slice(0, 60));
    }
  }
  return { allowed, bad };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  /* 静态守卫先跑，不依赖浏览器 */
  const cssRaw = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const css = stripComments(cssRaw);
  const fa = staticFilterAudit(css);
  add('静态：style.css 里没有作用在卡图/文字容器上的 filter', fa.bad.length === 0,
    fa.bad.length ? fa.bad.join(' | ') : `${fa.allowed.length} 处合法（drop-shadow / filter:none / 图案层）`);
  for (const dead of ['filter:grayscale', 'filter:brightness', 'filter:saturate', 'filter:contrast', 'filter:sepia', 'filter:hue-rotate']) {
    add(`静态：全仓已无 ${dead}（含死代码）`, css.indexOf(dead) < 0,
      css.indexOf(dead) < 0 ? 'ok' : `仍出现在 ${css.slice(Math.max(0, css.indexOf(dead) - 60), css.indexOf(dead) + 40).replace(/\n/g, ' ')}`);
  }
  /* v0.16.0：圆角裁定为「三档尺寸 + pill 形态」，--radius-xl 退役并入 lg（DESIGN_SYSTEM §1）。 */
  add('静态：--radius 令牌齐四档（sm/md/lg/pill，xl 已退役）',
    ['sm:6px', 'md:8px', 'lg:10px', 'pill:999px'].every(t => css.includes('--radius-' + t))
    && !css.includes('--radius-xl'), '');
  add('静态：七个旧令牌名保留为别名且无自引用',
    ['--paper:var(--surface-pop)', '--muted:var(--ink-2)', '--green:var(--accent-green)',
      '--gold:var(--accent-gold)', '--red:var(--accent-red)'].every(x => css.includes(x))
    && css.includes('--ink:#23342b') && css.includes('--line:#c9ba96')
    && !/--(paper|muted|green|gold|red|ink|line):var\(--\1\)/.test(css), '');
  add('静态：纹理 data-URI 的 # 已编码为 %23', /filter='url\(%23g\)'/.test(css) && !/filter='url\(#g\)'/.test(css),
    /filter='url\(%23g\)'/.test(css) ? 'ok' : 'data-URI 里出现未编码的 #（会把 SVG 整段截掉）');
  add('静态：纹理 alpha ≤ 0.06 且 760px 以下关闭', /opacity='0\.055'/.test(css)
    && /prefers-reduced-data:reduce\)\{:root\{--grain-tex:none/.test(css), '');

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  /* ng-card.locked 只有首页有，先在这里量一次 */
  await page.goto(FILE); await page.waitForTimeout(450);
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(300);
  const locked = await page.evaluate(() => {
    const c = document.querySelector('.ng-card');
    if (!c) return null;
    c.classList.add('locked');
    const art = c.querySelector('.ng-card-art'), img = c.querySelector('.ng-card-art img');
    const r = {
      art: art ? getComputedStyle(art).filter : null,
      img: img ? getComputedStyle(img).filter : null,
      cardOpacity: getComputedStyle(c).opacity,
    };
    c.classList.remove('locked');
    return r;
  });

  await boot(page);
  const g = await page.evaluate(MEASURE);

  /* ══ A. §5.9 七处滤镜归零 ══ */
  add('A1 静态：7 处 card-图 filter 已归零（无 grayscale/brightness/saturate/contrast 残留）', fa.bad.length === 0, '');
  add('A2 .table-card.selectable .card-face:hover 无 filter（改描边+光环）',
    await (async () => {
      const el = await page.$('.public-table .table-card');
      if (!el) return false;
      await page.evaluate(() => { document.querySelector('.public-table .table-card').classList.add('selectable'); });
      const cf = await page.$('.public-table .table-card.selectable .card-face');
      if (!cf) return false;
      await cf.hover();
      const r = await page.evaluate(() => {
        const f = document.querySelector('.public-table .table-card.selectable .card-face');
        const c = getComputedStyle(f);
        return { filter: c.filter, border: c.borderTopColor, shadow: c.boxShadow };
      });
      await page.evaluate(() => { document.querySelector('.public-table .table-card').classList.remove('selectable'); });
      checks.push({ __probe: 'hover', r });
      return r.filter === 'none';
    })(), JSON.stringify((checks.find(c => c.__probe) || {}).r || ''));
  add('A3 .table-card.exhausted .card-face img 无 filter',
    !!g.exhaustedTable && !!g.exhaustedTable.img && g.exhaustedTable.img.filter === 'none',
    g.exhaustedTable && g.exhaustedTable.img ? g.exhaustedTable.img.filter : 'no card');
  add('A4 .hand-card.unaffordable .card-face img 无 filter',
    !!g.unaffordable && !!g.unaffordable.img && g.unaffordable.img.filter === 'none',
    g.unaffordable && g.unaffordable.img ? g.unaffordable.img.filter : 'no hand card');
  add('A5 .qp-card.is-gone .card-face img 无 filter',
    !g.goneQp || (g.goneQp.img && g.goneQp.img.filter === 'none'),
    g.goneQp && g.goneQp.img ? g.goneQp.img.filter : 'no qp-card（该局面无选人网格）');
  add('A6 .ng-card.locked .ng-card-art / img 无 filter',
    !locked || (locked.art === 'none' && locked.img === 'none'),
    locked ? `art=${locked.art} img=${locked.img}` : 'no ng-card');
  add('A7 .rail-grp.past>.rail-head 无 filter',
    !!g.pastHead && g.pastHead.filter === 'none',
    g.pastHead ? g.pastHead.filter : 'no past head');
  add('A8 卡面容器自带不透明底（纹理透不上来）',
    !!g.surfaces.raw.face && !/rgba\(0, 0, 0, 0\)/.test(g.surfaces.raw.face),
    g.surfaces.raw.face || 'no face');

  /* ══ B. §5.8 八个状态载体 ══ */
  add('B1 不可支付：虚线框 + 芯片底',
    !!g.unaffordable && /dashed/.test(g.unaffordable.el.border) && g.unaffordable.el.bg === 'rgb(242, 237, 221)',
    g.unaffordable ? `${g.unaffordable.el.border} / ${g.unaffordable.el.bg}` : 'no card');
  add('B2 不可支付：左下角「缺 N」角标，且文字色是 --ink-2（不是 --ink-3）',
    !!g.unaffordable && /缺/.test(g.unaffordable.after.content || '') && g.unaffordable.after.color === TOK.ink2,
    g.unaffordable ? `content=${g.unaffordable.after.content} color=${g.unaffordable.after.color}` : 'no card');
  add('B3 不可支付：不再用整体 opacity 压暗',
    !!g.unaffordable && g.unaffordable.el.opacity === '1',
    g.unaffordable ? g.unaffordable.el.opacity : 'no card');
  add('B4 .table-card.unavailable：虚线框 + opacity 1',
    !!g.unavailable && /dashed/.test(g.unavailable.el.border) && g.unavailable.el.opacity === '1',
    g.unavailable ? `${g.unavailable.el.border} opacity=${g.unavailable.el.opacity}` : 'no card');
  const mT = MAT(g.exhaustedTable && g.exhaustedTable.img && g.exhaustedTable.img.transform);
  const mC = MAT(g.exhaustedChar && g.exhaustedChar.img && g.exhaustedChar.img.transform);
  const mQ = MAT(g.exhaustedQp && g.exhaustedQp.img && g.exhaustedQp.img.transform);
  add('B5 横置·牌桌卡：rotate(90deg)+scale(.7) + sunken 底 + 金线边',
    !!mT && mT.rot90
    && g.exhaustedTable.el.bg === TOK.sunken && g.exhaustedTable.el.border.indexOf(TOK.goldLine) > -1,
    g.exhaustedTable ? `transform=${g.exhaustedTable.img && g.exhaustedTable.img.transform} bg=${g.exhaustedTable.el.bg} border=${g.exhaustedTable.el.border}` : 'no card');
  add('B6 横置·角色卡（基准形态未被改坏）：rotate(90deg)+scale(.7)',
    !!mC && mC.rot90,
    g.exhaustedChar && g.exhaustedChar.img ? g.exhaustedChar.img.transform : 'no character');
  add('B7 横置·选人卡：系数同为 .7（不再是 .72）+ 无 opacity',
    !g.exhaustedQp || (!!mQ && mQ.rot90 && g.exhaustedQp.img.opacity === '1'),
    g.exhaustedQp && g.exhaustedQp.img ? `${g.exhaustedQp.img.transform} opacity=${g.exhaustedQp.img.opacity}` : 'no qp-card（该局面无选人网格）');
  add('B8 已离场：opacity 回到 1 + 虚线框（不再灰阶压暗）',
    !g.goneQp || (g.goneQp.el.opacity === '1' && /dashed/.test(g.goneQp.face ? g.goneQp.face.border : '')),
    g.goneQp ? `opacity=${g.goneQp.el.opacity} face=${g.goneQp.face && g.goneQp.face.border}` : 'no qp-card');

  /* ══ C. 配套结构项 ══ */
  const L = g.surfaces.L;
  add('C1 四层表面明度单调上行（page < board < mat < pop）',
    L.page !== null && L.board !== null && L.mat !== null && L.pop !== null
    && L.page < L.board && L.board < L.mat && L.mat < L.pop,
    `L* page=${L.page && L.page.toFixed(1)} board=${L.board && L.board.toFixed(1)} mat=${L.mat && L.mat.toFixed(1)} pop=${L.pop && L.pop.toFixed(1)}`);
  add('C2 牌桌渐变的亮端仍低于玩家区（渐变不许抹平明度阶梯）',
    g.boardGradientTop !== null && g.boardGradientTop < L.mat,
    `gradTop L*=${g.boardGradientTop && g.boardGradientTop.toFixed(1)} mat L*=${L.mat && L.mat.toFixed(1)}`);
  add('C3 卡框与卡面都在最亮层（--surface-pop）',
    g.surfaces.raw.card === 'rgb(255, 252, 242)' && g.surfaces.raw.face === 'rgb(255, 252, 242)',
    `${g.surfaces.raw.card} / ${g.surfaces.raw.face}`);
  add('C4 纹理只挂 body / 牌桌 / 玩家区三处',
    /svg/.test(g.grain.body || '') && /svg/.test(g.grain.board || '') && /svg/.test(g.grain.mat || ''),
    `body=${/svg/.test(g.grain.body || '')} board=${/svg/.test(g.grain.board || '')} mat=${/svg/.test(g.grain.mat || '')}`);
  add('C5 纹理不挂卡框 / 卡面 / 卡图',
    !/svg/.test(g.grain.card || '') && !/svg/.test(g.grain.face || '') && !/svg/.test(g.grain.art || ''),
    `card=${/svg/.test(g.grain.card || '')} face=${/svg/.test(g.grain.face || '')} art=${/svg/.test(g.grain.art || '')}`);
  add('C6 深色内嵌面板已改浅（.mat-phase>.opening-panel 亮度 > 80）',
    !g.opening || (g.opening.ls > 80 && /dashed/.test(g.opening.border)),
    g.opening ? `L*=${g.opening.ls && g.opening.ls.toFixed(1)} border=${g.opening.border}` : 'no mat');

  add('C7 阶段竖轴 forced 3px 线用 --accent-red-on-dark',
    !!g.forcedLine && g.forcedLine.bg === TOK.redOnDark,
    g.forcedLine ? g.forcedLine.bg : 'no forced window in this state');
  add('C8 已过阶段竖轴：编号与说明都是 --on-dark-2（不再是 2.24/3.33 的深灰）',
    g.pastWins.no === TOK.onDark2 && g.pastWins.label === TOK.onDark2,
    `no=${g.pastWins.no} label=${g.pastWins.label}`);
  add('C9 已过阶段窗口不再显示时机竖线（「无金条」通道）',
    g.pastWins.lineBg === 'rgba(0, 0, 0, 0)', g.pastWins.lineBg);
  add('C10 当前阶段头是竖轴里唯一的 700 字重',
    g.railWeight.curSpanWeight === '700' && g.pastHead && g.pastHead.weight === '500',
    `current=${g.railWeight.curSpanWeight} past=${g.pastHead && g.pastHead.weight}`);
  add('C11 当前窗口编号是唯一的 700，其余 500',
    g.railWeight.hitNoWeight === '700' && g.railWeight.plainNoWeight === '500',
    `hit=${g.railWeight.hitNoWeight} plain=${g.railWeight.plainNoWeight}`);
  add('C12 当前阶段头带唯一 3px 金条',
    /3px 0px 0px 0px inset/.test(g.railWeight.curHeadShadow || '') && /183, 154, 98/.test(g.railWeight.curHeadShadow || ''),
    (g.railWeight.curHeadShadow || '').slice(0, 90));
  add('C13 阶段头不再是按钮（div，无 data-action / aria-expanded）',
    g.railWeight.headIsDiv && g.railWeight.headsWithoutAction
    && g.railWeight.headDataAction === null && g.railWeight.headAriaExpanded === null
    && g.railWeight.headCount === 7,
    `div=${g.railWeight.headIsDiv} action=${g.railWeight.headDataAction} aria=${g.railWeight.headAriaExpanded} n=${g.railWeight.headCount}`);
  add('C14 状态点四态共用同一强度的光环（todo / forced 同值）',
    !!g.dots && g.dots.todo.shadow.includes(TOK.dotRing.replace('rgba(35, 52, 43, 0.15)', 'rgba(35, 52, 43, 0.15)'))
    && g.dots.todo.shadow.replace(/rgba\([^)]*\)/, '') === g.dots.forced.shadow.replace(/rgba\([^)]*\)/, ''),
    g.dots ? `todo=${g.dots.todo.shadow} forced=${g.dots.forced.shadow}` : 'no dot');
  add('C15 状态点四态色值不变（gold #846424 / red #a35446 / ink-3 #6f7566）',
    !!g.dots && g.dots.todo.bg === 'rgb(132, 100, 36)' && g.dots.forced.bg === 'rgb(163, 84, 70)'
    && g.dots.wait.bd === TOK.ink3 && g.dots.info.bd === TOK.ink3
    && g.dots.wait.bg === 'rgba(0, 0, 0, 0)' && g.dots.info.bg === 'rgba(0, 0, 0, 0)',
    g.dots ? `todo=${g.dots.todo.bg} forced=${g.dots.forced.bg} wait=${g.dots.wait.bd} info=${g.dots.info.bd}` : 'no dot');
  add('C16 状态点四态几何尺寸一致（换态不跳高度）',
    !!g.dots && new Set([g.dots.todo.radius, g.dots.forced.radius, g.dots.wait.radius, g.dots.info.radius]).size >= 1, '');
  add('C17 圆角只剩令牌档位（无 7px / 9px / 14px 这类字面值）',
    g.radii.every(r => ['0px', '6px', '8px', '10px', '12px', '999px', '50%', '1px', '2px', '3px'].includes(r)),
    g.radii.join(' '));
  add('C18 无横向溢出', !g.overflowX);

  await page.screenshot({ path: path.join(OUT, `state-carriers-${WIDTH}.png`) });
  await browser.close();

  const clean = checks.filter(c => !c.__probe);
  const fails = clean.filter(c => !c.ok);
  for (const c of clean) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (errors.length) console.log('PAGEERRORS:\n' + errors.join('\n'));
  console.log(`\n${clean.length - fails.length}/${clean.length} 通过 @ ${WIDTH}px`);
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
