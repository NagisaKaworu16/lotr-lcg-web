# V01–V11 视觉验收 · 口径与结果

> 本文件分两部分：**判据 v2（现行）** 与 **上一轮实测存档（历史，适用范围见第 0 节）**。
> 不要把第 2 节的表当成「R0 已验证」。

## 0. 适用范围（先读这段）

- 第 2 节的结果采集自构建 `index.html` md5 `4afdef65a6d8ea154f9f40c8ff6bfeba`，五档视口（1440×900 / 1280×800 / 390×844 / 761×600 / 1920×1080）× A/A2/B/C1/C2/D 五态。
- **fe 的 P1（窄屏 R0 数字被截断）与 U18-c 不在该构建内**：`style.css` 里既没有 `@media(max-width:600px){.r0-label → sr-only}`，也没有 `.state-pill{padding:1px 4px}`；`.r0-num` 仍是 `flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis`。
- 因此第 2 节的表 **不覆盖 R0 截断场景**，其中的 V10 用的是**已撤销的判据**（跨态比右缘），**不计为通过**。R0 的唯一判据是第 1 节的 V10 三条。
- 待前端第二轮提交后，按新 `index.html` md5 重跑（含 320×568 四人局 C2 档），届时第 2 节整体作废。

## 1. 判据 v2（现行）

| 编号 | 判定式（实测值一律入报告，不写形容词） |
|---|---|
| **V01** | `!body.innerText.includes('派遣交流与缓冲期')` 且 `.quest-deploy` 纵向块数 ∈ {3,4}（A/B/C1/C2 = 4、D = 3）。块数是视觉口径；**结构段另有 4 段口径（IA），两者不可互相断言** |
| **V02** | `.decide-inline` 内实心按钮（`bg ∈ {rgb(54,88,66), rgb(63,106,72)}` 且未禁用）≤ 1；ghost 按钮 `text-decoration: underline dotted` |
| **V03** | A 态 `input[type=checkbox]` > 0；B/C1/C2 态 = 0 且 `innerText` 含「已提交：」≥1；D 态不适用 |
| **V04** | 有控态：`select + [role=radiogroup] === 1` 且 `.badge === 0`；**D 态定值 0/0/0**（`select` 0、`radiogroup` 0、`[data-quest]` 0） |
| **V05** | `innerText` 中「已投入：」出现次数：A/B/C1/C2 = 0，D = 1 |
| **V06** | `!body.innerText.includes('暂定意志')` |
| **V07** | 有控态：`details` ≥1 且正文 ≥20 字、`details` 外可见 `<p>` 文本 ≤12 字；**D 态定值 `details === 0`** |
| **V08** | 全页绿钮（按计算样式数，**不看 `disabled`**）≤ 1，且全部未禁用 |
| **V09** | `.door-go:disabled` 的 `backgroundColor` 非绿系（期望 `rgb(236,234,224)`）。**先判 V09，V08 才有意义** |
| **V10** | `.r0-num` 自身三条：`scrollWidth − clientWidth ≤ 1`（未截断）、`getClientRects().length === 1`（未折行）、`|num.right − (r0.right − paddingRight)| ≤ 1`（贴右）。各态都跑，**另必须跑 320×568 四人局 C2**（`num.clientWidth ≥ 128`） |
| **V11-1** | `.decide-body` 与 `.decide-inline` 均无横向滚动（`scrollWidth === clientWidth`）。**对 R0 内部截断是盲的**（`min-width:0` + `ellipsis` 把溢出吸收进子元素） |
| **V11-2** | `.r0` 盒高 `h ≤ 26`，实测入报告（预期 23~24：`.state-pill` = 11.5×1.7 + 边框 2 + padding 2 = 23.55 撑高）。**22 只是标签行高，不是盒高**；为凑 22 去缩 pill 字号或内边距属违规 |
| **V11-3** | `pill.left ≥ r0.left − 1` 且 `num.right ≤ r0.right + 1`。**对内部截断是盲的**，不可当 R0 的双保险 |

### 判定顺序与归口

