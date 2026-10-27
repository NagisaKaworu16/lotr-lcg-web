/* V01–V11 视觉验收（visual-architect 专用；X 系列归 ux，不在本脚本内）
 *
 *   cd /c/Users/Administrator/WorkBuddy/魔戒LCG
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node scripts/visual-acceptance-v.cjs
 *   单档：末尾加 1280x800 / 320x568
 *
 * 产出：docs/browser-acceptance/vaccept/<视口>-<状态>.png + report.json
 * 不覆盖 01~07 基线。
 *
 * 判据口径（v3 定稿）
 *  · V10 以「文本渲染矩形 ⊂ 面板内容盒」为主判据：旧三条（scrollWidth−clientWidth / 行盒数 / Δ右）
 *    在当前实现（flex:none + shrink-to-fit）下恒真，负向对照已证其恒绿，撤。
 *  · V11-1/-3 是容器级检查，对「R0 内部谁被牺牲」是盲的——R0 的唯一判据在 V10，不设双保险。
 *  · V08 按计算样式数，不看 disabled：加 :not([disabled]) 会结构性漏掉「禁用但仍是绿底」那颗。
 *  · 状态构造走引擎（submitDeployment / approveDeployment）+ render()，可复现。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'browser-acceptance', 'vaccept');
const pageUrl = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const GREENS = ['rgb(54, 88, 66)', 'rgb(63, 106, 72)'];
const cands = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const executablePath = cands.find(p => fs.existsSync(p));

const VIEWPORTS = [
  { name: '1440x900', w: 1440, h: 900 },
  { name: '1280x800', w: 1280, h: 800 },
  { name: '390x844', w: 390, h: 844 },
  { name: '761x600', w: 761, h: 600, spot: true },
  { name: '1920x1080', w: 1920, h: 1080, spot: true },
];
const EXTRA = { name: '320x568', w: 320, h: 568 };
const only = process.argv[2] || '';

/* ── 页面内采集 ─────────────────────────────────────────────────────── */
function collect(tag) {
  const G = ['rgb(54, 88, 66)', 'rgb(63, 106, 72)'];
  const box = document.querySelector('.decide-box');
  const body = document.querySelector('.decide-body');
  const dep = box && box.querySelector('.quest-deploy');
  const cs = el => getComputedStyle(el);
  const rect = el => { const r = el.getBoundingClientRect(); return { left: +r.left.toFixed(2), top: +r.top.toFixed(2), right: +r.right.toFixed(2), bottom: +r.bottom.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2) }; };
  /* 裁切边界：`.decide-body{overflow:auto}` 在 **padding box** 处裁，所以量它。
     不要用 `.decide-box` 的 border box（比裁切盒大 1px 边框，会把越界少算 1px），
     也不要用任何 content box（文字可以合法画进 padding，用内容盒会假红）。
     三个盒子在 320 实测：inline border 287 / inline padding 286 / body padding 286。 */
  const clipBox = el => {
    if (!el) return null;
    const b = el.getBoundingClientRect(), s = cs(el);
    return {
      left: +(b.left + parseFloat(s.borderLeftWidth)).toFixed(2),
      right: +(b.right - parseFloat(s.borderRightWidth)).toFixed(2),
    };
  };
  const blockList = el => el ? [...el.children].filter(c => c.getBoundingClientRect().height > 0.5).map(c => c.className || c.tagName) : [];
  const btns = [...document.querySelectorAll('.decide-box button')];
  const solid = btns.filter(b => !b.disabled && G.includes(cs(b).backgroundColor));
  const ghosts = btns.filter(b => b.classList.contains('quest-ghost'));
  const pGreen = btns.filter(b => b.classList.contains('primary') && !b.disabled);
  /* V08 不看 disabled：禁用但仍是绿底的按钮，视觉上同样是「屏幕上多了一颗绿钮」。 */
  const greens = [...document.querySelectorAll('button')].filter(b => G.includes(cs(b).backgroundColor));
  const door = document.querySelector('.door-go');
  const r0 = box && box.querySelector('.r0');
  const num = box && box.querySelector('.r0-num');
  const pill = box && box.querySelector('.state-pill');
  const label = box && box.querySelector('.r0-label');
  const details = box ? [...box.querySelectorAll('details')] : [];
  const outP = box ? [...box.querySelectorAll('p')].filter(p => !p.closest('details') && p.getBoundingClientRect().height > 0.5) : [];
  const inner = document.body.innerText;
  const main = pGreen.find(b => b.closest('.quest-main-action')) || pGreen[0] || null;
  const rHead = box && box.querySelector('.r-head');
  const lines = [];
  if (rHead) for (const c of rHead.children) {
    const r = c.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const top = Math.round(r.top);
    let line = lines.find(l => Math.abs(l.top - top) <= 2);
    if (!line) { line = { top, items: [] }; lines.push(line); }
    line.items.push((c.className || c.tagName) + ':' + (c.textContent || '').trim().slice(0, 12));
  }
  return {
    tag,
    vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight,
    phase: typeof state !== 'undefined' ? state.phase : null,
    questStep: typeof state !== 'undefined' && state.questing ? state.questing.step : null,
    locked: !!(typeof state !== 'undefined' && state.questing && state.questing.deploymentLocked),
    view: typeof handView !== 'undefined' ? handView : null,
    deployState: dep ? dep.dataset.state : null,
    deployBlocks: blockList(dep),
    solid: solid.length, solidText: solid.map(b => b.textContent.trim()),
    ghostCount: ghosts.length,
    ghostDecor: ghosts.map(g => cs(g).textDecorationLine + '|' + cs(g).textDecorationStyle),
    selectCount: box ? box.querySelectorAll('select').length : -1,
    radiogroupCount: box ? box.querySelectorAll('[role=radiogroup]').length : -1,
    questCtl: box ? box.querySelectorAll('[data-quest]').length : -1,
    badgeCount: box ? box.querySelectorAll('.badge').length : -1,
    detailsCount: box ? details.length : -1,
    submitted: (inner.match(/已提交：/g) || []).length,
    committed: (inner.match(/已投入：/g) || []).length,
    checkbox: box ? box.querySelectorAll('input[type=checkbox]').length : -1,
    hasDiscussText: inner.includes('派遣交流与缓冲期'),
    hasDraftWill: inner.includes('暂定意志'),
    detailsLen: details[0] ? details[0].textContent.trim().length : 0,
    outsidePlen: outP.reduce((n, p) => n + p.textContent.trim().length, 0),
    outsidePtext: outP.map(p => p.textContent.trim()).join(' / ').slice(0, 60),
    greens: greens.length,
    greensList: greens.map(b => (b.disabled ? '(disabled)' : '') + (b.className || '') + ':' + b.textContent.trim().slice(0, 12)),
    door: door ? { disabled: door.disabled, bg: cs(door).backgroundColor, opacity: cs(door).opacity } : null,
    r0: r0 ? { ...rect(r0), padRight: parseFloat(cs(r0).paddingRight) || 0 } : null,
    num: num ? (() => {
      /* 文本自身的渲染矩形（Range）。它量与实现无关：不管用 overflow:hidden、ellipsis
         还是 flex:none 让它溢出去，被挤掉/挤出时这个矩形都会越过可见边界。
         反过来说，scrollWidth−clientWidth 只在「子元素自己裁切」的写法下有分辨力，
         一旦改写 flex:none 就恒为 0 —— 负向对照里两种挤出情形下它全绿。 */
      const rg = document.createRange(); rg.selectNodeContents(num);
      const rs = [...rg.getClientRects()];
      const cb = clipBox(body || box);
      const textLeft = rs.length ? Math.min(...rs.map(x => x.left)) : null;
      const textRight = rs.length ? Math.max(...rs.map(x => x.right)) : null;
      return {
        text: num.textContent.trim(), ...rect(num),
        scrollWidth: num.scrollWidth, clientWidth: num.clientWidth,
        lines: num.getClientRects().length,
        overflow: +(num.scrollWidth - num.clientWidth).toFixed(2),
        textLines: rs.length,
        textLeft: textLeft == null ? null : +textLeft.toFixed(2),
        textRight: textRight == null ? null : +textRight.toFixed(2),
        boxLeft: cb ? cb.left : null, boxRight: cb ? cb.right : null,
        spillRight: textRight != null && cb ? +(textRight - cb.right).toFixed(2) : null,
        spillLeft: textLeft != null && cb ? +(cb.left - textLeft).toFixed(2) : null,
      };
    })() : null,
    pill: pill ? { ...rect(pill), text: pill.textContent.trim() } : null,
    label: label ? { ...rect(label), text: label.textContent.trim(), display: cs(label).display } : null,
    rHead: rHead ? { lines: lines.length, layout: lines.map(l => l.items) } : null,
    boxSW: box ? { sw: box.scrollWidth, cw: box.clientWidth } : null,
    bodySW: body ? { sw: body.scrollWidth, cw: body.clientWidth } : null,
    primary: main ? rect(main) : null,
    shotBox: box ? rect(box) : null,
  };
}

