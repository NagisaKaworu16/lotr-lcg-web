/* U 系列验收探针（P1 / U18-a / U18-b / U18-c）
 *
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     node scripts/_ucheck.cjs [320x568|360x640|390x844|1440x900]
 *
 * 判据来源：docs/memory/DECISIONS.md D013（盒高来源 / 收缩优先级 / 窄屏降级三合一）。
 * 每条都打印「实测 / 期望 / 判定」，不输出形容词。
 *
 * ── 为什么不点真实按钮 ───────────────────────────────────────────────
 * 320×568 档被既有缺陷 #12（≤760px 开局面板与阶段轨重叠）拦截，keepHand 的真点击必败；
 * 390 档另有 #9（.draw-toast 全屏遮罩）会拦 finishSetup。本脚本测的是**布局**，
 * 状态用引擎构造 + DOM click 推进，与「能不能点到」无关——可达性由 _hitcheck.cjs 单独判。
 * 这不是绕过去：两个探针各测一件事，混在一起才会得出「要么都红要么都绿」的假结论。
 *
 * ── 为什么主判据用 Range 而不是 scrollWidth ─────────────────────────
 * 前缀改成可省略、数字改成 flex:none 之后，.r0-num 按内容定宽、overflow 可见，
 * num.scrollWidth === num.clientWidth 按构造恒成立——用 scrollWidth 判「数字没被切」
 * 会永远绿。Range.getBoundingClientRect().width 量的是文字真实绘制宽，与元素盒无关，
 * 才能在「有人把 min-width:0 + overflow:hidden 加回 num」时真红。
 */
'use strict';
const {chromium} = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].filter(Boolean).find(p => fs.existsSync(p));

const VP = {
  '320x568': {width: 320, height: 568},
  '360x640': {width: 360, height: 640},
  '390x844': {width: 390, height: 844},
  '620x640': {width: 620, height: 640},
  '700x640': {width: 700, height: 640},   // 601–760 中间档：sr-only 只在 ≤600 生效，label 仍在流内
  '1440x900': {width: 1440, height: 900},
};
const vpName = process.argv[2] || '320x568';
const PLAYERS = Number(process.argv[3] || 2);
const vp = VP[vpName];
if (!vp) { console.error('viewport 只支持：' + Object.keys(VP).join(' / ')); process.exit(2); }
const NARROW = vp.width <= 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 构建口径：跑前跑后各记一次 index.html 的 md5，不一致即整轮作废。
   team-lead 定稿 35a49f3 v0.15.71 = 49a607426097926d823991bf3658b91a */
const crypto = require('crypto');
const buildMd5 = () => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'index.html'))).digest('hex');
const BUILD_BEFORE = buildMd5();
const EXPECT_BUILD = '49a607426097926d823991bf3658b91a';

const R = [];
function check(id, measured, expect, ok, note) {
  R.push({id, measured, expect, ok, note: note || ''});
}

