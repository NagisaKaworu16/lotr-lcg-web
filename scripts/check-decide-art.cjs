/* 决策浮层里的卡图尺寸验收（v0.15.84）。
   问题：阶段6「暗影取消／结算」等面板把遭遇／暗影卡图渲染在 .decide-body 里，
   而 .card-art 的基础样式是 width:100%——浮层宽 880px，一张 424/600 的卡图
   就摊成 800×1130px，牌名、暗影文字与「结算／继续」按钮全被顶到可视区之外。
   做法：把真实的浮层骨架（.decide-box > .decide-pop > .decide-body > .notice > .card-art）
   注入页面，在真实 Chrome 里量算，断言卡图被收成 --card-w 宽的左浮动缩略图、
   正文绕排到右侧、浮层不再被一张图顶满；再单独验证 .setup-reveal 的 96px 版式没被误伤。
   运行：NODE_PATH=<node_modules> node scripts/check-decide-art.cjs [--width 1440] */
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

const WIDTH = (() => {
  const i = process.argv.indexOf('--width');
  return i > -1 ? Number(process.argv[i + 1]) : 1440;
})();

/* 424×600 的占位卡图：真实卡面的比例，不依赖任何具体图片文件是否存在。 */
const ART = "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='424'%20height='600'%3E%3Crect%20width='424'%20height='600'%20fill='%232f3a2c'/%3E%3C/svg%3E";

const wrap = (id, inner, pos = 'bottom:8px') => `
<div class="probe-wrap" id="${id}" style="position:absolute;left:16px;right:16px;${pos}">
 <section class="decide-box"><button class="decide-trigger" type="button"><span class="decide-title">战斗阶段</span></button>
  <div class="decide-pop">
   <div class="decide-head"><h2>战斗阶段</h2><button class="decide-close">×</button></div>
   <div class="decide-body">${inner}</div>
  </div>
 </section>
</div>`;

/* 探针 A：暗影窗口的真实结构（before/before 都一样，只是面板体不同）。 */
const SHADOW = wrap('probe-shadow', `
 <section class="panel questing-panel"><h2>阶段6 · 暗影取消／结算</h2>
  <p class="small muted">未翻开的暗影：0</p>
  <div class="notice">
   <button class="card-art" aria-label="放大卡图"><img src="${ART}" alt=""><span class="image-loading-note">英文卡图 · 本地 · 点击放大</span></button>
   <h3>本次暗影：黑暗树林</h3>
   <p>暗影效果：该角色横置。若可能，把这张暗影牌附给该角色。</p>
   <div class="actions"><button>结算本张暗影／继续</button></div>
  </div>
 </section>`);

/* 探针 B：开局翻牌面板（.setup-reveal 是 96px 竖排格子，卡图不该被浮起来）。 */
const SETUP = wrap('probe-setup', `
 <section class="panel setup-flow"><div class="panel-title"><h2>剧本设置 · 开局翻牌</h2></div>
  <div class="setup-reveal"><button class="card-art"><img src="${ART}" alt=""></button><div><h3>山丘巨魔</h3><p>厄运 0 · 涌现</p></div></div>
 </section>`,
 /* 三个探针都在视口内：A 贴底（暗影窗口的真实位置），B/C 贴顶与中部。 */
 'top:8px');

/* 探针 C：探险／旅行翻牌面板——外壳是 .quest-reveal 而不是 .notice，
   浮动必须同样被 clear，否则按钮会压到卡图右侧的空白里。 */