/* ── 判定 ──────────────────────────────────────────────────────────── */
function judge(m, ctx) {
  const out = {};
  const add = (id, ok, measured, expect) => { out[id] = { ok: !!ok, measured, expect }; };
  const st = ctx.state;

  // V01 块数 ∈{3,4}
  const blocks = m.deployBlocks.length;
  add('V01', !m.hasDiscussText && [3, 4].includes(blocks),
    { 禁用文案: m.hasDiscussText, 块数: blocks, 块: m.deployBlocks }, '无「派遣交流与缓冲期」且块数 ∈{3,4}');

  // V02 面板内实心 ≤1；ghost 虚线点下划线
  const ghostOk = m.ghostCount === 0 || m.ghostDecor.every(d => /underline/.test(d) && /dotted/.test(d));
  add('V02', m.solid <= 1 && ghostOk,
    { 实心: m.solid, 文本: m.solidText, ghost: m.ghostCount, 装饰: m.ghostDecor }, '实心 ≤1；ghost dotted underline');

  // V03
  if (st === 'A') add('V03', m.checkbox > 0, { checkbox: m.checkbox }, 'A 态 checkbox > 0');
  else if (['B', 'C1', 'C2'].includes(st)) add('V03', m.checkbox === 0 && m.submitted >= 1, { checkbox: m.checkbox, 已提交: m.submitted }, '=0 且「已提交：」≥1');
  else add('V03', true, { 态: st, 说明: 'D 态不适用' }, 'N/A');

  // V04 有控态 1 个；D 态定值 0/0/0
  if (st === 'D') add('V04', m.selectCount === 0 && m.radiogroupCount === 0 && m.questCtl === 0,
    { select: m.selectCount, radiogroup: m.radiogroupCount, 'data-quest': m.questCtl, badge: m.badgeCount }, 'D 态 0/0/0');
  else add('V04', m.selectCount + m.radiogroupCount === 1 && m.badgeCount === 0,
    { select: m.selectCount, radiogroup: m.radiogroupCount, badge: m.badgeCount }, 'select+radiogroup=1 且 badge=0');

  // V05
  const exp5 = st === 'D' ? 1 : 0;
  add('V05', m.committed === exp5, { 态: st, '已投入：': m.committed }, '= ' + exp5);

  // V06
  add('V06', !m.hasDraftWill, { 命中: m.hasDraftWill }, '不含「暂定意志」');

  // V07 有控态 details 长文；D 态定值 details=0
  if (st === 'D') add('V07', m.detailsCount === 0, { details: m.detailsCount }, 'D 态 details = 0');
  else add('V07', m.detailsCount >= 1 && m.detailsLen >= 20 && m.outsidePlen <= 12,
    { details: m.detailsCount, 正文字数: m.detailsLen, 外部p字数: m.outsidePlen, 外部p: m.outsidePtext }, '≥1 且 ≥20 字；外部 <p> ≤12 字');

  // V08 全页绿钮 ≤1 且全部可点
  add('V08', m.greens <= 1 && m.greensList.every(s => !s.startsWith('(disabled)')),
    { 绿钮: m.greens, 清单: m.greensList }, '≤1 且非禁用（禁用绿钮也算多一颗）');

  // V09
  const d = m.door;
  add('V09', d ? (d.disabled ? !GREENS.includes(d.bg) : true) : false,
    d ? { disabled: d.disabled, bg: d.bg, opacity: d.opacity } : '无 .door-go', 'disabled 时 bg ≠ 绿系（期望 rgb(236,234,224)）');

  /* V10 数字不被牺牲（判据 v3，2026-xx 改）
     旧三条（scrollWidth−clientWidth ≤1、getClientRects()=1、|Δ右|≤1）在当前实现下全部恒真：
       · 实现从 `overflow:hidden + ellipsis` 改成 `flex:none`，子元素不再自己裁切，scrollWidth 恒等于 clientWidth；
       · num 是 .r0 的最后一个 flex 项、.r0 又是 shrink-to-fit，num.right 与 r0.right 由构造相等。
     负向对照（320，人为挤出）：数字需多 60px → 文本越界 +40.36；药丸多 130px → +110.36；
     而旧三条在这两种情形下仍然是 0 / 1 / 0。**恒真的断言就是假断言**，撤换。
     新主判据只看文本自身的渲染矩形落在祖先可见区内（与用哪种 CSS 技巧实现无关），
     「不越出行盒」作副判据（只在 .r0 被压缩时有分辨力，不晋级为主判据）。 */
  if (!m.num || !m.r0) add('V10', false, '无 .r0 或 .r0-num', '存在 .r0-num');
  else {
    const n = m.num;
    const inside = n.spillRight != null && n.spillLeft != null && n.spillRight <= 1 && n.spillLeft <= 1;
    const inRow = n.right <= m.r0.right + 1;
    add('V10', inside && inRow && n.textLines === 1,
      { 文本: n.text, 文本右缘: n.textRight, 面板内容右: n.boxRight, 右越界: n.spillRight, 左越界: n.spillLeft,
        num右: n.right, r0右: m.r0.right, 文本行数: n.textLines, num宽: n.clientWidth, 旧口径_overflow: n.overflow, 旧口径_行盒: n.lines },
      '文本矩形 ⊂ 面板内容盒（左右各 ≤1px）；num.right ≤ r0.right+1；文本单行');
  }

  // V11-1 容器无横向滚动（对 R0 截断是盲的）
  add('V11-1', m.boxSW && m.bodySW && m.boxSW.sw === m.boxSW.cw && m.bodySW.sw === m.bodySW.cw,
    { box: m.boxSW, body: m.bodySW }, 'box/body 均无横向滚动（min-width:0 时恒真，不可作 R0 判据）');

  // V11-2 R0 盒高 ≤26
  add('V11-2', m.r0 ? m.r0.height <= 26 : false,
    { r0高: m.r0 && m.r0.height, pill高: m.pill && m.pill.height, label高: m.label && m.label.height, num高: m.num && m.num.height },
    'h ≤ 26（预期 23~24，由 .state-pill 撑高；22 只是标签行高）');

  // V11-3 子元素不越出 .r0 边框盒
  add('V11-3', m.pill && m.num && m.r0 ? (m.pill.left >= m.r0.left - 1 && m.num.right <= m.r0.right + 1) : false,
    { pillLeft: m.pill && m.pill.left, r0Left: m.r0 && m.r0.left, numRight: m.num && m.num.right, r0Right: m.r0 && m.r0.right },
    'pill.left ≥ r0.left−1 且 num.right ≤ r0.right+1（对内部截断是盲的）');

  return out;
}