1. **V09 → V08**：V09 不通过时，`disabled` 绿钮仍在屏幕上，V08 的计数没有意义。反过来 V08 若只用 `:not([disabled])` 过滤，会**结构性漏掉**这颗——那是判据自我豁免，不是实现合格。
2. **V10 管 R0 内部谁被牺牲，V11 管容器层溢出与祖先裁切**。两条都写「R0 无溢出」会让人以为是双保险，实际只有 V10 有效——「看起来有两条、其实只有一条」比只有一条更危险。

## 2. 上一轮实测存档（构建 `4afdef65…`，历史，见第 0 节适用范围）

| 视口 | V01 | V02 | V03 | V04 | V05 | V06 | V07 | V08 | V09 | V10 | V11-1 | V11-2 | V11-3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1440×900 | P | P | P | P | P | P | P | P | P | 判据已撤 | P | 未采 | P |
| 1280×800 | P | P | P | P | P | P | P | P | P | 判据已撤 | P | 未采 | P |
| 390×844 | P | P | P | P | P | P | P | P | P | 判据已撤 | P | 未采 | P |
| 761×600 | P | P | P | P | P | P | P | P | P | 判据已撤 | P | 未采 | P |
| 1920×1080 | P | P | P | P | P | P | P | P | P | 判据已撤 | P | 未采 | P |

各态块数（V01）在该构建下五档一致：A/B/C1/C2 = 4（`r-head | 名单区 | 主操作 | 规则与名单`），D = 3（`r-head | 已投入 | 规则`）。

**块数与结构段是两套口径，不可互相断言**（team-lead 2026-10-27 冻结）：

- **结构段（IA 口径，ux 维护）= 4**：R0 状态行（pill + 计数 + 玩家切换，即原 R0 + R1 合并）、R2 操作行、R3 提交点、R4 名单明细；`quest-rules` 独立不计段。
- **视觉块数（本报告口径）**：A/B/C1/C2 = 4、D = 3（差的一块是 D 态操作行退化为只读状态行，R3 提交点不存在）。
- **禁止用块数断言结构**——否则后来的人会以为结构是五块，去 `r-head` 里找那个不存在的第五块。

## 3. 观察项

