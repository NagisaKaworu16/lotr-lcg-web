/* 决策窗口规则验收（docs/design/WINDOWS.md §12）。
   R1 无候选不渲染 / R3 强制与可选可辨（形状通道）/ R4 继续追问 / R5 只闪点 / 文案统一。

   读法：每条断言都读「真实 DOM 几何 + getComputedStyle + dataset」，不读 state 自证。
   运行：NODE_PATH=<playwright-core node_modules> node scripts/check-window-rules.cjs
   （本机 Chrome：C:/Program Files (x86)/Google/Chrome/Application/chrome.exe）

   刻意的取舍（做不到稳定复现的条目宁可不写）：
   · R2「纯被动不出现」不单独构造（7.2 重置卡牌这类帧由引擎瞬间跨过，抓不稳）；
     用「计划阶段整段不出现 .decide-box」这条等价断言覆盖「没事可问就不渲染」。
   · 6.1/6.3 的 forced **真实局面**没有构造：要手工拼一个 combat 状态机快照，
     而那条路径已被 check-auto-phase.cjs 全程点过一遍（它验证战斗能推进）。
     这里改为对 DecisionUI.timingOf 直接喂 5 个 forced 锚点的最小状态对象——
     判定锚点是纯函数，比构造局面更稳，且正是 §12「R3 判定锚点」那一条。
   · 回执（M17）在现有引擎里被 QuestUI.panel 的只读块抢先兜住，正常局面走不到
     DecisionUI 的回执分支。为了验证这条防御分支本身，脚本里临时把 QuestUI.panel
     置空后渲染一次（用完立刻恢复），断言「0 个 button + tone=info + 不自动展开」。
     这是**测试替身**，不是产品行为——已经在注释里写明。 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.dirname(__dirname);
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));
const OUT = path.join(ROOT, 'docs', 'browser-acceptance');
const FILE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');

const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok, detail: String(detail) });

/* 进到「计划阶段」（决策触发条整段不存在的那一段）。 */
async function boot(page, players = 2) {
  await page.goto(FILE);
  await page.waitForTimeout(400);
  await page.selectOption('#playerCount', String(players));
  await page.waitForTimeout(150);
  await page.locator('.ng-tabs button', { hasText: '新版扩展' }).click(); await page.waitForTimeout(220);
  await page.locator('.ng-card', { hasText: '基础剧本合集' }).first().click(); await page.waitForTimeout(280);
  await page.locator('[data-action="ngNext"]').click(); await page.waitForTimeout(280);
  await page.locator('[data-action="chooserConfirm"]').click(); await page.waitForTimeout(650);
  for (const x of await page.locator('button[data-action="keepHand"]').all()) await x.click();
  const fin = page.locator('button[data-action="finishSetup"]');
  if (await fin.count()) await fin.click();
  await page.waitForTimeout(450);
  for (let i = 0; i < 40; i++) {
    const r = page.locator('[data-action="setupResolve"]'), d = page.locator('[data-action="setupDraw"]');
    if (await r.count()) await r.first().click();
    else if (await d.count()) await d.first().click();
    else break;
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => { const t = document.querySelector('.draw-toast'); if (t) t.remove(); });
  await page.waitForTimeout(200);
}

/* 触发条快照：tone / act / 点形状 / 浮层是否存在 / 焦点位置。 */
const snap = page => page.evaluate(() => {
  const tg = document.querySelector('.decide-trigger');
  const dot = tg && tg.querySelector('.decide-dot');
  const cs = dot ? getComputedStyle(dot) : null;
  const pop = document.querySelector('.decide-pop');
  return {
    boxes: document.querySelectorAll('.decide-box').length,
    hasTrigger: !!tg,
    tone: tg ? tg.dataset.tone : null,
    act: tg ? tg.dataset.act : null,
    expanded: tg ? tg.getAttribute('aria-expanded') : null,
    hasPop: !!pop,
    popButtons: pop ? pop.querySelectorAll('button').length : 0,
    popText: pop ? (pop.innerText || '').replace(/\s+/g, ' ') : '',
    dot: cs ? {
      w: cs.width, h: cs.height, radius: cs.borderRadius, style: cs.borderStyle,
      bg: cs.backgroundColor, iter: cs.animationIterationCount, anim: cs.animationName,
    } : null,
    focusIsTrigger: !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('decide-trigger')),
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' '),
    hintLive: document.querySelectorAll('.decide-hint[aria-live]').length,
    announcer: document.querySelectorAll('#decide-announcer').length,
  };
});