const QUESTING = wrap('probe-quest', `
 <section class="panel questing-panel"><h2>阶段2 · 遭遇卡结算</h2>
  <div class="quest-reveal">
   <button class="card-art" aria-label="放大卡图"><img src="${ART}" alt=""></button>
   <h3>黑暗树林</h3><p>厄运 2 · 涌现</p><p>等待结算</p>
   <div class="actions"><button>结算此牌</button></div>
  </div>
 </section>`, 'top:300px');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(FILE);
  await page.waitForTimeout(500);

  await page.evaluate(([a, b, c]) => {
    for (const html of [a, b, c]) { const box = document.createElement('div'); box.innerHTML = html; document.body.appendChild(box.firstElementChild); }
  }, [SHADOW, SETUP, QUESTING]);
  await page.waitForTimeout(350);

  const art = await page.evaluate(() => {
    const r = e => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    /* 浮动元素旁边那个块级元素的 box 仍在最左侧，只有行盒会让位——
       所以用 Range 量第一行文字真正的起点，才能判断「文字是否绕到了右边」。 */
    const textLeft = el => { const t = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(); if (!t) return null; const rg = document.createRange(); rg.selectNodeContents(t); const b = rg.getBoundingClientRect(); return +b.x.toFixed(1); };
    const probe = id => {
      const root = document.getElementById(id);
      const pop = root.querySelector('.decide-pop'), body = root.querySelector('.decide-body');
      return { pop: r(pop), body: r(body), bodyScrollH: body.scrollHeight };
    };
    const sh = document.getElementById('probe-shadow');
    const cardArt = sh.querySelector('.notice .card-art');
    const h3 = sh.querySelector('.notice h3');
    const actions = sh.querySelector('.notice .actions');
    const st = document.getElementById('probe-setup');
    const setupArt = st.querySelector('.setup-reveal .card-art');
    const cs = getComputedStyle(cardArt);
    const qs = document.getElementById('probe-quest');
    const qArt = qs.querySelector('.quest-reveal .card-art');
    const qH3 = qs.querySelector('.quest-reveal h3');
    const qActions = qs.querySelector('.quest-reveal .actions');
    return {
      shadow: probe('probe-shadow'), setup: probe('probe-setup'),
      cardArt: r(cardArt), img: r(cardArt.querySelector('img')), notice: r(sh.querySelector('.notice')),
      h3: r(h3), h3TextX: textLeft(h3), actions: r(actions),
      float: cs.float, maxWidth: cs.maxWidth, cardW: getComputedStyle(document.documentElement).getPropertyValue('--card-w').trim(),
      setupArt: r(setupArt), setupFloat: getComputedStyle(setupArt).float,
      questArt: r(qArt), questH3TextX: textLeft(qH3), questActions: r(qActions), questWrap: r(qs.querySelector('.quest-reveal')),
      vh: window.innerHeight,
    };
  });

  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });

  add('暗影卡图不再是满宽（收成缩略图）', art.cardArt.w <= 150, `${art.cardArt.w}px（浮层宽 ${art.shadow.pop.w}px）`);
  add('缩略图宽度 = 牌桌卡牌宽 --card-w', Math.abs(art.cardArt.w - parseFloat(art.cardW)) <= 1, `${art.cardArt.w}px vs ${art.cardW}`);
  add('缩略图高度不再占据一整屏', art.img.h <= 210, `${art.img.w}×${art.img.h}px，视口高 ${art.vh}`);
  add('卡图左浮动', art.float === 'left', `float=${art.float}`);
  add('牌名文字绕排到卡图右侧（不是被推到图下方）', art.h3TextX !== null && art.h3TextX >= art.cardArt.x + art.cardArt.w - 2, `文字左缘 ${art.h3TextX} ≥ 卡图右缘 ${(art.cardArt.x + art.cardArt.w).toFixed(1)}`);
  add('文字与卡图同排（顶对齐，未被推到图下方）', art.h3.y < art.cardArt.y + art.img.h, `h3.y=${art.h3.y} < 图底 ${(art.cardArt.y + art.img.h).toFixed(1)}`);
  add('整段 notice 高度受控（≤ 300px）', art.notice.h <= 300, `${art.notice.w}×${art.notice.h}px`);
  add('浮层不因这张图触到 62vh 高度上限', art.shadow.pop.h < art.vh * 0.62 - 1, `pop ${art.shadow.pop.h}px < 上限 ${(art.vh * 0.62).toFixed(0)}px`);
  add('浮层体内无滚动（内容一屏放得下）', art.shadow.bodyScrollH <= art.shadow.body.h + 2, `内容 ${art.shadow.bodyScrollH}px / 容器 ${art.shadow.body.h}px`);
  add('「结算本张暗影／继续」在浮层可视区内', art.actions.y + art.actions.h <= art.shadow.pop.y + art.shadow.pop.h + 2, `按钮底 ${(art.actions.y + art.actions.h).toFixed(0)} ≤ 浮层底 ${(art.shadow.pop.y + art.shadow.pop.h).toFixed(0)}`);
  add('开局翻牌 .setup-reveal 未被误伤（96px 竖排、不浮动）', art.setupArt.w <= 98 && art.setupFloat === 'none', `${art.setupArt.w}px，float=${art.setupFloat}`);
  /* 探险／旅行翻牌用的 .quest-reveal 外壳：同样要收成缩略图，且浮动被 clear 掉。 */
  add('探险／旅行翻牌的 .quest-reveal 卡图同为缩略图', Math.abs(art.questArt.w - parseFloat(art.cardW)) <= 1, `${art.questArt.w}px vs ${art.cardW}`);
  add('.quest-reveal 牌名文字绕排到卡图右侧', art.questH3TextX !== null && art.questH3TextX >= art.questArt.x + art.questArt.w - 2, `文字左缘 ${art.questH3TextX} ≥ 卡图右缘 ${(art.questArt.x + art.questArt.w).toFixed(1)}`);
  add('.quest-reveal 浮动被收住（容器底不短于卡图底）', art.questWrap.y + art.questWrap.h >= art.questArt.y + art.questArt.h - 1, `容器底 ${(art.questWrap.y + art.questWrap.h).toFixed(0)} ≥ 图底 ${(art.questArt.y + art.questArt.h).toFixed(0)}`);
  add('.quest-reveal 的按钮与卡图不重叠', art.questActions.x >= art.questArt.x + art.questArt.w - 2 || art.questActions.y >= art.questArt.y + art.questArt.h - 2, `按钮 ${art.questActions.x},${art.questActions.y} vs 卡图右缘 ${(art.questArt.x + art.questArt.w).toFixed(0)}`);
  add('无脚本错误', errors.length === 0, errors.join(' | '));

  /* 截图只留暗影窗口这一个浮层，另两个探针量完就撤掉，免得互相遮挡。 */
  await page.evaluate(() => { for (const id of ['probe-setup', 'probe-quest']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } });
  await page.waitForTimeout(120);

  const shot = path.join(OUT, `decide-art-${WIDTH}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const ok = checks.every(c => c.ok);
  fs.writeFileSync(path.join(OUT, `decide-art-${WIDTH}.json`), JSON.stringify({ ok, width: WIDTH, art, checks }, null, 2));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  console.log(ok ? `\n${checks.length}/${checks.length} 通过` : '\n存在失败项');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
