# 决策窗口规范 · 什么时候该问人

适用代码库：`C:/Users/Administrator/WorkBuddy/魔戒LCG`
适用文件：`desktop-ui.js`（`DecisionUI`）、`window-ui.js`、`window-engine.js`、`phase-log.js`、`style.css`
配套：`docs/design/DESIGN_SYSTEM.md`（令牌与配色，本文件不重复定义，只引用）
版本：v1 · 体验设计 · 本文件只定**规则与语义**，不含配色与排版实现细节

---

## 0. 一句话结论

**时机到了 ≠ 要问你。** 窗口存在的唯一理由是「引擎自己下不了结论，必须由人点一下」。
其余一律：写进日志、挂成别人的附属信息，或者什么都不显示。

判断链（任何一处不成立，窗口就不存在）：

```
引擎停在这个时机
  └─ 有「必须由人完成的一步」吗？（候选 / 具名输入 / 人手点的推进）
       ├─ 没有 → 窗口不存在（只写日志或挂成回执）
       └─ 有 → 窗口存在
            ├─ 这一步在 phase-log 里是 timing:'forced' → forced 窗口（无窗口级跳过）
            ├─ 本窗口第一个输入属于别的座位 → 等待态（只闪点，不弹层）
            └─ 否则 → todo 窗口（可选语义，必给跳过）
```

---

## 1. 五个术语（后面所有判定都只用这五个词）

| 术语 | 定义 | 代码锚点 |
|---|---|---|
| **窗口（window）** | 引擎停在某个时机、等玩家输入的状态 | `(s.round, s.phase, s.phaseLogStep, s.phaseLogWindowKey)` |
| **候选（candidate）** | 玩家此刻**可以**做的具体动作（打事件、用能力、领目标） | `WindowEngine.options(s).list` 里 `muted!==true` 的项 |
| **具名输入（named input）** | 引擎点名要的一个值（选谁防御、名单、确认与否） | `s.pending`、`R.choiceSpec(s)`、`q.deployments[pid]` 未确认、`c.proposals` 未批准 |
| **推进（advance）** | 玩家点一下让引擎继续算的按钮（不产生任何行动） | 阶段面板里的 primary，如「开始投入角色 →」 |
| **回执（receipt）** | 没有输入要做，但玩家需要知道「正在发生什么」 | `phasePanel` 的只读状态卡（见 §7.3） |

> **「有候选」不等于「有按钮」，「无候选」也不等于「窗口不存在」。** 窗口存在 ⇔ 存在**必须由人完成的一步**（候选 ∨ 具名输入 ∨ 推进）。这条区分是整份规范的基石：把它简化成 `actionable(body)` 就会出现「只剩一颗推进按钮时窗口消失、人卡死」或「只读回执自动弹层盖住牌桌」两种事故。

---

## 2. 五条规则的落地定义

### R1 无候选则窗口根本不存在

**判定条件**
```js
// DecisionUI.pending(s,pid) 的唯一契约：返回 null ⇔ 本时机没有任何必须由人完成的一步
mustAsk = candidates.length>0 || namedInput(s,pid) || humanAdvance(s,pid)
if(!mustAsk) return null;
```
- `candidates` = `WindowEngine.options(s).list.filter(o=>!o.muted)`
- `namedInput` = `s.pending.length>0 || !!ScenarioEngine.planning.choiceSpec(s) || 名单未提交/未确认/未放弃且轮到我`
- `humanAdvance` = 本阶段面板里存在未 `disabled` 的 `<button>`（**只作兜底**，见 §7.2）

**渲染后果**
- `DecisionUI.html()` 返回 `''`：不渲染 `.decide-box`，**零高度、零占位**（现在 `.decide-box{position:relative;margin:0 0 8px}` 保留即可，条件是节点不出现）。
- `pop` 状态重置为 `{key:'',open:false}`（现在已有）。

**反例（不许这样做）**
- ❌ 为了「让玩家知道现在没事做」渲染一张空面板或一颗 `disabled` 按钮。桌面上放一颗永远点不动的按钮＝故障信号。
- ❌ 把 `blocked`（在场但用不了 + 理由）单独开一个窗口。它属于 R2，只能作为已有窗口的 `<details>` 附属块。
- ❌ 在等待态里塞「稍候」类空 `<p>` 撑起一扇窗。

---

### R2 纯被动 / 骑乘式不单独开会话

**判定条件**
- **纯被动**：`timingOf(s)` ∈ `'trigger' | 'step'` **且** `candidates.length===0` **且** 无 `namedInput`。典型：1.1 重置英雄、1.2 获得资源、1.3 抽牌、3.3 任务结算、7.2 重置卡牌、4.1 选择地点（无人可选时）。
- **骑乘式**：本身不是决策，只是对另一个决策的补充说明。清单封闭为四类：
  1. `WindowEngine.options(s).blocked`（在场但不能用 + 中文理由）
  2. 名单进度（「已确认 1/2 人」）
  3. 剩余量（「剩 3 张」「威胁 7」）
  4. 本步骤结算摘要（「敌人造成 2 伤害」）

**渲染后果**
- 纯被动：只写 `s.log`（已有），界面最多在操作条留一句 `.small.muted` 摘要，**不产生 `.decide-trigger`**。
- 骑乘式：只能作为**已有窗口体内**的 `<details class="...">` 或 `<p class="small muted">`（`window-ui.js` 的 `.window-blocked` 已经是正确形态），或作为触发条右侧的 `.decide-hint` 胶囊（已有）。

**反例**
- ❌ 给 1.3「抽牌」开一扇窗让人点「确认」——规则书写的是自动结算，没有 `may`。
- ❌ 把 `blocked` 列表挂在触发条外侧自成一个 `section`。
- ❌ 用骑乘式内容冒充 `namedInput`：`blocked.length>0` 不能成为「窗口存在」的理由。

---

### R3 强制 vs 可选必须可辨

**判定条件（唯一锚点：`phase-log.js` 的 `timing`）**
```js
/* window 层新增（不改引擎），放在 desktop-ui.js 顶部 */
const STEP_ALIAS = {                     // 引擎 step 名 → phase-log 窗口 key
  4:{ optional:'beforeChecks' },
  5:{ attackChoice:'enemyAction', defenderResponses:'enemyAction',
      damageChoice:'enemyAction', shadowWindow:'shadows', shadowEffects:'shadows' },
};
function timingOf(s){
  try{
    let k = PhaseLog.stepKey(s);                       // 已有
    if(!k) return 'step';
    const g = PhaseLog.WINDOWS[s.phase];               // WINDOWS[i] 的 i 就是 s.phase
    const hit = g && g.windows.find(w => w.key === (STEP_ALIAS[s.phase]?.[k] || k));
    return hit ? hit.timing : 'step';                  // action|trigger|forced|step
  }catch(e){ return 'step'; }
}
const isForced = s => timingOf(s) === 'forced';
```
现成 5 个 forced 锚点：**3.2 探查区 / 5.2 交战检定 / 6.1 敌人攻击 / 6.3 暗影结算 / 7.3 回合结束**。

> ⚠️ 一处必须同步修正：`phase-log.js` 里 **5.1 `beforeChecks` 标成 `'step'`，但引擎在这一步开放行动窗口**（`encounter-ui.js` 的 `['beforeChecks','afterChecks']` 分支给能力按钮）。按本规范它应是 `timing:'action'`、标签「交战前行动」。改一个字符，属于显示元数据，不动引擎。

**渲染后果（三处必须同时变）**

| | forced 窗口 | optional 窗口 |
|---|---|---|
| 触发条 `data-tone` | `forced` | `todo` |
| 状态点形状 | **实心方块**（`border-radius:1px`，9×9） | 圆点（现状） |
| 标题前缀 | `强制 · ` | 无 |
| 主按钮 | `结算〈本步名〉 →`（唯一推进） | `〈本步名〉 →` 或窗口推进 |
| 窗口级跳过 | **禁止**（无「本次跳过」汇总、无「全队跳过本窗口」） | **必须有**，见 §8 |
| 候选级跳过 | **允许**（「这个能力我不用」≠「跳过这一步」） | 允许 |
| 空态文案 | 「这一步没有可选项，直接结算」 | 「本窗口没有要提醒的动作，可以跳过」 |

**反例**
- ❌ 强制窗口里出现「跳过」「全队跳过本窗口」「放弃本窗口行动（当作不结算）」。
- ❌ optional 窗口里没有跳过出口（只能通过「关掉浮层」逃避 —— 关浮层是视图操作，不算答完，见 R5）。
- ❌ 用颜色深浅区分强制/可选。色弱与灰度打印下会直接丢失，**必须叠加形状（方块/圆）**。
- ❌ 把 `s.pending.length>0` 一律当 forced：剧本待结算里既有「确认结算」（forced）也有可选响应（optional）。判定只看 `timingOf`，不看有没有待结算。