/* 页面内采集：C2 态 + 窄屏降级 + 盒高来源 */
const COLLECT = (narrow) => {
  const q = s => document.querySelector(s);
  const px = n => +(+n).toFixed(2);
  const rect = el => { const b = el.getBoundingClientRect(); return {l: px(b.left), t: px(b.top), r: px(b.right), b: px(b.bottom), w: px(b.width), h: px(b.height)}; };
  const textW = el => { const r = document.createRange(); r.selectNodeContents(el); return px(r.getBoundingClientRect().width); };
  const dep = q('.quest-deploy'), r0 = q('.r0'), pill = q('.state-pill'), label = q('.r0-label'), num = q('.r0-num');
  const body = q('.decide-body');
  const cs = el => getComputedStyle(el);
  const live = q('#live');
  const SR_PROPS = ['position', 'width', 'height', 'overflow', 'clip', 'whiteSpace', 'margin', 'padding'];
  const srOf = el => { const o = {}; for (const k of SR_PROPS) o[k] = cs(el)[k]; return o; };
  return {
    state: dep && dep.dataset.state,
    pillText: pill && pill.textContent,
    labelText: label && label.textContent,
    numText: num && num.textContent,
    pill: pill && rect(pill), label: label && rect(label), num: num && rect(num), r0: r0 && rect(r0),
    pillPad: pill ? [cs(pill).paddingTop, cs(pill).paddingRight, cs(pill).paddingBottom, cs(pill).paddingLeft] : null,
    numTextW: num ? textW(num) : null,
    /* 内容级：文本渲染矩形的右缘 vs 容器内容盒右缘。
       ⚠ 不能用 num.right 与 r0.right 相比 —— .r0 是 shrink-to-fit（flex:0 1 auto，
       宽度=内容宽），num 又是最后一个 flex 项，两者右缘由构造相等（实测 266.36==266.36）。
       那是「恒等」不是「刚好装下」。真正的容器右缘要用 .decide-box 的内容盒算。 */
    numTextRight: num ? (() => { const rg = document.createRange(); rg.selectNodeContents(num); return px(Math.max(...[...rg.getClientRects()].map(r => r.right))); })() : null,
    numRects: num ? (() => { const rg = document.createRange(); rg.selectNodeContents(num); return [...rg.getClientRects()].length; })() : null,
    /* 容器内容盒右缘 = rect.right − paddingRight − borderRight。
       ⚠ 我第一版只减了 padding、漏了 1px 边框，导致容器右缘读成 287（真值 286）、
       余量虚高 1px。visual 的 286 是对的。 */
    panelContentRight: (() => {
      const pn = q('.decide-box'); if (!pn) return null;
      const pr = pn.getBoundingClientRect(), c = getComputedStyle(pn);
      return px(pr.right - parseFloat(c.paddingRight) - parseFloat(c.borderRightWidth));
    })(),
    numOverflow: num ? cs(num).overflow : null,
    numTextOverflow: num ? cs(num).textOverflow : null,
    numClientW: num ? px(num.clientWidth) : null,
    numScrollW: num ? px(num.scrollWidth) : null,
    labelOverflow: label ? cs(label).overflow : null,
    labelTextOverflow: label ? cs(label).textOverflow : null,
    labelFlex: label ? cs(label).flex : null,
    labelTextW: label ? textW(label) : null,
    numFlex: num ? cs(num).flex : null,
    /* 「可见」= checkVisibility() 且 盒宽 > 4px。
       不能用 checkVisibility() 单独判：sr-only 用的是 clip:rect(0 0 0 0)，
       checkVisibility() 不识别 clip（只认 display / visibility / opacity / content-visibility），
       所以 1×1 的 sr-only 元素 checkVisibility() 仍为 true。
       也不能只用盒宽：折叠 <details> 里的内容有几何但 checkVisibility() 为 false。两者取交。 */
    r0VisibleChildren: r0 ? [...r0.children].filter(el => el.checkVisibility() && el.getBoundingClientRect().width > 4).length : null,
    r0Children: r0 ? [...r0.children].map(el => ({
      cls: el.className || el.tagName,
      w: px(el.getBoundingClientRect().width),
      cv: el.checkVisibility(),
      clip: cs(el).clip,
    })) : null,
    bodyScrollW: body ? px(body.scrollWidth) : null,
    bodyClientW: body ? px(body.clientWidth) : null,
    depScrollW: dep ? px(dep.scrollWidth) : null,
    depClientW: dep ? px(dep.clientWidth) : null,
    labelVsSrOnly: (label && live) ? {label: srOf(label), sr: srOf(live), same: SR_PROPS.every(k => cs(label)[k] === cs(live)[k])} : null,
    docW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
  };
};

