/* 由 report.json 生成 REPORT.md —— 数字一律从实测文件里读，不手抄。
 *
 *   node scripts/visual-acceptance-report.cjs
 *
 * REPORT.md 的「判据 v2」章节是本脚本里的常量（口径的唯一出处）；
 * 结果章节全部来自 report.json；buildStable=false 时整轮标红并写明作废。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs', 'browser-acceptance', 'vaccept');
const r = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));

const IDS = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08', 'V09', 'V10', 'V10-最坏内容', 'V11-1', 'V11-2', 'V11-3'];
const L = [];
const P = s => L.push(s || '');

const build = r.buildMd5 || '(未记录)';
const stable = r.buildStable !== false;

const cell = (v, id) => {
  const hits = Object.entries(v.verdicts || {}).filter(([k]) => k.startsWith(id + '@'));
  if (!hits.length) return '—';
  return hits.some(([, x]) => !x.ok) ? '**F**' : 'P';
};
const worst = (v, id) => {
  const hits = Object.entries(v.verdicts || {}).filter(([k]) => k.startsWith(id + '@'));
  return hits.find(([, x]) => !x.ok) || hits[0] || null;
};

/* ── 头部 ─────────────────────────────────────────────────────────── */
P('# V01–V11 视觉验收报告');
P();
P('> 本文件的**结果章节由 `scripts/visual-acceptance-report.cjs` 从 `report.json` 生成**，数字不手抄。');
P('> 判据章节是口径的唯一出处，改口径请先改脚本常量，再重跑。');
P();
P('## 0. 适用范围');
P();
P('- 构建：`index.html` md5 `' + build + '`' + (r.buildMd5End ? ' → 结束时 `' + r.buildMd5End + '`' : ''));
P('- 构建稳定性：' + (stable ? '**运行前后一致**（结果可用）' : '**运行中被重建，本轮整体作废**（`buildStable=false`）'));
P('- 采集时间：' + (r.startedAt || '?'));
P('- 浏览器：' + (r.executablePath || '?') + '（headless, --no-sandbox）');
P('- 视口：' + (r.viewports || []).map(v => v.viewport).join(' / '));
P('- 状态构造：引擎 `submitDeployment` / `approveDeployment` + `render()`，A/B/C1/C2/D 五态；320×568 档为四人局 C2（pill「已确认 3/4」）。');
P();
if (!stable) {
  P('> **本轮不可用于判定。** `index.html` 在运行过程中被重建（`build.py` 先截断再写入，中途读到空文件时 md5 为 `d41d8cd9…`）。');
  P('> 修复办法：等构建完成后重跑；脚本启动/结束各取一次 md5，不一致即作废。');
  P();
}