---

### R4 同一时机结算完要继续追问

**判定条件（唯一一把钥匙：`decisionAnchor`）**
```js
/* 「本窗口已消费掉的输入数」——窗口内单调递增，是判断「又该问了」的唯一量 */
function consumedOf(s){
  const q=s.questing||{}, c=ScenarioEngine.planning.context(s)||{};
  return (q.finalPasses?.length||0) + (q.actionApprovals?.length||0)
       + (q.deploymentApprovals?.length||0)
       + Object.keys(q.deployments||{}).length
       + (c.finalPasses?.length||0) + (c.plannedActions?.length||0)
       + (s.pending?.length||0);
}
function decisionAnchor(s){
  try{
    const c=ScenarioEngine.planning.context(s)||{};
    const open = (WindowEngine.options(s).list||[]).filter(o=>!o.muted).length;
    return `${s.round}.${s.phase}.${c.step||'-'}.${consumedOf(s)}.${open}`;
  }catch(e){ return '0.0.0.-1.0'; }
}
/* syncKey 由 4 段变 6 段 */
const key = `${s.round}:${s.phase}:${d.kind}:${decisionAnchor(s)}:${d.act?'1':'0'}:${bodyHash(stableBody(d.body))}`;
```
`anchor` 的作用：**玩家做了一次输入（用掉一个动作、确认一个人、结算一条待结）→ `consumedOf` +1 → key 变 → 自动重新展开**，即使面板正文一字未改（连开两次同名能力就是这种情况，此时 `bodyHash` 完全相同，只靠 hash 会漏问）。

**渲染后果**
- 同窗口内每次输入后：浮层**保持/重新展开**，触发条不消失（除非本轮问题问完）。
- 只有 `decisionAnchor` 三件套全部归零（`open===0` && `namedInput===0` && `humanAdvance===false`）才允许 `pending()` 返回 null。

**「这个窗口问完了」的收尾判定（三条同时成立）**
1. `WindowEngine.options(s).list` 里没有 `muted!==true` 的项；
2. 无具名输入：`s.pending.length===0`、`!R.choiceSpec(s)`、名单全部已提交且已确认、`finalPasses` 覆盖全员；
3. 无待人手点的推进（`humanAdvance===false`）。

三条成立 → 窗口消失（R1）。**任何一条不成立就不许收**，包括「玩家点了浮层外面」「玩家按了 Esc」。

**反例**
- ❌ 答一次就 `pop.open=false`（现状 `syncKey` 在 key 不变时不会重开，正是这个缺陷的入口）。
- ❌ 用 `bodyHash` 单独判定「是否有新决策」——两次相同的 `{kind,name}` 决策 hash 相同。
- ❌ 把「玩家关掉浮层」记成「已跳过」。关 = 视图；跳过 = 写 `windowPrefs.muted`（`WindowEngine.mute`）并留日志。二者不可互相替代。
- ❌ 为了「继续追问」而让 `mute` 记 `forever`。`once` 是默认，跨阶段自动失效。

---

### R5 他人的窗口只闪点，不弹层

**判定条件**
```js
function ownerOf(s){
  const live=s.players.filter(p=>!p.eliminated);
  if(live.length<2) return null;                  // 单人局永不启用「他人」
  const q=s.questing||{};
  if(s.phase===2&&q.step==='commit')            return q.order.find(id=>!q.deployments?.[id]?.confirmed) ?? null;
  if(s.phase===2&&q.step==='staging')           return q.order.find(id=>!(q.deploymentApprovals||[]).includes(id)) ?? null;
  if(s.phase===2&&!q.completed)                 return q.order.find(id=>!(q.finalPasses||[]).includes(id)) ?? null;
  const m=DesktopUI.mode(s,handView); if(m) return m.player;         // 防御/攻击草稿的发起者
  const c=ScenarioEngine.planning.context(s);
  if(c&&c.finalPasses)                          return live.map(p=>p.id).find(id=>!c.finalPasses.includes(id)) ?? null;
  return null;                                  // null = 全队共用（setup / 全队窗口）
}
const othersTurn = owner => owner!==null && owner!==handView;
```

**渲染后果**
- `data-tone="wait"`；状态点**空心圆 + 虚线描边**（形状通道，不靠颜色）。
- **不自动展开**：`open = d.act && !othersTurn`（`d.act` 见 §7.2）。
- **不移动焦点**：他人窗口出现时禁止 `focusSel()`。
- 标题：`等待 · 玩家2 提交名单`（陈述句，不是祈使句）。
- hint 胶囊：`轮到玩家2`。
- 闪点：`.decide-dot` 播 2 次 `decidePulse`（1.4s，`animation-iteration-count:2`），**不常闪**；`prefers-reduced-motion:reduce` 下 `animation:none`。
- 播报：只有一枚 `<span class="sr-only" role="status" aria-live="polite">` 在 **owner 变化**时念一次「玩家2 需要决定：提交派遣名单」；同一 owner 重复渲染不重复播报。
- 点开之后去哪：**不跳页、不改 `handView`**。浮层里给 `secondary` 按钮「切换到 玩家2 的视角」→ 走既有 `data-action="desktop" data-desktop="view" data-player="2"`（`DesktopUI.handle` 已实现，纯视图、不入撤销历史）。

**自动转座只允许在引擎已定义的交接点发生**（现状：提交名单后 `handView=下一个未确认者`、`endPhase` 后 `handView=active`）。`DecisionUI` **不得**自己改 `handView`——它会连带换掉手牌区，属于"悄悄换了我看到的东西"。

**反例**
- ❌ 他人待决时自动弹层盖住牌桌（这正是《诡镇》网页版要解决的问题）。
- ❌ 单人局也走「他人」分支（`live.length<2` 必须短路，否则单人局永远显示"等待玩家1"）。
- ❌ 用 `aria-live="assertive"` 抢断读屏。
- ❌ 把「等待」做成可点跳转的整行按钮——那会让 `actionable()` 判成 todo 并自动展开。

---

## 3. 窗口级 forced 标记的派生链（只改 window 层）

```
phase-log.js   WINDOWS[].timing           ← 已存在，5 个 forced（唯一真相）
     ↓ PhaseLog.stepKey(s) + STEP_ALIAS
desktop-ui.js  timingOf(s) → isForced(s)  ← 新增 8 行
     ↓ 透传
DecisionUI.pending() 返回 {kind,title,body,act,forced,owner}
     ↓
triggerHTML()  data-tone="forced|todo|wait|info" + 方块/圆点 + 前缀「强制 · 」
window-ui.js   收到 forced → 不渲染「全队跳过本窗口」，主按钮改「结算〈步骤名〉 →」
phase-log.js   rail 的 data-timing="forced" 竖线仍用红（既有，二者天然一致）
```

**强制窗口的文案铁律**
- 主按钮：`结算〈步骤名〉 →`，步骤名直接取 `PhaseLog.WINDOWS[s.phase].windows.find(...).label`（如「敌人攻击」「暗影结算」「探查区」），**不要自己另起名字**——竖轴、日志、触发条必须是同一个词。
- 说明句只说明「会发生什么、能不能减伤」：`本步必然结算；你可以选择是否响应，但不能跳过。`
- 禁用按钮必须带原因：`title="还有 2 名玩家未确认"`，且**不许出现「唯一可点控件是 disabled」的面板**（见 §7.4）。

**可选窗口的「跳过」位置**
- 候选级：每行右侧 `本次跳过`（`data-window="mute"`，`keep='once'`）——既有。
- 窗口级：bottom 行 `全队跳过本窗口 →`（原「全队继续到下一决策点」）。
- 恢复：`恢复已跳过的提示（3）`（原「恢复全部跳过记录」，括号里给条数）。
- 只要本窗口存在 0 个候选但有推进需求，「跳过」位必须留给「全队跳过本窗口」；不要把「跳过」藏进 `<details>`。

---

## 4. 判定矩阵

**列说明**：`触发条` 是否渲染 `.decide-box`；`自动展开` 是否无需点击就出 `.decide-pop`；`tone` 是 `data-tone`；`来源` 是判定字段。