(async () => {
  const b = await chromium.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox']});
  const p = await (await b.newContext({viewport: vp})).newPage();
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await sleep(450);

  /* 开局：2 人、基础剧本。全程用 DOM click —— 见文件头注释。
     坑：mutate() 里 render() 会整页重建，一次性 forEach 拿到的第二个按钮已经是游离节点，
     对游离节点 .click() 不会冒泡到 document，于是只有玩家 1 被确认、finishSetup 一直 disabled。
     必须每点一次重新查询。 */
  const jsClick = async sel => { const n = await p.locator(sel).count(); if (n) await p.evaluate(s => document.querySelector(s).click(), sel); await sleep(200); };
  const jsClickAll = async sel => { for (let i = 0; i < 8; i++) { if (!(await p.locator(sel).count())) break; await p.evaluate(s => document.querySelector(s).click(), sel); await sleep(220); } };
  await p.selectOption('#playerCount', String(PLAYERS)); await sleep(150);
  await p.locator('.ng-tabs button', {hasText: '新版扩展'}).click(); await sleep(220);
  await p.locator('.ng-card', {hasText: '基础剧本合集'}).first().click(); await sleep(280);
  await p.locator('[data-action="ngNext"]').click(); await sleep(280);
  await p.locator('[data-action="chooserConfirm"]').click(); await sleep(600);
  await jsClickAll('[data-action="keepHand"]:not([disabled])');
  await sleep(250);
  await jsClick('button[data-action="finishSetup"]:not([disabled])');
  // 未渲染 finishSetup 时直接推引擎（v0.15.64 起全员确认手牌后可能自动执行设置）
  await p.evaluate(() => { for (let i = 0; i < 12; i++) { if (state.phase >= 2) break; try { ScenarioEngine.endPhase(state); } catch (e) { break; } } render(); });
  await sleep(250);
  await jsClick('.phase-door .door-go:not([disabled])');
  await sleep(400);

  /* 构造 C2：全员提交、只有玩家 0 确认，视角固定在玩家 0。
     注意 approveDeployment 走引擎 API 不会触发 quest-ui 的「自动切下一位」，
     所以 handView 必须自己钉回 0，否则读到的 pill 是别人的态。 */
  await p.evaluate((n) => {
    const Q = ScenarioEngine.questing;
    for (let i = 0; i < n; i++) Q.submitDeployment(state, i, Q.eligible(state, i).map(c => c.uid).slice(0, 1));
    Q.approveDeployment(state, 0);
    handView = 0; render();
  }, PLAYERS);
  await sleep(350);

  /* 反向验证（对应 team-lead 的「每条门禁至少要被人为破坏过一次并观察到它红」）：
     UX_BREAK 里塞一段把实现打回旧版的 CSS，断言必须大面积转红；
     全绿就说明这批判据是「不可能失败」的，不是「通过了」。 */
  const BROKEN = !!process.env.UX_BREAK;
  if (BROKEN) { await p.addStyleTag({content: process.env.UX_BREAK}); await sleep(250); }

  const c2 = await p.evaluate(COLLECT, NARROW);
  console.log('\n=== ' + vpName + ' · ' + PLAYERS + ' 人 · C2 态' + (BROKEN ? '（反向验证：已注入旧版 CSS）' : '') + ' ===');
  console.log(JSON.stringify({state: c2.state, pill: c2.pillText, label: c2.labelText, num: c2.numText}, null, 0));

  if (c2.state !== 'C2') {
    check('C2-态构造', c2.state, 'C2', false, '状态没构造出来，后续判定无意义');
  } else {
    check('C2-态构造', c2.state, 'C2', true);
    /* G1 内容级：数字完整显示。用 Range 的真实文字宽 + rect 宽（不用 clientWidth：
       它是整数截断值，127.2 会读成 127，产生假的 0.2px 差）。 */
    check('G1 num 装得下文字', `${c2.num.w} ≥ ${c2.numTextW}`, 'rectW ≥ textW − 0.5',
      c2.num.w >= c2.numTextW - 0.5, 'Range 实测文字宽，与元素盒无关；不用 scrollWidth（flex:none 下恒等）');
    /* G2 结构级：省略只许发生在前缀 */
    check('G2a num 无 ellipsis', c2.numTextOverflow, '≠ ellipsis', c2.numTextOverflow !== 'ellipsis');
    check('G2b num overflow 可见', c2.numOverflow, 'visible', c2.numOverflow === 'visible');
    check('G2c label 可省略', c2.labelTextOverflow, 'ellipsis', c2.labelTextOverflow === 'ellipsis');
    /* G3 几何级：越界而非切字。
       注意：G3a（num.right ≤ r0.right）已于 2026-10-27 删除 —— 实测 266.36 ≤ 266.36 恒等。
       它不是逻辑恒真，而是条件恒真：只有 .r0 被压到小于内容宽时才可能红，而只要 num 可收缩
       就永远压不到那一步（旧实现），或 r0 不被压（新实现）。这种「该红时仍绿」比恒真更难发现。 */
    check('G3b 无横向滚动', `${c2.bodyScrollW} − ${c2.bodyClientW}`, '≤ 1', c2.bodyScrollW - c2.bodyClientW <= 1, '容器级：抓「num 把容器撑破」');
    check('G3c doc 无横向滚动', `${c2.docW} − ${c2.docClientW}`, '≤ 1', c2.docW - c2.docClientW <= 1);
    /* G4 内容级·容器框（与 visual 统一口径）：文本渲染矩形右缘不得越过容器内容盒右缘。
       这是「有没有地方放」的正面判据；D 值同时给出余量（负数=还剩多少）。 */
    const dG4 = c2.panelContentRight == null ? null : +(c2.numTextRight - c2.panelContentRight).toFixed(2);
    check('G4 常规数值文本不越容器', `${c2.numTextRight} vs ${c2.panelContentRight} → ${dG4}`, '≤ 0.5', dG4 != null && dG4 <= 0.5,
      `余量 = ${dG4 == null ? 'n/a' : (-dG4).toFixed(2)}px（负数即余量）`);
    /* G4 前提：只在单行时有意义。折行后 getClientRects() 会有多个矩形，
       max right 是最后一行而不是整段最大宽 —— 会给出假绿。必须同时断言单行。 */
    check('G4-前提 文本单行', `${c2.numRects} 个矩形`, '== 1', c2.numRects === 1,
      '折行时 Range 多矩形，max right 失去意义；这条不成立则 G4 作废');
    /* U18-b 盒高来源 */
    check('U18-b r0 盒高 ≤ 26', c2.r0.h, '≤ 26', c2.r0.h <= 26);
    check('U18-b-补 r0 高 == pill 高', `|${c2.r0.h} − ${c2.pill.h}|`, '≤ 0.5', Math.abs(c2.r0.h - c2.pill.h) <= 0.5, '证明盒高由 pill 撑起');
  }

  /* U18-c 窄屏降级 */
  if (NARROW) {
    check('U18-c-1 label 转 sr-only', c2.label ? `${c2.label.w}×${c2.label.h}` : 'null', '1×1', !!c2.label && Math.abs(c2.label.w - 1) <= 0.6 && Math.abs(c2.label.h - 1) <= 0.6);
    check('U18-c-1b label 仍可被读屏', c2.labelText, '暂定', c2.labelText === '暂定', 'sr-only 保留在可访问性树');
    check('U18-c-2 r0 可见子项数', `${c2.r0VisibleChildren} ${JSON.stringify(c2.r0Children)}`, '== 2（pill + num）', c2.r0VisibleChildren === 2,
      '可见 = checkVisibility() 且盒宽>4；sr-only 的 clip 不被 checkVisibility 识别，必须两项取交');
    if (c2.labelVsSrOnly) {
      const bad = Object.keys(c2.labelVsSrOnly.sr).filter(k => c2.labelVsSrOnly.label[k] !== c2.labelVsSrOnly.sr[k]);
      check('U18-c-3 与 .sr-only 同源', bad.length ? bad.map(k => `${k}: ${c2.labelVsSrOnly.label[k]} ≠ ${c2.labelVsSrOnly.sr[k]}`).join('; ') : '8/8 一致', '8 个计算属性全等', c2.labelVsSrOnly.same,
        '变更检测器：不是同源证明，但两份改了不一致会红');
    }
    check('U18-c-4 pill 水平 padding', JSON.stringify(c2.pillPad), '上下 1px / 左右 4px',
      c2.pillPad[0] === '1px' && c2.pillPad[2] === '1px' && c2.pillPad[1] === '4px' && c2.pillPad[3] === '4px',
      '垂直 1px 是 R0 盒高唯一来源，不许归零');
  }

  /* 最宽数值档（UX_WIDE=1）：只测了一组数值是上一轮的硬伤。
     statusParts 的 num 模板是 `${n} 名 · 意志 ${will} ／ 威胁 ${threat}`，威胁会到 50、意志会到两位数。
     tabular-nums 下数字宽度与数值无关、只与位数有关，所以「最宽」= 位数最多的组合。
     构造方式：文本注入（**非真实可达局面，如实标注，不谎称是真实局面**），测完立刻还原。
     主判据用 G3b 的同一条：容器 scrollWidth ≤ clientWidth —— 这一档才会真正触发它。 */
  const WIDE = !!process.env.UX_WIDE;
  if (WIDE && c2.state === 'C2') {
    const w = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      const num = q('.r0-num'), body = q('.decide-body'), pn = q('.decide-box');
      const orig = num.textContent;
      num.textContent = '12 名 · 意志 99 ／ 威胁 50';   // 真·最坏：2 位名数 + 2 位意志 + 2 位威胁
      const px = n => +(+n).toFixed(2);
      const pr = pn.getBoundingClientRect();
      const pcs = getComputedStyle(pn);
      const contentRight = px(pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth));
      const rg = document.createRange(); rg.selectNodeContents(num);
      const out = {
        text: num.textContent,
        textW: px(rg.getBoundingClientRect().width),
        numW: px(num.getBoundingClientRect().width),
        textRight: px(Math.max(...[...rg.getClientRects()].map(r => r.right))),
        rects: [...rg.getClientRects()].length,
        contentRight,
        dRange: px(Math.max(...[...rg.getClientRects()].map(r => r.right)) - contentRight),
        bodyScrollW: body.scrollWidth, bodyClientW: body.clientWidth,
        docW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
      };
      num.textContent = orig;
      return out;
    });
    /* 主判据换成「文本渲染矩形 vs 容器内容盒」（visual 同款口径，两边统一）。
       旧的 W3（r0.scrollW ≤ r0.clientW）已废弃：.r0 是 shrink-to-fit，
       它被压时 scrollW>clientW 是正常收缩，不代表视觉损伤。 */
    check('W1 最宽数值文本不越容器', `${w.textRight} vs ${w.contentRight} → ${w.dRange}`, '≤ 0.5',
      w.dRange <= 0.5, `文本注入「${w.text}」（非真实可达局面）`);
    check('W1-前提 最宽文本单行', `${w.rects} 个矩形`, '== 1', w.rects === 1, '折行则 W1 失去意义');
    check('W2 最宽数值 num 装得下', `${w.numW} ≥ ${w.textW}`, 'rectW ≥ textW − 0.5', w.numW >= w.textW - 0.5,
      '同上，文本注入；这一档才会让 G1 真正承重');
    check('W4 最宽数值 doc 不横向滚', `${w.docW} − ${w.docClientW}`, '≤ 1', w.docW - w.docClientW <= 1);
    check('W5 最宽数值容器不横向滚', `${w.bodyScrollW} − ${w.bodyClientW}`, '≤ 1', w.bodyScrollW - w.bodyClientW <= 1,
      '容器级补证；注意出现 2px 滚动条也算红');
  }

  /* 五态扫描：pill 宽度 / label 文本。
     · label 文本：A/B/C1/C2 =「暂定」，D =「实际」（v0.15.72 起；之前是空串）
     · pill 五态等宽：⚠ 这是护栏不是门禁 —— 旧实现 min-width:5.6em 本来就定宽，
       所以它对「收窄 pill」这个改动不可见。留着防将来有人把 min-width 加错。 */
  /* 五态扫描（延后执行：它会把状态推到 D 并可能锁盘，先跑 U18-a 再扫） */
  const runSweep = (NARROW && c2.state === 'C2') ? async () => {
    const sweep = await p.evaluate(() => {
      const Q = ScenarioEngine.questing, q = state.questing, n = state.players.length;
      const snap = () => {
        const p = document.querySelector('.state-pill'), l = document.querySelector('.r0-label'), d = document.querySelector('.quest-deploy'), n = document.querySelector('.r0-num');
        return {
          state: d && d.dataset.state,
          pill: p ? p.textContent : null,
          pillW: p ? +p.getBoundingClientRect().width.toFixed(2) : null,
          pillOffsetW: p ? p.offsetWidth : null,
          numLeft: n ? +n.getBoundingClientRect().left.toFixed(2) : null,
          label: l ? l.textContent : null,
          labelW: l ? +l.getBoundingClientRect().width.toFixed(2) : null,
        };
      };
      const out = [];
      q.deployments = {}; q.deploymentApprovals = []; q.deploymentLocked = false; handView = 0; render(); out.push(snap());
      Q.submitDeployment(state, 0, Q.eligible(state, 0).map(c => c.uid).slice(0, 1)); handView = 0; render(); out.push(snap());
      for (let i = 1; i < n; i++) Q.submitDeployment(state, i, Q.eligible(state, i).map(c => c.uid).slice(0, 1));
      handView = 0; render(); out.push(snap());
      Q.approveDeployment(state, 0); handView = 0; render(); out.push(snap());
      for (let i = 1; i < n; i++) Q.approveDeployment(state, i);
      handView = 0; render(); out.push(snap());
      return out;
    });
    const order = ['A', 'B', 'C1', 'C2', 'D'];
    check('五态-S1 状态序列', sweep.map(s => s.state).join('→'), order.join('→'),
      sweep.map(s => s.state).join('→') === order.join('→'), '扫描本身是否成立');
    const want = {A: '暂定', B: '暂定', C1: '暂定', C2: '暂定', D: '实际'};
    const badLabel = sweep.filter(s => s.label !== want[s.state]).map(s => `${s.state}="${s.label}"≠"${want[s.state]}"`);
    check('五态-S2 label 文本', badLabel.length ? badLabel.join('; ') : '五态全符',
      'A/B/C1/C2=暂定, D=实际', badLabel.length === 0, 'D 态「实际」自 v0.15.72 起；此前为空串');
    const ws = sweep.map(s => s.pillW).filter(v => v != null);
    const spread = ws.length ? +(Math.max(...ws) - Math.min(...ws)).toFixed(2) : null;
    check('护栏 pill 五态等宽', `${JSON.stringify(ws)} 极差=${spread}`, '≤ 0.5', spread != null && spread <= 0.5,
      '⚠ 护栏：旧实现定宽时也绿，不可当门禁');
    /* team-lead ⑤：v0.15.72 的主判据改成「num.left 五态极差」+「pill.offsetWidth 五态全等」。
       num.left 稳定 = 切人/切态时数字不横跳（这是玩家真正看得见的东西）。 */
    const ls = sweep.map(s => s.numLeft).filter(v => v != null);
    const lSpread = ls.length ? +(Math.max(...ls) - Math.min(...ls)).toFixed(2) : null;
    check('五态-S3 num.left 极差', `${JSON.stringify(ls)} 极差=${lSpread}`, '≤ 1', lSpread != null && lSpread <= 1,
      '切人/切态时数字不横跳');
    const ows = sweep.map(s => s.pillOffsetW).filter(v => v != null);
    check('五态-S4 pill.offsetWidth 全等', `${JSON.stringify(ows)}`, '五态全等', ows.length === 5 && new Set(ows).size === 1);
  } : null;

  /* 601–760px 中间档：sr-only 只在 ≤600 生效，label 仍在流内且要跟前缀抢宽度。
     这三档一直没人管：窄档有 sr-only 兜底、宽档有空间，中间档两头不靠。 */
  if (vp.width > 600 && vp.width <= 760 && c2.state === 'C2') {
    const dMid = c2.panelContentRight == null ? null : +(c2.numTextRight - c2.panelContentRight).toFixed(2);
    check('M1 中间档容器不横向滚', `${c2.bodyScrollW} − ${c2.bodyClientW}`, '≤ 1', c2.bodyScrollW - c2.bodyClientW <= 1);
    check('M2 中间档数字不越容器', `${c2.numTextRight} vs ${c2.panelContentRight} → ${dMid}`, '≤ 0.5', dMid != null && dMid <= 0.5,
      `余量 = ${dMid == null ? 'n/a' : (-dMid).toFixed(2)}px`);
    check('M3 中间档前缀未被截断', `盒宽 ${c2.label.w} / 文字宽 ${c2.labelTextW}`, '盒宽 ≥ 文字宽 − 0.5',
      c2.label.w >= c2.labelTextW - 0.5,
      c2.label.w < c2.labelTextW - 0.5 ? '前缀被 ellipsis 截断 —— 中间档的固有问题，需决定是否把 sr-only 提到 760' : '完整显示');
  }

  /* U18-a 焦点：C1 态点【确认派遣】→ render() 全量重建 → activeElement 落哪 */
  if (NARROW) {
    // 回到 C1 且操作者强制为玩家 0：approveDeployment 会自动切到下一位未确认者，
    // 上一步的自动切换已经把 handView 变成 1；不重置会点到「玩家1 的确认」，测的不是同一件事。
    await p.evaluate(() => { state.questing.deploymentApprovals = []; handView = 0; render(); });
    await sleep(250);
    // 先滚到视口内再命中测试：elementFromPoint 对视口外的点恒返回 null，
    // 那是「不在视口」，不是「被遮挡」——两者必须分开，否则会把正常滚动判成遮挡。
    await p.evaluate(() => document.querySelector('[data-quest="approveDeployment"]')?.scrollIntoView({block: 'center'}));
    await sleep(250);
    const pre = await p.evaluate(() => {
      const btn = document.querySelector('[data-quest="approveDeployment"]');
      if (!btn) return {err: 'no approve 按钮（C1 未构造成功）', state: document.querySelector('.quest-deploy')?.dataset.state};
      const bb = btn.getBoundingClientRect();
      const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
      const inView = cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth;
      const hit = inView ? document.elementFromPoint(cx, cy) : null;
      return {ok: !!(hit && (hit === btn || btn.contains(hit))), inView, hit: hit && (hit.tagName + '.' + String(hit.className).split(' ')[0]), state: document.querySelector('.quest-deploy').dataset.state};
    });
    if (!pre.ok) {
      check('U18-a 前置：确认按钮可命中', pre.err || `${pre.hit}（inView=${pre.inView}, state=${pre.state}）`, '命中自身', false, '不在视口或被遮挡则焦点测试无意义，跳过');
    } else {
      await p.evaluate(() => { const b = document.querySelector('[data-quest="approveDeployment"]'); b.focus(); b.click(); });
      await sleep(400);
      const ae = await p.evaluate(() => {
        const a = document.activeElement;
        return {tag: a && a.tagName, id: a && a.id, fk: a && a.dataset && a.dataset.focusKey, text: a && (a.textContent || '').trim().slice(0, 16), state: document.querySelector('.quest-deploy')?.dataset.state};
      });
      const ok = !!ae.tag && ae.tag !== 'BODY' && (!!ae.fk || ae.id === 'live');
      check('U18-a 焦点不落 body', JSON.stringify(ae), '非 BODY 且带 focusKey 或 id=live', ok, '确认派遣后 render() 全量重建');
    }
  }

  /* 五态扫描放最后：推到 D 会锁盘，先跑 U18-a。 */
  if (runSweep) await runSweep();

  /* 输出 */
  console.log('');
  const w = Math.max(...R.map(r => r.id.length));
  for (const r of R) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${r.id.padEnd(w)}  实测=${String(r.measured).padEnd(34)} 期望=${r.expect}${r.note ? '   // ' + r.note : ''}`);
  }
  const fail = R.filter(r => !r.ok).length;
  console.log('\n' + (fail ? `${fail} 项 FAIL / ${R.length} 项` : `${R.length} 项全 PASS`) + '  (' + vpName + ' · ' + PLAYERS + ' 人)');

  /* 落盘：报告 + 构建口径 */
  const BUILD_AFTER = buildMd5();
  const rec = {
    viewport: vpName, players: PLAYERS, at: new Date().toISOString(),
    buildMd5Start: BUILD_BEFORE, buildMd5End: BUILD_AFTER,
    buildStable: BUILD_BEFORE === BUILD_AFTER,
    expectedBuild: EXPECT_BUILD, isFinalBuild: BUILD_BEFORE === EXPECT_BUILD,
    c2: {state: c2.state, pill: c2.pillText, label: c2.labelText, num: c2.numText,
      pillW: c2.pill.w, numW: c2.num.w, numClientW: c2.numClientW, numTextW: c2.numTextW,
      r0W: c2.r0.w, r0H: c2.r0.h, pillPad: c2.pillPad},
    checks: R, fail, total: R.length,
  };
  const outFile = path.join(ROOT, 'docs', 'browser-acceptance', '_ucheck', 'report-ux.json');
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { prev = []; }
  prev = (Array.isArray(prev) ? prev : []).filter(r => !(r.viewport === vpName && r.players === PLAYERS));
  prev.push(rec);
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, JSON.stringify(prev, null, 1));
  console.log(`build ${BUILD_BEFORE}${rec.buildStable ? ' (stable)' : ' ← 跑中途变了，本轮作废'}` +
    (rec.isFinalBuild ? ' = 定稿 35a49f3' : ' ≠ 定稿 49a6074…，本轮不可引用'));
  console.log('报告 → docs/browser-acceptance/_ucheck/report-ux.json');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(2); });