/* ── 判据（常量，口径唯一出处） ───────────────────────────────────── */
P('## 1. 判据 v2（现行）');
P();
P('| 编号 | 判定式（实测值一律入报告，不写形容词） |');
P('|---|---|');
const CRIT = [
  ['**V01**', "`!body.innerText.includes('派遣交流与缓冲期')` 且 `.quest-deploy` 纵向块数 ∈ {3,4}（A/B/C1/C2 = 4、D = 3）。块数是视觉口径；**结构段另有 4 段口径（IA），两者不可互相断言**"],
  ['**V02**', '`.decide-box` 内实心按钮（`bg ∈ {rgb(54,88,66), rgb(63,106,72)}` 且未禁用）≤ 1；ghost 按钮 `text-decoration: underline dotted`'],
  ['**V03**', 'A 态 `input[type=checkbox]` > 0；B/C1/C2 态 = 0 且 `innerText` 含「已提交：」≥1；D 态不适用'],
  ['**V04**', '有控态：`select + [role=radiogroup] === 1` 且 `.badge === 0`；**D 态定值 0/0/0**（`select` 0、`radiogroup` 0、`[data-quest]` 0）'],
  ['**V05**', '`innerText` 中「已投入：」出现次数：A/B/C1/C2 = 0，D = 1'],
  ['**V06**', "`!body.innerText.includes('暂定意志')`"],
  ['**V07**', '有控态：`details` ≥1 且正文 ≥20 字、`details` 外可见 `<p>` 文本 ≤12 字；**D 态定值 `details === 0`**'],
  ['**V08**', '全页绿钮（按计算样式数，**不看 `disabled`**）≤ 1，且全部未禁用'],
  ['**V09**', '`.door-go:disabled` 的 `backgroundColor` 非绿系（期望 `rgb(236,234,224)`）。**先判 V09，V08 才有意义**'],
  ['**V10**', '`.r0-num` **文本渲染矩形**（`Range.getClientRects()`）完整落在 `.decide-box` 内容盒内（左右各 ≤1px）、`num.right ≤ r0.right+1`、文本单行。各态都跑，**另必须跑 320×568 四人局 C2**。旧口径（`scrollWidth−clientWidth`、`Δ右`）在当前实现下恒真，已撤，理由见 2.3'],
  ['**V10-最坏内容**', '**仅窄屏（w ≤ 600）**：把 `.r0-num` 文本换成最宽可达值（意志 99 / 威胁 50）量文字绘制宽，要求 `需要 ≤ 可用`（可用 = 面板内容右 − num 左缘）。两个量彼此独立，不是同一元素自比；宽屏不设此门（可用以百 px 计，设了恒真）'],
  ['**V11-1**', '`.decide-body` 与 `.decide-box` 均无横向滚动。**对 R0 内部截断是盲的**'],
  ['**V11-2**', '`.r0` 盒高 `h ≤ 26`，实测入报告（预期 23~24：`.state-pill` = 11.5×1.7 + 边框 2 + padding 2 = 23.55 撑高）。**22 只是标签行高，不是盒高**'],
  ['**V11-3**', '`pill.left ≥ r0.left − 1` 且 `num.right ≤ r0.right + 1`。**对内部截断是盲的**，不构成 R0 的双保险'],
];
for (const [id, t] of CRIT) P('| ' + id + ' | ' + t + ' |');
P();
P('**判定顺序与归口**');
P();
P('1. **V09 → V08**：V09 不通过时，`disabled` 绿钮仍在屏幕上，V08 的计数没有意义。V08 若只用 `:not([disabled])` 过滤，会**结构性漏掉**这颗。');
P('2. **V10 管 R0 内部谁被牺牲，V11 管容器层溢出与祖先裁切**。两条都写「R0 无溢出」会让人以为是双保险，实际只有 V10 有效。');
P('3. **块数 ≠ 结构段**：视觉块数 A/B/C1/C2=4、D=3（D 态操作行退化为只读）；IA 结构段恒为 4（R0 状态行含玩家切换、R2 操作行、R3 提交点、R4 名单明细）。禁止用块数断言结构。');
P();

/* ── 结果 ─────────────────────────────────────────────────────────── */
P('## 2. 结果');
P();
P('| 视口 | ' + IDS.join(' | ') + ' |');
P('|---|' + IDS.map(() => '---').join('|') + '|');
for (const v of r.viewports || []) {
  if (v.fatal) { P('| ' + v.viewport + ' | ' + IDS.map(() => 'FATAL').join(' | ') + ' |'); continue; }
  P('| ' + v.viewport + ' | ' + IDS.map(id => cell(v, id)).join(' | ') + ' |');
}
P();
for (const v of r.viewports || []) {
  if (v.fatal) P('- **' + v.viewport + ' FATAL**：`' + v.fatal + '`');
}
P();
P('（`F` = 存在不通过态，明细见下；`—` = 该视口未采集该项）');
P();

/* 失败明细 */
P('### 2.1 不通过项明细');
P();
let anyFail = false;
for (const v of r.viewports || []) {
  for (const [k, x] of Object.entries(v.verdicts || {})) {
    if (x.ok) continue;
    anyFail = true;
    P('- **' + v.viewport + ' · ' + k + '**：`' + JSON.stringify(x.measured) + '`　期望 ' + x.expect);
  }
}
if (!anyFail) P('无。');
P();

/* 块数 */
P('### 2.2 各态纵向块数（V01）');
P();
P('| 视口 | A | B | C1 | C2 | D |');
P('|---|---|---|---|---|---|');
for (const v of r.viewports || []) {
  const d = {}; for (const s of v.states || []) d[s.tag] = s.blocks;
  P('| ' + v.viewport + ' | ' + ['A', 'B', 'C1', 'C2', 'D'].map(t => d[t] === undefined ? '—' : d[t]).join(' | ') + ' |');
}
P();