| # | 阶段 · 窗口（timing） | 情形 | 触发条 | 自动展开 | 标题 | 主按钮 | 跳过 | tone | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| M1 | 开局 · 剧本设置揭示（forced，无 timing 记录） | 有未结算翻牌 | 出现 | **展开** | 剧本设置 · 翻开遭遇牌 | `结算此牌并继续 →` | 无（取消是步骤内可选） | forced | `DesktopUI.setupPanel` |
| M2 | 1 资源 · 1.1 重置英雄（step） | 引擎自动 | 不出现 | — | — | — | — | — | `pending()`→null |
| M3 | 1 资源 · 1.2 获得资源（step） | 引擎自动 | 不出现 | — | — | — | — | — | 同上 |
| M4 | 1 资源 · 1.3 抽牌（trigger） | 引擎自动 | 不出现 | — | — | — | — | — | 同上（R2 纯被动） |
| M5 | 1 资源 · 若引擎开放行动窗口 | 有候选 | 出现 | 展开 | 可做的事 | 候选按钮 | 有：`本次跳过` | todo | `windowTail` |
| M6 | 2 计划 · 2.1 计划行动（action） | 无强制效果 | **不出现** | — | — | 见 `PlanningUI.strip` | — | — | `phasePanel` 返回 null |
| M7 | 2 计划 · 2.1 计划行动 | 有**强制**效果 `ch`（`task.optional===false`） | 不出现 | — | — | `处理强制效果：「卡名」`（primary） | **无** | — | `R.choiceSpec().task.optional` |
| M8 | 2 计划 · 2.1 计划行动 | 有**可选**响应 `ch` | 不出现 | — | — | `选择响应：「卡名」`／`不使用响应` | 有，且在 strip 上直出 | — | 同上 |
| M9 | 2 计划 · 2.1 计划行动 | 多人、轮到别人出牌 | 不出现 | — | — | `等待 玩家2 出牌`（文字行，无按钮） | — | — | `R.active(s)` |
| M10 | 2 计划 · 2.2 阶段结束（step） | 等下一次点结束 | 不出现 | — | — | `结束计划阶段`（角色区） | — | — | `PlanningUI.strip` |
| M11 | 3 探险 · 3.1 投入前行动（action） | 有候选（可打事件/能力） | 出现 | 展开 | 探险阶段 · 投入前行动窗口 | `开始投入角色 →` | 有：候选级 + `全队跳过本窗口 →` | todo | `QuestUI.picker` |
| M12 | 3 探险 · 3.1 投入前行动 | 无候选，但有人未放弃 | 出现 | 展开 | 探险阶段 · 投入前行动窗口 | `开始投入角色 →` | `〈玩家N〉：放弃本窗口行动` | todo | `q.finalPasses` |
| M13 | 3 探险 · 3.1 投入前行动 | 全员已放弃，只差推进 | 出现 | **展开** | 同上 | `开始投入角色 →` | 无（已无候选） | todo | `humanAdvance===true` |
| M14 | 3 探险 · commit 名单（具名输入） | 我未提交 | 出现 | 展开 | 探险阶段 · 投入角色 | `提交名单 · N 名` | 仅当空名单合法：`提交空名单（本次不投入）` | todo | `q.deployments[pid]` |
| M15 | 3 探险 · commit 名单 | 我已提交，等他人 | 出现 | **仅闪点** | 等待 · 玩家2 提交名单 | 无（0 控件） | — | wait | `ownerOf()`≠`handView` |
| M16 | 3 探险 · commit 二次确认 | 全员已提交、我未确认 | 出现 | 展开 | 探险阶段 · 二次确认 | `确认派遣名单` | 无（`取消确认` 是 secondary） | todo | `q.deploymentApprovals` |
| M17 | 3 探险 · 全员确认后横置中 | 引擎自动推进 | **出现（回执）** | **不展开** | 探险阶段 · 正在横置 | **无按钮** | — | info | `phasePanel` 只读卡（§7.3） |
| M18 | 3 探险 · 3.2 探查区（**forced**） | 有未结算翻牌 | 出现 | 展开 | 强制 · 探查区 | `结算「卡名」→` | **无窗口级跳过**；取消类选项照给 | forced | `isForced(s)` |
| M19 | 3 探险 · 3.3 任务结算（trigger） | 引擎自动 | 不出现 | — | — | — | — | — | R2 纯被动 |
| M20 | 3 探险 · `q.completed` | 阶段已完 | 不出现 | — | — | 阶段门按钮接管 | — | — | `phasePanel`→null |
| M21 | 4 旅行 · 4.1 选择地点（step） | 我未选 | 出现 | 展开 | 旅行阶段 · 选择地点 | `前往「地点」→` | 有：`不旅行（留在原地）` | todo | `traveling.step==='choice'` |
| M22 | 4 旅行 · 4.1 选择地点 | 他人已暂定、我未确认 | 出现 | 展开 | 旅行阶段 · 确认前往「地点」 | `确认前往` | 有：`取消暂定`（secondary） | todo | `x.proposal`/`x.approvals` |
| M23 | 4 旅行 · 4.2 旅行行动（action） | 有候选 | 出现 | 展开 | 旅行阶段 · 旅行行动 | `结算旅行阶段结束 →` | 有：候选级 + 全队跳过 | todo | `TravelUI.panel` |
| M24 | 4 旅行 · 4.2 旅行行动 | 我放弃，等他人 | 出现 | 仅闪点 | 等待 · 玩家2 结束旅行阶段 | 无 | — | wait | `ownerOf()` |
| M25 | 5 遭遇 · 5.1 交战前行动（**应为 action**） | 有候选 | 出现 | 展开 | 遭遇阶段 · 交战前行动 | `开始交战检定 →` | 有：候选级 + 全队跳过 | todo | `x.step==='beforeChecks'` |
| M26 | 5 遭遇 · 5.1 交战选择（可选方案） | 我未提交/未确认 | 出现 | 展开 | 遭遇阶段 · 确认交战方案 | `确认交战方案`／`全部确认交战方案 →` | 有：`放弃本窗口行动` | todo | `x.choices`/`x.approvals` |
| M27 | 5 遭遇 · 5.2 交战检定（**forced**） | 待检 | 出现 | 展开 | 强制 · 交战检定 | `开始交战检定 →` | **无窗口级跳过** | forced | `isForced(s)` |
| M28 | 5 遭遇 · 5.3 检定后行动（action） | 有候选 | 出现 | 展开 | 遭遇阶段 · 检定后行动 | `结算遭遇阶段结束 →` | 有：候选级 + 全队跳过 | todo | `x.step==='afterChecks'` |
| M29 | 6 战斗 · 6.1 敌人攻击（**forced**） | 需分配防御 | 出现 | 展开 | 强制 · 分配防御 | `提交防御名单` | **无窗口级跳过**；`不选＝无人防御` 必须在网格说明里写明 | forced | `DesktopUI.mode().kind==='defense'` |
| M30 | 6 战斗 · 6.2 玩家攻击（action） | 有候选/待选目标 | 出现 | 展开 | 战斗阶段 · 玩家攻击 | `提交攻击名单` | 有：候选级 + 全队跳过 | todo | `mode().kind==='attack'` |
| M31 | 6 战斗 · 6.3 暗影结算（**forced**） | 已翻暗影 | 出现 | 展开 | 强制 · 暗影结算 | `结算本张暗影／继续` | **无窗口级跳过**；取消类选项照给 | forced | `isForced(s)` |
| M32 | 6 战斗 · 6.4 战斗结束（step） | 只差推进 | 出现 | 展开 | 战斗阶段 · 收尾 | `结算战斗阶段结束 →` | 无 | todo | `x.step==='endAction'` |
| M33 | 7 刷新 · 7.1 刷新行动（action） | 有候选 | 出现 | 展开 | 刷新阶段 · 刷新行动 | `结算刷新与回合结束 →` | 有：候选级 + 全队跳过 | todo | `RefreshUI.panel` |
| M34 | 7 刷新 · 7.3 回合结束（**forced**） | 待结算 | 出现 | 展开 | 强制 · 回合结束 | `结算刷新与回合结束 →` | **无窗口级跳过** | forced | `isForced(s)` |
| M35 | 任一阶段 · 全员跳过完毕 | 问完 | 不出现 | — | — | — | — | — | R4 收尾三条件 |
| M36 | 任一阶段 · 阶段已 `completed` | 等阶段门 | 不出现 | — | — | 阶段门（`.phase-door .door-go`） | — | — | `phasePanel`→null |

> 行数：**36 行**。其中 forced 6 行（M1、M18、M27、M29、M31、M34），等待态 3 行（M15、M24、M9），回执 1 行（M17），不出现 11 行。

### 4.1 一处显式裁决：`phasePanel` 的只读状态卡怎么和 R1 共存

现状（`desktop-ui.js:103`）：名单锁定后 `if(!html&&!q.completed)` 给一张「引擎正在按起始玩家顺序横置…已确认 N/M 人」，注释理由是「不让弹窗彻底消失，否则人会以为卡住」。

**裁决：保留，但从「窗口」降级为「回执」（M17），并加四条硬约束。**