/* 探险 beforeCommit → commit：替玩家0 提交一份名单（真实 UI 路径：draft → 提交 → 确认框）。 */
async function submitPlayer0(page) {
  await page.evaluate(() => {
    const q = state.questing;
    QuestUI.setDraft(state, 0, [state.players[0].heroStates[0].uid]);
    void q; render();
  });
  await page.waitForTimeout(150);
  const commit = page.locator('[data-quest="commit"]').first();
  if (await commit.count()) await commit.click();
  await page.waitForTimeout(250);
  const ok = page.locator('dialog[open] #ok').first();
  if (await ok.count()) await ok.click();
  await page.waitForTimeout(300);
}

const OLD_TEXT = ['全队继续到下一决策点', '恢复全部跳过记录', '提交暂定防御名单', '处理卡牌响应'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const errors = [];

  /* ── 主流程：2 人局 ───────────────────────────────────────────── */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('2p: ' + String(e && e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));
  await boot(page, 2);

  /* R1：计划阶段没有任何必须由人完成的一步 → 触发条/盒子零高度零占位 */
  let s = await snap(page);
  add('R1 计划阶段不渲染 .decide-box（无候选则窗口不存在）', s.boxes === 0, `boxes=${s.boxes}`);
  add('R1 计划阶段没有 .decide-trigger 节点', !s.hasTrigger, s.hasTrigger ? 'trigger 仍在' : 'ok');

  /* 进入探险阶段：这里一定有决策（投入前行动窗口） */
  await page.locator('button[data-action="endPhase"]').click();
  await page.waitForTimeout(600);
  s = await snap(page);
  add('3.1 投入前行动：触发条出现且 tone=todo', s.hasTrigger && s.tone === 'todo', `tone=${s.tone}`);
  add('3.1 有可点控件 → 自动展开（act=1 / aria-expanded=true）', s.act === '1' && s.expanded === 'true', `act=${s.act} expanded=${s.expanded}`);
  add('3.1 浮层真的在 DOM 里且有按钮', s.hasPop && s.popButtons > 0, `pop=${s.hasPop} buttons=${s.popButtons}`);
  add('R3 todo 状态点是实心圆（border-radius 50%）', !!s.dot && s.dot.radius === '50%', s.dot ? s.dot.radius : 'no dot');
  add('a11y #decide-announcer 恰好一个', s.announcer === 1, `n=${s.announcer}`);
  add('a11y .decide-hint 不再带 aria-live（播报交给 announcer）', s.hintLive === 0, `n=${s.hintLive}`);

  /* 文案统一：四个旧串一次都不许出现（整页文本，含浮层） */
  const leaked = OLD_TEXT.filter(t => s.bodyText.includes(t));
  add('文案统一：页面不出现 4 个旧串', leaked.length === 0, leaked.join(' / ') || 'clean');

  /* R3 判定锚点：5 个 forced 全覆盖 + 3 个 action 反例（纯函数，最稳） */
  const anchors = await page.evaluate(() => {
    const T = (o) => DecisionUI.timingOf(o);
    return {
      qstaging: T({ phase: 2, questing: { step: 'staging' } }),
      encChecks: T({ phase: 4, encountering: { step: 'checks' } }),
      cbAttackChoice: T({ phase: 5, combat: { step: 'attackChoice' } }),
      cbShadow: T({ phase: 5, combat: { step: 'shadowWindow' } }),
      rfRoundEnd: T({ phase: 6, refreshing: { step: 'roundEnd' } }),
      qBeforeCommit: T({ phase: 2, questing: { step: 'beforeCommit' } }),
      encBeforeChecks: T({ phase: 4, encountering: { step: 'beforeChecks' } }),
      cbPlayerAction: T({ phase: 5, combat: { step: 'playerAction' } }),
    };
  });
  add('R3 判定锚点 3.2 探查区 = forced', anchors.qstaging === 'forced', anchors.qstaging);
  add('R3 判定锚点 5.2 交战检定 = forced', anchors.encChecks === 'forced', anchors.encChecks);
  add('R3 判定锚点 6.1 敌人攻击（attackChoice 经别名）= forced', anchors.cbAttackChoice === 'forced', anchors.cbAttackChoice);
  add('R3 判定锚点 6.3 暗影结算（shadowWindow 经别名）= forced', anchors.cbShadow === 'forced', anchors.cbShadow);
  add('R3 判定锚点 7.3 回合结束 = forced', anchors.rfRoundEnd === 'forced', anchors.rfRoundEnd);
  add('R3 判定锚点 3.1 投入前行动 = action（不是 forced）', anchors.qBeforeCommit === 'action', anchors.qBeforeCommit);
  add('R3 判定锚点 5.1 交战前行动 = action（phase-log 已修正）', anchors.encBeforeChecks === 'action', anchors.encBeforeChecks);
  add('R3 判定锚点 6.2 玩家攻击 = action', anchors.cbPlayerAction === 'action', anchors.cbPlayerAction);

  /* R4 决策锚点：consumedOf 随「已消费输入」单调增长，同一段正文也能换 key */
  const anchorProbe = await page.evaluate(() => {
    const before = DecisionUI.decisionAnchor(state);
    const consumed0 = DecisionUI.consumedOf(state);
    state.pending.push({ id: 999001, kind: 'treachery', text: '锚点探针' });
    const after = DecisionUI.decisionAnchor(state);
    const consumed1 = DecisionUI.consumedOf(state);
    state.pending.pop();
    return { before, after, consumed0, consumed1 };
  });
  add('R4 决策锚点：consume +1 后 anchor 变化（同一段正文也会重问）',
    anchorProbe.after !== anchorProbe.before && anchorProbe.consumed1 === anchorProbe.consumed0 + 1,
    `${anchorProbe.consumed0}→${anchorProbe.consumed1}`);

  /* 形状通道四态：按产品真实机制给**触发条**换 data-tone 读点的计算样式
     （点自己没有 data-tone；把它设在点上是测试替身，会被触发条的规则压过）。 */
  const shape = await page.evaluate(() => {
    const tg = document.querySelector('.decide-trigger');
    const dot = tg && tg.querySelector('.decide-dot');
    if (!dot) return null;
    const old = tg.getAttribute('data-tone');
    const read = t => { tg.setAttribute('data-tone', t); const c = getComputedStyle(dot);
      return { w: c.width, h: c.height, radius: c.borderRadius, style: c.borderStyle, bg: c.backgroundColor }; };
    const out = { todo: read('todo'), forced: read('forced'), wait: read('wait'), info: read('info') };
    if (old === null) tg.removeAttribute('data-tone'); else tg.setAttribute('data-tone', old);
    return out;
  });
  add('R3 forced 与 todo 的唯一形状差异是圆角（实心方块 vs 实心圆）',
    !!shape && shape.forced.radius === '1px' && shape.todo.radius === '50%',
    shape ? `forced=${shape.forced.radius} todo=${shape.todo.radius}` : 'no dot');
  add('四态几何尺寸完全一致（9×9，缩小时不缩形状）',
    !!shape && [shape.todo, shape.forced, shape.wait, shape.info].every(x => x.w === shape.todo.w && x.h === shape.todo.h),
    shape ? `${shape.todo.w}×${shape.todo.h}` : 'no dot');
  add('R5/info 的空心态是空心（透明底）+ 描边',
    !!shape && shape.wait.bg === 'rgba(0, 0, 0, 0)' && shape.info.bg === 'rgba(0, 0, 0, 0)'
      && shape.wait.style === 'dashed' && shape.info.style === 'solid',
    shape ? `wait=${shape.wait.bg}/${shape.wait.style} info=${shape.info.bg}/${shape.info.style}` : 'no dot');

  /* 四态**色值**必须单独断一次：形状通道与颜色无关，灰度/形状断言全过也不代表色号对
     （§7.2 唯一真相表：todo = --accent-gold #846424 / forced = --accent-red #a35446 /
     wait·info = --ink-3 #6f7566 描边）。forced 用红不用金是与阶段竖轴
     `.rail-win-line[data-timing="forced"]` 同源的口径，颜色错了形状断言抓不到。 */
  const colors = await page.evaluate(() => {
    const tg = document.querySelector('.decide-trigger');
    const dot = tg && tg.querySelector('.decide-dot');
    if (!dot) return null;
    const old = tg.getAttribute('data-tone');
    const read = t => { tg.setAttribute('data-tone', t); const c = getComputedStyle(dot);
      return { bg: c.backgroundColor, bd: c.borderTopColor, bw: c.borderTopWidth, style: c.borderStyle }; };
    const out = { todo: read('todo'), forced: read('forced'), wait: read('wait'), info: read('info') };
    if (old === null) tg.removeAttribute('data-tone'); else tg.setAttribute('data-tone', old);
    return out;
  });
  add('四态色值 todo = --accent-gold #846424（实心金圆）',
    !!colors && colors.todo.bg === 'rgb(132, 100, 36)' && colors.todo.bd === 'rgb(132, 100, 36)',
    colors ? `bg=${colors.todo.bg} bd=${colors.todo.bd}` : 'no dot');
  add('四态色值 forced = --accent-red #a35446（红方块，不用金）',
    !!colors && colors.forced.bg === 'rgb(163, 84, 70)' && colors.forced.bd === 'rgb(163, 84, 70)',
    colors ? `bg=${colors.forced.bg} bd=${colors.forced.bd}` : 'no dot');
  add('四态色值 wait/info 描边 = --ink-3 #6f7566（只做描边，没拿它当填充）',
    !!colors && colors.wait.bd === 'rgb(111, 117, 102)' && colors.info.bd === 'rgb(111, 117, 102)'
      && colors.wait.bg === 'rgba(0, 0, 0, 0)' && colors.info.bg === 'rgba(0, 0, 0, 0)',
    colors ? `wait=${colors.wait.bd} info=${colors.info.bd}` : 'no dot');

  /* 两档尺寸 × 四态：换态不许改变几何尺寸（否则触发条高度会跳）。
     7px 档是**真实尺寸**（触发条并入 .bottom-deck > .zone-heading 的 26px 胶囊，
     规则 `.bottom-deck>.zone-heading>.decide-box .decide-dot{width:7px;height:7px}`）；
     9px 档是基类值，这里用内联覆盖复现（测试替身，只为确认基类尺寸下形状仍在）。 */
  const tiers = await page.evaluate(() => {
    const tg = document.querySelector('.decide-trigger');
    const dot = tg && tg.querySelector('.decide-dot');
    if (!dot) return null;
    const old = tg.getAttribute('data-tone'), base = dot.style.cssText;
    const measure = () => {
      const out = {};
      for (const t of ['todo', 'forced', 'wait', 'info']) {
        tg.setAttribute('data-tone', t);
        const c = getComputedStyle(dot);
        out[t] = { w: c.width, h: c.height, radius: c.borderRadius, style: c.borderStyle, bw: c.borderTopWidth, bg: c.backgroundColor };
      }
      return out;
    };
    const small = measure();
    dot.style.width = '9px'; dot.style.height = '9px';
    const big = measure();
    dot.style.cssText = base;
    if (old === null) tg.removeAttribute('data-tone'); else tg.setAttribute('data-tone', old);
    return { small, big };
  });
  const sameGeo = tt => !!tt && ['todo', 'forced', 'wait', 'info'].every(t => tt[t].w === tt.todo.w && tt[t].h === tt.todo.h);
  add('7px 档四态几何尺寸一致（换态不跳高度）', sameGeo(tiers && tiers.small),
    tiers ? `${tiers.small.todo.w}×${tiers.small.todo.h} / ${Object.keys(tiers.small).map(t => tiers.small[t].h).join(',')}` : 'no dot');
  add('9px 档四态几何尺寸一致', sameGeo(tiers && tiers.big),
    tiers ? `${tiers.big.todo.w}×${tiers.big.todo.h}` : 'no dot');
  /* 三通道编码（形状 × 填充 × 线型）要两两互异——**填充也算一通道**：
     todo 与 info 的圆角、线型完全一样，唯一的区别就是「实心 vs 空心」。
     只断 圆角×线型 会把 todo 与 info 判成同一格（假红），所以三元组必须带上填充。 */
  const combo = tt => new Set(['todo', 'forced', 'wait', 'info']
    .map(t => `${tt[t].radius}|${tt[t].style}|${tt[t].bg === 'rgba(0, 0, 0, 0)' ? 'hollow' : 'filled'}`)).size;
  add('两档的「形状×填充×线型」四种组合两两互异（灰度下也能分辨，不依赖颜色）',
    !!tiers && combo(tiers.small) === 4 && combo(tiers.big) === 4,
    tiers ? Object.keys(tiers.big).map(t => `${t}=${tiers.big[t].radius}/${tiers.big[t].style}/${tiers.big[t].bg === 'rgba(0, 0, 0, 0)' ? '空心' : '实心'}`).join(' ') : 'no dot');
  /* 线宽：**不能断计算值等于 '1.5px'**。Chrome 在 devicePixelRatio=1 下把 1.5px 的
     border-width 折算成 1px（getComputedStyle 返回 '1px'），断言字面量只会假红。
     真正的红线是「描边不能被做没了」：与同组的 info 等宽、且非 0；再加下面那条像素判据，
     一起证明「wait 与 info 在当前渲染尺寸下真的还分得开」。 */
  add('两档 wait 的描边宽度与 info 一致且非 0（没有被做成 0 或比实线更细）',
    !!tiers && [tiers.small, tiers.big].every(tt => tt.wait.bw === tt.info.bw && tt.wait.bw !== '0px'),
    tiers ? `small wait=${tiers.small.wait.bw} info=${tiers.small.info.bw} · big wait=${tiers.big.wait.bw} info=${tiers.big.info.bw}` : 'no dot');
  /* 上面断的是「渲染出来什么」，这条断「写下去是什么」：将来有人把 1.5 改成 1（或把 dashed
     改成 dashed 之外的东西），先在这里红，不必等像素判据去猜。 */
  const authored = await page.evaluate(() => {
    const out = {};
    const walk = rules => {
      for (const r of rules) {
        if (r.cssRules) walk(r.cssRules);
        if (!r.selectorText) continue;
        /* 只认「写了宽度」的那条规则：同色点还会被 forced-colors / reduced-motion 两个
           @media 块再命中一次（那两条只改 border-style / animation），后写会覆盖前写。

           注意 shorthand 里只要有 var()，CSSOM 就**不会**把它展开成长属性：
           `border:1.5px dashed var(--ink-3)` 的 r.style.borderWidth 是空串。
           所以宽度/线型都要先看长属性，回落到 shorthand 文本里取，否则令牌化之后
           这里会假红「未找到」——写下去的明明是 1.5px dashed。 */
        const short = r.style.border || r.style.borderTop || '';
        const w = r.style.borderWidth || r.style.borderTopWidth
          || (/(?:^|\s)([\d.]+px)(?:\s|$)/.exec(short) || [])[1] || '';
        if (!w) continue;
        const st = r.style.borderStyle || r.style.borderTopStyle
          || (/(dashed|dotted|double|solid)/.exec(short) || [])[1] || '';
        const t = [w, st].join(' ');
        if (/\.decide-dot\[data-tone="wait"\]/.test(r.selectorText)) out.wait = t;
        if (/\.decide-dot\[data-tone="info"\]/.test(r.selectorText)) out.info = t;
      }
    };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch (e) { /* 跨域表跳过 */ } }
    return out;
  });
  add('作者样式表 wait = 1.5px dashed / info = 1.5px solid（计算值被 Chrome 折成 1px，不能拿它当判据）',
    /1\.5px/.test(authored.wait || '') && /dashed/.test(authored.wait || '')
      && /1\.5px/.test(authored.info || '') && /solid/.test(authored.info || ''),
    `wait=${authored.wait || '未找到'} info=${authored.info || '未找到'}`);
  add('7px 档 forced 圆角仍是 1px（改到 2px 以上，7px 方块与 7px 圆在灰度下分不出来）',
    !!tiers && tiers.small.forced.radius === '1px' && tiers.big.forced.radius === '1px',
    tiers ? `small=${tiers.small.forced.radius} big=${tiers.big.forced.radius}` : 'no dot');

  /* 7px 档的虚线**不能只断 borderStyle 字符串**——字符串永远返回 'dashed'，
     即使 dash 被挤成实线也照样通过（典型假绿）。这里用像素判据：
     同一颗点分别渲染 wait / info，各截两张同 clip 的图；
       ① info 的两次截图必须逐字节一致（证明截图可重复，否则后面的差异没有意义）；
       ② wait 至少一处字节与 info 不同（证明虚线真的画出了缺口）。
     不解码 PNG：同 page、同 clip、同 deviceScaleFactor 下 Chrome 的编码是确定的。 */
  const dotClip = await page.evaluate(() => {
    const tg = document.querySelector('.decide-trigger');
    const d = tg && tg.querySelector('.decide-dot');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.x) - 2), y: Math.max(0, Math.round(r.y) - 2), width: Math.round(r.width) + 4, height: Math.round(r.height) + 4, size: getComputedStyle(d).width };
  });
  if (dotClip) {
    /* 浮层是向上弹的，理论上压不到触发条里的点；但收起来再截更稳，也不受 box-shadow 干扰。 */
    const openT = page.locator('.decide-trigger[aria-expanded="true"]').first();
    if (await openT.count()) { await openT.click(); await page.waitForTimeout(200); }
    const shot = async tone => {
      await page.evaluate(t => {
        const tg = document.querySelector('.decide-trigger');
        tg.setAttribute('data-tone', t);
        /* wait 带 opacity 脉冲，先把动画关掉再截，否则两次截图必然不同（那是动画不是 dash）。 */
        const d = tg.querySelector('.decide-dot');
        d.style.animation = 'none';
      }, tone);
      await page.waitForTimeout(60);
      return page.screenshot({ clip: dotClip, animations: 'disabled' });
    };
    const w1 = await shot('wait'), w2 = await shot('wait');
    const i1 = await shot('info'), i2 = await shot('info');
    await page.evaluate(() => {
      const tg = document.querySelector('.decide-trigger');
      tg.removeAttribute('data-tone');
      tg.querySelector('.decide-dot').style.animation = '';
      render();
    });
    add(`像素判据可复现（${dotClip.size} 档 info 两次截图逐字节一致）`,
      i1.equals(i2), `${i1.length}B / ${i2.length}B`);
    add(`像素判据 ${dotClip.size} 档 wait 真的有缺口（与 info 实线不同图）`,
      !w1.equals(i1), `wait=${w1.length}B info=${i1.length}B`);
    add(`像素判据 ${dotClip.size} 档 wait 自身两次也一致（差异来自 dash，不是抖动）`,
      w1.equals(w2), `${w1.length}B / ${w2.length}B`);
  } else add('像素判据（找不到 .decide-dot）', false, 'no dot');

  /* R5 等待态：玩家0 交完名单、玩家1 还没交，切回玩家0 的视角。
     前置：浮层是「唯一把手」——折叠态下阶段面板整个不在 DOM 里（上面像素判据那步
     为了避开浮层投影把浮层收起来了），所以先在就绪状态上把浮层点开，再找控件。
     并显式断言「确实进了 commit 步」：不然一旦哪步没点动，后面 7 条等待态断言会
     全体变成「tone=todo」的连环假红，看不出是哪一步坏的。 */
  const openPop = async () => {
    const t = page.locator('.decide-trigger[aria-expanded="false"]').first();
    if (await t.count()) { await t.click(); await page.waitForTimeout(220); }
  };
  await openPop();
  const moveBtn = page.locator('[data-quest="move"]:not([disabled])').first();
  if (await moveBtn.count()) await moveBtn.click();
  await page.waitForTimeout(450);
  const enteredCommit = await page.evaluate(() => state.questing && state.questing.step);
  add('R5 前置：从投入前窗口进入派遣（commit）步', enteredCommit === 'commit', `step=${enteredCommit}`);
  await submitPlayer0(page);
  await page.evaluate(() => { handView = 0; render(); });
  await page.waitForTimeout(300);
  s = await snap(page);
  add('R5 等待态 tone=wait', s.hasTrigger && s.tone === 'wait', `tone=${s.tone}`);
  add('R5 等待态 act=0 且不自动展开（.decide-pop 不在 DOM）', s.act === '0' && !s.hasPop, `act=${s.act} pop=${s.hasPop}`);
  add('R5 等待态状态点是空心 + 虚线', !!s.dot && s.dot.style === 'dashed', s.dot ? s.dot.style : 'no dot');
  add('R5 等待态闪 2 次就停（animation-iteration-count=2）', !!s.dot && s.dot.iter === '2', s.dot ? s.dot.iter : 'no dot');
  add('R5 等待态不抢焦点（activeElement 不是触发条）', !s.focusIsTrigger, s.focusIsTrigger ? '抢了焦点' : 'ok');
  add('R5 等待态标题是陈述句且点名到具体玩家', /等待 · 玩家\d/.test(s.bodyText), (s.bodyText.match(/等待 · [^ ]*/) || [''])[0]);
  /* 手动点开之后只允许一颗「切换到别人视角」的 ghost 控件，不许有 primary */
  await page.locator('.decide-trigger').first().click();
  await page.waitForTimeout(250);
  s = await snap(page);
  const switchBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.decide-pop button')]
      .filter(x => /切换到/.test(x.textContent || ''));
    return b.map(x => ({ text: x.textContent.trim(), primary: x.classList.contains('primary') }));
  });
  add('R5 等待态可手动展开，且体内的「切换到…视角」不是 primary',
    s.hasPop && switchBtn.length === 1 && switchBtn.every(x => !x.primary),
    switchBtn.map(x => x.text).join(' / ') || 'missing');
  /* 等待态 expand 之后不许出现「跳过别人窗口」的入口 */
  add('R5 等待态体内没有「跳过」类控件（跳过别人的窗口＝替他做决定）',
    !/跳过/.test(s.popText), s.popText.slice(0, 60));

  /* R1 回执（M17）：用测试替身把 QuestUI 的只读块置空，逼出 DecisionUI 的回执分支。
     回执 act=0 → 浮层默认不在 DOM，所以先断言「不自动展开」，再手动点开读正文。 */
  const receipt = await page.evaluate(() => {
    QuestUI.__save = { panel: QuestUI.panel, picker: QuestUI.picker, reveal: QuestUI.revealCard };
    QuestUI.panel = () => ''; QuestUI.picker = () => ''; QuestUI.revealCard = () => '';
    const q = state.questing;
    q.step = 'commit'; q.deploymentLocked = false; q.completed = false;
    const all = q.order || state.players.map(p => p.id);
    q.order = all;
    q.deployments = {};
    for (const id of all) q.deployments[id] = { ids: [], confirmed: true };
    render();
    const tg = document.querySelector('.decide-trigger');
    const pop = document.querySelector('.decide-pop');
    return {
      tone: tg ? tg.dataset.tone : null,
      act: tg ? tg.dataset.act : null,
      popInDom: !!pop,
      bodyButtons: document.querySelectorAll('.decide-body button').length,
      triggerText: tg ? (tg.innerText || '').replace(/\s+/g, ' ') : '',
    };
  });
  add('R1 回执 tone=info（灰空心圆，不是待办金点）', receipt.tone === 'info', `tone=${receipt.tone}`);
  add('R1 回执不自动展开（act=0 且无浮层）', receipt.act === '0' && !receipt.popInDom, `act=${receipt.act} pop=${receipt.popInDom}`);
  await page.locator('.decide-trigger').first().click().catch(() => {});
  await page.waitForTimeout(220);
  const receiptBody = await page.evaluate(() => {
    const body = document.querySelector('.decide-pop .decide-body');
    const out = {
      buttons: body ? body.querySelectorAll('button').length : -1,
      text: body ? (body.innerText || '').replace(/\s+/g, ' ') : '',
    };
    /* 用完立刻恢复真身，别把替身留给后面的断言 */
    QuestUI.panel = QuestUI.__save.panel; QuestUI.picker = QuestUI.__save.picker; QuestUI.revealCard = QuestUI.__save.reveal;
    delete QuestUI.__save;
    render();
    return out;
  });
  add('R1 回执体内 0 个 button（含「取消确认」也不许有）', receiptBody.buttons === 0, `n=${receiptBody.buttons}`);
  add('R1 回执逐个列名 + 还差谁 / 下一步是什么',
    /✓/.test(receiptBody.text) && /横置/.test(receiptBody.text) && /下一步/.test(receiptBody.text),
    receiptBody.text.slice(0, 100));

  await page.screenshot({ path: path.join(OUT, 'window-rules-2p.png') });
  await ctx.close();

  /* ── 减少动效：wait 的闪点必须停住 ─────────────────────────────── */
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errors.push('rm: ' + String(e && e.message || e)));
  await boot(page2, 1);
  await page2.locator('button[data-action="endPhase"]').click();
  await page2.waitForTimeout(500);
  const rm = await page2.evaluate(() => {
    const tg = document.querySelector('.decide-trigger');
    const dot = tg && tg.querySelector('.decide-dot');
    if (!dot) return null;
    const old = tg.getAttribute('data-tone');
    tg.setAttribute('data-tone', 'wait');
    const c = getComputedStyle(dot);
    const out = { anim: c.animationName, style: c.borderStyle };
    if (old === null) tg.removeAttribute('data-tone'); else tg.setAttribute('data-tone', old);
    return out;
  });
  add('prefers-reduced-motion:reduce 下 wait 点不闪（animation-name=none）',
    !!rm && rm.anim === 'none' && rm.style === 'dashed', rm ? `${rm.anim}/${rm.style}` : 'no dot');
  await ctx2.close();

  await browser.close();
  const fails = checks.filter(c => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (errors.length) { console.log('PAGEERRORS:\n' + errors.join('\n')); process.exit(2); }
  console.log(`${checks.length - fails.length}/${checks.length} 通过`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