/* V10 */
P('### 2.3 V10 · `.r0-num` 不被牺牲（判据 v3，改用文本渲染矩形）');
P();
P('| 视口 | 态 | num 文本 | 文本右缘 | 面板内容右 | 右越界 | 左越界 | 文本行数 | num 右 | r0 右 |');
P('|---|---|---|---|---|---|---|---|---|---|');
for (const v of r.viewports || []) {
  for (const [k, x] of Object.entries(v.verdicts || {})) {
    if (!k.startsWith('V10@')) continue;
    const m = x.measured || {};
    P('| ' + v.viewport + ' | ' + k.split('@')[1] + ' | ' + (m.文本 || '') + ' | ' + (m.文本右缘 ?? '') + ' | ' + (m.面板内容右 ?? '') + ' | ' + (m.右越界 ?? '') + ' | ' + (m.左越界 ?? '') + ' | ' + (m.文本行数 ?? '') + ' | ' + (m.num右 ?? '') + ' | ' + (m.r0右 ?? '') + ' |');
  }
}
P();
P('**为什么撤掉旧三条**：当前实现把 `.r0-num` 从 `overflow:hidden + ellipsis` 改成 `flex:none`，子元素不再自己裁切，`scrollWidth − clientWidth` 恒为 0；`.r0` 是 shrink-to-fit、num 是最后一个 flex 项，`num.right` 与 `r0.right` 由构造相等。负向对照（320 档内联挤出 60px / 130px）下旧三条读数仍是 `0 / 1 / 0`，而文本实际越界 +40.36 / +110.36 —— 恒真的断言等于假断言。');
P();

/* V10-最坏内容（仅窄屏） */
const wc = [];
for (const v of r.viewports || []) {
  for (const [k, x] of Object.entries(v.verdicts || {})) {
    if (!k.startsWith('V10-最坏内容@')) continue;
    wc.push('| ' + v.viewport + ' | ' + k.split('@')[1] + ' | ' + (x.ok ? 'PASS' : '**FAIL**') + ' | ' + ((x.measured || {}).当前文本 ?? '') + ' | ' + ((x.measured || {}).最坏文本 ?? '') + ' | ' + ((x.measured || {}).可用 ?? '') + ' | ' + ((x.measured || {}).需要 ?? '') + ' | ' + ((x.measured || {}).余量 ?? '') + ' |');
  }
}
if (wc.length) {
  P('**最坏可达内容**（窄屏专用门）：数字随剧本状态变化，当前这一局的文本小不代表装得下。');
  P();
  P('| 视口 | 态 | 结论 | 当前文本 | 最坏文本 | 可用 | 需要 | 余量 |');
  P('|---|---|---|---|---|---|---|---|');
  for (const l of wc) P(l);
  P();
}
P('320 档的 `右越界` 数值已并入上表，**不另设第二道门**：它与 V10 是同一谓词，重复计数会把一次失败记成两次。');
P();

/* V08 / V09 */
P('### 2.4 V08 / V09（一屏一绿）');
P();
P('| 视口 | 态 | 绿钮数（含禁用） | 清单 | door.disabled | door.bg |');
P('|---|---|---|---|---|---|');
for (const v of r.viewports || []) {
  const tags = [...new Set(Object.keys(v.verdicts || {}).map(k => k.split('@')[1]))];
  for (const t of tags) {
    const g = v.verdicts['V08@' + t], d = v.verdicts['V09@' + t];
    if (!g && !d) continue;
    const gm = (g && g.measured) || {}, dm = (d && d.measured) || {};
    P('| ' + v.viewport + ' | ' + t + ' | ' + (gm.绿钮 ?? '') + ' | ' + ((gm.清单 || []).join('<br>') || '—') + ' | ' + (dm.disabled ?? '') + ' | ' + (dm.bg || '') + ' |');
  }
}
P();

/* r-head 折行 */
P('### 2.5 `r-head` 折行状态（O1）');
P();
P('| 视口 | 态 | 行数 | 每行成员 |');
P('|---|---|---|---|');
for (const v of r.viewports || []) {
  for (const s of v.states || []) {
    if (!s.rHead) continue;
    P('| ' + v.viewport + ' | ' + s.tag + ' | ' + s.rHead.lines + ' | ' + s.rHead.layout.map((l, i) => 'L' + (i + 1) + ': ' + l.join(' + ')).join('<br>') + ' |');
  }
}
P();