1. **`act:false`**：回执体内**不得出现任何 `<button>`**（含「取消确认」）。它永远不自动展开、不抢焦点——这正好也是现状 `actionable()` 的结果，但必须从"碰巧"升级成"声明"。
2. **`data-tone="info"`**：灰点 + **空心圆**（形状通道）。绝不允许 todo 金点——它不是待办。
3. **必须回答两个问题**：`还差谁`（逐个列名 + ✓/·）与 `下一步是什么`（「全员确认后开始横置」）。只写「稍候即可」不合格。
4. **必须有终态**：出现条件收紧为「`q.order` 全员 `confirmed` 且 `!q.completed`」——即确实处在引擎推进期。若 `confirmed` 一个都没有却仍无 `html`，那是**缺分支的 bug**，不许用回执兜底（此时应显示「本步缺少可操作入口」并留 `console.warn`，让问题暴露）。停留超过 **10 秒**未完成，文案由「稍候即可」改为「停在横置已超过 10 秒，可用日志里的撤回回到上一步」（降级方案，见 §11）。

**为什么不是"让窗口彻底消失 + 弹个 toast"**：toast 是瞬时的，玩家点了二次确认之后视线还在牌桌上，3 秒后 toast 消失、桌面无变化，比留着回执更像卡死。回执是"常驻但低权重"的正确形态——它不是窗口，所以不违反 R1。

---

## 5. 等待态（等他人 / 引擎自动推进）

允许存在，但必须和「可做的事」在**四个通道**上同时不同：

| 通道 | 等待态 | 可做的事（todo） |
|---|---|---|
| 标题 | `等待 · 玩家2 提交名单`（陈述） | `探险阶段 · 投入角色`（祈使） |
| 状态点 | 空心圆 + 虚线描边（`outline` 而非 `background`） | 实心圆/方块 |
| 语气 | 不含动词、不含「请」 | 含动词 |
| 自动展开 | **否** | 是（`act:true` 时） |

**`actionable()` 的处置（关键）**
现状 `actionable(body)` = 「体里有未 disabled 的 `<button>`」→ 决定是否自动展开。这个启发式有两个固有缺陷：① 等待态想放一颗「切换视角」就会误判成"该弹"；② 回执想放一颗「查看详情」同理。
**改法（不删旧函数，改其地位）**：`pending()` 的每个出口显式返回 `act`，`syncKey` 用 `d.act`；`actionable()` 降级为兜底默认值。

```js
// 各出口的 act 取值（默认 = actionable(body)，但必须显式写死）
setup      → act: true        // 有翻牌要结算
select     → act: true        // 有名单可提交
phase*     → act: 见下表
window     → act: candidates.length>0
回执(info) → act: false       // 铁律
等待(wait) → act: false       // 铁律：即使体内有「切换视角」按钮
```

**等待态能不能放可点控件？**
- `act:false` 之下**允许且仅允许 1 个**：`切换到 玩家2 的视角`（`secondary`，`data-desktop="view"`）。
- 禁止放：`跳过`（跳过别人的窗口是替他做决定）、`继续`（会推进到下一步，破坏"只闪点"）、任何 `primary`。
- 引擎自动推进态（M17 回执）：**0 个**可点控件。

**是否算「有按钮」**：不算。因此它不改变自动展开行为、不抢焦点、不进 Tab 顺序的第一位（它在浮层里，只有手动展开才可及）。

---

## 6. 同一时机继续追问

### 6.1 重问规则

| 触发 | 是否重新展开 | 说明 |
|---|---|---|
| 玩家结算了一个候选（用能力/打事件） | **是** | `consumedOf` +1 → key 变。即使面板正文一字未改（连开两次同名能力）也必须重开——这正是只靠 `bodyHash` 会漏的情形 |
| 玩家提交/确认了一份名单，仍有他人未完成 | **是** | 标题转「等待 · 玩家N」，`act:false` 后不自动展开（转为闪点） |
| 玩家点「本次跳过」 | **是**（若仍有其它候选） | 该行变「（本次已跳过）」，其余候选照问 |
| 玩家点「全队跳过本窗口」 | 否 | 引擎批量让过并推进；本窗口关闭 |
| 玩家点浮层外 / 按 Esc | **否，且不算答完** | 纯视图操作；下次 `anchor` 变化时重新弹出 |
| 引擎进入下一步骤 | 否（旧窗口销毁） | 新窗口按矩阵重新判定 |
| 玩家点「恢复已跳过的提示」 | **是** | `restore()` 后 key 变（`open` 计数变了） |

### 6.2 收尾判定（怎样才算这个窗口问完了）

```js
function windowSettled(s,pid){
  const open = (WindowEngine.options(s).list||[]).filter(o=>!o.muted).length;
  return open===0 && !namedInput(s,pid) && !humanAdvance(s,pid);
}
```
- 成立 → `pending()` 返回 null → 触发条消失（R1）。
- **不允许**用「玩家关掉了」或「一次点击」近似这个判定。
- 强制窗口的收尾不由玩家决定：`forced` 步骤结算完，`timingOf` 自然变到下一步（`anchor` 里的 step 段变化），窗口自动换新，而不是"问完了"。
- **全部跳过 ≠ 全部沉默**：`全队跳过本窗口` 必须写日志（`本次跳过「X」（阶段推进后恢复提示）`，`WindowEngine.mute` 已做）；`restore()` 必须写「已恢复全部 N 条」。日志是这类静默动作唯一的可追溯性。

---

## 7. 他人窗口只闪点（同机多人）

### 7.1 放在哪

触发条本身（`.decide-box` 仍在「队伍与手牌」标题行内，v0.15.93 位置不变），状态点在标题左侧。**不新增第二个全局角标**——同机会有多处待决标记（每个座位一个），再开一层只会变成噪声。

### 7.2 形状与语义（四态唯一真相表，`style.css` 与断言都以此为准）

| tone | 形状 | 填充 | 线型 | 语义 | 令牌 |
|---|---|---|---|---|---|
| `todo` | 圆 `border-radius:50%` | **实心** | 无 | 现在轮到你，**可以**点 | `var(--accent-gold)`（现值 `#846424`，对触发条底 4.56） |
| `forced` | **方块** `border-radius:1px` | **实心** | 无 | 现在轮到你，**不能**跳过 | `var(--accent-red)`（现值 `#a35446`，4.46） |
| `wait` | 圆 | 空心 | `dashed` | 正在等别人/引擎，不用你动手 | `var(--ink-3)` 描边（现值 `#6f7566`，3.95，图形按 3:1 判，过） |
| `info` | 圆 | 空心 | `solid` | 纯回执，没有要做的事 | `var(--ink-3)` 描边（同上） |

**四态一律写令牌名**（括号里注一次现值），不许两套并写；四个色值都不新增令牌。

**存在感的统一来源是 `--dot-ring`，不是逐态写死颜色**：四个 tone 共用同一条 `box-shadow:0 0 0 3px var(--dot-ring)`，`--dot-ring` 在各自规则里声明（现值 `todo #84642429` / `forced #a3544626`；`wait`/`info` 为 `none`）。**它的值必须随底面重算**——底色一换，环的观感与可见度就变，这是唯一允许"跟底色联动"的令牌。

**尺寸按「在哪」分，不按「多小」分**（两处选择器不同、生效范围不同，别合成一句"7px 档"）：

| 出现位置 | 尺寸 | 选择器 | 备注 |
|---|---|---|---|
| 底部触发条 `.decide-trigger` 内的点 | **7×7** | `.bottom-deck>.zone-heading>.decide-box .decide-dot{width:7px;height:7px}`（`style.css:2124`） | 最常见的一档；形状在这里最容易塌 |
| 计划阶段 strip 的强制说明点 | **9×9** | `.planning-strip .planning-forced-note .decide-dot{width:9px;height:9px}`（`style.css:693`，§7.2.1 方案 A 新增） | 不跟触发条同源，**不是 7px** |
| 其他/浮层内 | 9×9 | 基础类 `.decide-dot`（`style.css:1613`） | 兜底 |

> **两条禁令（两档都适用，7px 是临界值）**
> 1. **不许为了"看起来干净"改线宽**。`wait` 的虚线在 7px 上已经是「外框周长约 28px、4~5 段 dash」的临界值，改线宽会同时改变 dash 段长与段数，而这段预算**没有人实测过**——所以规则是「**未经实测的线宽不要动**」，不是「1px 就一定会塌」。（实测记录：`dpr=1` 下 Chrome 会把作者样式的 `1.5px` 折算成计算值 `1px`，1px 渲染下仍有 4~5 段缺口、与实线可分。所以**断言不能读 `getComputedStyle().borderTopWidth`**，它永远返回 `1px`；要读 `document.styleSheets` 里的作者样式。）
> 2. **不许为了"更清楚"把方块圆角调大**。`border-radius:1px` 在 7px 上仍是明确的方角；一旦改成 2px 以上，7px 的方块与 7px 的圆（半径 3.5px）在灰度下就分不出。