/* ── 导航 ──────────────────────────────────────────────────────────── */
/* 这里用「常规点击 → DOM click」两级兜底，**刻意不用 force:true**：
   force 只是跳过可点性检查，事件仍按坐标派发、由浏览器命中测试决定落点——
   在 320 下等于把点击打到盖在上面的阶段轨按钮上（任务 #12），比点不动更糟。
   DOM `el.click()` 才是真正的绕过：不经过命中测试，直接触发元素自己的处理器。
   结果仍以引擎状态断言，不看点击是否"优雅"。 */
async function tap(loc, ms = 250) {
  if (!await loc.count()) return false;
  try { await loc.first().click({ timeout: 1800 }); }
  catch (e) {
    try { await loc.first().evaluate(el => el.click()); } catch (e2) { return false; }
  }
  await new Promise(r => setTimeout(r, ms));
  return true;
}

async function gotoCommit(page, players) {
  await page.selectOption('#playerCount', String(players));
  await page.waitForTimeout(180);
  await tap(page.locator('.ng-tabs button', { hasText: '新版扩展' }), 220);
  await tap(page.locator('.ng-card', { hasText: '基础剧本合集' }), 280);
  await tap(page.locator('[data-action="ngNext"]'), 280);
  await tap(page.locator('[data-action="chooserConfirm"]'), 560);
  for (let i = 0; i < 8; i++) {
    /* :not([disabled]) 是必须的：已确认的玩家按钮留在 DOM 里、只变 disabled，
       于是 first() 永远选中第 1 个人那颗，Playwright 等它变可用直到超时，
       整条 setup 原地卡死（1440 同样复现；不是窄屏问题，也不是遮罩问题）。 */
    const keeps = page.locator('button[data-action="keepHand"]:not([disabled])');
    if (!await keeps.count()) break;
    if (!await tap(keeps, 200)) break;
  }
  await page.waitForTimeout(180);
  const fin = page.locator('button[data-action="finishSetup"]:not([disabled])');
  if (await fin.count()) await tap(fin, 380);

  /* 起始手牌兜底：320 下这两颗按钮的真实指针落在阶段轨上（任务 #12），点不到。
     这一小段改用引擎走完（openingChoice × 全部玩家 → startScenario），
     之后的阶段推进仍然先走真实点击，只有点不动才退引擎。 */
  const setupFixed = await page.evaluate(() => {
    const s = state;
    let g = 0;
    while (g++ < 8 && s.players.some(p => !p.openingConfirmed)) {
      for (const p of s.players) { if (!p.openingConfirmed) { try { ScenarioEngine.openingChoice(s, p.id, false); } catch (e) {} } }
    }
    if (s.phase === 0) { try { ScenarioEngine.startScenario(s); } catch (e) {} }
    render();
    return { phase: s.phase, confirmed: s.players.every(p => p.openingConfirmed) };
  });
  if (!setupFixed.confirmed) throw new Error('起始手牌未能全部确认：' + JSON.stringify(setupFixed));
  await page.waitForTimeout(240);

  const PANEL = ':is(.operation-content, .decide-box, .planning-strip)';
  /* 文字匹配的按钮一律走 tap()：常规点击失败后直接 DOM click，不用 force。 */
  const clickAny = async (sel, text) => {
    const el = text ? page.locator(sel, { hasText: text }).first() : page.locator(sel).first();
    if (!await el.count()) return false;
    return tap(el, 280);
  };
  const dismiss = async () => {
    const dc = page.locator('#draw-close');
    if (await dc.count() && await dc.isVisible()) { await dc.click({ force: true }).catch(() => {}); await page.waitForTimeout(140); return true; }
    return false;
  };
  let at = false;
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({ p: state.phase, st: state.questing && state.questing.step, locked: !!(state.questing && state.questing.deploymentLocked) }));
    if (s.p === 2 && s.st === 'commit' && !s.locked) { at = true; break; }
    if (await dismiss()) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '结束我的盟友／附属出牌步骤')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '继续到下一决策点')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '：放弃剩余行动')) continue;
    if (await clickAny(PANEL + ' button:not([disabled])', '开始投入角色')) continue;
    if (await clickAny('.operation-title button.primary:not([disabled])')) continue;
    await page.waitForTimeout(220);
  }
  if (!at) {
    /* 点不动已定性为 .draw-toast 全屏遮罩（见 REPORT O3 / 任务 #9），这里退回引擎推进，
       状态与 UI 结果等价；不把「点击成功」当判据，只断言由此产生的 DOM 状态。 */
    const r = await page.evaluate(() => {
      const s = state, Q = ScenarioEngine.questing;
      let g = 0; while (s.phase !== 2 && g++ < 8) { try { ScenarioEngine.nextPhase(s); } catch (e) { break; } }
      if (s.questing) {
        for (const id of (s.questing.order || [])) { try { Q.pass(s, id); } catch (e) {} }
        try { if (s.questing.step === 'beforeCommit') Q.move(s); } catch (e) {}
      }
      render();
      return { p: s.phase, st: s.questing && s.questing.step };
    });
    at = r.p === 2 && r.st === 'commit';
    if (!at) throw new Error('未能进入 commit（phase=' + r.p + ' step=' + r.st + '）');
  }
}