/* 面板位置 */
P('### 2.6 面板与主按钮位置（O2，V11 不判）');
P();
P('| 视口 | 态 | 面板 top | 面板高 | 主按钮 top | 视口高 |');
P('|---|---|---|---|---|---|');
for (const v of r.viewports || []) {
  for (const s of v.states || []) {
    P('| ' + v.viewport + ' | ' + s.tag + ' | ' + (s.panelTop ?? '') + ' | ' + (s.panelH ?? '') + ' | ' + (s.primaryTop ?? '—') + ' | ' + (v.viewport.split('x')[1] || '') + ' |');
  }
}
P();

/* ── 观察项 ───────────────────────────────────────────────────────── */
P('## 3. 观察项（不进入 V 判定）');
P();
P('- **O1 · `r-head` 把「读数」与「换人」塞在同一行**：`.r-head{flex-wrap:wrap;gap:6px 12px}`，`@media(max-width:760px){.r-head>.quest-actors{flex:1 1 100%;order:2}}` —— **≤760px 时「换人」被强制换到第二行**，「读数」留在第一行（见 2.5）。不是纯视觉问题：折行后两者不在相邻位置，用户会以为那是同一个控件组。');
P('- **O2 · 面板头部越出视口（缺陷级，可测量）**：判据 `panel.getBoundingClientRect().top >= 容器可视区 top − 1`，当前为负（见 2.6）。玩家看到的是「标题被切、直接从摘要行开始」。已单立任务 #8；V11 只约束容器溢出与 R0，不判此项。');
P('- **O3 · 窄屏点不动：根因是 `.draw-toast` 全屏遮罩**（`style.css:8` `position:fixed;inset:0;z-index:60`，`pointer-events` 默认 `auto`，`app.js:351` `setTimeout(close,4000)`）。抽牌后 4 秒内整屏吃点击：`click({timeout:1500})` 必红、`click({timeout:15000})` 4.1s 成功、DOM 原生 `el.click()` 43ms 成功；失败瞬间 `elementFromPoint` 命中 `IMG`，叠加栈底为 `div.draw-toast`。手动关掉仍超时，因为 `lastDrawToast` 只记 `rd.id`、不记「用户已关过」，下次 `render()` 会重建遮罩。**判据不写成「点击成功」**：`elementFromPoint(目标中心) === 目标或其子孙` 且 **抽牌后 0ms 与 3500ms 两个时刻都成立**（只判 0ms 会被「反正 4 秒后自动关」蒙过去），T2 = 目标之上不得存在「有绘制痕迹」的层（`elementsFromPoint` 取目标之前的栈，`overlapRatio(层, 目标) ≥ 30%` 且 `背景 alpha>0.02 / 背景图 / backdrop-filter` 且 `opacity>0.02`；**刻意不看 `pointer-events`**，否则 T2 退化成 T1 的复制品）。分母只取目标矩形、不取视口。**判据不点名类名**——点名等于替实现挑修法。组合含义（T1 可点/T2 无压暗）：双绿=正常；T1红=吃点击；T1绿+T2红=可点但仍压暗（最容易做一半）；双红=又挡又吃。实测 Chrome 155 的 `elementsFromPoint` 遵守 `pointer-events`，不会返回 `pointer-events:none` 元素。已建任务 #9；**归因不得写成「sticky unstable」或「偶发」**。');
P('- **O4 · 该浮层「视觉模态、语义非模态」**（任务 #10）：无 `role="dialog"`/`aria-modal`/`aria-label`，不抢焦点、Esc 无效、Tab 会跑到浮层外；4 秒后 `state.resourceDraw` 仍在但无重开入口，`state.log` 里也查不到。**本报告截图均裁剪自 `.decide-box`、不含该浮层**；补全屏截图时请注明，不要按模态控件要求焦点行为。');
P();
P('## 4. 复现');
P();
P('```');
P('cd /c/Users/Administrator/WorkBuddy/魔戒LCG');
P('NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node scripts/visual-acceptance-v.cjs');
P('node scripts/visual-acceptance-report.cjs');
P('```');
P('- 单档：第一条命令末尾加 `1280x800` / `320x568`。');
P('- 截图：`docs/browser-acceptance/vaccept/<视口>-<态>.png`；原始数据：`report.json`（含 `buildMd5` / `buildMd5End` / `buildStable`）。');
P('- **`buildStable=false` 时整轮作废**，不要引用其结论。');

const out = process.argv[2] || 'REPORT.md';
fs.writeFileSync(path.join(dir, out), L.join('\n') + '\n', 'utf8');
console.log(out + ' 已生成（' + L.length + ' 行，构建 ' + build + (stable ? '，稳定' : '，已作废') + '）');