**「形状可辨」的判据是三元组，不是二元组**：`borderRadius × borderStyle × 填充`。
`todo` = `50% / solid / 实心`、`forced` = `1px / solid / 实心`、`wait` = `50% / dashed / 空心`、`info` = `50% / solid / 空心`。
**只断前两项会让 `todo` 与 `info` 撞车**——基础类就是 `border:1.5px solid transparent`，两者计算值都是 `50%` + `solid`，差别只在填充。这条坑实际踩过一次，别再踩。

**报对比度必须用「元素实际所在的底面」**：状态点坐的是 `.decide-trigger`（`--surface-wash #f1ead3`），**不是 `--surface-mat`**。同一个色值在这两档分母上能差出近一倍（`#c08f2c`：mat 2.58 → 触发条 2.42；`--accent-gold`：mat 4.85 → 触发条 4.56），所以表里所有比值一律写触发条底，写 mat 就算错。

**三通道同时编码**：形状（圆/方）× 填充（实心/空心）× 线型（无/虚线/实线）——四态在这三条上两两互异，因此**任何单一通道失效（灰度打印、色弱、`forced-colors` 强制色）都还能分辨"实心＝要你动手"**。颜色只做加成，不承担语义。

**`forced` 用红、不用金的理由是同源，不是对比度**：`phase-log.js` 的阶段竖轴里 `rail-win-line[data-timing="forced"]` 本来就是红色竖线。触发条与阶段栏必须**同一个词、同一种信号**——否则玩家在竖轴看到红色 forced、在触发条看到金色方块，两套语义当场打架。这条对 `todo` 也成立：阶段栏的 `action` 是绿，触发条 `todo` 用金已经偏了，但金色是 v0.15.x 的既有信号且与「当前阶段」的实心底不冲突，本次不动色相、只把值收敛到 `--accent-gold`（`#c08f2c` 退役：它在四层底面上全部低于 3:1，是未达标字面量——见本节「报对比度必须用元素实际所在的底面」段的实算值）。

### 7.2.1 计划阶段的例外（已定，方案 A）

计划阶段（`s.phase===1`）**不渲染触发条**，一切决策留在 `PlanningUI.strip` 按钮行。为了让 R3「强制必须可辨」在这一阶段仍然成立，strip 里的强制项必须带两样东西：

1. 按钮前加 `■` 方块点（与 `.decide-dot[data-tone="forced"]` **同一份形状与色值**，但尺寸是 **9×9**：`.planning-strip .planning-forced-note .decide-dot{width:9px;height:9px}`，`style.css:693`；它不受触发条那条 7px 覆盖影响，不要写成 7×7）；
2. 紧跟一行 `.small`：`必须先处理，否则不能结束计划阶段`。

反例：把计划阶段的强制项升级成触发条——会把 v0.15.74 用户明确否掉的「计划阶段桌面又有一行决策条」顶回来。

### 7.3 要不要 `aria-live`

要，但只一处、只一次：
```html
<span class="sr-only" role="status" aria-live="polite" aria-atomic="true" id="decide-announcer"></span>
```
- 只在 **owner 变化** 或 **窗口标题变化** 时写入一句：「玩家2 需要决定：提交派遣名单」。
- 关闭 `decisionAnchor` 里高频变化的数字播报（现在 `.decide-hint` 带 `aria-live="polite"`，「已选 3 名（意志 6）」每次勾选都会被念一遍——**必须去掉**，改由 announcer 承担）。
- 禁止 `assertive`。

### 7.4 点了之后跳哪

点触发条 → 就地展开浮层（不跳页）。浮层内第一行是「玩家2 需要决定：…」，第二行是 `secondary` 按钮 `切换到 玩家2 的视角`。点击后调用既有 `DesktopUI.handle` 的 `view` 分支（`data-desktop="view"`），`handView` 变化 → 整页 `render()` → 触发条按新视角重算，焦点靠 `data-focus-key="decide-trigger"` 回到触发条（既有恢复机制）。

**降级**：若某一天出现"多设备实时"，`owner` 判定不变，只把「切换视角」换成"给对方推一条提醒"；本规范其余部分不需要改。

---

## 8. 按钮层级与文案表

### 8.1 四级语义边界（判定优先于观感）

| 级别 | 语义（唯一标准） | 一屏上限 | 例子 |
|---|---|---|---|
| **primary** | 本窗口**唯一**的推进动作：点它世界会往前走 | **1**（浮层内） | `开始投入角色 →`、`提交名单 · 2 名`、`结算「遭遇牌」→` |
| **secondary** | 具名输入的提交/确认/切换，不推进阶段 | ≤3 | `确认派遣名单`、`取消确认`、`切换到 玩家2 的视角` |
| **ghost** | 可逆的减损动作：跳过、放弃、恢复、清空 | 不限（但同一动词只出现一组） | `本次跳过`、`放弃本窗口行动`、`恢复已跳过的提示（3）`、`清空选择` |
| **danger** | **不可逆**或会丢失进度的动作 | ≤2 | `重置剧本`、`删除卡组`、`移出角色`、`撤回并重置本回合` |

**与 `DESIGN_SYSTEM.md` §5.1 的一处调整（visual 已采纳并改稿）**：视觉稿原把「放弃行动」列为 danger。本规范改为 **ghost**，理由：它可逆（`cancelPass`/`unpass` 随时能撤）、一屏会出现 2–4 枚（多人逐人一行）、且语义上属于"减损"不属于"破坏"。**danger 只保留给不可逆操作**（重置剧本／删除卡组／移出角色／放弃整局）。visual 已在 §5.1 加边界说明，并把「可逆的撤出」写进 ghost 一栏。

### 8.2 必须统一的现有高频文案

| 现状（分散在多处） | 出现位置 | 问题 | 统一为 |
|---|---|---|---|
| `全队继续到下一决策点` | `window-ui.js:19` | 既是"跳过"又是"推进"，与「放弃本窗口行动」语义重叠 | `全队跳过本窗口 →`（primary，forced 窗口下不渲染） |
| `恢复全部跳过记录` | `window-ui.js:19` | 没有数量，玩家不知道恢复几条 | `恢复已跳过的提示（3）`（ghost） |
| `本次跳过` | `window-ui.js:16` | 良好，保留 | `本次跳过`（ghost，行尾） |
| `提交名单` / `提交空名单` | `quest-ui.js:101,134` | 两种文案让 `stableBody` 要额外归一；空名单没有说明后果 | `提交名单 · N 名` / 空名额时 `提交空名单（本次不投入）` |
| `提交暂定防御名单` / `提交暂定攻击名单` | `desktop-ui.js:348` | 「暂定」重复（面板标题已在说暂定） | `提交防御名单` / `提交攻击名单` |
| `处理卡牌响应` | `refresh-ui.js:10`、`travel-ui.js:9`、`quest-ui.js:201`、`combat-ui.js:78` | 四份同名实现，强制/可选不分 | forced → `处理强制效果：「卡名」`；optional → `选择响应：「卡名」`（抽成共用函数 `ChoiceUI.button(task)`） |
| `处理强制效果／卡牌响应` | `encounter-ui.js:9` | 一句话表达两种性质 | 同上，按 `task.optional` 二选一 |
| `处理响应／选择` | `travel-ui.js:10` | 同上 | 同上 |
| `处理强制选择` / `选择响应／放弃` | `planning-ui.js:16` | 良好，但「选择响应／放弃」宜拆成两颗 | forced：`处理强制效果：「卡名」`；optional：`选择响应` + `不使用响应`（ghost） |
| `开始投入角色 →` / `结束探险阶段` / `开始探查` / `自动结算探险` | `quest-ui.js:309` 等 | 箭头只在部分按钮上有 | 所有 primary 一律以 `→` 结尾；ghost/secondary 不带箭头 |
| `结算旅行阶段结束` / `结算遭遇阶段结束` / `结算刷新与回合结束` / `结算战斗阶段结束` / `关闭本行动窗口，继续战斗` | 四个 `*-ui.js` | 最后一个不是"结算"句式 | `结算〈步骤名〉 →`；步骤名取 `phase-log` 的 `label`，不另起名字 |
| `结算此牌并继续` | `desktop-ui.js:377` | 句式不一致 | `结算「卡名」→` |
| `翻开下一张遭遇牌` | 同上 | 同上 | `翻开下一张 →` |
| `全部确认交战方案，继续` | `encounter-ui.js:14` | 智能模式专属，与 `全队跳过本窗口` 易混 | `全队确认并继续 →`（primary） |
| `领取目标` | `window-ui.js:16`、`app.js:98` | 一致，保留 | `领取目标`（secondary） |
| `暂定结束我的攻击` / `本回合不攻击，交给下一位` | `combat-ui.js:87` | 两句同义，一个"暂定"一个"不攻击" | `不攻击，交给下一位`（ghost）+ `暂定结束我的攻击`（secondary）保留 |
| `清空选择` / `重置选择` | `desktop-ui.js:350`、`quest-ui.js:365` | 同义两词，全站应只留一个 | `清空选择`（ghost） |
| `保留手牌` / `整手调度一次` | `desktop-ui.js:507` | 一致，保留 | 不变 |