/* 最坏可达内容：R0 数字随剧本状态变化，当前值小不代表装得下。
   D013 第 2 条末项要求「内容取最宽可达值（威胁 50、意志两位数）时仍不溢出」，
   这里把数字临时换成最宽可达文本量一次**文字真实绘制宽**，再换回来。
   量的是「需要」与「可用」两个独立的量（不是同一元素的两次自比），因此不是恒真判据。 */
function worstCase() {
  const num = document.querySelector('.r0-num');
  const clip = document.querySelector('.decide-body') || document.querySelector('.decide-box');
  if (!num || !clip) return null;
  const s = getComputedStyle(clip), b = clip.getBoundingClientRect();
  /* 裁切边界 = overflow:auto 的 padding box，与 collect 里同一口径 */
  const clipRight = b.right - parseFloat(s.borderRightWidth);
  const avail = clipRight - num.getBoundingClientRect().left;
  const keep = num.textContent;
  /* 最宽可达：四人局每人 3 名英雄全部投入 → 「12 名」；意志/威胁取两位数上限。
     不能用「4 名」——那是当前这局的数值，不是可达上限（4 名比 12 名窄约 12px，
     用它当最坏值会把 320 的溢出测成 PASS，等于再造一条假绿）。 */
  const WORST = '12 名 · 意志 99 ／ 威胁 50';
  num.textContent = WORST;
  const rg = document.createRange(); rg.selectNodeContents(num);
  const rs = [...rg.getClientRects()];
  const need = rs.length ? Math.max(...rs.map(x => x.right)) - Math.min(...rs.map(x => x.left)) : null;
  num.textContent = keep;
  return {
    text: WORST, 当前: keep,
    avail: +avail.toFixed(2),
    need: need == null ? null : +need.toFixed(2),
    slack: need == null ? null : +(avail - need).toFixed(2),
  };
}