- **O1 · `r-head` 里「读数」与「换人」同处一行且会折行**（结构性事实，非偏好）：`.r-head{display:flex;gap:6px 12px;flex-wrap:wrap}`，且 `@media(max-width:760px){.r-head>.quest-actors{flex:1 1 100%;order:2}}`。即 **≤760px 时 `.quest-actors` 被强制换到第二行**，此时「读数（r0）」在第一行、「换人」在第二行；1440 档两者同行相邻、间距 12px。正式跑会把每档的折行行数与每行成员写进 `report.json` 的 `states[].rHead`。
- **O2 · 面板头部越出视口（缺陷级，不是视觉偏好）**：390×844 时 `.decide-inline` top = −24~−58，761×600 时 = −122~−129，面板高 224–337。判据 `panel.getBoundingClientRect().top >= 容器可视区 top − 1` 当前为负。玩家看到的是「标题被切、直接从摘要行开始」。已单立任务 #8；V11 不判它（V11 只约束容器溢出与 R0）。
- **O3 · 窄屏点不动：根因已定性为 `.draw-toast` 全屏遮罩**（`style.css:8`：`position:fixed;inset:0;z-index:60`，`pointer-events` 默认 `auto`，`app.js:351` 的 `setTimeout(close,4000)`）。抽牌后 4 秒内**整屏吃点击**：390×844 上 `click({timeout:1500})` 必红、`click({timeout:15000})` 4.1s 后成功、DOM 原生 `el.click()` 43ms 成功；失败瞬间 `elementFromPoint` 命中 `IMG`，叠加栈底是 `div.draw-toast`。
  - 手动关掉后仍会超时，是因为 `showDrawToast()` 里 `lastDrawToast` 只记 `rd.id`、不记「用户已关过这一张」，下一次 `render()` 会把遮罩重建。
  - **判据不能写成「点击成功」**（会被超时长度左右），要写行为断言；且**不得点名类名**——点名等于判据知道实现细节：改个类名失效、换个浮层漏掉、把 `.draw-toast` 拆成两层也漏掉。这与「会不会误伤某个修法」无关。
  - **T1 / T2 互补，分工不得重叠**（原写 P1/P2，与 fe 的「P1 = 窄屏 R0 截断」撞名，已改前缀）：
    - **T1 管「点得到」**：`elementFromPoint(cx,cy) === target || target.contains(...)`。`pointer-events:none` 的层在这条里天然无害。
    - **T2 管「看起来被压暗」**：目标之上是否有**有绘制痕迹**的层。**T2 不过滤 `pointer-events`**——要抓的正是「不吃点击但仍在压暗」这个中间态；一旦过滤，T2 就退化成 T1 的复制品。
    ```js
    const stack = document.elementsFromPoint(cx, cy);
    const i = stack.findIndex(el => el === target || target.contains(el));
    if (i === -1) return fail('目标未被命中：栈里没有它');   // slice(0,-1) 会把整套栈当 blocker 报出来
    const tr = target.getBoundingClientRect();
    const blockers = stack.slice(0, i).filter(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      const big   = overlapRatio(r, tr) >= 0.3;                 // 分母只取目标矩形，不取视口
      const paint = alphaOf(s.backgroundColor) > 0.02 || s.backgroundImage !== 'none'
                 || (s.backdropFilter && s.backdropFilter !== 'none');
      const vis   = Number(s.opacity) > 0.02 && s.visibility !== 'hidden' && s.display !== 'none';
      return big && paint && vis;                               // 刻意不看 pointer-events
    });
    expect(blockers).toEqual([]);
    ```
    `overlapRatio(r, tr) = 交叠面积 / 目标矩形面积`。**不要用视口面积做分母**——T2 要回答的是「目标位置上是否压了一层」，与目标之外的视口面积无关：半屏抽屉压在按钮上时重叠可能近 100%，按视口算只有 60%；而角落里的整屏 scrim 若没压到按钮就不该判红。用视口面积去近似「有没有挡住目标」，是用错分母。
  - **两个判据的组合要给名字**，否则读报告的人还要自己推：
    | T1 可点 | T2 无压暗 | 结论 |
    |---|---|---|
    | ✅ | ✅ | 正常 |
    | ❌ | ✅ | **吃点击**（典型：`pointer-events:auto` 的全屏遮罩） |
    | ✅ | ❌ | **可点但仍压暗**（典型：改了 `pointer-events:none` 却没收 scrim——最容易做一半的那条） |
    | ❌ | ❌ | **又挡又吃**（最坏，当前 `.draw-toast` 属于这格） |
  - 实测（Chrome 155 headless，400×300 最小复现）：遮罩 `pointer-events:auto` 时 `elementFromPoint=ov`、`elementsFromPoint=[ov, under, HTML]`；改成 `pointer-events:none` 后 `elementFromPoint=under`、`elementsFromPoint=[under, HTML]`——**`elementsFromPoint` 遵守 `pointer-events`，不会返回 `pointer-events:none` 的元素**（两者同走 hit-testing，没有分叉）。所以「点名 `.draw-toast`」并不会误伤 `pointer-events:none` 修法；换掉它的理由是上面那条：判据不该知道实现细节。
- **O4 · 该浮层是「视觉模态、语义非模态」**（任务 #10）：无 `role="dialog"` / `aria-modal` / `aria-label`，不抢焦点、Esc 无效、Tab 会跑到浮层外（无焦点圈定）；4 秒后 `state.resourceDraw` 仍在 state 里、但无任何重开入口，`state.log` 里也查不到这次抽牌。**本报告所有截图均裁剪自 `.decide-inline`，不含该浮层**；若后续有人补全屏截图，请注明它是视觉模态、语义非模态，不要按模态控件要求焦点行为。

## 4. 复现

```
cd /c/Users/Administrator/WorkBuddy/魔戒LCG
NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node scripts/visual-acceptance-v.cjs
```
- 单档：末尾加 `1280x800` 或 `320x568`。
- 输出：`docs/browser-acceptance/vaccept/<视口>-<状态>.png`、`report.json`（含 `buildMd5` / `buildMd5End` / `buildStable`）。**`buildStable=false` 时整轮结果作废**——第 2 节就是在踩到「构建在运行中被重建」之后重新取数的。