**文案三条文法**
1. **primary 以 ` →` 结尾**，表示"这一步点下去世界会往前走"。
2. **跳过/放弃类必须含「跳过」或「放弃」字面**，不许用「继续」「取消」表达同一件事（"取消"只用于撤销一次提交）。
3. **禁用态必须带原因**：`title` 或体内 `.small.muted` 一句，例如 `还有 2 名玩家未确认`。

---

## 9. 状态载体体系（替代卡图滤镜）

**前提**（已拍板）：卡图 `img` 上零 `filter`。所有"状态"必须换成非滤镜手段，且**任一状态至少有一个非颜色通道**（形状/线型/文字/位置）。

> **与 `DESIGN_SYSTEM.md` §5.8/§5.9 的接口注（visual 已同步）**：卡图零滤镜后，状态只能由**卡框外侧的几何**（虚线/实心/竖条/角标/点态）+ 色块承担；**任何文字衰减不得用 `opacity` 或 `filter`，只能换 `color` 令牌**。颜色令牌一律取 visual 实算过的值——本表里所有小字角标用 `--ink-2`（对 `--surface-sunken` 5.36），不用 `--ink-3`（只有 3.62，跌破 4.5，它只许做描边/图标/禁用态/≥24px 大字）。

**两条硬规则（不是脚注，写进正文）**

1. **`filter` 只允许出现在装饰性矢量图标上** —— 全仓唯一的合法处是 `.nav-home .brand-mark{filter:drop-shadow(…)}`（16×16 矢量，不承载文字）。凡作用在 `img` / `.card-face` / `.card-art` / 承载文字的节点上一律违规。
   **`transform` 不在其列**：旋转与位移是**替代**滤镜的几何通道。验收断言读 `.table-card.exhausted img` 时必须**显式接受 `rotate(90deg)`**——否则下一个人清滤镜时会顺手把横置的几何通道也拆掉，横置就彻底没有视觉载体了。
2. **`.qp-card.is-gone` 收到两重编码**（虚线框 + 角标）：`filter:grayscale(1)` 与整卡 `opacity:.4` **都要删**。`opacity` 不是"观感偏好"，它会把卡名压到 **2.6:1 以下**，属于可读性缺陷（同一条规则也适用于 `.hand-card.unaffordable{opacity:.82}` 与 `.rail-grp.past` 的 `filter:saturate()/brightness()`——后者作用在文字上，等于绕过对比度规则）。

**唯一允许"靠颜色"的载体是「已选」**：8 个状态里只有它带颜色（金双环 `0 0 0 2px var(--accent-gold)`），这是全局选中态的唯一视觉锚点，**不许用虚线框替代**。理由不是审美：虚线在本表里已经承担了「不可支付 / 不可选 / 已离场」三种"你不能动"的语义，若再让"你选中了它"也用虚线，**两个相反的语义就共用同一通道**——那是比少一个通道更严重的问题。

### 9.1 状态载体表

| 状态 | 判定字段 | 视觉载体（非滤镜、非 opacity） | 文字通道 | 无障碍备份 | 禁止 |
|---|---|---|---|---|---|
| **横置** | `c.state.exhausted`；`.exhausted` | ①卡图 `transform:rotate(90deg) scale(.7)`（既有，保留）②卡框底 `--surface-sunken` ③卡框边 `--gold-line` 1px ④卡框左侧 3px `--line-strong` 竖条 | 卡框角标「横置」 | 卡面按钮 `aria-label` 追加「横置」；caption 里「横置」文字（`planning-ui.js` 已有） | `filter:brightness/saturate` |
| **不可支付** | 资源 < 费用；`.unaffordable` | ①**虚线**卡框 `1px dashed --line-strong` ②卡框底 `--surface-chip` ③右上角角标 `border:1px dashed --line-strong;background:var(--surface-sunken);color:var(--ink-2)`（**5.36，不用 `--ink-3`**，它只有 3.62） | 角标写「缺 N」；卡名后 `· 需 N 资源` | `aria-disabled="true"` + `aria-describedby` 指向一句可见理由（不是 title-only） | `opacity`（`.hand-card.unaffordable{opacity:.82}` 也要删）、灰度滤镜 |
| **不可选（规则不许）** | `WindowUI` 的 `blocked`；`.unavailable` | ①实线 `1px --line`（比可用的 `--line-strong` 更淡）②无 `box-shadow`（平贴）③右上角角标「此刻不可用」（同款角标，字色 `--ink-2`） | `<details>` 里逐条给中文理由（`blocked.reason`） | 理由必须在 DOM 里可见文本；`aria-disabled="true"` | 只给 `title` |
| **已选（草稿）** | `DesktopUI.draft().ids`；`.is-selected` / `.selected` | ①双环 `box-shadow:0 0 0 2px --accent-gold,0 0 0 5px #84642429`（既有）②左上角实心金方块徽章 | 徽章写「已选」／「目标」 | `aria-pressed="true"` + `aria-label` 尾部「点击移出名单」 | 位移、`scale` |
| **已确认（已提交）** | `q.deployments[pid].confirmed`；`.is-pending` | ①卡框底 `--state-ok-bg` ②卡框 1px `--green-ink` ③左上角徽章换绿底 | 徽章写「已确认」；行内「（已提交，等待他人）」 | `aria-checked` / 文字已可读；触发条 hint 报「已确认 1/2」 | 只换颜色不给词 |
| **已跳过** | `windowPrefs.muted` 命中 `o.key`；`o.muted` | ①行内 `--surface-sunken` 底 ②行首 3px `--line-strong` 竖条 ③文字后缀 | 「（本次已跳过）」 | 文本已有；`aria-description` 可选 | 整行删除（会造成"我跳过的怎么消失了"） |
| **等待中** | `ownerOf()!==handView` 或引擎推进中 | ①三点静态 `···`（CSS 伪元素，非 emoji，字色 `--ink-2`）②虚线空心圆点 ③`--surface-chip` 底 | 「等待 · 玩家2 提交名单」 | `role="status"` 一次性播报；不抢焦点 | 转圈动画（`prefers-reduced-motion` 下无意义且焦虑） |
| **已离场/销毁** | `c.state.destroyed`；`.is-gone` | ①卡图替换为「已离场」文字底版（`--surface-sunken`）②卡框 `1px dashed --line` ③徽章「已离场」 | 徽章 + 名字划掉（`text-decoration:line-through`） | 文字通道已够 | `filter:grayscale(1)`（`style.css:1867`）**与同处的整卡 `opacity:.4`** —— 三重编码里这两重都要删，只留「虚线框 + 角标」两重；`opacity:.4` 会把卡名压到不可读 |

### 9.2 全仓 `filter` 清单（visual 已查，7 处；`DESIGN_SYSTEM.md` §5.9 与本表同源）

| # | 位置 | 现值 | 处置 |
|---|---|---|---|
| 1 | `style.css:515` `.hand-card.unaffordable .card-face img` | `filter:grayscale(1) brightness(.72)` | 删；按「不可支付」行改造 |
| 2 | `style.css:38` `.table-card.exhausted .card-face img` | `filter:brightness(.64) saturate(.7)` | 删；按「横置」行改造（`rotate(90deg) scale(.7)` 是**几何变换不是滤镜**，允许保留——写断言时别把它当成残留滤镜） |
| 3 | `style.css:1867` `.qp-card.is-gone .card-face img` | `filter:grayscale(1)`（同处还有整卡 `opacity:.4`） | 删两项；按「已离场」行改造 |
| 4 | `style.css:38` `.table-card.selectable .card-face:hover` | `filter:brightness(1.1)` | 改 `border-color:var(--gold-line)` + `box-shadow:0 0 0 2px #b79a6266` |
| 5 | `style.css:1231` `.rail-grp.past>.rail-head` | `filter:saturate(.42) brightness(.72)` | **不是卡图，是阶段栏标题文字**——filter 连文字一起压暗，等于绕过对比度规则。改 `color:var(--ink-2)` |
| 6 | `style.css:198` / `:232` `.ng-card.locked .ng-card-art{filter:…}` | `grayscale(.9) contrast(.95)` / `grayscale(.25)` | **死代码**：已被 `:242/:243/:296` 的 `filter:none` 覆盖。建议直接删掉，避免下一轮"复活"时又把滤镜加回卡面 |
| 7 | `style.css:286~288` `.nav-home .brand-mark` | `filter:drop-shadow(…)` | **合法**：作用在 16×16 品牌图标（装饰性矢量），不在卡图、不承载文字。保留 |