async function runViewport(page, vp) {
  const shot = async (name, clip) => {
    const file = path.join(outDir, `${vp.name}-${name}.png`);
    if (clip && clip.width > 2) await page.screenshot({ path: file, clip: { x: Math.max(0, clip.left - 6), y: Math.max(0, clip.top - 6), width: Math.min(clip.width + 12, vp.w), height: Math.min(clip.height + 12, vp.h) } }).catch(() => {});
    else await page.screenshot({ path: file });
  };
  await gotoCommit(page, 2);
  const rows = [];
  const take = async (tag, state) => {
    const m = await page.evaluate(collect, tag);
    await shot(tag, m.shotBox);
    const j = judge(m, { state });
    /* 窄屏才需要最坏内容门：宽屏的余量以百 px 计，量了也是恒真。 */
    if (vp.w <= 600) {
      const w = await page.evaluate(worstCase);
      j['V10-最坏内容'] = {
        ok: !!(w && w.slack != null && w.slack >= 0),
        measured: { 最坏文本: w && w.text, 当前文本: w && w.当前, 可用: w && w.avail, 需要: w && w.need, 余量: w && w.slack },
        expect: '需要 ≤ 可用（威胁 50 / 意志两位数的文字绘制宽不得越过面板内容右缘）',
      };
    }
    rows.push({ tag, state, m, j });
  };

  await page.evaluate(() => { handView = 0; render(); });
  await page.waitForTimeout(200);
  await take('A', 'A');

  await page.evaluate(() => {
    const ids = ScenarioEngine.questing.eligible(state, 0).map(c => c.uid).slice(0, 1);
    ScenarioEngine.questing.submitDeployment(state, 0, ids); handView = 0; render();
  });
  await page.waitForTimeout(220);
  await take('B', 'B');

  await page.evaluate(() => {
    const ids = ScenarioEngine.questing.eligible(state, 1).map(c => c.uid).slice(0, 1);
    ScenarioEngine.questing.submitDeployment(state, 1, ids); handView = 0; render();
  });
  await page.waitForTimeout(220);
  await take('C1', 'C1');

  await page.evaluate(() => { ScenarioEngine.questing.approveDeployment(state, 0); handView = 0; render(); });
  await page.waitForTimeout(220);
  await take('C2', 'C2');

  await page.evaluate(() => { ScenarioEngine.questing.approveDeployment(state, 1); handView = 0; render(); });
  await page.waitForTimeout(420);
  await take('D', 'D');

  return rows;
}