> 判定边界一句话：**`filter` 只允许出现在装饰性矢量图标上**（第 7 条）。凡作用在 `img` / `.card-face` / `.card-art` / 承载文字的节点上一律违规。`transform` 不在此列（旋转、位移是几何通道，正是我们用来替代滤镜的手段）。

### 9.3 响应式补充（与状态载体共用同一套形状）

- `≤760px`：触发条整行（`min-height:44px`，已有）、浮层变底部抽屉（已有）。状态形状不变——**缩小时只缩字号，不缩形状**（方块/圆点是唯一跨断点稳定的语义通道）。
- `pointer:coarse`：所有可点目标 `min-height:44px`。`pointer:fine` 上标题行胶囊可维持 26px，但**不得低于 24×24**（WCAG 2.2 SC 2.5.8 底线）。
- 卡面在 `≤760px` 一屏 6 张时，角标文字退化为「缺N」/「横」两字，形状不变。

---

## 10. 无障碍硬约束

### 10.1 焦点进出路径

| 事件 | 焦点去向 | 依据 |
|---|---|---|
| 玩家点触发条展开 | `.decide-pop h2[tabindex="-1"]`（现状） | 读屏把标题当"本对话框的入口" |
| 玩家点 ×／按 Esc／点浮层外关闭 | `.decide-trigger`（现状） | 键盘玩家不该被扔回页首 |
| **自动展开**（`act:true`） | **不动焦点** | 玩家可能正在用键盘操作别处；自动弹层已经够打扰 |
| **等待态出现/消失** | **不动焦点** | 别人的事不该抢你的光标 |
| 「切换到玩家N」后整页重绘 | `.decide-trigger`（靠 `data-focus-key="decide-trigger"`，既有机制） | 节点被重建，必须回指 |
| Esc | 只在没有内层 `<dialog>` 时关浮层（`dialogOpen()` 既有判断） | 两层模态抢 Esc 的老问题 |

**禁止焦点陷阱**：浮层是非模态的（`role="group"`，不是 `dialog`），不得 `preventDefault` Tab 逃逸。

### 10.2 ARIA 用法

```html
<button class="decide-trigger" aria-expanded="true|false" aria-controls="decide-pop"
        aria-label="探险阶段 · 投入角色，已选 3 名（意志 6）" data-tone="todo|forced|wait|info">
<div class="decide-pop" id="decide-pop" role="group" aria-labelledby="decide-title">
  <h2 id="decide-title" tabindex="-1">…</h2>
```
- `aria-expanded` 必须与 `pop.open` 同步（现有一处遗漏：`closeQuiet()` 手动 `setAttribute`，但 `outsidePointer` 之外的路径要复查）。
- `.decide-hint` **去掉** `aria-live`（现在每次勾选都播报数字，读屏被淹没），改由 `#decide-announcer` 播一次。
- 跳过按钮必须能 Tab 到：`本次跳过` 用真 `<button>`（已满足），`disabled` 时用 `aria-disabled` 保留可聚焦（这样读屏能念出"已跳过"），**不要用 `disabled` 属性把它从 Tab 序列里删掉**。
- 形状语义必须有文字兜底：`aria-label` 前缀「强制」/「等待」（方块/空心圆对读屏不可见）。

### 10.3 触控与动效

- 触控目标：`pointer:coarse` 与 `≤760px` 下 ≥44×44；`pointer:fine` 桌面胶囊 ≥24 高（当前 26 ✓）。
- `prefers-reduced-motion:reduce`：`decideIn` 入场动画（已有 `animation:none`）、`decidePulse` 闪点（**新增，必须同一条规则**）、`quest-progress-fill` 过渡。
- 高对比模式 `@media (forced-colors:active)`：状态点用 `border` 保证可见（`background` 会被系统色覆盖），形状（方块/圆）在此模式下是唯一有效通道。
- 对比度：**四态取值以 §7.2 唯一真相表为准，本节不复述任何数值**（复述过一次就分叉过一次：上一版这里留着按 mat 算的比值，与表里的触发条底值对不上，等于拿错的数去"证明"达标）。判读时只有两条硬要求：① **分母一律取元素实际所在的底面**（状态点坐在 `.decide-trigger` 的 `--surface-wash #f1ead3` 上，不是 mat，两者差出近一倍）；② 图形部件按 3:1 判，不按 4.5:1。**文字不受点色影响**——语气同时由标题前缀（「强制 ·」「等待 ·」）承载。装饰性金线/竖条（`--gold-line` / `--line-strong`）不参与对比度判定，**不要为了"达标"去加深它们**，否则"结构线"会被用成"另一种文字色"。
- `forced` 必须是 `--accent-red`，**不得用金**：与阶段竖轴 `rail-win-line[data-timing="forced"]` 同源（见 §7.2）。
- 小字角标一律 `--ink-2`（对 `--surface-sunken` 5.36）。`--ink-3` 只许做描边、图标笔画、禁用态、≥24px 大字。

---

## 11. 高风险交互与降级方案

| 风险 | 场景 | 后果 | 降级 |
|---|---|---|---|
| **误点跳过** | 候选级「本次跳过」紧挨「选择能力」 | 玩家以为能用却没触发 | `本次跳过` 用 ghost（无边框无填充），`选择能力` 用 secondary；二者间距 ≥ `--space-2`；跳过必须写日志（可追溯） |
| **误把"关窗"当答完** | 玩家点浮层外 | 决策被静默丢弃 | `outsidePointer` 只改视图；`decisionAnchor` 不变时不再自动弹（尊重用户），但触发条 tone 保持 `todo`（不改灰），提示"这事儿还没过去" |
| **forced 窗口卡死** | 强制定时被 `disabled` 挡住且无替代 | 无法推进 | 铁律：**任何时刻必须存在至少一个可点控件**；若阶段面板全 disabled，`windowTail` 必须提供 `结算〈步骤名〉 →`（用 `WindowEngine.next` 或该阶段 `move`），并用 `title` 说明为什么被挡 |
| **回执常驻** | 引擎异常停在横置 | 玩家以为卡住 | 10 秒后文案转「停在横置已超过 10 秒，可用日志撤回上一步」+ 指向日志区（不做自动回退，状态不可在 UI 层擅自改） |
| **他人的事被打断** | 多人同机，玩家1 在出牌 | 弹层盖住手牌 | 等待态 `act:false`，只在标题行闪 2 次 |
| **浮层遮住要点的卡** | 浮层 680×413 向上弹 | 点不到桌面卡 | `fit()` 既有按触发条到顶距限高；本次不新增机制，只需保证回执/等待态**不自动展开**（少开一次窗就少一次遮挡） |
| **静默不可反悔** | `mute` 记 forever | 整局不再提示 | 强制 `keep='once'`；`restore()` 必须在浮层底部常驻可见（不是设置页深处） |

---

## 12. 验收断言建议（写进 `scripts/check-*.cjs` 的可测判据）

> 风格与既有脚本一致：`playwright-core` 起浏览器 → 读真实 DOM 几何与 `getComputedStyle` → 比对数值/布尔。每条给出**可测判据**，不写完整脚本。

| 规则 | 判据（可直接断言） |
|---|---|
| R1 无候选不出现 | 构筑"引擎无事可问"局面（进入资源阶段且无 pending/choice）后：`document.querySelectorAll('.decide-box').length === 0`，且 `.decide-trigger` 的 `getBoundingClientRect().height === 0`（节点不存在即用 `===0` 的计数断言） |
| R1 反例/回执 | 名单锁定期：`.decide-box` 存在；`document.querySelectorAll('.decide-body button').length === 0`；`.decide-trigger.dataset.tone === 'info'`；`document.querySelector('.decide-pop') === null`（未自动展开） |
| R2 纯被动 | 进入刷新阶段 7.2 重置卡牌（`s.refreshing.step==='completed'` 且无候选）后 `.decide-box` 计数为 0；`#app` 文本含该步骤日志 |
| R3 forced/optional 可辨 | 战斗 6.1：`.decide-trigger.dataset.tone === 'forced'`；`getComputedStyle('.decide-dot').borderRadius === '1px'`；展开后 `.decide-pop.innerText` **不含**「跳过」。切到 6.2 后 `tone === 'todo'`、`borderRadius` 为 `50%`、`[data-window="mute"]` 计数 ≥1 |
| R3 判定锚点 | `page.evaluate(()=>timingOf(state))` 在 3.2/5.2/6.1/6.3/7.3 返回 `'forced'`，在 6.2/3.1/5.3 返回 `'action'`（5 个 forced 全覆盖） |
| R4 继续追问 | 提交名单后（仍有他人未确认）：`aria-expanded === 'true'`（或 `'false'` 但 `tone==='wait'`）；标题含「等待」。连开同一能力两次后：`document.querySelector('.decide-pop') !== null` 且其 `offsetHeight > 0` |
| R4 收尾 | 全员确认且 `q.completed===false`：`.decide-box` 计数仍为 1（回执）；`q.completed===true` 后计数 0 |
| R5 只闪点 | 2 人局、`handView=0`、玩家1 未提交：`document.querySelector('.decide-trigger').dataset.tone === 'wait'`；`.decide-pop` 为 `null`；`getComputedStyle('.decide-dot').borderStyle === 'dashed'`（或 `outline` 存在）；`document.activeElement` **不是** `.decide-trigger`（没抢焦点） |
| R5 闪点次数 | `getComputedStyle('.decide-dot').animationIterationCount === '2'`；在 `prefers-reduced-motion:reduce` 上下文（`newContext({reducedMotion:'reduce'})`）下 `animationName === 'none'` |
| 等待态不可点 | 等待态展开后：`.decide-pop button` 计数 === 1 且该 button 的 `textContent` 含「切换到」；无 `primary` 类 |
| 状态载体（滤镜零残留） | `getComputedStyle(document.querySelector('.hand-card.unaffordable .card-face img')).filter === 'none'`；`.table-card.exhausted .card-face img` 的 `filter === 'none'` 且 `transform` 含 `rotate(90deg)`（几何变换允许，断言里要显式排除它，别把 `rotate` 当残留滤镜）；`.qp-card.is-gone .card-face img` 的 `filter === 'none'` **且整卡 `getComputedStyle('.qp-card.is-gone').opacity === '1'`**；`.hand-card.unaffordable` 的 `opacity === '1'`；`.rail-grp.past>.rail-head` 的 `filter === 'none'` |
| 状态非颜色单通道 | `.table-card.exhausted` 内存在文本「横置」；`.hand-card.unaffordable` 内存在 `[data-badge]` 且文本匹配 `/缺\s*\d/`；该角标 `getComputedStyle(...).color` 解析后等于 `--ink-2`（`rgb(84,91,77)`）而非 `--ink-3` |
| **灰度可辨 / 形状可辨**（visual §8 的硬验收，唯一能自动验的形态） | **① 三元组互异（CI 首选，零依赖）**：取四态的 `borderRadius × borderStyle × 填充(实心/空心)`，断言**两两互异**（相对断言，不各自等于固定值，将来微调圆角不误报）。⚠️ **不能用二元组**：基础类 `border:1.5px solid transparent` 让 `todo` 与 `info` 同时是 `50%/solid`，只有填充能分开。⚠️ **不要读 `borderWidth` 的值**：`dpr=1` 下 Chrome 把作者样式的 `1.5px` 折算成计算值 `1px`，断 `1.5px` 会假红；要断线宽就读 `document.styleSheets` 里的**作者样式**，只断「`wait` 与 `info` 等宽且非 0」（红线是"描边不能被做没"，不是那个数字）。**② 虚线没被小尺寸吞掉（像素法，不引 PNG 解码器）**：同 clip 各截两张 → `info` 两张逐字节一致（可复现）、`wait` 两张一致（差异不是抖动）、`wait ≠ info`（缺口真的画出来了）。三条一起过才算数 |
| a11y 触控 | `pointer:fine` 下 `.decide-trigger` 高度 ≥24；`newContext({hasTouch:true, viewport:{width:390}})` 下 ≥44 |
| a11y 键盘 | `page.keyboard.press('Tab')` 直至 `document.activeElement.dataset.window === 'mute'` 可达（断言 Tab 次数 < 30）；关闭浮层后 `document.activeElement.classList.contains('decide-trigger')` |
| a11y 播报 | `document.querySelectorAll('#decide-announcer').length === 1`；`.decide-hint` 的 `getAttribute('aria-live') === null`（已移除） |
| 文案统一 | `.decide-pop` 内不出现 `全队继续到下一决策点` / `跳过记录` / `提交暂定防御名单` / `处理卡牌响应` 四个旧串 |

建议新脚本：`scripts/check-window-rules.cjs`（R1–R5，几何+计算样式）、`scripts/check-state-carriers.cjs`（§9 全表）、把文案统一断言挂进 `scripts/check-decide-seat.cjs` 的现有 boot 流程。

---

## 13. 落地改哪里（给前端的最小清单）

| 文件 | 改动 |
|---|---|
| `desktop-ui.js` `DecisionUI.pending()` | 五个出口都返回 `{kind,title,body,act,forced,owner}`；`windowTail` 在 forced 步骤且阶段面板已有按钮时返回 `''` |
| `desktop-ui.js` `syncKey()` | key 从 4 段扩到 6 段（加 `decisionAnchor`、`act`）；`open = d.act && d.owner!==null? d.owner===pid : d.act` |
| `desktop-ui.js` `triggerHTML()` | `data-tone` 四值；状态点按 tone 换形状；`aria-label` 加「强制」/「等待」前缀 |
| `desktop-ui.js` `popHTML()` | `aria-labelledby="decide-title"` 取代重复的 `aria-label`；h2 加 `id` |
| `desktop-ui.js` `phasePanel()` | 回执分支收紧为「全员 confirmed 且 !completed」，加 `act:false` 标记、10 秒降级文案 |
| `desktop-ui.js` 新增 | `timingOf`、`isForced`、`STEP_ALIAS`、`consumedOf`、`decisionAnchor`（约 30 行，全部 try/catch） |
| `window-ui.js` `panel()` | forced 时不渲染「全队跳过本窗口」；`本次跳过`→ghost；`全队继续到下一决策点`→`全队跳过本窗口 →`；`恢复全部跳过记录`→`恢复已跳过的提示（N）`；无候选且 forced 时整块返回 `''` |
| `quest-ui.js` / `combat-ui.js` / `travel-ui.js` / `encounter-ui.js` / `refresh-ui.js` | 主按钮统一 `结算〈步骤名〉 →`；`处理…响应` 四份合并成一个函数；`提交暂定防御名单`→`提交防御名单` |
| `planning-ui.js` `strip()` | ① optional 分支拆成 `选择响应` + `不使用响应`（ghost），不要只留一颗开 dialog 的按钮；② **按已定方案 A**：`ch.task.optional===false` 时按钮前加 `■` 方块点（7×7，`--accent-red`）+ 紧随一行 `.small`「必须先处理，否则不能结束计划阶段」，**不新增触发条**（见 §7.2.1） |
| `phase-log.js` | 5.1 `beforeChecks` 的 `timing` 由 `'step'` 改 `'action'`（一个字符） |
| `style.css` | 删 4 处违规 `filter` + 2 处 `opacity` 衰减（§9.2 清单，共 7 处里 1 处合法保留、2 处死代码删掉）；新增 `.decide-dot` 四态形状、`decidePulse`（含 reduced-motion）、角标（字色 `--ink-2`）与徽章；`.decide-hint` 保持现状不加 live |

**工作量**：`desktop-ui.js` 约 80 行增改、`window-ui.js` 约 15 行、`style.css` 约 60 行、五个 `*-ui.js` 文案替换 20 处、一个字符的 `phase-log.js`。**不动 `engine.js` / `planning-engine.js` / 各阶段引擎。**

---

## 14. 已定的两个决策（team-lead 拍板，不再讨论）

**① 状态点「形状通道」：批准。** 四态按 **形状 + 填充 + 线型** 三通道编码，色相只做加成，见 §7.2 唯一真相表。`forced` 用 `--accent-red`（**不用金**，与阶段竖轴 `data-timing="forced"` 同源）。`DESIGN_SYSTEM.md` §5.6/§7 已由 visual 同步完成。

**② 计划阶段（phase 1）：方案 A，保持豁免触发条。** strip 里的强制项加 `■` 方块点 + 一行「必须先处理，否则不能结束计划阶段」，见 §7.2.1。理由：方案 B 会把 v0.15.74 用户明确否掉的「计划阶段桌面又有一行决策条」顶回来。`planning-ui.js` 那 1 处改动不阻塞其它工作。

> 此后若再出现"某个时机的窗口该不该显示"的分歧，一律回到 §0 的判断链与 §4 矩阵，不新增例外；确有例外，必须同时写明「为什么它不是决策窗口」并加进矩阵。

---

*v1.1 · 体验设计 · 判定矩阵 36 行；两个拍板点已定；所有代码锚点取自 v0.15.93 实际实现，未提出任何需要重写引擎的方案。*