/* 320×568 四人局 C2（pill「已确认 3/4」）——V10 的关键档：宽屏藏得住截断 */
async function run320(browser) {
  const ctx = await browser.newContext({ viewport: { width: EXTRA.w, height: EXTRA.h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(pageUrl);
  await page.waitForTimeout(450);
  const entry = { viewport: EXTRA.name, spot: false, states: [], verdicts: {}, errors: errs, ok: false, note: '四人局 C2（已确认 3/4）' };
  try {
    await gotoCommit(page, 4);
    await page.evaluate(() => {
      const Q = ScenarioEngine.questing, s = state;
      for (const id of [0, 1, 2, 3]) { try { Q.submitDeployment(s, id, Q.eligible(s, id).map(c => c.uid).slice(0, 1)); } catch (e) {} }
      for (const id of [0, 1, 2]) { try { Q.approveDeployment(s, id); } catch (e) {} }
      handView = 0; render();
    });
    await page.waitForTimeout(320);
    const m = await page.evaluate(collect, 'C2-320');
    const w = await page.evaluate(worstCase);
    const clip = m.shotBox && m.shotBox.width > 2 ? { x: Math.max(0, m.shotBox.left - 4), y: Math.max(0, m.shotBox.top - 4), width: Math.min(m.shotBox.width + 8, EXTRA.w), height: Math.min(m.shotBox.height + 8, EXTRA.h) } : undefined;
    await page.screenshot({ path: path.join(outDir, '320x568-C2.png'), clip }).catch(() => {});
    const j = judge(m, { state: 'C2' });
    j['V10-最坏内容'] = {
      ok: !!(w && w.slack != null && w.slack >= 0),
      measured: { 最坏文本: w && w.text, 当前文本: w && w.当前, 可用: w && w.avail, 需要: w && w.need, 余量: w && w.slack },
      expect: '需要 ≤ 可用（威胁 50 / 意志两位数的文字绘制宽不得越过面板内容右缘）',
    };
    entry.states.push({ tag: 'C2', deployState: m.deployState, blocks: m.deployBlocks.length, pill: m.pill && m.pill.text, numWidth: m.num && m.num.clientWidth, rHead: m.rHead });
    for (const [id, v] of Object.entries(j)) entry.verdicts[id + '@C2'] = { ...v, tag: 'C2' };
    entry.ok = true;
  } catch (e) {
    entry.fatal = String(e.message).replace(/\s+/g, ' ').slice(0, 300);
  }
  await ctx.close();
  return entry;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  if (!executablePath) throw new Error('未找到本机 Chrome/Edge');
  const md5 = () => crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex');
  const h0 = md5();
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const report = {
    startedAt: new Date().toISOString(), buildMd5: h0, executablePath,
    note: [
      'V10 只看 .r0-num 自身（未截断/未折行/贴右）。跨态比 left 恒假、比 right 恒真，两种都已撤。',
      'V11-1/-3 是容器级检查，对 R0 内部截断是盲的（min-width:0 + ellipsis 把溢出吸收进子元素）；R0 的唯一判据在 V10。',
      'V08 按计算样式数绿钮、不看 disabled——加 :not([disabled]) 会结构性漏掉「禁用但仍是绿底」那颗。',
      '主视口 1440/1280/390，抽查 761/1920；另跑 320×568 四人局 C2 作为 V10 的关键档。',
    ],
    viewports: [],
  };

  for (const vp of VIEWPORTS) {
    if (only && only !== EXTRA.name && vp.name !== only) continue;
    if (only === EXTRA.name) break;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pageUrl);
    await page.waitForTimeout(450);
    const entry = { viewport: vp.name, spot: !!vp.spot, states: [], verdicts: {}, errors: errs, ok: false };
    try {
      const rows = await runViewport(page, vp);
      for (const r of rows) {
        entry.states.push({
          tag: r.tag, deployState: r.m.deployState, blocks: r.m.deployBlocks.length,
          rHead: r.m.rHead, panelTop: r.m.shotBox && r.m.shotBox.top, panelH: r.m.shotBox && r.m.shotBox.height,
          primaryTop: r.m.primary && r.m.primary.top, r0h: r.m.r0 && r.m.r0.height,
        });
        for (const [id, v] of Object.entries(r.j)) entry.verdicts[id + '@' + r.tag] = { ...v, tag: r.tag };
      }
      entry.ok = true;
    } catch (e) {
      entry.fatal = String(e.message).replace(/\s+/g, ' ').slice(0, 300);
    }
    await ctx.close();
    report.viewports.push(entry);
  }

  if (!only || only === EXTRA.name) report.viewports.push(await run320(browser));

  await browser.close();
  const h1 = md5();
  report.buildMd5End = h1;
  report.buildStable = h0 === h1;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  const ids = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08', 'V09', 'V10', 'V10-最坏内容', 'V11-1', 'V11-2', 'V11-3'];
  console.log('\n构建 md5 ' + h0 + (h0 === h1 ? '（运行前后一致）' : ' → ' + h1 + '  !! 运行中被重建，结果不可用'));
  console.log('\n视口        ' + ids.map(i => i.padEnd(7)).join(''));
  for (const v of report.viewports) {
    if (v.fatal) { console.log(v.viewport.padEnd(12) + 'FATAL ' + v.fatal); continue; }
    const cols = ids.map(id => {
      const hits = Object.entries(v.verdicts).filter(([k]) => k.startsWith(id + '@'));
      if (!hits.length) return '—'.padEnd(7);
      return (hits.some(([, x]) => !x.ok) ? 'FAIL' : 'PASS').padEnd(7);
    });
    console.log(v.viewport.padEnd(12) + cols.join(''));
  }
  console.log('\n明细 → ' + path.join(outDir, 'report.json'));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
