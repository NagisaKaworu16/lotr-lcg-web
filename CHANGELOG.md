# v0.16.0 · 窗口规则五条（引擎级+UI级）与 Vintage Analog 全站视觉体系（2026-10-30）

用户参照诡镇奇谈网页版（arkhamhorror.app，开源 Haskell+Vue）问「触发窗口是不是会一直提醒」，取证其
`runWindow`/`WindowAsk`/`abilityRidesAlong` 源码后提炼五条规则并要求落地，同时按 Vintage Analog（羊皮纸+sepia 暖调）
改版全站四个面。规范文档：`docs/design/WINDOWS.md`（36 行判定矩阵）、`docs/design/DESIGN_SYSTEM.md`（令牌全套）。

**一、窗口五条规则（引擎级 + UI 级）**
1. **无候选则窗口不存在**：`DecisionUI.pending()` 五出口全部先判「有没有必须由人完成的一步」，纯摘要不再开会话；
   `actionable()` 降为兜底，不再是唯一真相。
2. **骑乘式/被动不单独开**：同一时机的强制效果合并展示；回执面板收紧为「全员 confirmed 且 !completed」，
   `act:false` + 0 按钮 + `tone=info`（M17）。
3. **强制 vs 可选可辨**：forced 不渲染「全队跳过本窗口」，`本次跳过` 降为 ghost；计划阶段 forced 选择
   显示方块点 +「必须先处理，否则不能结束计划阶段」（`choiceSkip` 走 `R.resolveChoice(...,{skip:true})`）。
4. **同一时机结算完继续追问**：`syncKey` 升 6 段 `round:phase:kind:bodyHash:decisionAnchor:act`，
   `consumedOf()` 五项求和防「连开两次同名能力不重问」。
5. **他人窗口只闪点不弹层**：`owner` 入 key；状态点四态（todo 金实心圆 / forced 红实心方块 / wait 灰虚线圆 /
   info 灰实线圆）形状为主通道，灰度下仍可辨；`#decide-announcer`（aria-live）补读屏。
   新增 `scripts/check-window-rules.cjs`（47 项，含 7px 虚线的逐字节截图比对）。

**二、Vintage Analog 视觉体系**
1. **四层表面明度阶梯**：page #e1d7be → board #ede3c8 → mat #f7f1de → pop #fffcf2（ΔL* 4.2/4.7/3.8），
   墨色三档（--ink/-2/-3）、强调色三物理条件拆分（gold/gold-ink/gold-line 等 55 个令牌，7 个旧名保留别名）。
2. **滤镜归零**：7 处 `filter` 全部移除（4 活改状态载体、2 死代码删除、1 处打在文字上的改 `color` 通道）；
   `opacity` 压文字的 5 处改 `color`。卡面只允许通过 `img` 加载，不再重采样。
3. **七阶段数据色**（`phase-log.js` PHASE_COLOR，DESIGN_SYSTEM §5.7-c）：七色**等亮度**（对 --on-dark 恰 5.6:1，
   极差 0.04），日志流不因读到战斗条目变重；OKLab 彩度 0.082–0.100（陈年颜料带，参照赭石 0.079）；
   两两 ΔE 最小 0.079，旧值资源/旅行仅 0.025（几乎不可分）。**顺手修掉三处既有对比度失败**
   （旧计划/探险/旅行对白字 4.22/4.29/4.49 < 4.5）。资源与刷新有意留在冷侧（靛青是正当颜料），已在文档注明。
4. **实测口径收口**：新增 `scripts/check-palette.cjs`——断言六个面**实际渲染**的 CSS 颜色 ⊆ 调色板 ∪ 允许清单
   （源码 359 个去重色值里 38 个是令牌，数声明会严重高估，必须扫 computed style）。
   本轮共落地约 45 处调牌板外残留：legacy `.card` 组件整族、`details.cat-item` 边框（卡牌页 128 处）、
   侧栏图标/边框/小字、日志面板字面量（3 条硬失败：.log-count 2.85 / .log-empty 2.81 / .log-undo 4.41）、
   纯白 input/select、`#toast` 等。竖轴深底统一为 `--surface-rail`。
5. **圆角收敛**：六种旧圆角 → 三档尺寸（sm 6 / md 8 / lg 10）+ pill 形态；`--radius-xl` 退役并入 lg
   （2 处引用改写，令牌删除；行内块 3px 例外见 §1）。

**三、顺手修掉的既有缺陷**
1. **顶栏非活跃玩家标签数字几乎看不见**（P0）：`.player-tabs button .tab-stats b{color:var(--ink)}` 是浅底旧 SPA
   规则，v0.15.88 标签搬进深色 header 后实测 **1.34:1**（玩家2 的威胁/资源/伤害只剩暗影）。新增
   `.game-hud` 作用域改用 `--on-dark-2`/`--on-dark`（6.13/8.20:1），浅底的卡组页原规则保留。
2. **`.railPhase` 死按钮**：`phase-log.js` 阶段头的 `<button data-action="railPhase">` 全仓无分发分支，
   7 个阶段头点了没反应 → 改 `<div class="rail-head">`，连带新增 `data-action` 白名单护栏
   （源码指纹扫描，防 `b()` 批量改签名时把 `data-action="travelFlow"` 撕成 `data-action=""`）。
3. **对比度审计盲区**：`check-contrast.cjs` 原是选择器白名单，`.log-count`/`.threat-total`/`.tab-stats` 都不在内，
   报「0 条」但没扫。改为**全文字元素遍历** + 背景图承载护栏（数字坐在卡图/代币立绘上时 background-color 算不准），
   跳过数打印出来。`check-auto-phase.cjs` 的 `/usr/bin/chromium` 硬编码改为候选探测。

**四、待办（下一轮）**
- 活跃玩家标签底色 `#527085`（--on-dark 4.37 / .tab-stats 4.12 均不达标）、可选中卡片边框 `#79b9db`（冷天蓝，
  `--accent-gold` 对深卡面仅 2.73）、竖轴 trigger/action 两条时机线（`#e8c169` 过艳 / `#6ea86b` 全页唯一鲜绿）
  ——三项已派设计裁定，未回，`check-palette.cjs` 允许清单与 `check-contrast.cjs` 的 3 条 FAIL 均为已知待办。
- `check-quest-r0` 27/30、`visual-acceptance-v` 26 红：均为本轮之前既有，`git show HEAD:` 复跑一致，非回归。

**验收**：`python scripts/check_project.py` 503/503；`check-window-rules` 47/47；`check-state-carriers` 45/45；
`check-palette` 6 面 0 越界；`check-hud-row` 69/69；`browser-check` ok=true；`check-contrast --min 4.5`
仅剩 3 条已知待办（上）。截图：`docs/browser-acceptance/vintage-{1920,1440,1366,1280}.png`、
`phase-color-compare.png`（新旧七阶段色对照）、`window-rules-2p.png`。

# v0.15.93 · 决策条归位：并进「队伍与手牌」标题行，浮层收窄、面板标题降级（2026-10-29）

用户问「各阶段弹窗所归属的模块/功能有没有更简约的显示或触发方式」。实测现状：决策条 963×**42px**
独占一行夹在角色行与手牌之间（既不属于牌桌也不属于手牌）；浮层 880×425 向上弹，盖住公共牌桌 51%；
「遭遇阶段」这类标题在触发条、浮层头、面板 h2 上出现三次；单人局还保留「操作玩家」下拉 + 玩家名两层控件。

**改动**：
1. **决策条归位**：`.decide-box` 从角色行之后搬进 `.bottom-deck > .zone-heading`（「队伍与手牌」标题行），
   压成 26px 胶囊，与右侧「结束阶段」同属「这一阶段该做什么」的一条动线——整行 42px 还给角色行与手牌。
   触发条排在「结束阶段」右侧（`.phase-door` 改 `margin-left:auto`），浮层右缘因此与整行右缘对齐。
2. **浮层收窄并贴右**：880 → `min(680px, 100vw−48px)`，左侧让出探险区与探查区（做决定要看的信息）；
   窄屏 ≤760 仍是固定底部抽屉，不受影响。**宽度不能再窄**：560 时选人网格折行，浮层反变 731px 高。
3. **浮层自适应限高**（`DecisionUI.fit()`，render 末尾调用）：触发条上移后向上弹的可用高度从 608px 缩到约 413px，
   派遣名单这类长面板（493px）会顶出视口顶部、连标题与 × 都看不见。改为按「触发条到视口顶」的真实距离
   写 `max-height`（`top−16`，下限 220），差额交给 `.decide-body` 滚动；窄屏 ≤760 跳过（fixed 抽屉）。
4. **面板标题降级**：`.decide-body .panel > h2` 由 19px 收到小标签尺寸，不再与浮层标题抢层级（原「三层同名标题」）。
5. **单人局隐去玩家选择器**：四处「操作玩家 `<select id="planning-actor">`」（遭遇／战斗／刷新／旅行）
   改成 `ps.length>1` 才渲染——单人时 actor 恒为自己，这层控件没有意义（遭遇弹窗 6 行 → 4 行）。

**工程坑**：
- `combat-pick-tests.cjs` 的 `pop()` 原本取「浮层起点到页尾」，决策盒上移后角色行落进尾巴里，
  每张卡都带 `data-desktop="pick"`，攻击者缩略图被数成 6（应为 3）→ 改为按 `<div>` 标签配平截到浮层闭合处。
- `check-pick-graphic` 的「浮层体内无滚动」在触发条上移后不再成立（可用高度由视口顶决定），
  阈值改为「滚动 ≤ 24px，提交按钮基本在一屏内」。

**新增验收** `scripts/check-decide-seat.cjs` 48 项（四档）：触发条在标题行内且高 ≤ 28、与「结束阶段」同排、
角色行与手牌之间无决策横杠、标题行高 ≤ 32、浮层顶部 ≥ 0 / 宽 ≤ 700 / 右缘对齐触发条、单人局无玩家下拉、
无横向溢出、手牌在视口内。

# v0.15.92 · 角色卡代币改「左列属性 / 右下状态」角标双簇（2026-10-29）

v0.15.91 的双带（属性 1×4 贴上沿、状态 1×2 贴下沿）用户上手后反馈「左列右下更舒服」，本版换成角标双簇：

**改动**：
1. **属性 4 枚改竖列贴卡面左缘**（`flex-direction:column`、`top:3px;left:0`、`--tk:18px`、`gap:2px`，
   整簇 18×78）——接手实体卡左侧印刷属性图标的位置，宽度只占左缘一条，比横带更少压插画主体。
2. **状态 2 枚改竖排右下角**（`bottom:2px;right:0`、`--tk:16px`）——窄簇回避牌文正中。
3. **同步对手小卡**：`other-player` 跟用同一套角标簇（16px，竖列）；矮屏（≤820 高）两档
   `other-player` 的状态簇显式回到横排，避免继承竖列后两枚竖着挂到卡外。
4. **矮屏卡面收尺寸**：1366/1280 档属性 `--tk:15px`、状态 14px，左列 4 枚（66px）仍落在卡面高度内。

**实测（1440 档，卡面 86×120）**：属性簇贴左缘 5–23px、自上而下 8→86；状态簇贴右下角 75–91 × 89.9–123.9；
牌文带遮挡 16.6%（双带 16.3%、改前 22%）；卡高 146.2 不变。1366 档遮挡 25.8%（卡面缩到 92.6 高，仍 ≤ 30% 上限）。

`check-card-tokens.cjs` 断言随之改写为「同一列 / 左条占宽 ≤ 40% / 右下角距右 ≤ 3、距底 ≤ 4」共 64 项（四档）。

# v0.15.91 · 角色卡代币改「上属性 / 下状态」双带（2026-10-29）

改前：属性四条是 2×2 方块（47×46），整体 `top:-8px` **悬在卡面上方 7px**，同时盖掉插画上缘约 34px；
资源/伤害两枚（47×54）压在**牌文框正中**，把最该读的规则文字挡住。卡面左缘本来就印着四条属性图标，
大代币却叠在画面中央，信息重复又抢戏。

**改动**：
1. **属性 1×4 横带**：贴卡面上沿内侧（92×18，`--tk:18px`，`justify-content:space-between`），
   意志/攻击/防御/生命固定顺序，探险与战斗时一行扫完。
2. **状态 1×2 贴下沿**：资源/伤害缩到 18px 贴卡面底边（`bottom:1px`），避开牌文主体。
3. **代币锚卡面而非整卡**：新增 `.card-frame` 包裹层（属性行 + 卡面按钮 + 状态行），
   卡名换行/附加「已投入」时状态行不会上移进插画。
4. **数字随代币缩放**：`.tk b` 原本硬编码 14px，18px 圆里会溢出；改
   `clamp(9.5px, calc(var(--tk) * .58), 14px)`（限定 `.card-frame` 内，不影响面板大代币）。
5. **零值降噪**：`data-n="0"` 的代币 `opacity:.5`（仍渲染，规则需要它）。
6. 对手小卡（`other-player`）沿用同一套双带，代币 16px；原规则依赖被删的居中定位，已显式给四边。

**测量**：属性带 86×18 落在卡面内（改前 -7px 悬空）；状态带 y≈621/牌文带 592–637；
牌文带遮挡 22%→16.3%，插画上缘遮挡 -34px；卡高 146px 不变（玩家区高度预算不受影响）。

# v0.15.90 · 探险卡名悬浮牌文卡：悬停看两面文案，翻面达成有金色徽章（2026-10-29）

v0.15.89 把探险区收成一行后，卡名「蛛蝇密布」只剩一个词——想知道它到底怎么运作得点开「牌文 ▾」。
这一版把牌文变成即指即显：**悬停（或 Tab 聚焦）卡名，向下弹出一张悬浮卡**，
同时把「探险值攒够、该翻面了」从隐式状态变成显式标记。

**改动**：
1. **卡名悬浮牌文卡**：收起条与展开态标题里的卡名包进 `.quest-name`，悬停/键盘聚焦弹出 `.quest-tip`
   （宽 min(430px, 100vw−64px)，向下弹落在 `.public-table` 内部，避开它的 `overflow-y:auto` 裁剪）。
   内容 = 卡名 + 翻面门限 + A面（入场效果）+ B面（翻面后文案）+ 状态行；当前生效的一面高亮。
   卡名带 `aria-label`（完整两面牌文）供读屏，`tabindex=0` 供键盘触达。
2. **翻面状态可视化**（进度 ≥ 门限时，不靠悬停也能看见）：
   迷你进度条转金（`.full`）、卡名旁亮出「B面生效」金徽章、悬浮卡状态行说明
   「探险值已满：B面文案生效中」，展开态追加金句「探险值已满 · B面文案生效中」。
3. 29 段矮屏 `.quest-zone{max-height:108px;overflow:hidden}` 收窄到展开态
   （`:not(.quest-collapsed)`），否则悬浮卡会被收起条裁掉；36 段 `strong` 去掉
   `overflow:hidden` 省略号（同理会剪悬浮卡，卡名本身很短不需要）。

**测试**：planning-dom-tests 新用例（悬浮卡两面原文、aria-label、翻面徽章/金条/状态行）；
check-table-slim 增补 E 组 5 项/档（悬停弹出、落在 public-table 内、不越视口、翻面态徽章+金条）。

# v0.15.89 · 牌桌区瘦身：探险区收成一行触发条，地点卡并入探查区行首（2026-10-29）

v0.15.87/88 依次收了玩家区与顶栏，公共牌桌顶部还剩最后一块常驻大件——
「当前探险」区（卡图 + 牌文 + 进度条，约 110~150px）和它右侧独占一列的「当前地点」卡（行高 ≥155px）。

**改动**：
1. **探险区可收起**：默认收成一行标题条（约 26px）——「当前探险 · 阶段」+ 剧本名 + 迷你进度条 + 「牌文 ▾」；
   点开才渲染卡图、牌文与门限说明。开局设置与开局翻牌窗口期间强制展开（那两步必须读剧本牌文）。
   开合是纯视图操作（`app.js` 的 `questZone` 动作翻转 `questZoneOpen`），刷新重置、不进撤销历史、不写存档。
2. **地点卡搬家**：`.quest-location-row` 包装层退役，「当前地点」卡带竖排「地点」分隔并入探查区行首
   （画法同 v0.15.87 玩家区的「交战」分隔）；无地点时探查区照旧。省下整行 155px+ 的行高。
3. CSS：新增 36 段。`.public-table>.quest-zone` 显式退出「分区吃满剩余」的 flex 分配
   （否则收起了也会被 `.public-table>.table-zone{min-height:106px}` 撑回 106px）。

**测试**：498 项（新增收起/展开与地点合并用例；进度代币用例改为先展开探险区再断言）。
真实浏览器验收：`scripts/check-table-slim.cjs`（四档视口：默认收起一行、地点并入探查区、
展开/收起往返、开局阶段强制展开、手牌不被挤出视口）。`check-onescreen` 的 `.active-zone` 探针改 `.staging-zone`。

# v0.15.88 · 顶栏收成一行：剧本/阶段与玩家状态并入菜单栏，操作条撤掉提示语与品牌行（2026-10-28）

用户实测：「这两个文字可以移除；这两个信息框架可以移到顶部菜单栏，但是需要设定只在游戏中才显示。让桌面获得更大的空间」。

**此前顶部有两条横带**：
1. `header` 第一行是导航（首页／卡牌／我的卡组／说明 + 撤销／导出／导入）；
2. `#gameHud` 因为 `flex-basis:100%` 被迫独占**第二行**（约 49px），
   左半是「穿越幽暗密林 · 第 2 回合 · 1 人同机 · 标准 · 遭遇」，右半是「玩家1 威胁/资源/伤害 + 重新选择剧本」；
3. 紧接其下还有 `.operation-dock` 一行（约 34px）：提示语主标题 + `MIDDLE-EARTH EXPEDITION · vX`。

一屏之内，同一件事被写了两遍半：剧本与回合在 HUD，当前阶段在 HUD、阶段竖轴、决策浮层标题、
结束阶段按钮的 title 各写一次，品牌行纯装饰。

**改动**
- `.game-hud` 在 ≥1280px 不再独占一行：`order:2` 排到导航之后、历史按钮之前，
  玩家标签从「名字／数值两行」改成一行（名字 + 三个数字），高度 26px 与导航齐平。
  HUD 里的元信息只留「第 N 回合 · 当前阶段」——人数由玩家标签数量表达，
  难度与剧本集名收进 `.hud-name` 的 `title`，悬停即见。
- 顶栏仍只在「对局页签 + 对局进行中」显示（`syncGameHUD()` 判据不变）；
  ≤1279px 是纵向单屏，保持原来的换行布局，不去挤导航。
- `.operation-title` 只留状态 chip 与阶段推进按钮；提示语降级成整条的 `title` / `aria-label`，
  品牌行搬到「说明与完成范围」页（`VERSION vX` + 页脚 `MIDDLE-EARTH EXPEDITION · vX`）。
  没有 chip、没有推进按钮、内容区也空时，整条 dock 高度归零。

**收益（1366×768）**：顶栏 101 → 47px，操作条 34 → 0px，牌桌上沿从 y=109 提到 y=60，
探查区/地点区可用高度 220 → 约 300px。

# v0.15.87 · 玩家区瘦身：附属挂卡名、交战并入角色行，手牌不再被挤掉（2026-10-28）

用户实测两条：「添加附属之后，手牌就看不到了」「交战区有怪物之后，角色卡和手牌都看不到了」。

**根因不是高度不够，而是「行数会随状态增加」**：玩家区是一条固定高度的窄带
（1440×900 下 450px），里面原本是「模块标题 → 附属行 → 角色行 → 决策条 → 手牌行」
一条纵向堆栈。出 1 张附属就多 184px 的独立行（手牌被推到 y=865），
再交战 1 名敌人又多 151px（手牌 y=1021）。更糟的是 `.bottom-deck` 是 `overflow:hidden`，
手牌不是「要滚一下」，而是**直接消失、滚也滚不到**。

## 改法

- **附属不再独立成行**：改成宿主卡卡名右边的一枚 15×19 迷你卡图徽章
  （点开看牌；当前窗口能用就打金环并直接触发能力）。角色卡行高度只从 178.4 涨到 178.4。
- **交战区并入角色行**：同一行、同一条横向滚动，中间一道竖虚线 + 竖排「交战」。
  已交战的敌人卡不再显示「威胁/交战」与暗影计数，只留「攻击 · 防御」+「生命」两行。
- **手牌永远贴底**：`margin-top:auto` + 角色行 `flex:1 1 auto` 吃剩余高度并内部滚动；
  同时清掉手牌行那条 `min-height:calc(96px*600/424+10px)`（≈146px）的死下限——
  它比 `--hc` 推导出的 flex-basis 还大，矮屏下白吃 20px。
- **「本阶段说明」在桌面整块去掉**（右栏窗口竖轴已把当前窗口与后续时机写全）。
- **矮屏（≥1280 宽且 ≤820 高）**：玩家区 356→372px，角色卡 76 宽、敌人卡 84 宽、
  手牌 84 高；1366×768 下牌桌区仍是 222px（改动前 192px）。

## 验收

新增 `scripts/check-mat-layout.cjs`：真实开 1 人局，依次摆出「基线 / +附属 / +交战 /
3 名敌人 / 宿主离场 / 探险阶段决策条在场」六态，逐态断言 `手牌底 ≤ 玩家区底`、
玩家区无纵向滚动、角色行只横向滚动，并量附属徽章与敌人卡说明是否完整。
1280×800、1366×768、1440×900、1920×1080 四档各 26 项全过。

回归：CI 497/497、check-quest-panel 40、check-taskbar 24、check-layout 17、
check-pick-graphic 33、check-decide-art 16、check-quest-r0 30、check-attachment 5、
check-setup-reveal 13、check-window-skip 8、check-score 19、check-draw-toast 11、
browser-check ok=true。

# v0.15.86 · 浮层内改图形化表达：空态图标卡 / 步骤圆点 / 代币数值（2026-10-28）

- **用户反馈**：「弹窗内如果能以图形化显示的，最好不要用文字展示」——截图里战斗浮层只剩两行灰字「没有合法攻击目标」「该目标没有可派出的角色」，底部又是一条长句「暂定基础攻击 3 · 请先点选目标敌人 · 已选 2 名」。
- **四类改动**：
  1. **空态卡 `.pick-void`**：图标 + 一句结论 + 一句出路。斜杠靶心＝没有目标、斜杠卡牌＝没有角色、箭头入卡＝还没选目标。图标是内联 SVG（不额外请求、跟随文字色），结论加粗、出路用副行写清「下一步点哪里」，替代原来那行像报错的灰字。
  2. **步骤圆点 `.pick-step-dot`**：编号 + 状态色（已完成绿勾／当前金圈／未开始灰底）。攻击选择顺势改成**左右两栏**——左栏「1 攻击目标」、右栏「2 参与角色」，中间一道竖虚线；上下堆叠时目标行＋角色行＋摘要卡会把浮层顶到 62vh 上限并内部滚动（实测内容 692px / 容器 537px），「提交暂定攻击名单」被挤出可视区，并排后降到 490px 一屏放得下。
  3. **草稿数值代币化**：`暂定基础攻击 3` 这类长句拆成「代币图标 + 标签 + 大字数字」的 chip，素材直接复用牌桌的 `assets/tokens/{attack,defense,hitPoints}.png`；已选人数改深色徽章；未选目标时不再摆一排 0（看着像「已经算过了，结果是 0」）。
  4. **一致性修复**：没有合法攻击目标时，草稿 `target` 自己归零（原来 `doneAttacks` 变了但 key 不变，草稿残留 → 同一屏「没有可攻击的敌人」＋「已选 2 名」自相矛盾）；同时摘要卡改口为「这次攻击可以直接放弃，不消耗任何资源」，不再叫人去选一个不存在的敌人。
- **面板美化**：`.table-selection` 在 `.decide-body` 里之前没有任何专属样式（`.operation-content .table-selection` 那条在浮层里不命中），一直是裸文本块；这次做成浅色卡（玩家徽章 → 代币数值 → 已选徽章 → 说明 → 按钮），提交按钮用 CSS mask 加了一枚勾选图标（跟随按钮文字色，禁用态自动变灰）。
- **验收**：新增 `scripts/check-pick-graphic.cjs`，真实 Chrome 开 2 人局、摆到战斗攻击选择，依次断言三种状态并各拍一张截图——1440/1024 各 33 项、760 各 28 项全通过（窄屏两栏改单列堆叠，滚动属预期，故「并排／一屏放得下」只在桌面档断言）。CI 497/497；check-decide-art 16、check-setup-reveal 13、check-taskbar 24、check-quest-panel 40、check-quest-r0 30、check-attachment 5、check-window-skip 8、check-score 19、check-draw-toast 11、check-layout 17、browser-check ok=true 全绿。

# v0.15.85 · 抽牌浮层不再在每次刷新后重播（2026-10-28）

- **用户反馈**：「为什么每次强制刷新都会出现抽卡弹窗」——每次 Ctrl+F5 都弹一次「资源阶段 · 抽到的牌」，显示的还是很久以前那笔抽牌。
- **根因**：引擎把最近一次资源阶段抽牌记在 `s.resourceDraw`（`{id, round, cards}`），这个字段**随存档一起落盘**；而「已经展示过」的标记 `lastDrawToast` 只是个内存变量，刷新即归零。`render()` 每次都调 `showDrawToast()`，判据是「`resourceDraw.id !== lastDrawToast`」——于是加载存档后必然判定为「有一笔没展示过的抽牌」，把旧抽牌重弹一遍。
- **改法**：判据从「状态里有没有没展示过的抽牌」改成「**这一次操作是不是刚抽了牌**」。新增 `pendingDrawId`（app.js）：`mutate()` 里比对操作前后的 `resourceDraw.id`，只有本条操作真的产生了新抽牌才记下 id，`render()` 消费一次即清空。
  · 刷新／打开旧存档／切换页签／撤销回退 → `pendingDrawId` 为 null，不弹；
  · 真抽牌（推进到资源阶段）→ 照常弹一次，4 秒自动关闭、可点 × 或点浮层外关闭。
- **为什么不用 localStorage 持久化「已展示的 id」**：`resourceDraw.id` 取自 `s.serial`，**每局从 0 重新计数**，跨局会撞号；持久化反而会让新一局的首抽被旧记录吞掉。绑在「本次操作」上是无状态的，天然不会跨局、跨刷新误判。
- **验收**：新增 `scripts/check-draw-toast.cjs` 11 项，真实 Chrome 开 2 人局实测：真实抽牌（mutate → 引擎 `resourcePhase`）弹一次且列出卡名/费用；同一笔抽牌重复 `render()` 不再弹；存档里确认仍有 `resourceDraw`（复现前提）→ **整页 reload 后不弹、存档内容不丢**；刷新后再抽一次仍照常弹（防止一刀切把正常提示砍掉）；点 × 可关、约 4 秒自动关；无脚本错误。CI 497/497 不变。

# v0.15.84 · 决策浮层里的卡图收成 --card-w 缩略图（2026-10-28）

- **用户反馈**：「阶段六窗口中的图片太大了，规范其显示尺寸」——阶段6「暗影取消／结算」浮层里的暗影／遭遇卡图占满整个浮层宽度，牌名、暗影文字与「结算／继续」按钮全被顶到可视区之外（截图里只看得到一张巨大的卡图）。
- **根因**：`.card-art` 的基础样式是 `width:100%`，而 `.decide-pop` 的宽度是 `min(880px,100vw-48px)`——一张 424/600 的卡图于是摊成约 800×1130px。操作条时代靠 `.operation-content .card-art{max-width:100px;float:left}` 收过一次，v0.15.81 把面板整体搬进 `.decide-pop` 之后，这条选择器不再命中任何节点，卡图就回到了满宽。
- **改法**（style.css，18c 段）：`.decide-body .card-art{float:left;max-width:var(--card-w);margin:0 12px 8px 0}`——尺寸取 `--card-w`（132px，与牌桌卡牌、探险区立绘同宽），正文与按钮绕排到右侧；`.decide-body .notice::after{clear:both}` 收住浮动，避免按钮挤到图下错位。卡图底下那行「英文卡图 · 本地 · 点击放大」在 132px 里要折三行、且无决策价值，按 `.operation-content` 的旧例隐藏（`.image-loading-note{display:none}`）。要看全图仍点卡图本身（它本来就是「放大卡图」按钮）。
- **范围**：所有渲染在浮层里的单张卡图统一生效——暗影窗口、暗影效果、遭遇卡结算、当前地点、旅行、强制选择里的牌。缩略图网格（`.qp-card`）本就是独立尺寸，不受影响。
- **不误伤**：开局翻牌的 `.setup-reveal` 是 96px 竖排格子版式，追加 `.decide-body .setup-reveal .card-art{float:none;max-width:none;margin:0}` 还原，实测仍是 96px、不浮动。
- **验收**：新增 `scripts/check-decide-art.cjs`——把真实浮层骨架注入页面，在 760／900／1024／1440 四档宽度下量算，12 项断言全通过：卡图 132×187px（浮层宽 880px）、宽度＝`--card-w`、左浮动、牌名文字左缘 196 ≥ 卡图右缘 184（确实绕排而非被推到图下）、notice 高 219px（原来 1130px）、浮层高 384px 未触 62vh 上限且体内无滚动、「结算本张暗影／继续」在可视区内、`.setup-reveal` 仍 96px、无脚本错误。CI 497/497 不变。

# v0.15.83 · 战斗防御／攻击也改为浮层内缩略图选人（2026-10-28）

- **用户反馈**：「为什么没有显示投入角色防御的弹窗」——战斗防御选择时浮层里只有一句「点击角色暂定防御」和提交按钮，看不到任何可选角色。
- **根因**：v0.15.81 把决策面板统一成**覆盖桌面的非模态浮层**，但 defense/attack 的选人方式仍是「点桌面上的角色卡」（`.character-card.selectable`）。浮层一开就把角色卡盖住，桌面卡既点不到也看不见；v0.15.82 之前面板只有 96px 高、不遮桌面，所以问题没显形。
- **改法**：`CombatUI.popExtra(s,pid)`（combat-ui.js）——与探险投入角色共用同一套缩略图视觉（`.pick-panel/.pick-grid/.qp-card`）与同一份草稿（`DesktopUI.draft`），拼在 `.decide-pop` 体的最前面：
  · 防御：一次列出全部候选防御者（英雄＋盟友，含警戒角色），缩略图显示攻/防/生命代币与卡名，点缩略图 = 点桌面卡（`data-desktop="pick"`），已选金边＋「已选」角标；
  · 攻击：分两步——先给目标敌人的缩略图（`data-desktop="target"`，选中打「目标」角标），选完目标再列出可派出的攻击者；两步都有空态文案（无目标／无角色）。
  · 浮层标题从含糊的「选择要处理到的角色」改为「战斗 · 选择防御角色」／「战斗 · 选择攻击目标与角色」（`CombatUI.selectTitle`）。
- **顺带修一个复发坑**：`stableBody()` 补上战斗草稿数字的归一（暂定防御／暂定基础攻击／敌人当前攻击／目标防御／基础伤害预估／已选 N 名）。不归一的话，关掉浮层后在桌面上点一张角色卡会让浮层 key 变一次、自己弹回来，正好盖住玩家要点的下一张卡（探险阶段 v0.15.81 踩过同一个坑）。
- **回归**：新增 `combat-pick-tests.cjs` 4 项（防御网格数量＝候选数且走 pick 路径、点缩略图入草稿且预览同步、攻击先目标后角色且提交可用、关浮层后点桌面卡不复弹）。CI 493 → 497。

# v0.15.82 · 「放弃本窗口行动」合并进主推进按钮：点一下就全队让过（2026-10-28）

- **用户疑问**：「窗口中的放弃本窗口行动到底是什么意思，为什么我每次都要点了这个才能开始选择投入角色」。查明：探险阶段在派遣(commit)之前有一个规则行动窗口(beforeCommit)，引擎 `move()` 硬校验「每位玩家须确认放弃本窗口行动」，于是单人局也要「点放弃 → 再点开始投入」两步；战斗/旅行/遭遇/刷新的行动窗口同一形态（`requirePassed`/`beginChecks`/UI 的 allPassed 禁用条件）。
- **改法**：新增引擎函数 `passWindow(s)`（engine.js，随 api 导出）——把当前阶段所有存活玩家直接记为已让过，**不经过 `passAction` 的窗口校验**（`afterStaging` 这类 framework 步骤窗口是关着的，passAction 会拒绝）；有暂定行动未确认或 `actionLocked` 时返回 false 拒绝代点。五个阶段的「主推进按钮」点击时先调它，再调各自的 move/finish/beginChecks。
- **UI 同步**：`quest-ui.js`（beforeCommit 紧凑面板 + 详细模式行动窗口）、`combat-ui.js`、`travel-ui.js`、`encounter-ui.js`、`refresh-ui.js` 的主按钮 disabled 条件去掉 `!全员已放弃`——只剩「有暂定行动／行动已锁定」才禁用；文案改成「准备好后直接点下方按钮，全队即视为放弃本窗口」。逐人「X：放弃本窗口行动／取消放弃」按钮**保留**（精细控制与热座场景仍可用），只是不再是必经步骤。
- **行为对比**：单人局 beforeCommit 从「点放弃 → 点开始投入」（2 次）变为「点开始投入」（1 次）；2 人热座同样一次点击即替全员放弃并进入派遣（`finalPasses` 由 `move` 清空，符合原有语义）。
- **测试**：新增 `pass-window-tests.cjs` 4 项（beforeCommit 一次点击进派遣且主按钮不 disabled、有暂定行动时主按钮禁用且 `passWindow` 拒绝代点、passWindow 对探险/战斗/刷新三阶段都补齐全员让过、窗口关闭的 afterStaging 也能让过并推进）。CI 489 → 493。

# v0.15.81 · 决策面板统一为「一行触发条 + 非模态浮层」：全部阶段需要玩家操作时自动弹出（2026-10-27）

- **用户报障**：「为什么阶段窗口还在桌面上，之前的要求不是作为弹窗显示吗」。实测 1440×950 探险 beforeCommit：`.decide-box` = 963×96px，`.decide-body` 被 flex 压到 44px 内滚——v0.15.79 把整块面板内联到手牌区上方后，桌面上永远躺着一扇 96px 的窗。
- **形态**：`.decide-box` 只剩两样东西——一行触发条 `.decide-trigger`（状态圆点［有待办=金色／纯资讯=灰］+ 标题 + 可选 hint + chevron，min-height:40px，占满宽）与非模态浮层 `.decide-pop`（`.decide-box` 的 DOM 子节点，`position:absolute; bottom:calc(100% + 8px)`，宽 `min(880px, calc(100vw − 48px))`，高 `max-height:min(62vh,600px)`，头固定／体滚动；≤760px 改全宽底部抽屉）。类名 `.decide-head`/`.decide-body` 原样保留（验收脚本与既有测试依赖）。
- **开合只有一把钥匙**：`(round, phase, kind, body 内容哈希)`。key 变化且体里存在**未 disabled 的 button** → 自动打开（「需要玩家操作时自动弹出」）；key 变化但体里没有可点按钮（纯资讯，如名单锁定的 D 态）→ 自动收起只留触发条；用户手动关掉后同一 key 不再自动打开，直到 key 变化。哈希前先抹掉三处**与决策无关的易变片段**（R0 草稿数字「暂定 N 名·意志 M」、勾选 `checked`/`data-state="on"`、主按钮「提交空名单」）与折叠区明细——否则「关掉浮层 → 在桌面上点一张角色卡」会让 key 变一次，浮层被自己那次勾选弹回来、正好盖住下一张卡。
- **关闭途径**：头部 × 、Esc、点浮层外部。`dialog[open]` 存在时 Esc 让位给内层 dialog、pointerdown 不算点外部（复核弹窗与 PlanningUI 表单期间的点击不误关）。点外部只摘浮层节点不 render（pointerdown 里整页重绘会吞掉同一次点击），焦点关闭后回触发条、开启时进浮层标题。
- **合并重复浮层**：v0.15.80 的 `.quest-pick`（选人缩略图网格）与新的 `.decide-pop` 会撞车，现合并成**唯一浮层**——`QuestUI.popExtra()` 把缩略图网格（`.pick-panel`，含 `.pick-bar` 的重置选择与 C1 说明）内联到浮层体最前面（deploySection 之前），`QuestUI.pickHint()` 把「已选 N 名（意志 X）」搬到 `.decide-trigger` 的 hint 区，`.pick-trigger` 的第二条触发条消失。**去重**：删掉 v0.15.80 浮层脚部的第二颗「提交名单」（`.quest-deploy` R2 已有一颗，`data-quest="commit"` 全页唯一）与 C1 两步内联确认（`pickApprove`/`pickDismiss` 会与 R2 的「确认派遣」形成两颗同义绿按钮，与 `.decide-box` 内 `[data-quest="approveDeployment"]` 恰好一颗、`.quest-deploy` 内 primary ≤1 两条硬约束冲突）；`data-quest="pickApprove"` 退成兼容别名（等同直接确认），防误触说明改由 `.pick-note` 静态文案承担。**删除 pickState 开合状态机**（key/open/auto/prevStep/confirm 全部退役），Esc／点外部／自动弹出统一到 DecisionUI；`draftFor`/`draftPeek`/`setDraft`（R4 分槽）与 R1–R5 增强、`syncTableMarks`/`syncDraftBits` 双向同步全部保留。
- **脚本兼容**：`.player-mat .bottom-deck:has(.quest-pick)` / `.player-mat:has(.quest-pick)` 两条祖先放行改为 `.decide-pop`（否则浮层被 overflow:hidden 裁掉、命中测试穿透）。`check-taskbar`/`browser-check` 的收起浮层由点 `.pick-trigger` 改为点 `.decide-trigger[aria-expanded="true"]`，`browser-check` 的缩略图选择器改 `.decide-pop .qp-card`；`check-quest-panel` 的 D 态与 `check-quest-r0` 的五态在浮层被自动收起后先点触发条再量（关闭态内容不可量也不可点，这是新形态的既定语义）。
- **测试**：`quest-overlay-tests.cjs` 整份改写为 11 项 DecisionUI 版本（自动打开＋触发条 hint、只有一个 `id="decide-pop"`、选人网格排在 `.quest-deploy` 之前、开→关→重开草稿保留＋R4 分槽、eligible 空「提交空名单」、重置只清草稿、C1 单颗确认→C2 翻转、D 态零派遣控件、`actionable()` 四例、Esc 关闭且 dialog 打开时让位、dialog 内 pointerdown 不误关、最后提交者进 C1 自动弹出、手动关闭后草稿点击不重新弹开）。CI 489 项全绿。

# v0.15.80 · 探险阶段·投入角色：非模态缩略图浮层（decide-box 子节点向上弹出）（2026-10-27）

- **用户指令**：为探险阶段「投入角色」实现非模态浮层——作为 `.decide-box` 的 DOM 子节点向上弹出（锚点在玩家区，向下会盖手牌），缩略图网格选人，替代/补充原有的内联勾选面板；含 R1–R5 五项增强。
- **实施**：① **QuestUI.pickHTML**（quest-ui.js）：`avail = phase2 · step=commit · 未锁定 · 无 spec/choice · 有操作者` 时在 decide-box 内渲染触发按钮（文案「选择投入角色」+ 徽标「已选 N 名（意志 X）」，aria-expanded/aria-controls）与浮层（`.quest-pick`：absolute bottom:calc(100%+8px)，三段 head/body(scroll)/foot，出现动效照抄 .card-hover-box，prefers-reduced-motion 降级；≤760px 改全宽底部抽屉 R5）。缩略图按英雄/盟友分组（组标题复用 .ng-chapter-head），单卡=卡图(424/600 cover)+卡名(11.5px 省略)+属性代币行(--tk:21px)+左上角费用徽标+右上角「查看」角标；状态：已选（金边+已选角标）/已提交待确认（绿态「待确认」）/已横置（旋转+红字）/已离场（灰阶虚线），后三类 aria-disabled 禁点、点击 toast「此角色当前不能加入名单」。② **开合生命周期**：open 以 (round,phase,step,handView) 为键存 `pickState`，render() 全量重绘时由 `syncPick()` 恢复/收敛；自动弹出=进入 commit 且本人未提交/提交后自动交接/全员交齐进入本人 C1/withdraw 退回 A；自动收起=deploymentLocked、step 离开 commit、手动切人（不跟随、切回不自动弹）。「点外部关闭」用 document pointerdown 监听，只摘浮层节点不触发 render（避免吞掉同一次点击）；关闭后焦点回触发按钮，开启焦点进浮层标题（tabindex=-1）。③ **三按钮逻辑**（脚部右 primary 左 ghost）：确认 data-quest="commit"（走既有 choose() 复核弹窗；eligible 空时「提交空名单」保持可用）；重置 data-quest="clear"（走 k==='clear' 现成路径，只清草稿永不触碰 deployments；可见文案「重置选择」、aria-label 含「清空选择」）；头部 × 关闭（纯视图）。B 态脚部只有「修改名单」ghost；C1 态「确认派遣」点击**翻转浮层内联确认条**（非原生 confirm：说明+[再想想][就是现在 primary data-quest="approveDeployment"]），内联面板同名按钮不在 .quest-pick 内照旧直接确认——验收脚本 `[data-quest="approveDeployment"]` 的 .first() 永远命中内联面板那颗；C2/D 只读。④ **R4 草稿分槽**：QuestUI 草稿从单槽 {context,player,ids} 改为按 pid 分槽 Map——根治「切人丢草稿」；提交后清空本人槽位。⑤ **R2/R3**：浮层脚部左侧实时「暂定意志 X」；缩略图点击走 DesktopUI.pick 同一草稿路径，与桌面角色卡、内联勾选三处双向同步（syncTableMarks 现成）；内联勾选的局部同步（syncDraftBits）追加 syncPickBits 刷新浮层徽标/暂定意志/已选态。浮层不是 dialog/aria-modal（role="region"），无全视口遮罩 div。
- **测试**：新增 `quest-overlay-tests.cjs` 7 项（自动弹出与徽标、开→关→重开草稿保留+R4 分槽、eligible 空「提交空名单」可用、重置只清草稿不动 deployments/history、C1 内联确认翻转与「再想想」、D 态零控件、提交后自动交接自动弹出）；CI 485 项全绿。browser-check.cjs:169 的橡皮擦文案改「重置选择」。
- **返工补记（同一版本内）**：① **Esc 关闭缺失**——新增 document keydown 监听（`escClose`），与 × 同语义（open=false + 焦点回触发按钮）；`dialog[open]` 存在时让内层 dialog 自己处理 Esc（复核弹窗/PlanningUI 表单期间浮层原样保留）。② **C1「全员交齐自动弹出」断路**——两处一起修：a) 点外部关闭（`outsidePointer`）在 `dialog[open]` 存在时整个忽略（此前点复核弹窗「确认」的 pointerdown 命中「点外部」把浮层收掉了）；b) `syncPick` 的 key 不变分支把 `auto==='handover'` 当 `withdraw` 同等处理（最后一个提交者没有交接、只是自己进 C1 时，旧实现只认 withdraw，浮层保持关闭）。关闭逻辑收敛为 `closePick/outsidePointer/escClose` 三个纯函数并导出，供监听器与回归测试共用（假 DOM 无 addEventListener）。追加 3 项回归（Esc 无 dialog 关闭 / Esc 有 dialog 保留 + pointerdown 不算点外部 / handover 分支最后提交者进 C1 自动弹出），CI 488 项全绿；真机自测 9/9（Esc 前后 aria-expanded true→false、复核弹窗内 Esc 只关 dialog、复核确认后浮层对新 actor 打开并聚焦、最后提交者 C1 脚部为「确认派遣」）。

# v0.15.79 · 决策面板下移手牌区上方——与保留/调度按钮同槽，公共桌面归还探险区（2026-10-27）

- **用户指令**：像保留手牌阶段那样，把每个阶段在桌面上出现的弹窗都集成到保留手牌按钮处。
- **实施**：注入点从 `.public-table` 顶部移到 player-mat 手牌区上方（`DecisionUI.html` 与 `openingBar` 同一插槽，决策面板在上、开局按钮在下——两者不同时出现：揭示开始后 openingBar 消失）。面板结构/类名（.decide-box/.decide-body）不变，六个验收脚本选择器零改动；公共桌面顶部归还，探险区不再被面板下推。玩家区已有 overflow-y:auto 兜底（v0.15.77），面板高时内容可滚动到达。

# v0.15.78 · 面板类卡图统一 5:7 比例——修复卡片高低不一（2026-10-27）

- **用户报障**：手牌截图里卡片高度不一致。排查：牌桌手牌扇形区实测每张锁死 118px（--hc+object-fit:cover）完全一致；不一致的是走通用 .card 结构的面板类卡片（legacy 手牌面板、抽牌浮层、卡牌库详情）——其卡图规则只有 max-height 上限、宽度自适应，图源宽高比不同（多数 750×1050 竖版，少数异形图）导致渲染高度参差。
- **修复**：.card .card-art img / .hand-card .card-art img / .card details .card-art img 统一加 width:100% + aspect-ratio:5/7（恰为 750×1050 原图比例，标准卡图零裁切）+ object-fit:cover。横版剧本封面（.quest-card-art 600/424）走自己的规则不受影响。

# v0.15.77 · 开局手牌面板退役：只留「保留手牌／整手调度一次」按钮，贴手牌区上方（2026-10-27）

- **用户指令**：截图里的「开局 · 起始手牌」面板整个模块不要了，只保留「保留手牌／整手调度一次」两个按钮。
- **实施**：① DecisionUI.pending() 删 opening kind 分支——面板不再出现；② 新增 DesktopUI.openingBar(s,p)：两个按钮直接渲染在手牌区上方（.opening-inline 虚线条，按钮跟当前查看玩家走，选择过后变一句状态说明，全员确认引擎自动执行剧本设置——v0.15.67 行为）；③ PlayerUI.openingPanel() 整体删除（含导出）。「确认手牌并执行剧本设置」按钮自 v0.15.67 自动开局后已无实际作用，随之消失；引擎 E.startScenario 的 finishSetup 动作分支保留（防御）。按钮放上方而非下方：空间不足时优先保操作入口可见。
- **测试**：测试与脚本按 data-action 查找按钮（与位置无关），keepHand/mulligan/finishSetup 引用全部继续有效；478 项 CI 全绿。

# v0.15.76 · 决策弹窗退役：全部待决定事项内联公共桌面顶部（2026-10-27）

- **用户指令**：把浮动决策弹窗完全移除显示，其功能（开局保留手牌/整手调度、目标与附属选择、各阶段事项等）直接放在公共桌面上。
- **`DecisionUI` 重构**：`html(s,pid)` 从「浮动层 + 收起角标」两态改为单一内联面板——`<section class="decide-box" role="region">`（`.decide-head` 标题 + `.decide-body` 内容），渲染为 `.public-table` 的第一个子块（探险区上方）。`pending()` 五 kind（opening/setup/select/phase/window）判定逻辑不变。**随之删除**：`.decide-layer` 浮动骨架、`.decide-badge` 收起角标、`.decide-x` 收起按钮、Esc 监听、resize 监听、`place()` 实测定位（约 60 行几何代码）、`openKind/lastKey` 开合状态机、`handle/sync/reset/isOpen` 导出；app.js 对应删掉 `DecisionUI.sync/reset/place/handle` 四处调用。**类名沿用** `.decide-box/.decide-body`：六个验收脚本的 PANEL 选择器与既有测试（decide-box 切片断言）零改动。
- **取舍**：面板占公共桌面顶部一行高度（有事项时），探险区整体下移——这是「放桌面」的本来代价；换来的是事项常驻可见、永不遮挡手牌/角色卡/探查区、不再有「收起后找不到入口」的状态。无事项时返回空串，不占任何高度。
- **测试**：478 项 CI 全绿（版本徽标校验随 CHANGELOG 更新通过）。

# v0.15.75 · 对局 HUD 上移导航栏 + 玩家区三行分区：附属区→角色区→手牌区（2026-10-27）

- **对局 HUD（方案 A 落地）**：`shell.html` 的 header 末尾新增静态容器 `.game-hud#gameHud`；`app.js` 新增 `syncGameHUD()`（render() 尾部同步，不另起渲染路径），仅在「对局页签 + 对局进行中 + 真实牌桌（heroStates 齐）」时显示。内容=剧本名＋回合/人数/难度/当前阶段＋**玩家页签**（威胁/资源/伤害汇总、起始/淘汰标记，选择器仍是 `.player-tabs`）＋「重新选择剧本」。header 在 `#app` 之外，点击委托不到——把 `$('#app').onclick` 的大箭头提为具名 `handleAction(ev)`，`#app` 与 `#gameHud` 共用同一个分发器。
- **`.expedition-title` 标题条整行移除**（约 38px+margins 归还牌桌）：`DesktopUI.hudHTML(s,p)` 承接其全部信息，导出供 app.js 调用；操作条保留为单行 sticky（任务提示＋等待 chips＋阶段＋推进按钮）。
- **bottom-deck 三行分区**（用户指定顺序）：附属区（`.own-attachments`，仅在有附属时渲染）→ 角色区（`.own-characters`，英雄+盟友）→ 手牌区（`.hand-zone`）。附属卡用 72px 紧凑幅面（画幅 424/500 裁切），比角色行矮约 60px；`DecisionUI.place()` 的可点元素测量集合加入 `.own-attachments`。
- **脚本迁移**：browser-check 的 reset 选择器 `.expedition-title button…` → `.game-hud button…`；check-onescreen 的 landmark `.expedition-title` → `.game-hud`。`.player-tabs` 选择器在六个脚本中原样有效（HUD 保留类名）。
- **开局阻塞 bug（本版关键修复）**：`hudHTML` 引用了 `tableHTML` 内的局部 `const tabStats`——浏览器里开局链路 `chooserConfirm → mutate → render → syncGameHUD → hudHTML` 抛 `ReferenceError: tabStats is not defined`，被 `mutate` 的 catch 吞掉并把 `state` 回滚为 null，表现为「点开始远征后桌面无反应」（toast 有提示但一闪而过）。CI 全绿是因为测试假 DOM 没有 `#gameHud`，`syncGameHUD` 在 `hudHTML` 之前就提前返回——**真实浏览器独有路径，教训：新渲染函数被 syncGameHUD 这类「先改 hidden 再 innerHTML」的调用包裹时，CI 盲区在容器缺失分支**。修复：`tabStats(s,o)` 提升为模块级函数（显式接收 s）；新增回归测试直接调用 `DesktopUI.hudHTML` 抓同步异常。
- **测试**：478 项 CI 全绿。浏览器实测（1440×950）：开局全链路恢复（chooserConfirm 后 state 正常、无 toast 异常、无 console/pageerror）；三行纵向顺序 att(585)<chars(589)<hand(753) 正确、手牌底 897≤950 全部 7 张视口内可点、点手牌正常弹「选择目标与支付资源」；HUD 对局外 hidden、对局中显示（剧本名/回合/难度/阶段/页签/reset 齐全）、无任何报错。


# v0.15.74 · 出牌阶段去弹窗：阶段控制收进「结束阶段」旁按钮条；删盟友/附属大画廊，手牌区恢复常显（2026-10-27）

- **问题 1（手牌区消失）**：`PlanningUI.board(p)` 在 bottom-deck 里渲染「盟友区／附属区」整卡画廊——一旦打出盟友或附属，画廊把 `.hand-zone` 推出锁高视口（实测 1440×950 出一张盟友后 hand.top=1226 > 950，页面 `overflow:hidden` 不可滚，手牌完全不可见不可点）。画廊与角色行的桌面卡完全重复（v0.15.64 的注释早就记录过「空态占 265px 把手牌挤出 bottom-deck」）。**整块删除** `PlanningUI.board`；盟友继续由 `.own-characters` 的角色卡渲染（属性代币/伤害/资源/能力按钮齐全），附属继续由附属卡渲染（「附于 X」+ 能力按钮）。实测出盟友后手牌 6/6 全部在视口内可点。
- **问题 2（出牌阶段右上角弹窗遮挡）**：计划阶段不再产生任何浮层——`DecisionUI.pending()` 的 phase 1 分支直接返回 null（连带 `windowTail` 在 phase 1 短路，「可做的事」也不弹）。阶段控制改为 **`PlanningUI.strip(s,pid)` 按钮条**，渲染在「队伍与手牌」标题行（`结束阶段` 门按钮）正下方，只含引擎自己走不完的三件事：有 `choiceSpec` 时「处理强制选择／选择响应／放弃」、多人出牌轮内「结束我的盟友／附属出牌步骤」、轮次走完后逐人「放弃剩余行动」；单人局「结束计划阶段」；`pl.halted` 提示内联显示。能力不进按钮条——角色卡/附属卡卡面自带「使用能力」按钮（character()/附属 article 一直都有）。**取舍**：智能模式在计划阶段失去「本次跳过」入口（可做的事浮层不再弹）；跳过属于可选优化，不阻塞流程，接受。
- **`PlanningUI.panel()` 整体删除**：唯一调用方是已删的计划阶段弹窗分支；其内容（顺序徽标、出牌说明、能力清单）要么冗余、要么已由 strip/卡面/操作条承担。
- **测试与脚本**：477 项 CI 全绿（`planning-dom-tests` 一条断言随设计更新：board 的「盟友区 · 1」→ 标题计数「盟友 1」）。六个验收脚本的 `PANEL` 选择器统一加 `.planning-strip`（browser-check/check-contrast/check-taskbar/_rulesprobe/_v10probe/visual-acceptance-v），导航点击「结束我的盟友／附属出牌步骤」「：放弃剩余行动」改走按钮条。浏览器验收全绿：check-quest-panel 40/40、check-quest-r0 30/30、check-taskbar 24/24、check-contrast PASS、browser-check ok=true（full-round-loop 走到第 3 回合）。


# v0.15.73 · 手牌区归还牌桌：阶段模块整体改为非模态浮动弹窗 + 收起角标 + Esc（2026-10-27）

- **背景**：v0.15.69 把待决定面板就地渲染进手牌区「结束阶段」那一块后，手牌界面被阶段面板挤占、无法正常显示（#7：手牌区 45% 可见／24% 视口外／31% 被祖先裁剪）。用户要求：① 彻底删除手牌上的阶段模块；② 所有需玩家手动操作的环节统一改为弹窗；③ 无需玩家操作的环节由系统自动判断并自动执行；④ 手牌界面恢复正常、流程不中断。
- **手牌区只留牌**：`tableHTML()` 里 `${DecisionUI.html(s,p.id)}` 从「队伍与手牌」区头部移除，注入点改到 `<aside class="tabletop-rail">` 之前——弹窗层 `position:fixed` 脱离文档流，手牌布局从此不受阶段面板任何影响。
- **弹窗两态**（`DecisionUI.html()`）：展开时输出非模态浮动层 `.decide-layer`（fixed 铺满、`pointer-events:none` 定位骨架）+ `.decide-box`（`pointer-events:auto`，实际弹窗盒）；**收起后输出 `.decide-badge` 角标**（fixed 右上），点击重开。非模态是刻意的：弹窗开着时牌桌上的手牌、角色卡、探查区照常可点——计划阶段出牌、探险阶段投名单都依赖桌面点击，模态会锁死流程。
- **定位交给 `place()`**：实测牌桌上真正可点的元素（手牌/角色卡/探查区卡/手牌区）取最右缘与最下缘，双列时往右列留白塞、单列时落在可点区下方空白里（下方不足 120px 才退回覆盖下半屏）。`place()` 原本只在 `handle('open')` 与 resize 时调用，现在 `render()` 尾部也调一次——否则重绘后弹窗停在旧坐标。
- **Esc 收起**：`keydown` Escape 时若弹窗开着则收起（只留角标）；原生 `<dialog>`（组队确认框、选目标表单）开着时让路，不劫持 top layer。
- **自动处理的判断逻辑（用户要求③的落点，`pending()` 的判据）**：`pending()` 返回 null 即无弹窗——规则书写 **must**（强制结算、自动抽牌加资源、提交后按顺序横置、无选择的投入响应、探险/战斗数值结算）由引擎算完只留日志，绝不弹窗；规则书写 **may/choose/up to**（选目标、选响应、定投入名单）才弹。具体五类：`opening`（开局弃牌，轮到你且有可弃牌时）、`setup`（剧本设置揭示，轮到你翻牌时）、`select`（defense/attack 目标草稿，含预览与提交）、`phase`（各阶段面板：等谁放弃行动、等人选旅行点、等人提交名单——**引擎自己走不完的步骤才给**；名单锁定期给只读状态卡说明引擎在做什么）、`window`（智能模式下可做的事，详细模式不重复给）。阶段内自动推进由引擎 `autoAdvance` 承担（v0.15.57）。
- **测试**：全部 `decide-inline` 引用改为 `decide-box`（13 个文件 48 处）；`planning-dom-tests` 待决定段落选择器同步。弹窗不再渲染进手牌区，原「面板在手牌区内」类断言随实现更新。


# v0.15.72 · 更正「右对齐恒定」：R0 改内容宽左锚 + 药丸等宽 + 一次交互一次重绘 + 进入派遣时主按钮入视口（2026-10-27）

- **更正一条错误结论**：v0.15.71 在注释里写「`.r0-num` 右对齐，右缘恒定，所以不需要给前缀或药丸定宽」。**这是错的**：`.r0` 是 `flex:0 1 auto` 的内容宽盒，`text-align:right` 在内容宽盒里没有多余宽度可对齐，`num.right == r0.right` 恒成立，跨状态照样跟着前一项走。实测（1440，A→D，位数相同）：`num.left 147 → 127`、`num.width 127 → 127`、`num.right 274 → 254`，左右缘一起位移 20px。
- **R0 改为内容宽、左锚**：跨状态要稳定的是**数字文本的起点**，不是右缘。两件事保证它：`.state-pill` 等宽（`min-width:77.16px`，取 C2「已确认 N/M」实测固有宽；窄屏 `padding:1px 4px` 时同步减到 `69.16px`）、`.r0-label` 五态都写两个汉字（`暂定`／D 态 `实际`）。`.r0-num` 去掉 `text-align:right`，保留 `flex:none + tabular-nums`（数字永不被省略）。
- **D 态前缀由空串改「实际」**：原来的空前缀 + `.r0-label:empty{display:none}` 会让整行左移 32px（24px 前缀 + 8px gap）。「暂定 ↔ 实际」是同一件事的两个时相，两个汉字对两个汉字，字宽严格相等；顺带把语义说准——D 态那些数字不是暂定的，是已投入的实际值。删掉 `:empty` 死规则。
- **U18-a 焦点丢失**：`approveDeployment` 后「确认 + 自动切下一位」原本是两次 `render()`，第一次恢复的焦点被第二次 `innerHTML` 替换连节点一起丢掉，`activeElement` 落回 `BODY`。现在把交接操作权放进同一次 `mutate()`，一次交互只重绘一次；落点由新的 `focusActor()` 指定为**新操作者的 R1 胶囊**（`[data-quest-actor]`，非推进性动作，按住回车不会连续替两个人确认），单人局落 `.r0`（新增 `tabindex="-1"`）。`commit` 路径同样合并为一次 `mutate`。
- **`.door-go:disabled` 换底**（v0.15.71 已落地，本版补验证）：`opacity:.55` 只降透明度、底色仍是 `rgb(54,88,66)`，禁用状态看起来还是「可以按的绿钮」。改为 `#eceae0` 底 + `#8b9383` 字 + `--line` 边。实测四态 `backgroundColor = rgb(236,234,224)`，选择器 `.phase-door .door-go:disabled` 命中（`.door-go` 不在 `.primary` 规则范围内）。
- **#8 进入派遣步骤时主按钮被落在首屏之外**：面板渲染在手牌区「结束阶段」同一块里，进阶段那一刻主按钮在 390×844 下位于折线下方 127px、761×600 下 258px（实测未修复时按钮 `bottom` 分别为 1174/990，视口只有 844/600）。现在 `render()` 在 `questing.step` **变为** `commit` 的那一次把 `.quest-main-action` 里的主按钮 `scrollIntoView({block:'nearest'})`；锚点是**按钮不是面板**（滚容器要多滚 110px，会把 R0/R1 一起顶出去，玩家反而丢了「我交了几名、还差谁」的上下文），并用模块级 `lastScrolledStep` 保证**同一步内任何重绘都不再滚**（否则连续确认四个人会抖四次）。有意取舍：只滚按钮时滚动后 `.r-head` 可能整体出视口，用「上下文」换「按钮」，已写进注释防止后人当 bug 改回去。**旧判据「面板 top ≥ 0」作废**——它在 v0.15.71 上恒绿（实测 top=971/858，远大于 0），属于「不可能失败」的判据；新判据量按钮 rect：`top ≥ −1 && bottom ≤ innerHeight + 1`，并加一条幂等断言「同一步内连续 `render()` 5 次 `scrollY` 不变」。
- **「／ 威胁 N」移出 R0 数字串**：威胁在界面上已有三处显示（探查区标题「总威胁 N」常驻、面板标题「探查区威胁 N」、结算文案），R0 是第四处；且它是全局局面值，不属于「我的派遣」这一行，切人时不变却跟着重绘，容易被误读成「也随派遣变化」。宽度上这是必做而非可选：五态药丸等宽从数字身上拿走 35px（A 态 pill 33.81→69.16）后，最坏可达内容 `12 名 · 意志 34 ／ 威胁 50`（四人局每人 3 名英雄全投）文字宽 148.81，超出 320 容器内容盒（286−139.16=146.84）**1.97px**——0.5 容差的 4 倍，不是字体取整波动，并会冒出一条 2px 横向滚动条。去掉威胁后最宽值约 105px，余量回到约 +42。配套：commit 步标题补「探查区威胁 N」（原 commit 步标题只有标题名，删「投入意志」时把威胁一起删了；现在 R0 里没有威胁，标题必须接住）。**不准用换行解决**（R0 盒高 23.55→约 47，破 U18-b）；**不准包成窄屏才 sr-only 的 span**（内容随断点变导致跨断点宽度跳变）。
- **D 态删掉玩家切换（死控件）**：`tally()` 遍历 `liveOrder(s)` 全员累加，`pid` 只在 A 态影响草稿——D 态切人时 R0 数字一个字符都不会变，`live.length<2` 的判定让它在只读阶段照样渲染，点了没有任何反馈。改为 `live.length<2 || ph==='D'`。V07@D 的 `details:1` 不是缺陷：规则在任何状态都可查（只读态更需要），D 态保留折叠、去掉名单明细是对的设计，判据改为「`details ≥ 1` 且内部无 `.quest-roster`」。
- **测试**：477 项全绿。`planning-dom-tests` 加三条计数断言（A 态 `data-quest="commit"` 唯一、C1 态 `approveDeployment` 唯一、C2 态 `unapproveDeployment` 唯一）——只数 `data-focus-key` 证明不了唯一性，第二颗不带 key 就漏；并断言 `.r0` 带 `tabindex="-1"`、D 态前缀「实际」、R0 数字串不含「威胁」、D 态无 `.quest-actors`。**排版类断言（药丸等宽、`num.left` 极差、未截断）只能在真实浏览器做**，收在两个脚本里：
  - `scripts/check-quest-panel.cjs`（37 条）：结构、交互、R4 展开、改名单二次确认、跨状态数字列不动，并按**目标档宽度开局**补 #8 两条（390×844 与 761×600，都在该档下真点进 commit 再量）。
  - `scripts/check-quest-r0.cjs`（新建，27 条 = 三档 × W1–W9）：1440/390/320 各测五态的 `pill` 实宽全等、`num.left` 极差 ≤1、`num.scrollWidth − clientWidth ≤1`（320 是唯一触发截断的局面，宽屏永远测不出来）、不折行、盒高 23.55±1、窄屏前缀是 sr-only 而非 `display:none`（D 态要能读出「实际」）、`door-go:disabled` 非绿底、药丸内容没被 `min-width` 挤掉、本档不出横向滚动条。实测三档五态的 `num.left` 极差全为 **0**（1440: 182.16 / 390: 140.16 / 320: 139.16），`num.width` 恒 127.2。

# v0.15.71 · 派遣面板收尾：R0 拆前缀／数字、R2 同处演化（已提交→已投入）、R4 补全队名单、改名单二次确认（2026-10-26）

- **背景**：v0.15.70 把派遣面板收成四段后，视觉与体验验收又查出四件事：R0 整句 `暂定 0 名 · 意志 0 ／ 威胁 3` 字数一变数字就横跳；提交后 R2 整块消失，玩家看不出「我交的是谁」；R0 的全队合计没有可核对的明细；`ghost`「修改名单」会静默清掉全队已完成的确认。
- **状态枚举改名 C-in／C-out → C1／C2**：C1 待确认（本人未确认）、C2 已确认（本人已确认、他人未确认）。旧名字是同一状态的否定式命名，和 A/B 的「本人在哪一步」不同构，读代码时要反推。
- **R0 拆三段**：`pill`（草稿／已提交／待确认／已确认 N/M／执行中）+ `.r0-label`（前缀「暂定」，D 态不渲染）+ `.r0-num`（数字，`text-align:right`、`tabular-nums`、`flex:1` + `ellipsis`）。前缀字数变化时数字不横跳；`nowrap` 只锁行不锁收缩，390px 也不出横向滚动条。D 态前缀改为「N 名角色 · 意志 M」，不再与下方「已投入：…」连读成复读。
- **R2 一个位置演化**：A 可勾选网格 → B/C1/C2 只读「已提交：阿拉贡（意3）」→ D 只读「已投入：…」。以前提交后勾选区整块消失、信息归零；现在「已提交 ≠ 已投入」这个模型就写在同一个位置的颜色变化里（灰＝待定、绿＝落地）。两行截断 + `title` 悬浮全文，长名字不顶宽。
- **R4 补全队名单**：`<details>` 里除规则正文外新增 `.quest-roster`——每人一行「名字 / N 名 · 意志 M / 状态胶囊（已提交·草稿·未提交）」，正好解释 R0 合计为什么少了（未提交者按 0 计）。D 态不渲染明细（上方已有全队「已投入：…」）。summary 文案恒定为「规则与名单」，展开态由 `rulesOpen` 记住（`render()` 全量重建会抹掉 `<details open>`），勾选时同步刷新本人那一行。
- **「修改名单」二次确认**：`withdraw` 若已有人确认（`deploymentApprovals.length > 0`），先弹确认框说明「会清除全队 N 次确认」，取消则不发任何状态变更。这是本面板唯一会破坏他人工作的次操作，其余仍是零确认直达。
- **draft 视图副作用分离**：`draftFor()` 会把草稿重置成某个 pid 的初始名单（副作用，只给交互路径用）；新增纯函数 `draftPeek()` 给「只是看看」的地方——R0 合计、R2 勾选态、R4 明细、牌桌角标同步。此前用别人的 pid 调 `draftFor` 会让当前操作者勾好的名单当场消失，且不进 history、撤不回来。
- **有卡牌响应时不渲染控件**：`step==='commit'` 且存在待结算的 `choice`／投入响应时只渲染只读摘要（别人正在决定时不该能提交名单）。
- **样式（第 20b 节重写）**：新增 `.r0/.r0-label/.r0-num/.r1/.quest-submitted/.quest-committed/.quest-roster`；`state-pill` 改用自身的 `data-state` 上色（A 米黄／B·C1 浅绿／C2 深绿／D 中性），不再依赖父级选择器；左侧状态竖线 A 虚线、B·C1 金、C2 绿、D 无；`.quest-deploy` 段距 9→8px；窄屏与 `pointer:coarse` 命中区规则保持不变。
- **测试**：全部 20 套 477 项零失败。两处 CI 断言随设计更新并加严——`暂定 0 名`→按 `.r0-label`／`.r0-num` 两段断言 + 「意志只出现在 R0 一次」；`C-in/C-out`→`C1/C2`，并新增「R2 只读已提交行」「已提交后无勾选框」「C2 pill 为 已确认 N/M」「D 态写 1 名角色 · 意志 M」「D 态不渲染 R4 明细」。

# v0.15.70 · 派遣面板精简：玩家分段按钮组取代下拉＋徽章、四态枚举渲染、单一主操作、说明收进折叠（2026-10-26）

- **背景**：探险阶段的「派遣名单」一屏里同时有下拉框、并排玩家徽章、逐人「二次确认派遣」按钮、两块解释文字（「派遣交流与缓冲期」＋「本次确认只提交名单…」），牌桌操作条里还藏着第三颗「提交暂定派遣名单」。四人局里同一件事要在三处点、两颗绿按钮同时招手。
- **合并的重复控件**：`select#planning-actor` + 并排 `.badge` → 一颗 `role=radiogroup` 的玩家分段按钮组（`.actor-chip`；三态圆点：空心环＝未提交／实心＝已提交／实心加金环＝已二次确认；点击只改 `handView` 视图态，零游戏状态变更、不进 history）；逐人「玩家N：二次确认派遣」→ 收成单颗「确认派遣」／「取消确认」；「派遣交流与缓冲期」整块删除（其内容已由四态面板表达）。
- **四态枚举渲染**：以前「未提交」与「已提交」是两条并列 `if` 各往 body 追加一段，状态重叠时同一件事渲染两遍——这才是重叠的根因。现在 `QuestUI.stateOf()` 一次算出唯一状态 A 草稿／B 已提交待他人／C-in 待确认／C-out 已确认待他人／D 已锁定，纵向四段只在一处渲染：R0 状态行（草稿态「暂定 N 名 · 意志 X ／ 威胁 T」，`tabular-nums`）→ R1 玩家分段按钮组（单人局不渲染）→ R2 名单勾选区（提交后消失，空态「本回合无可用角色」）→ R3 sticky 主操作行 → R4 `<details>` 规则说明（默认折叠）。`picker()` 与 `panel()` 共用这一份实现，智能／详细模式不再各写一份。
- **「已投入」措辞收敛**：草稿态一律写「暂定」；「已投入：阿拉贡（意3）」这一行改为无人时不渲染（不再印一句「无人」），字面格式保持不变。
- **删掉第 3 个提交入口**：`.table-selection` 里那颗「提交暂定派遣名单」按钮移除，只留「已选 N 名／暂定意志 X／清空选择」作为只读摘要与橡皮擦——它是同一屏第三份提交入口，四人局角色行横滚时还会被带出视野。
- **门禁联动**：`phaseDoor()` 以前只算「未提交」，C 态时门禁是绿的、底部「确认派遣」也是绿的。现在 `blocked = waitingSub || waitingApr`，提示分两支「等 X 提交名单」／「等 X 二次确认」。
- **淘汰玩家死锁修复**：`submitDeployment`／`approveDeployment` 的 `order.every(...)` 判据、`phase-engine` 的 deploy／dconfirm 待办项、`status()` 的等待点名，一律排除 `eliminated` 玩家；`resumeDeployment` 跳过没有名单的已淘汰玩家（此前会因 `x.deployments[pid]` 为 undefined 抛错）。中途有人被淘汰会永远卡在 B/C 的死锁至此解除。
- **a11y 播报**：`shell.html` 在 `#toast` 后新增 `#live`（`role=status aria-live=polite`，`.sr-only`）；写入前先清空再异步写，避免同一句连播不生效。文案覆盖提交（「玩家1 已提交名单，还差 玩家2」）、名单齐（「名单已齐，等待 2 人确认，尚未横置」）、单次确认（「已确认 1／2，尚未横置」）、确认被清空（「玩家2 改了名单，确认已重置，请重新确认」）、锁定（「已锁定，正在按顺序投入 3 名角色」）。
- **焦点保持**：`render()` 重绘前记录 `data-focus-key`，重绘后按同一键 `focus({preventScroll:true})`；面板输出 `quest-actor-<pid>`／`quest-commit-<uid>`／`quest-submit`／`quest-withdraw`／`quest-approve`／`quest-unapprove`。勾选／取消勾选仍走局部改文本（不 render），并补上「勾选 → 牌桌角色卡加 `.selected` 与「已选」角标」的正向同步（反向点卡本来就能同步）。
- **样式**：沿用 `--paper/--line/--ink/--green/--gold` 变量；12px 文字不用 `--muted`（对比度约 3.8:1），改 `#5f6a58`、提示类 `#6b5a35`；主按钮 `min-height:34px`／14px／600，次要操作一律 ghost（透明底、无边框、dotted 下划线）；一屏绿色实心按钮只留一颗。窄屏（≤600px）玩家 chip 换行、名单两列纵向滚、主按钮整宽 ≥38px；`pointer:coarse` 用 padding 把命中区扩到 ≥44px；任何档位不出横向滚动条。
- **测试**：全部 20 套 473 项零失败。CI 断言两处随设计更新（`取消确认，修改派遣` → `data-quest="withdraw"`）；浏览器验收脚本的选择器同步改为 `[data-quest="commit"]`／`[data-quest="approveDeployment"]`／`[role="radiogroup"]`。

# v0.15.69 · 抽牌浮层放大居中 + 待决定面板并入结束阶段区（2026-10-26）

- **背景**：用户反馈「抽卡弹窗做大一些，至少需要占到屏幕的9分之一，然后要居中显示。还有右上角的阶段弹窗还是没有和手牌右上角的结束阶段做合并」，随后纠正方向：「我是说把右上角的功能和结束阶段那块合并」。
- **抽牌浮层放大居中**：浮层改为屏幕正中（`align-items:center`），卡片容器 `width:min(720px,92vw);min-height:33.4vh`——1920×1080 下 720×434 占屏 15.1%（≥1/9≈11.1%），`min-height` 用视口单位保证任意分辨率达标；卡面从 150px 加宽到 190px。
- **待决定面板并入结束阶段区（v0.15.69 二次修正）**：第一版误把「结束阶段」按钮搬进浮层弹窗（方向反了）。正确做法：**决策内容不再是屏幕右上角的浮层**——`DecisionUI.html` 改为内联渲染，待决定的面板直接展开在手牌区「结束阶段」按钮同一块（zone-heading 紧邻其下），标题、按钮、操作控件在同一处完成，不再有浮层/角标/「收起，稍后处理」。`place()` 定位逻辑成为死代码（安全早退保留），`.decide-layer/.decide-box/.decide-badge` 样式删除。
- **测试**：全部 20 套 473 项零失败；浏览器 1920×1080 验收面板就地展开、结束阶段可正常推进。

# v0.15.68 · 计划阶段一键结束 + 资源阶段抽牌浮层（2026-10-26）

- **背景**：用户反馈「自动化之后这个弹窗是不是也不需要，完成操作直接点结束阶段就行了。然后每回合资源阶段抽取手牌时，做一个弹窗显示所抽到的牌，3-5秒自动关闭，也可以点弹窗外或者关闭按钮手动关闭」。
- **计划阶段（单人）**：面板只留一个「结束计划阶段」按钮——点击时 UI 层一次完成「结束出牌步骤 → 放弃剩余行动 → 结算阶段」三步；顺序徽标与两段说明文字只对多人有序有意义，单人删去（响应待处理/阶段结算中时按钮禁用）。
- **引擎契约不变**：`P2.finish` 的前置断言保持严格——`autoAdvance`「断言一抛即停手」的设计仍然会在计划阶段停手让玩家出牌，不会静默跳过。曾把单人自动推进放进引擎 finish，实测 `autoAdvance` 会一路把计划阶段也跳掉（玩家无法出牌），已回退并把自动化放在 UI 层。
- **资源阶段抽牌浮层**：`resourcePhase` 记录 `s.resourceDraw`（本次抽到的牌 uid 与归属）；界面在渲染时弹出浮层显示所抽到的牌（卡面+归属+费用），约 4 秒自动关闭，点浮层外部或 × 手动关闭。用普通固定定位元素而不是原生 dialog：不阻塞决策弹窗，也不影响 modal 层级。
- **测试**：全部 20 套 458 项零失败；planning-dom 版本一致性用例随 CHANGELOG 条目自动恢复。

# v0.15.67 · 全员确认后自动推进到下一阶段（2026-10-26）

- **背景**：用户反馈「保留手牌的弹窗，所有人都确定了，就应该自动进入到下一个阶段。其他的自动化也应该是这样的逻辑」。
- **两处落地**：
  1. **开局手牌**（app.js keepHand/mulligan handler）：全员 `openingConfirmed` 后自动 `E.startScenario(state)`，不再需要额外点「确认手牌并执行剧本设置」按钮。
  2. **刷新阶段确认**（refresh-engine.js）：
     - **空确认语义**：没有蛛网要支付的玩家没有决策点，视为已确认（`settled()` 判定——只要求**有蛛网**的玩家出现在 approvals 中），不再阻塞二次确认结算；`propose` 重置 approvals 也不会丢失空确认。
     - **全员无蛛网**：start 时直接自动结算（重置+威胁+先手轮换一步到位，日志写明「自动完成刷新确认」）。
     - **单人模式**：`propose` 提交蛛网方案后自动确认（与 v0.15.66 各阶段单人自动确认一致）。
     - 有蛛网的多人对局仍保留完整确认门：蛛网方案变更作废全部确认、最终确认前原子校验资源，语义不变。
- **测试对齐**：refresh-tests 给 `refresh()` helper 加 setup 钩子（蛛网须在刷新初始化前挂上——无蛛网时刷新会自动结算）；用例1/2/3/4/7/8/10/14 对齐新语义；combat-tests 两处 `step==='ready'` 断言改 `'action'`；window-tests 用例21 重写；planning-dom refreshScreen 把蛛网附着提前到 `E.refreshing.start` 之前、用例20/21 只需玩家0确认。全部 20 套 510 项零失败。

# v0.15.66 · 空操作跳过二次确认（2026-10-26）

- **背景**：用户反馈「能自动化处理的部分不需要添加二次确认」。v0.15.62 的二次确认引擎对**所有**暂定选择一视同仁，包括零费用、零位移、零结算的纯空操作——实测完整一回合要多点 6~8 次无意义的确认。
- **短路规则**（仅纯空操作，有实际效果的保留确认）：
  1. **旅行 · 本次不旅行**（`travel-engine.js propose`）：uid=null 时直接执行（原本 execute 就是只 log 后开行动窗口），并取消 UI 的「暂定旅行选择」弹窗（`travel-ui.js`）。
  2. **主动交战 · 全队均不主动交战**（`encounter-engine.js propose`）：全员均已提交且全部为不交战时，最后一人提交后直接进入执行，跳过 approve 轮。
  3. **玩家攻击 · 本回合不攻击**（`combat-engine.js propose`）：attack 提案 uid=null 时直接 playerIndex++ 进下一窗口。
  4. **单人模式**：确认人=提案人本人，二次确认是自我重复——旅行/主动交战/战斗方案在单人时全部自动确认。
- **保留确认的**：防御（无人防御仍结算敌人攻击与暗影）、派遣名单（quest commit 锁定语义）、有费用/横置/卡牌移动的一切暂定行动。
- **测试**：helper（travel/confirm/approveAll）改为"提案已自动执行则跳过 approve"；重写 engagement 用例2（全队不交战自动执行新增独立用例）；planning-dom 的 encounterScreen/combatScreen/用例12/13 对齐新语义。全部 20 套 493 项零失败。

# v0.15.65 · 修复：交战区敌人多时手牌被挤到视口外（2026-10-26）

- **场景**：用户要求按 1920×1080 做验收。真实浏览器全流程实测（开局→计划→探险→旅行→遭遇→战斗→刷新→第2回合），第 1 回合手牌全部可见；**第 2 回合交战区出现 2 名敌人后，8 张手牌整行掉到视口外**（手牌 top=1203 > 1080，`bottom-deck` 被 flex 压缩到只剩 71px）。
- **根因**：`bottom-deck` 是 `flex:1 1 auto`，与交战区（`.table-zone:not(.bottom-deck)`，无 min-height 限制）抢剩余高度。交战区内容（敌人卡+说明文字）变高时吃掉全部富余空间，`bottom-deck` 被压缩——区内的 `overflow:auto` 只能保证"可达"，不能保证"默认可见"。
- **修法**：反转 flex 优先级——`.player-mat>.table-zone:not(.bottom-deck){flex:1 1 auto;min-height:0;overflow:auto}`（上方公共区压缩并滚动），`.player-mat .bottom-deck{flex:0 0 auto}`（按内容自然占高，角色行+手牌行始终完整渲染）。
- **实测**：1920×1080 第 2 回合 8 张手牌 925–1043 全部可见（bottom-deck 恢复 351px）；1440×577 窄窗同样全部可见。全部 19 套 426 项测试零失败。

# v0.15.64 · 修复：开局弃牌阶段看不到手牌（2026-10-26）

- **症状**：开局「起始手牌」确认界面（保留 / 整手洗回重抽）看不到自己的 6 张手牌，没法做换牌决定。真实浏览器 1440×900 与 1280×577 双档复现。
- **根因**：`bottom-deck`（队伍与手牌区，`overflow:hidden`）里，开局面板出现时英雄区隐藏（v0.15.59 设计），但 `PlanningUI.board` 仍渲染「盟友区·0／附属区·0」两个大空态占位，实测占 **265px**——62px 的手牌窄扇被挤出盒子底部，被 `overflow:hidden` 整体裁掉，页面又不可滚动（`pageH===innerHeight`），于是手牌在 DOM 里存在（6 张 `.hand-card`）却永远看不见。
- **修法**：开局面板出现时整个隐藏 `.player-permanents`（`display:none`）。开局阶段盟友/附属必为 0，数量信息已在 zone-heading（「盟友 0 · 附属 0」）里，空态占位毫无信息量还挤占关键空间。与 v0.15.47「开局隐藏英雄区」同一套 `:has(.mat-phase>.opening-panel)` 判据。
- **实测**：修复后 6 张手牌窄卡扇在「队伍与手牌」区完整可见（y=523，视口 900 内），开局面板与「保留手牌／整手调度一次」按钮无遮挡；planning-dom 70/70、tests 25/25 回归通过。
- **追加（同日二次修复，用户实测反馈）**：
  1. **底部深色开局面板整个移除**——`PlayerUI.openingPanel`（起始手牌确认）与 `DesktopUI.setupPanel`（剧本设置揭示）都迁进决策弹窗（`DecisionUI.pending()` 新增 `opening`/`setup` 两个 kind），模板删除 `<div class="mat-phase">` 容器及其全部 `:has(.mat-phase>.opening-panel)` 死规则。弃牌期（含全员已确认、尚未点「执行剧本设置」）始终弹开局面板——面板里有唯一的确认按钮，不能弹完就消失；揭示期弹揭示面板。
  2. **手牌高度/可见性治本**——`PlanningUI.board` 的「盟友区·0／附属区·0」空态不再渲染（实测占 265px，把最后的手牌行挤出 `bottom-deck` 的 `overflow:hidden`）；`bottom-deck` 的 `overflow:hidden→auto`（对齐「各区独立滚动、页面不滚」设计，盟友/附属多时区内滚动，手牌永远可达）。**1440×900 计划阶段实测：7 张手牌全部可见（底缘 863 < 900），1440×577 窄窗开局 6 张手牌+3 英雄+开局面板同屏可见。**
  3. 弹窗开合链路实测：开局弃牌弹窗 → 保留手牌 → 确认执行 → 计划阶段弹窗，全程无空窗、无遮挡。
- **回归**：全部 15 套 448 项零失败（tests 25、phase 8、planning 90、planning-dom 70、quest 45、travel 24、combat 58、refresh 19、opening 16、setup-reveal 9、engagement 26、player 19、score 10、deck-share 7、window 22）。

# v0.15.63 · planning-dom-tests 清零 + 桌面攻击草稿面板回归修复（2026-10-25）

- **目标**：把 `planning-dom-tests.cjs` 从 62 pass / 8 fail 清到 **70 pass / 0 fail**；顺带把受二次确认引擎语义影响的 quest/phase/planning 三套引擎测试一并对齐。全部 16 套共 **453 项全过**。
- **修掉的真 bug（桌面攻击草稿面板失联）**：`DecisionUI.pending()` 的 select 轻量分支写成了 `m.kind!=='quest'&&m.kind!=='attack'`——attack 草稿面板（含「暂定基础攻击 / 目标防御 / **基础伤害预估**」预览与「提交暂定攻击名单」按钮）从此没有任何渲染路径：玩家在牌桌上点完目标与攻击者，界面既无预览也无提交钮。证据就在同文件：`selectTitle` 里专门留着 attack 的「选择攻击目标」文案。修法：attack 回到 select 分支（`desktop-ui.js` 与 `index.html` 内联副本同改；index 副本中 defense 仍留给 `CombatUI.panel` 承载完整防御面板）。
- **引擎语义落地（`discussion:true` 进 `QuestRulesFactory.start`）**：v0.15.62 重构后自动推进路径（`passAction`→`autoAdvance`）会绕过 `handlers.next` 的 `enableDiscussion`，导致部分路径下 `state.questing.discussion` 为 undefined、二次确认按钮不出现。修在引擎 `start()` 初始化（`quest-engine.js` + `index.html` 内联副本同改），不再依赖 UI 路径。
- **测试对齐（非产品弱化）**：
  - 提交派遣名单（`submitDeployment`）现在只置 `confirmed`，**横置与投入发生在全员 `approveDeployment` 之后的正式 commit**——`quest-tests` 33/34/35、`phase-tests` 3/4/5、`planning-dom-tests` 9/36/70 按新流程补「全员二次确认」步。
  - 探险窗口打事件必须「暂定 + 全员二次确认」：`quest-tests` 新增 `playQ` 助手（`queueAction` + 全员 `approveActions`），替换 4 处直接 `R.play`。
  - 自动推进语义：阶段完成即推进（旅行/遭遇验收屏是过渡帧；刷新结束自动进入新回合计划阶段、资源与抽牌已结算；遭遇完成即初始化战斗并发暗影）。`planning-dom-tests` 的 combatScreen 助手把敌人与暗影牌的注入挪到遭遇最后一次 pass 之前，否则战斗已开局、暗影发不到后补的敌人。
  - 提交状态文案改为操作条 chip「玩家1 · 已提交」；提交后视角自动切到未提交玩家。
  - `planning-tests` 一项 v0.15.58 起的旧失败：reason 已改为直说资源缺口，断言改为「不可打出 + 匹配领域|资源不足」。
- **清理**：移除上次会话遗留的悬空 cherry-pick 状态（两个 v0.15.30/31 旧提交内容早已在库）。
- **回归**：tests 25、phase 8、planning 90、planning-dom 70、quest 45、travel 24、combat 58、refresh 19、opening 16、setup-reveal 9、engagement 26、player 19、score 10、deck-share 7、window 22、pack-data 4、encounter-explanation 5——**453 项全过，零失败**。

# v0.15.62 · 阶段面板搬进决策弹窗：底栏清空、操作条收起、只在轮到你时弹（2026-10-25）

- **起因**：底部 `.mat-phase`、顶部操作条、刚加的弹窗，三处渲染的是同一份阶段内容，玩家得决定该看哪儿；而「结束阶段」按钮已经在角色区右上角，底部那块纯属重复。
- **判据线（沿用 ArkhamHorror 逆向结论）**：规则书写 `must`（强制结算、自动抽牌加资源）→ 引擎算完只留日志，**绝不弹窗**；写 `may` / `choose` / `up to`（选目标、选响应、选防御者、定投入名单）→ 必须问人，才弹。
- **弹窗机制**：新增 `DecisionUI`（`index.html` 约 10260 行），独立闭包，自己取依赖（`esc`、`DesktopUI.setupPendingReveal`、`ScenarioEngine`），**不靠外层闭包**——早期版本直接写 `setupPendingReveal()`，一移出 `DesktopUI` 闭包就在 `render()` 里抛 `not defined`，而 `mutate()` 的 catch 会吞掉异常并回滚整个状态，症状是「按钮点了没反应」。
- **刻意不用 `dialog.showModal()`**：`PlanningUI.form()` 内部已占用一个 `<dialog>`，两层 `showModal` 叠加时后开的会抢焦点、关掉时把前一层的 backdrop 一起带走。决策弹窗改为普通定位层 + 自管焦点（内层 `<dialog>` 由浏览器放进 top layer，永远高于任何 `z-index`）。
- **遮罩非阻塞**（`pointer-events:none`）：弹窗不是「挡住你做别的事」，而是「把当前该你决定的事摆到眼前」——探险投入要回牌桌点角色卡、打牌要按住手牌看牌文，全屏拦截会让这些动作做不了。只给 `.decide-box` 本身 `pointer-events:auto`。
- **位置按实测自适应**（`place()`）：双列布局贴右上、让开所有可点元素（`.hand-card/.character-card/.encounter-card/.own-characters/.hand-zone` 的右缘与下缘）；单列布局落到牌桌下方空白。**必须量两帧**：只量一次会在图片解码／手牌扇叠计算完成前读到旧位置，实测 1100 宽下因此把弹窗压在了整块手牌上。**不用写死宽度判断单列**：改判 `rail.top >= mat.bottom - 8`——1100~1280 这一段是「双列但很窄」，光看视口宽会误判。
- **下方留 120px 就放下面**（不是 200px）：1100×800 实测 `roomBelow=156`，按 200 判会落进「覆盖」分支、整块手牌被盖。宁可弹窗矮一点要滚动，也不去盖手牌。
- **收起与角标**：不需要决策时自动收起，右上角留 `.decide-badge`（「待决定 N」）；点角标重开并重新定位（收起期间可能换过分辨率或转过屏）；`resize` 时也重算一次。
- **操作条空时收起**：`.operation-dock:not(:has(.operation-content:not(:empty)))` 把 padding 归零，实测 `dock` 从 **130px 降到 64–78px**；阶段长说明折进 `<details class="phase-hint-wrap">`，默认收起。
- **六阶段面板全部迁入**：计划／探险／旅行／遭遇／战斗／刷新。其中三处原本只在 detailed 模式渲染、智能模式是空壳，一并补上智能模式出口——`TravelUI.panel` 的放弃/结算组、`EncounterUI` 的放弃行动与开始检定、`CombatUI` 的防御出口。
- **修掉的真 bug 一（探险投入名单挡门）**：`phaseRules.checks` 把「提交派遣名单／二次确认／按顺序投入」圈在 `if(c.step==='commit')` 里，step 一旦走出 commit（`afterCommit`→`staging`→…→`completed`），收尾后重新取 `checks()` 得到的是「一条都没记下」的快照：名单早已 `confirmed`、step 已是 `completed`，结束阶段按钮却仍禁用，悬停还写「等 玩家1、玩家2 提交投入名单」。改为**按 step 位置判定**（`afterCommit = step!=='commit' && step!=='beforeCommit' || deploymentLocked`），与 `result` 项同一套写法。同类问题一并修：`reveal`（走出 `staging` 后认作完成）、`pass`（只在 `afterCommit/afterStaging/afterResult` 三个窗口才算必需）。
- **修掉的真 bug 二（遭遇阶段弹窗空壳）**：`EncounterUI.panel` 里两个分支都只认 `beforeChecks`/`afterChecks`，而 `checks` 是引擎逐人掷骰的中间步——若本轮所有玩家都已无候选敌人，`resume()` 不再往前推，两个分支都进不去，弹窗只剩标题、**一个可点控件都没有**。补 `checks` 步的兜底出口「继续结算交战检定 →」（新增动作 `continueChecks` → `T.resume`）。
- **修掉的真 bug 三（防御选择被轻量分支抢走）**：`DecisionUI.pending()` 把 `defense` 也归进 `select` 轻量分支，标题写「选择要处理到的角色」，正文只有提交/清空两个按钮，战斗面板里的「敌人当前攻击 3」「暂定防御合计」全被挤掉——玩家看不到自己在防几点攻击。改为 `defense` 交给 `CombatUI.panel` 承载完整面板；`selectTitle` 补上 `defense` 专属文案并带玩家名（「玩家1 · 选择防御者（不选＝无人防御）」）。
- **两处副本同步**：`desktop-ui.js` 才是浏览器实际执行的 `phaseDoor`，`index.html` 里那份是内联副本；`phase-engine.js` 的 `PhaseRulesFactory` 与 `index.html` 内联版同理。本次三处同改，避免日后漂移。
- **实测（引擎 API 逐阶段驱动，2 人局）**：计划→探险→旅行→遭遇→战斗→刷新**七阶段全程走通**，每阶段弹窗 `ctrls` 分别为 2/5/3/4/14/16/2，**零空壳**；`dock` 全程 64–78px；零 JS 错误。
- **回归**：tests 25/25、phase 8/8、quest 45/45、travel 24/24、combat 58/58、refresh 19/19、opening 16/16、setup-reveal 9/9、engagement 26/26（合计 **230 项全过**）。`planning-dom-tests` **60 pass / 10 fail，基线为 53 pass / 17 fail**（stash 后对比确认），本次改动净修好多 7 项，未引入新失败；`window-tests` 22/22。
- **9 档分辨率验收**：1920/1600/1440/1366/1280/1100/900/768/390 共 54 项断言全 PASS（`mat-phase` 为空、弹窗不压可点元素、手牌无横溢、无整页横滚、操作条≤140、无 JS 错误）。

# v0.15.61 · 让玩家区和右栏不再互相挤：手牌少就平铺、阶段轴一次看全（2026-10-25）

- **问题一（手牌只露一条边）**：手牌一律扇叠——92px 卡宽、`-46px` 间距 + 7px gap，每张只露出约 53px。v0.15.58 刚让「付不起的牌变灰」，可 53px 连费用都读不全，那个提示等于白做。
- **修法**：用 `:has()` 数张数，`< 10` 张平铺、`≥ 10` 张才扇叠：`.player-mat .hand-zone:not(:has(.hand-card:nth-child(10))) .hand-card+.hand-card{margin-left:0}`。阈值是按实测算的——1440 宽下容器 989px，`10×92+9×7=983`，正好容 10 张，取 9 作阈值留一格余量。1280 视口容器只有 870px（容 8 张），`max-width:1360px` 时阈值下调到 8。开局弃牌态（`.opening-panel` 的窄卡密排）选择器优先级更高，不受影响。
- **问题二（右栏被挤）**：主网格右栏宽度 `clamp(320px,26vw,400px)`，1440 下实际 374px，其中阶段轴占 190px，日志只剩 152px——文字实测 109px 宽，一句话必折两行。更糟的是 `@media(min-width:1700px)` 把右栏写死成 `274px`，**大屏反而比 1440 更窄**。
- **修法**：1700+ 断点改为 `clamp(374px,22vw,460px)`（随视口增长，上限 460）；主网格下限 320→400、上限 400→470。实测日志文字宽 109→135px（1280/1440）、167px（1600）、205px（1920），条目高 30px→15px，**不再折行**。
- **问题三（阶段轴要滚才能看完）**：20 条窗口 × 31px + 阶段名色块 = 682px 内容高，只有 900px 以上的视口放得下；1280×720 / 1366×768 / 1440×800 这些常见笔记本屏分别差 130/82/50px，只能滚动看。而竖轴的全部价值就在「一眼看到当前在第几阶段的第几个窗口、后面还有什么」，一滚动就失效。
- **修法**：按视口高度分档压缩垂直留白（`max-height` 断点，不写 `min-height`，保证不反向覆盖大屏）——
  - `≤880px`：窗口行 31→26px、编号 13px、名称 12.5px；阶段名色块内边距 `10px 0`→`6px 0`、字号 14→12.5px。
  - `≤800px`：行 23px、编号/名称 12px；色块内边距 `4px 0`、字号 12px。
  - `≤740px`：行 21px、字号 11px；色块内边距 `3px 0`、字号 11px。
  - **关键**：原以为压 `.rail-win` 的 `min-height` 就够了，实测行高仍是 31px——原因有三层：`.rail-wins` 继承的 `line-height:30.6px` 在撑 `min-height`（补 `line-height:normal`）；色块 `padding:10px 0` 把 head 顶到 93px，而 `.rail-grp` 是单行 grid，head 有多高整段就多高（改压内边距与字号）。三处一起改，内容高才真正降到 552px 以内。
- **竖轴尾部**：1920×1080 下竖轴 912px 而内容只有 682px，尾部空出 230px，看起来像「断了一截」。改成用一层 120px 的渐隐收尾（`background-image:linear-gradient`）把「墙」收住。**刻意没有**让 7 个阶段 flex-grow 平分剩余空间——试过，会把每个阶段内部撕出十几像素空白，行与行不再连续，比断尾更难看。
- **手机档回归（验收时发现并修掉）**：`max-width:1360px` 那档阈值只覆盖到 8 张，390 宽手机容器只有 322px（按 `(322+46)/(92+7-46)` 只装得下 3 张），7 张平铺成 588px，被 `overflow-x` 拖成需要横向滚动的手牌——而旧版扇叠恰好 322px 不溢出，**这是本次改动引入的退化**。补 `max-width:600px` 一档：`< 4` 张平铺、`≥ 4` 张扇叠。修后手机端与旧版逐像素一致（`margin-left:-46px`、`step 39px`、`scrollWidth 322 = clientWidth 322`）。
- **实测**：`railNeed`（竖轴是否需要滚动）在 1280×720 / 1366×768 / 1440×800 / 1440×900 / 1920×1080 **五档全部 false**；日志 `logNeed` 同样全部 false；`docOver` 全为 0（整页不出现纵向滚动条）。
- **回归**：check-window-skip 8/8、check-auto-phase PASS、check-onescreen / check-taskbar / check-affordable / check-history / check-layout / check-contrast 全 PASS；tests.cjs 25/25；31 个内联脚本块 `node --check` 全通过。
- **验收截图**：`docs/browser-acceptance/v01561-1366x768.png`、`v01561-1440x900.png`、`v01561-1920x1080.png`，及右栏特写 `v01561-rail-*.png`。

# v0.15.60 · 窗口静默改成「跳过这一次」，并且把不能用的理由说出来（2026-10-25）

- **问题一（静默失忆）**：`window-engine.js` 的 `mute()` 只会往 `windowPrefs.muted` 里追加一条记录，key 是 `回合:阶段:kind:玩家:uid`，而语义上它被当成了「永久静默」——一旦写过，同一个能力整局不再提示，想反悔只能按「恢复本阶段能力提醒」全清（连本来想留的记录一起冲掉）。玩家实际想要的是「这一次不用问我」，不是「以后都别问」。
- **修法**：`mute(s,kind,pid,uid,keep='once')` 新增 `keep` 参数（`once`/`phase`/`forever`），默认 `once`，并在写入时留一条日志「回合N · 阶段 · 本次跳过「某牌」（阶段推进后恢复提示）」。因为 key 自带回合+阶段，阶段一推进即自动失效，无需额外清理逻辑——这一点由 `scripts/check-window-skip.cjs` 的「阶段推进后同一张卡重新可见」逐条断言。
- **问题二（静默压制无声）**：这正是从 ArkhamHorror 的 `AbilityPrevented` 抄来的教训——它的注释写着「NARRATION ONLY，不产生游戏效果；没有它，抑制就是不可见的」。咱们的 `probe()` 把 `abilitySpec()` 返回的 `reason` 直接丢掉，只留 `legal` 真假，于是「这张卡在场、但此刻用不了」在界面上完全不存在。实测两人局第 1 阶段：可用 3 项，**不能用的 9 项，全部不可见**，理由分别是「该卡在计划阶段没有可主动使用的能力」「没有符合此牌条件的合法目标」。
- **修法**：`options()` 改为返回 `{list, blocked}`，`blocked` 每项带 `name` 与引擎原文 `reason`；新增 `list()` 供只关心可用项的旧调用点使用。**顺手修掉一个新引入的陷阱**：`probe()` 现在可能返回理由字符串，若沿用 `if(legal)` 判断，字符串会被当成真值塞进可用列表——改为一律严格写 `legal===true` / `legal==='uncertain'`，并单独加一条断言守住。
- **界面**：行动窗口面板每行按钮从「本阶段不再提醒」改为「**本次跳过**」（且不再受 `eligible` 约束——跳过一次不推进任何状态，没理由要求「窗口可推进」才允许点）；面板底部新增可折叠的「N 张在场但不能用（点开看原因）」，默认收起，样式走 `.window-blocked`，刻意压低存在感以免与真正可点的行动抢注意力。底栏「恢复本阶段能力提醒」改为「恢复全部跳过记录」，因为它调的是全清的 `restore()`。
- **一并补上的边界**：`unmute(s,kind,pid,uid)` 只清指定 key，不动别的记录；`restore()` 清空后留日志「已恢复全部 N 条窗口跳过记录」；`mute()` 传入非法 `keep` 抛「无效的静默范围」。
- **回归**：新增 `scripts/check-window-skip.cjs`（8 项，all pass）：`options()` 结构、blocked 带理由、理由不被误判成合法行动、mute 写对 key 并留日志、阶段推进后重新可见、restore 全清、unmute 只清指定、非法 keep 报错。既有回归全绿：tests.cjs 25/25、check-auto-phase 自动推进到第 4 回合 PASS、check-onescreen / check-taskbar / check-affordable / check-history / check-layout / check-contrast 全部 PASS。`index.html` 32 个内联脚本块 `node --check` 全通过。
- **顺手修掉的既有 bug（截图才发现）**：第 18 节的行动窗口面板配色是照深色主题写的（文字 `#d3dde4` 浅灰、分隔线 `#3d5361` 深蓝），但 `.operation-dock` 在浅色主题下是 `#fffdf6` 白底。原来以为主题覆盖段能兜住，可那里与第 18 节的选择器**优先级完全相同**，后写的深色值反而胜出——「玩家N · 牌名」一直是白底浅灰字，几乎看不见（v0.15.59 之前的截图里这几行本就是空的）。本次在文件末尾补了「18b 浅色主题覆盖」并显式注明必须放在第 18 节之后，`check-contrast` PASS。
- **限宽**：`.window-option` 的 `span{flex:1}` 在 1400px 通栏里会把按钮甩到最右缘、中间拖出一整屏空白。改为 `flex:0 1 auto` + 行 `max-width:720px`，按钮紧跟文字；`em`（否决理由）从 `white-space:nowrap` 改为 `overflow-wrap:anywhere`，长理由不再撑破行。
- **实测成本**：`options()` 单次 0.34 ms，面板整份渲染 0.36 ms（两人局第 1 阶段，含 9 条否决理由），不构成性能负担。
- **架构备注**：`index.html` 是唯一生效的壳，`window-engine.js` 的同一份代码以「内联副本 + 独立模块」两种形式存在（Node 测试 require 模块，浏览器跑内联）。本次改动用脚本把模块内容整体灌回内联副本，避免手抄漂移；日后改 `window-engine.js` 必须同步 `index.html` 第 6290 行起那一段。另注：`desktop-ui.js` 与 `planning-ui.js` **未被 `index.html` 引用**，是历史残留，本次只同步了其中的版本号常量，未做其它改动。

# v0.15.59 · 底部合并成「队伍与手牌」，结束阶段只剩一颗按钮（2026-10-25）

- **合并**：玩家区原来的「英雄与盟友」「手牌」两个分区（外加打出的附属）并成底部一个模块 `.bottom-deck`——标题行写清数量（英雄 a · 盟友 b · 附属 c · 手牌 d），角色行在上、手牌行在下，交战区仍在模块上方独立成行。
- **结束阶段简化**：`phaseDoor()` 从「标题 + 必需操作清单 + 按钮 + 状态行」四段竖排缩成一颗按钮，收进合并模块的标题行右侧。必需操作清单全文挪进按钮 tooltip（title），未完成项数量保留在隐藏的 `.door-state` 里——`check-auto-phase` 的卡死签名还读它。`check-taskbar`、`check-auto-phase` 依赖的 `.phase-door .door-go` 选择器原样保留，脚本零改动。
- **卡图完整显示**：手牌行高改为由 CSS 变量推导（`--hc:118px` + 26px 行距），并留 4px 余量防选中描边被 `overflow-y:hidden` 裁掉；角色行 96px 宽按 424:600 原始比例显示，实测卡图底缘全部落在行盒内（144/144）。角色区与手牌行各自横向滚动、互不挤压。
- **布局同步**：`style.css` 里十几处 `.player-mat>.own-characters` / `>.hand-zone` 直属选择器全部改为适配新嵌套（合并模块内两行）；开局弃牌态手牌窄带（62px）、探险投入名单态角色行限高 150px 的特殊行为保留。`check-layout` 的卡宽取样与 `check-attachment` 的手牌探测选择器同步更新。
- **回归**：check-layout 17/17、check-onescreen 单屏可见（hand ✓）、check-taskbar 23/23、check-auto-phase 自动走到第 4 回合 PASS、check-attachment 5/5、check-score 19/19、check-quest-panel 7/7、check-setup-reveal 13/13、check-affordable 10/10、check-card-hover 22/22。
- **验收截图**：`docs/browser-acceptance/v0.15.59-bottom-deck.png`。

# v0.15.58 · 付不起的牌就该是灰的：置灰判据不再依赖「此刻轮不轮得到你」（2026-10-25）

- **问题**：资源用光后手牌依然全亮。`desktop-ui.js` 靠 `!sp.legal && /资源不足/.test(sp.reason)` 判断要不要加 `.unaffordable`，可 `playSpec()` 的断言是有顺序的——先查时机（`free()` 里的「请先处理剧本待结算事项」「当前不是玩家行动窗口」）、先查阶段（「盟友和附属仅可在计划阶段正常打出」）、先查身份（「仅当前计划玩家可以从手牌打出盟友或附属」），最后才轮到 `payment()` 抛「匹配领域的资源不足」。所以换玩家、进探险阶段、或行动窗口没打开时，`reason` 里根本不会出现「资源不足」四个字，CSS 类加不上，一手牌全是亮的，点下去才发现付不起。
- **修法**：把「钱够不够」从 `playSpec()` 里拆成两个纯查询函数，界面直接读结论，不再靠正则猜文案：
  - `shortfall(s,pid,sphere,cost,three)` — 只回答还差多少点资源（0 = 够）。领域对不上直接按「一分钱也付不了」算。
  - `costOf(s,m,params,fields)` — 这张牌这一手实际要付多少（01051「挺身战斗」按弃牌堆里那张的费用、01067「甘道夫的搜寻」按选的 X），和 `payment()` 同一口径。
  - `playSpec()` 的返回值新增 `cost` / `short` / `affordable` 三个字段，且在**所有时机断言之前**就算好，所以无论当前是什么阶段、轮到谁，界面都能拿到准确的「够不够」。
- **界面**：`unaffordable` 改判 `sp.affordable===false`；牌面说明从笼统的「匹配领域的资源不足」改成带差额的「资源不足：还差 N 点」（阶段自动推进时玩家最需要的就是这个数）。置灰只影响能否点击，`data-hover-src` 探针保留，灰牌照样能悬停放大看牌文。
- **刻意不做的**：0 费牌（如「共同事业」）在资源清零后依然保持可点——规则上它本来就付得起，灰掉反而是错的。回归断言按 `cost===0` 单独豁免。
- **回归**：新增 `scripts/check-affordable.cjs`（10 项，all pass）。核心断言不是「灰色数 === 0」而是**界面灰色数与引擎 `affordable===false` 的牌数逐张一致**——建局手牌随机，1 费 2 费牌常常付得起，用绝对数当基线会假失败。另外覆盖：资源清零后除 0 费外全灰且全禁用、灰牌仍可悬停、差额文案正确、切到另一位玩家后按那个人的资源重新判定（不继承上一位的灰色状态）。
- **验收截图**：`docs/browser-acceptance/v0.15.58-hand-unaffordable.png`。

# v0.15.57 · 阶段该自动就自动：引擎自己判断「本阶段没事可做了」（2026-10-25）

- **问题**：`endPhase()` 里明明写着 `if(s.phase===0&&s.resourceDoneRound!==s.round)resourcePhase(s)`，也就是「资源阶段没有玩家决定，到回合就替玩家收」，但这句挂在「结束阶段」按钮的回调后面，没有任何代码主动调用它。结果：收集资源 + 抽牌这种零决策步骤也要玩家点一下按钮，阶段推进变成了「玩家替引擎判断做完了没有」。
- **修法**：新增 `ScenarioEngine.autoAdvance(s)`，接到 `mutate()` 里（`windows.run` 前后各跑一次），只要本阶段没有「必须由玩家决定」的事就连续走完，直到碰上需要玩家决定的地方才停手。判断口径直接复用 `phaseRules.completed()` / `checks()`，不另立一套，避免界面说「已完成」而引擎不动。
- **自动边界**（按产品判断刻意收窄）：只自动「无决策」阶段——资源阶段收资源抽牌、阶段必需操作全部打勾后的换阶段。**不**替玩家放弃出牌、**不**替玩家放弃攻击、**不**替玩家收尾有可选响应的窗口。这些步骤的 `finish`/`move` 自带前置断言（例如「请让每位玩家确认放弃剩余行动」），断言一抛就当「这里需要玩家」停手，因此不会静默跳过任何玩家选择。不留开关，固定行为。
- **顺带修掉的五个真实缺陷**（都在自动推进的路上暴露，全部会导致卡死）：
  - **阶段 2 智能模式下「放弃剩余行动」整块消失**（`planning-ui.js`）：`current===null && mode==='smart'` 时整排按钮和主动能力区都不渲染，两位玩家结束出牌后阶段 2 只剩一颗「结束阶段」。而 `phaseRules` 把「放弃剩余行动」算作必需项——必需项永远打不了勾，只能靠结束阶段绕过去。现在智能模式一样渲染，这两件事本来就该由玩家点。
  - **`beforeCommit` 的「开始投入角色」从未真正渲染**（`desktop-ui.js`）：调用点写死 `step==='commit'`，把上一版加在 `picker()` 里的 `beforeCommit` 分支整个挡住了。改为交给 `picker` 自己判断。
  - **`result` 判据不认 `completed`**（`phase-engine.js`）：探险阶段收尾后 `step` 变 `'completed'`，判据只认 `'afterResult'`，事后复查一律未完成，`autoAdvance` 据此拒绝换阶段，界面只剩一句「验收完成」。
  - **阶段 4 的 `travel`/`pass` 同一毛病**：只认 `step==='action'`，收尾后（`completed`）判未完成，旅行阶段走完却进不了遭遇阶段。
  - **阶段 5 的 `enemies`/`attacks` 同理**：只认 `endAction`/`ending`，战斗收尾后被判未完成。三处统一改为「`step==='completed'` 或 `context.completed` 也算完成」。
- **回归**：`check-auto-phase.cjs` 新增断言「引擎须自己走过 ≥3 个回合」，否则判失败——防止退回「每步都要玩家点一下」。实测连续 3 次 PASS，分别自动走到第 4~5 回合，中途只点玩家必须决定的项（提交名单、选择防御者、处理卡牌响应）。补上「处理强制效果／卡牌响应」按钮的识别（原来只认另外三种文案，遇到交战检定的强制效果就停住）。
- 验收：check-auto-phase PASS（rounds 4~5，auto-advance ok）、check-layout **17/17**、check-taskbar 23/23、check-quest-panel 7/7、check-score 19/19、check-onescreen 五区可见、check-contrast 0 低对比、check-attachment 5/5、check-card-hover 22/22、check-setup-reveal 13/13、verify-local-art `ok:true`。截图 `docs/browser-acceptance/v0.15.57-auto-resource.png`：建局后直接落在第 2 阶段，三名英雄各 +1 资源、手牌 7 张，玩家未点任何按钮。

# v0.15.56 · 导航瘦身 + 修复探险/遭遇/战斗/刷新在智能模式下无法推进（2026-10-25）

- **删除顶部「全部卡图」入口**：与「卡牌」导航完全重复。`shell.html` 去掉 `#imagesTab`，`app.js` 同步移除 `images` 路由映射、`ImageLibrary.html()` 分支与点击绑定。
- **导航栏瘦身**：header 内边距 10→6px、行高 1.25、导航按钮 12.5px/3px-8px、历史与操作按钮同步压扁、品牌标 16px。实测 header 68px → **36px**，导航项仍为「首页 / 卡牌 128 / 我的卡组 / 说明与完成范围」，无溢出。
- **修复（核心）**：智能推进模式（默认）下，四个阶段一旦走过「结束阶段」就再也找不到下一步入口——这些入口全写在 `mode==='detailed'` 分支里：
  - **探险·投入前行动窗口**：`picker()` 只在 `step==='commit'` 渲染，`beforeCommit` 没有「开始投入」，任务永远停在 `1R P2 commit`。现在补 `beforeCommit` 紧凑面板（全员放弃 + 取消放弃 + 开始投入）。
  - **探险·投入名单**：紧凑面板只有当前玩家的角色卡，第二个人提交不了名单。补上「查看／操作玩家」下拉框；并在提交成功后自动把操作权交给下一位未确认玩家（与桌面点选路径一致）。
  - **遭遇阶段**：补 `beforeChecks`/`afterChecks` 的「放弃行动 → 开始交战检定 / 结束遭遇阶段」，以及主动交战方案的「全部确认交战方案，继续」（新增 `approveAll`）。
  - **战斗与刷新阶段**：行动窗口补「全队放弃行动 → 关闭窗口继续 / 结算战斗阶段结束 / 结算刷新与回合结束」。
- **修复（战斗阶段真断点）**：审计「自动进入下一阶段」时又发现三处硬阻塞，都会让第六阶段完全走不动：
  - **智能模式下「全队继续到下一决策点」按钮消失**：`WindowUI.panel()` 在窗口没有「值得提醒」的行动时整块返回空字符串，连带把这颗唯一的推进按钮也藏了；战斗里全队放弃行动后就再无入口。现在只要窗口可推进就保留按钮行，无选项时显示一句「本窗口没有需要提醒的行动，可以让过继续」。
  - **攻击声明阶段没有任何出口**：`attackChoice` 只渲染「暂定攻击 X」，一个都打不了时（角色全横置／已攻击过）面板只剩被禁用的「放弃行动」。补「暂定结束我的攻击 / 本回合不攻击，交给下一位」。
  - **敌人攻击选择缺少轮转**：`enemyChoice` 按 `activeEnemyPlayer` 轮转，只有当前玩家的敌人按钮可用；两侧都打完后由 `resume()` 换人，脚本与 UI 都依赖这一步，已补出口提示。
- **回归脚本**：新增 `scripts/check-auto-phase.cjs`，从建局自动点到第 7 阶段并进入第 2 回合，同一状态连续 12 次无变化即判失败，输出停在哪个步骤、战斗子状态、最后点击的按钮与 `blocker`；覆盖投入名单、防御勾选、敌人攻击轮转、暗影结算、防御响应与行动窗口推进。连续 10 次全 PASS。
- **回归脚本的三个判据修正**（脚本自身缺陷，会误报「卡死」）：
  - **卡死签名漏掉战斗子状态**：原签名只看 `回合/阶段/任务步骤/阶段门文案`。第五阶段的推进发生在战斗状态机内部（防御选择 → 响应 → 暗影 → 伤害……），这四项全不变，正常推进被误判成卡死。签名补入 `combat.step + 敌我游标 + 已完成计数 + 提案/确认数`。
  - **重复提案把确认数清零**：`propose` 会清空 `approvals`。脚本原来每轮都点「暂定」类按钮，自己把刚攒的二次确认抹掉。改为「已有提案时只做二次确认，绝不再提案」。
  - **脚本在浏览器上下文引用 `process`**：`p.evaluate` 里写 `process.env` 直接 `ReferenceError`，改为在 Node 侧判断。
- **阶段 3 面板重排**：`.mat-phase` 里的投入面板由「标题 + 长说明 + 草稿摘要 + 勾选 + 提交」重排为三行紧凑结构（操作玩家下拉 + 横滚勾选条 + 提交），面板内隐藏重复的「已投入：…」行与 `panel-title`，实测面板 96/96 无内部滚动、提交按钮在视口内。
- **操作条限高**：`.operation-dock > .operation-content` 加 `max-height:clamp(88px,12vh,120px)`，避免探险阶段操作条涨到 295px 把公共牌桌压到 120px；加断言 `操作条不挤压公共牌桌（dock ≤ 200px 且牌桌 ≥ 200px）`。
- 验收：check-layout **17/17**、check-taskbar 23/23、check-quest-panel 7/7、check-score 19/19、check-onescreen 五区可见、check-contrast 0 低对比、check-attachment 5/5、check-card-hover 22/22、check-setup-reveal 13/13、check-auto-phase `reach: 1:0 … 1:6 2:0` 连续 10 次 PASS、verify-local-art `ok:true`。截图：`docs/browser-acceptance/v0.15.56-{header-nav,phase3-commit-panel,phase5-combat}.png`。

# v0.15.55 · 压缩顶部区域，角色卡完整可见（2026-10-24）

- **问题**：截图红框圈的是顶部（标题行 + 任务提示条），而玩家区角色卡只显示上半截（角色行 95px / 内容 117px）。逐区测量发现顶栏之外牌桌区也在被裁（内容 402px / 容器 288px），单纯「减顶部」不够，需整体重排高度预算。
- **顶部瘦身**（约 68px）：导航条内边距 16→10px；标题行——装饰性 eyebrow 隐藏、h1 19→17px、玩家标签按钮固定 36px 高（原 44/49px）；操作条——按钮压扁（min-height 0）、「第 x/7 阶段」小字删除（与竖轴重复）、任务提示整行隐藏（与竖轴必需操作清单重复，信息不丢失）。
- **卡牌尺寸紧凑档放宽到 ≤980px 高**（原 ≤820px 专属）：对手区改单行微型头像条（90px）、探险区压单行信息条（108px 上限）、公共牌 84px、探查区下限 104px。
- **玩家区**：手牌变量 `--hc` 130→118px（行高 152→140）；角色行卡 100→96px、查看按钮压扁；玩家区行高上限 380→428px（44vh）。结果：角色行 146px 内容完整显示（此前 95/117 被裁）、牌桌区 347/345 全部可见、手牌与结束阶段完整。
- 验收：check-layout 16/16、check-taskbar 23/23、check-score 19/19、check-onescreen 五区可见、check-contrast 0 低对比、check-attachment 5/5、check-card-hover 22/22。

# v0.15.54 · 修复：打出附属后手牌与结束阶段被裁掉（2026-10-24）


- **根因**：附属卡独占一行 `.table-zone`（标题 + 122px 卡面 ≈ 267px），而 `.player-mat` 是 `overflow:hidden` 的固定高度网格行。打出附属后内容总高 639px 远超 380px 容器——flex 布局压缩角色行也填不平，手牌行（152px）与 `.mat-phase`（结束阶段，96px）被整块推出容器底部裁掉，表现为「只剩附属卡，没有手牌也没有结束阶段」。
- **修法**：附属并入「英雄与盟友」同一行（附属本来就附着在角色上，语义一致），标题计数显示「盟友区 · n · 附属 m」；`.own-characters` 改为 `min-height:0 + 内部滚动`，角色行内容再多也只在自己范围内滚动，永不挤压/顶走手牌与结束阶段。修复后 mat 内容 377px ≤ 380px，手牌 7 张与结束阶段按钮均可见。
- **回归脚本**：新增 `scripts/check-attachment.cjs`（真实浏览器打附属 → 断言附属入场、不溢出、手牌可见、结束阶段可见），5/5 通过。
- 验收：check-layout 16/16、check-taskbar 23/23、check-score 19/19、check-onescreen 五区可见、check-contrast 0 低对比。

# v0.15.53 · 竖轴再放大一档（2026-10-24）


- 通高实测 697px 后再放开：行高 24→31px（20 × 31 = 620，留 77px 余量不滚动）、编号 14px、标签 13.5px、行内间距 8px、右内边距 8px、阶段名 14px/字距 4px/上下留白 10px、竖轴列宽 176→190px。32px 档实测溢出 1px，回调 31px 后 scrollHeight == height 无滚动。
- 验收：check-layout 16/16、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比。

# v0.15.52 · 竖轴按通高重新配比（2026-10-24）


- **行高与字号放开**：右栏通高约 530px 后，竖轴从矮栏压缩态（20 窗口 × 15px、标签 10.5px、列宽 128px）改为舒展态——行高 24px、编号 13px、标签 12.5px、阶段名竖排 12.5px/字距 2px、色块列 22→保持但内边距加大；竖轴列宽 128→176px。20 × 24 = 480px < 530px，整轴仍一屏看全、不滚动。
- 标签加 `title` 提示，超长窗口名悬停可看全文。
- 验收：check-layout 16/16、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19、check-card-hover 22/22。

# v0.15.51 · 删除「行动窗口」chip；阶段+日志占满右侧全高（2026-10-24）


- **删除「行动窗口 · 智能推进」**：操作条标题行的那枚模式切换 chip 整个删掉（`WindowUI.modeChip` 函数、desktop-ui 的调用、`.mode-chip` CSS 一并移除）；有可选项时的紧凑面板保留但不再算「页面」。planning-dom-tests 对应断言同步删除（模式默认 smart 仍断言，切换走引擎层验证）。
- **右栏通高**：单屏网格从 `"table dock"/"mat rail"` 两行改为三行 `"dock dock"/"table rail"/"mat rail"`——操作条（已无框）移到顶部通栏，右栏（阶段竖轴 + 日志框体）横跨第 2、3 行，占据页面右侧全部高度。§14/17/24/31/32/33 五处两值行高覆盖全部补上首位 `auto`，否则 dock 行会被当成 1fr 压扁。
- **验收断言更新**：check-layout「右列操作栏」四项改为新语义（操作栏顶部通栏 / 右栏顶与桌面齐、底与玩家区齐 / 左右不重叠）；check-taskbar 首项同步。当前 16/16 与 23/23。
- 验收：引擎套件全绿；check-layout 16/16、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-history OK。

# v0.15.50 · 操作条去框 + 阶段与日志合并为同一框体（2026-10-24）


- **操作区空框删除**：右侧第 6 节（操作条）此前虽无内容仍印一个带底色描边的框，用户截图质问「这个框体去不掉吗」。`.operation-dock` 改为透明容器（`background:transparent;border:0;box-shadow:none;border-radius:0`），`.operation-title`/`.phase-hint` 同步去底——操作条只剩文字与控件，不再是一个「框」。
- **阶段竖轴与日志合并成一个框体**：v0.15.49 的抽屉方案回滚。`.tabletop-rail` 恢复为一个完整框体（深底 + 描边 + 圆角 + 内边距），内部改两列网格（`128px 竖轴 | 1fr 日志`）：阶段竖轴居左通高，远征日志居右以竖分隔线隔开，日志行内「回退」撤销入口保留。`logDrawer()`、顶栏「远征日志」按钮与 app.js 的 `logToggle`/`APP_LOG_OPEN` 一并删除。
- **验收脚本修正**：check-taskbar 的 `PANEL='.operation-content, .mat-phase'` 拼接后逗号优先级使整个 `.operation-content` div 也成为匹配项，`.first().click()` 点在 div 上——提交流程 7 项假失败。改为 `:is(...)` 后 23/23。check-layout 三项改为：圆角检查豁免透明 dock、右栏断言为「一个框体两列（kids=2）」、竖轴高度按 rail 内边距+边框 22px 放宽容差。
- 验收：14 个套件全绿；check-layout 15/15、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19。浏览器实测：`dock{bg:rgba(0,0,0,0),bd:none}`、`railCols:2`、`logInRail:true`、`entries:7`、`undo:true`。


- **需求**：整个右侧区域只被竖着的阶段条占据，没有其他框体。此前右栏是「竖轴（108px）+ 日志流（其余宽）」两列，日志面板固定占掉大半栏。
- **改法**：`.tabletop-rail` 改单列，只渲染阶段竖轴（通高占满 374px 栏宽）；`.table-log` 移出 rail 变成 `position:fixed` 的右侧抽屉（`min(420px,44vw)` 宽、半透明深底），默认 `hidden` 收起。顶栏新增「远征日志 / 收起日志」按钮（`data-action="logToggle"`）开关；抽屉内保留日志条目、按阶段着色与本回合/全部切换，**日志行内「回退」撤销入口不变**。
- **修复**：`.table-log{display:flex}` 会覆盖 `hidden` 属性导致抽屉收不起来——补 `.table-log[hidden]{display:none}`。
- **窄屏**：390px 档因顶栏被「远征日志」按钮挤紧出现 7px 横向溢出。新增 600px 断点（置于文件末尾以覆盖单屏布局块的 `nowrap`）：藏玩家标签的威胁/资源统计、顶栏允许换行。
- **验收脚本**：check-layout 的「右侧栏各框一致」三项改为「右栏只有竖轴一个框 + 竖轴占满栏高」（旧断言针对已移出 rail 的日志框）。
- 验收：14 个套件全绿；check-layout 15/15、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19（含 390px 无溢出）、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-history 无脚本错误。

# v0.15.48 · 删除行动窗口空壳面板，模式切换缩成标题行小按钮（2026-10-24）

- **问题**：右侧操作条里「行动窗口 · 智能推进」面板无论有没有可做的行动都印一整块（标题 + 一段长说明 + 空列表），和右侧阶段竖轴表达同一件事——玩家问「这个窗口为什么还在」。
- **修法**：`window-ui.js` 的 `panel()` 只在智能模式且 action 窗口**真的有可选项**时渲染紧凑面板（选项行 + 让过/恢复按钮，删掉长说明）；其余情况返回空。模式切换缩成操作条标题行的一枚 `.mode-chip` 小按钮（`WindowUI.modeChip`），文本随模式在「行动窗口 · 智能推进 / 详细模式」间切换。
- **有选项时面板并入 taskPanel**：`desktop-ui.js` 的 `taskPanel()` 增加通用分支渲染 `WindowUI.panel(s)`，符合「操作条只留此刻必须做的输入」原则；战斗阶段的攻击选择、静音提醒等按钮行为不变。
- **对比度修正**：chip 原为透明底，落到浅色 setup 页面对比只有 1.73；改实底 `#1d2d38` 后 0 低对比。
- 验收：14 个套件全绿（planning-dom 70 项含窗口模式切换断言）；check-layout 16/16、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-history 无脚本错误。浏览器实测：资源阶段 `panel:false, ops:0`（空壳确无），chip 双向切换正常。

# v0.15.47 · 开局设置搬到角色卡下方（2026-10-24）

- **「开局步骤 · 起始手牌」从右栏移到角色卡下方**：它原来渲染在 `.operation-content` 里，把右侧 320px 的窄条占满，而角色卡下方那块 `.mat-phase` 在开局阶段是空的。现在 `openingPanel` 与 `setupPanel` 一起落到 `.mat-phase`，与阶段面板同一位置——开局设置本来就是「第 1 阶段之前的那一步」，位置一致更符合直觉。
- **开局面板按深色卡区重绘**：它本身是浅色纸感底（`#f8f2df`），直接放进深色 `.player-mat` 会突兀且文字不可读。改为深绿底 + 金色描边（`#2b3d33` / `#c6ac74`），玩家行卡片改成深底，标题与说明转成暖白。
- **开局阶段让出高度**：`.mat-phase` 原本有 `max-height:96px` + `min-height:76px`（为保住「结束阶段」按钮不被裁）。开局面板没有那个按钮，但内容有 174px，三条角色区规则一起放开：`.mat-phase:has(>.opening-panel)` 解除高度限制；英雄区 `max-height:0`；手牌行改 `flex:0 0 62px`（原来是 `flex:0 0 auto` + `min-height:104px`，不改 flex 与 min-height 光是改 min-height 没用，仍会撑满 170px）。
- 验收：14 个套件全绿；check-layout 16/16、check-taskbar 23/23、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-history 无脚本错误。三档分辨率实测面板底边均在 `.player-mat` 内（1440×900: 883/890，1366×768: 753/758，1920×1080: 1063/1070）。

# v0.15.46 · 阶段智能推进：一键结束阶段 + 面板搬到角色卡下方（2026-10-24）

- **阶段面板去掉重复出口**：探险 / 旅行 / 遭遇 / 战斗 / 刷新五个面板里那排「回退一步（整桌）」按钮与长段说明全部删除。撤销统一走顶栏「撤销一步」与日志行内回退，面板底部只留一个「结束阶段」出口。
- **面板搬到角色卡下方**：320px 宽的 sticky 操作条装不下完整阶段面板（标题被挤到换行）。完整面板 + 必需操作清单 + 结束阶段按钮现在落在角色卡区的 `.mat-phase`；操作条只保留「此刻必须做的输入」——探险阶段的投入选择器、已翻开的遭遇牌。`taskPanel()` 带 try/catch，面板异常时返回空串，不再拖垮整张桌面渲染。
- **`endPhase` 一次点击走完「收尾 → 换阶段」**：计划/探险/旅行/遭遇/战斗/刷新阶段的收尾是两段式（先 `closing` 收尾、置 `completed`，第二次调 `nextPhase` 才换阶段）。`endPhase` 现在最多连调 3 次 `nextPhase`，收尾抛错但已落成 `completed` 时 `continue` 继续推进，因此从计划阶段点一次即可直达探险阶段（`{from:1,to:2,steps:['进入探险阶段']}`）。
- **`quest-ui.js` 修正**：底部调用误写成 `door(s,Q)`（`Q` 不在作用域），渲染即抛 `ReferenceError`，表现为结束阶段后界面「跳回原阶段」。
- **「结束阶段」不再静默失败**（三处）：探险阶段「投入名单未提交」和「遭遇牌未翻开」两个分支原来直接 `return`，按钮看着可点、点了毫无反应。现在把原因写进 `steps`（`还差 玩家1、玩家2 提交投入名单` / `还差 N 张遭遇牌未翻开结算`），由 toast 说出来；投入名单未齐时按钮直接禁用并在旁边点名等谁——引擎不会替玩家挑角色。
- **修复二次确认被整体跳过**：`q.discussion` 只由旧的 `next` 处理器置位，阶段推进改走 `endPhase` 后它永远是 `undefined`，`submitDeployment` 于是把第二位玩家的提交当成「全员已确认」直接锁定执行。现在 `endPhase` 进入探险阶段时统一调用 `enableDiscussion`，两条推进路径行为一致。
- **「结束阶段」卡片压缩到两行**：原来「标题 + 清单 + 按钮 + 长说明」竖排 151px 高，角色卡区只有 336–380px，手牌一撑就把按钮顶出视口（被 `.player-mat` 的 `overflow:hidden` 裁掉半截）。改成第一行 标题/未完成项/按钮、第二行 清单（溢出省略 + tooltip 全文），高度降到 62px；`.mat-phase` 给 `min-height:76px` 保证按钮不被压扁，面板自身 `max-height:96px` 可滚。
- 验收：14 个套件全绿（tests 25 / planning 90 / quest 45 / travel 24 / engagement 26 / combat 58 / refresh 19 / window 21 / player 19 / opening 16 / score 10 / setup-reveal 9 / phase 8 / planning-dom 70）；check-taskbar 23/23、check-layout 16/16、check-onescreen 五区可见、check-contrast 0 低对比、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-history 无脚本错误。

# v0.15.45 · 右栏去框：只留阶段窗口竖轴与日志流（2026-10-24）

- **移除牌堆栏**：`遭遇牌堆 / 弃牌 / 胜利点` 计数框与「查看弃牌与胜利区」折叠整块删除。牌库/弃牌数量在玩家区标题行仍有（每人自己的），胜利点在终局计分面板完整可查。
- **移除「阶段与界面说明」折叠框**：操作提示文案已并入各阶段面板，独立说明框属于冗余。
- **日志去框**：`.table-log` 的背景、边框、圆角、内边距全部移除，日志流直接贴在竖轴右侧；右栏现在只有「阶段窗口竖轴 + 日志流」两个内容，无任何容器框体。
- 验收：67 项测试全绿（新增「牌堆栏/说明框不得再出现」断言）；check-layout 16/16（1920/1440/1366）、check-taskbar 23/23、check-contrast 0 低对比、check-score 19/19、check-onescreen 五区可见（deckRail 检查项改为 phaseWin）。

# v0.15.44 · 移除操作面板的横排阶段胶囊，高度让给右侧竖轴（2026-10-24）

- **删掉重复的阶段指示**：操作面板顶部那排 `01 资源 当前 / 02 计划 / … / 07 刷新` 胶囊已移除。它与右侧竖轴表达同一件事（当前在第几阶段），但竖轴还多了窗口编号与触发时机，胶囊纯属冗余，还占掉约 30px 高度。
- **高度重新分配**：矮屏断点里右栏行高原本写死 268px（历史原因是「最后 18px」的压缩，为日志区挤空间）。现在右栏要装通高的 20 窗口竖轴，实测需 334px → 回调到 336px（1366×768 下 `railH == railScroll == 336`，一屏看全无需滚动）。手牌高度从 100px 回到 108px，不再为省 18px 而压。
- **操作面板按内容收缩**：`contentH == contentScroll` 已验证内容区不虚占高度，省下的空间实际落到竖轴上。
- 验收：67 项测试全绿；check-layout 16/16（1920/1600/1440/1366 四档）、check-taskbar 23/23、check-contrast 6 阶段 0 低对比、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-onescreen 五区可见；三档分辨率 `railH == railScroll`（竖轴完整可见）。

# v0.15.43 · 右侧重做为规则书「阶段与时机」竖轴 + 窗口编号（2026-10-24）

- **补齐参考图的结构**：上一版把参考图理解成「横排阶段胶囊 + 细色带」，方向错了。参考图（97×1833）实际是规则书里那张**阶段-窗口索引轴**：左侧通高色块竖排阶段名，右侧逐条列窗口编号（`1.1 重置英雄` … `7.3 回合结束`），并用金/绿/红三条竖线标出触发时机。本次按这个结构重做，共 **7 阶段 20 个窗口**。
- **窗口编号与引擎对齐**：编号不是装饰，`stepKey()` 从引擎各阶段子对象取 `step`（`questing`/`traveling`/`encountering`/`combat`/`refreshing`），精确点亮当前窗口。计划阶段用的是 `planning.completed` 标志而非 `step`，单独换算；资源阶段无子对象，退回点亮首行。15 种状态逐一验证，每次只有一条高亮。
- **竖轴改为右栏通高列**：塞在 125px 的日志面板里，20 条窗口每条只能分到 6px，压到不可读。现在竖轴是右栏第一列（108px 宽、360px 高），牌堆/日志/说明收进右侧内容列；右栏整体由 256px 放宽到 320px。1440×900 下 20 条窗口 × 15px 刚好排满，**一屏看全、无需滚动**；1366×768 下轻滚 66px（矮屏合理妥协）。
- **触发时机三色线**：金=规则触发（抽牌、任务结算、重置卡牌）、绿=行动窗口（6 条）、红=强制结算（探查区、交战检定、敌人攻击、暗影、回合结束）。已过阶段整体压暗但保留色相，当前阶段满饱和 + 外发光。
- **点阶段色块可收起**：默认全展开；点一下就压成计数条，方便聚焦当前阶段。与日志范围切换一样，`railOpen` 是纯视图状态，不写对局、不进撤销历史。
- **修掉两处真实缺陷**：
  - 阶段色块是 `<button>`，默认继承页面深绿字色（`rgb(36,57,47)`），与阶段色底对比度只有 1.66~2.45 → 明确指定白色，`check-contrast` 由「35 项不合格」归零。
  - `check-layout` 用 `.tabletop-rail>section` 取样右栏各框，结构改动后取不到真实卡片 → 改为顺着 `.rail-content` 取并过滤无边框容器。
- 验收：67 项测试全绿（新增窗口映射 15 例 + 展开/收起 5 项断言）；check-layout 16/16（1920 / 1600 / 1440 / 1366 四档）、check-contrast 6 阶段 0 低对比、check-taskbar 23/23、check-score 19/19、check-card-hover 22/22、check-setup-reveal 13/13、check-deck-share 16/16、check-onescreen 五区可见；四档分辨率均无纵向溢出与脚本错误。

# v0.15.42 · 远征日志重构：阶段色带 + 按阶段着色 + 单条回退（2026-10-24）

- **日志按阶段着色**：新增 `phase-log.js`。日志行改为「回合N · §P3§文本」的结构化格式（`§` 标记可被纯文本工具直接切掉，旧存档无标记时按关键词或当前阶段归组）。七个阶段各有一套色相：资源蓝灰、计划赭、探险绿、旅行青、遭遇紫、战斗砖红、刷新靛。顶部一条横排 7 枚阶段胶囊，当前阶段用自身色相点亮。
- **单条回退**：悬停任一日志条目，右侧浮出回退按钮，点击即回到**那条记录出现之前**的完整状态。历史上 `history[j]` 存的是操作「之前」的状态，而日志是操作「之后」才写入，两者不能按下标对齐；本次在 `mutate()` 里记录每次操作前后的日志条数（`logMarks`，含绝对序号 `seq` 以兼容 80 步截断），日志据此精确落到产生它的那次操作。
- **右栏布局修正**：右栏原有两行网格定义（`auto minmax(0,1fr)`），第三块会落到隐式行而被挤出视口。改为三行 `auto minmax(0,1fr) auto`，日志区改独立 `section` 撑满剩余高度（放 `details` 内会因内容高度反向撑高自身）。矮屏（≤860px 高）压缩牌堆栏为单行计数，1366×768 下日志可见条目由 1 条提升到 4 条。
- **默认只显示本回合**：日志默认限定为当前回合，顶部「本回合 / 全部」分段按钮可随时切换；有更早记录时底部给出「更早 N 条 · 查看全部回合」入口。`panel(state, marks, scope)` 的 `scope` 是唯一开关，`roundSpan()` 用「从头数到第一条第回合号不同」的长度截断而非过滤，保证本回合模式下条目下标与原日志一致、回退映射无需换算。**切换范围是纯视图操作**——不写 `state`、不进 `history`、不产生 `logMarks`；后续若要加「按阶段筛选」等维度，把 `app.js` 的 `logScope` 扩成 `{scope, phases}` 对象传给 `panel` 即可。
- **回合分组排序修正**：日志为 newest-first，但同回合内可能夹着跨回合杂项（阶段切换、补写记录），原先只做「相邻同回合合并」会把同一回合拆成多段，出现「回合2 / 回合3 / 回合1」的乱序。改为 `Map` 按回合号归并后再降序排列。
- **对比度**：日志正文/回合标签/阶段名纳入 `check-contrast` 取样；同时修正该脚本的一个真实缺陷——Chrome 对 `color-mix()` 计算色返回浮点 `oklab()`，旧代码按 0~255 解析导致对比度失真，现统一归一化。
- 验收：458 项测试全绿（新增 4 项日志解析/回退映射/DOM 渲染/回退行为回归，3 项日志范围默认值/只读性/回合排序回归）；check-layout 16、check-contrast 6 阶段 0 低对比、check-taskbar 23、check-score 19、check-card-hover 22、check-setup-reveal 13、check-deck-share 16、check-onescreen 四分辨率、browser-check 全流程全部通过；真实浏览器验证日志回退（日志 7→6、历史标记 4→3、对局保留）。

# v0.15.41 · 单屏桌面布局：BGA 式「左桌右栏」四区重排（2026-10-23）

- **单屏不滚动**：`body:has(.desktop-table)` 锁定 `100vh`，`main` 改为 flex 填充剩余高度并 `overflow:hidden`。文档总高由 **2455px 降到恰好一屏**（1440×900 下 900px，零纵向溢出），1920×1080 / 1600×900 / 1440×900 / 1366×768 四种常见桌面分辨率均单屏容纳全部剧本信息。
- **四区网格**：`.tabletop-layout` 改为 `grid-template-areas:"table dock" / "mat rail"`——左列上为公共桌面（探险区+探查区+对手条）、下为玩家区（英雄区+手牌）；右列上为操作面板、下为牌堆/日志栏。`.tabletop-main` 用 `display:contents` 拆壳，DOM 结构完全未动，纯 CSS 重排。
- **高度预算制**：弃用 `fr` 比例猜测，改按内容需求分配行高（`minmax(0,1fr) minmax(232px,auto)`，矮屏 `minmax(0,1fr) 268px`），避免 1366×768 下英雄区被压成 0。
- **卡面显式高度**：flex 容器会压缩 `aspect-ratio`，手牌与公共牌改用显式 `height` + `flex:0 0 Npx`，卡图不再被裁成条状；同排遭遇卡 `align-items:stretch` 等高。
- **对手区压缩**：其他玩家区改为 62px 小卡横排，隐藏卡名标题，把高度让给探查区（`min-height:126px`，不可塌陷）。
- **终局计分不折叠**：计分面板在右列内完整呈现——行高按 0.6 收缩、说明文字单行截断、按钮横排，总分与「开始新剧本」无需滚动即可见；终局时隐藏阶段提示面板（`.operation-content:has(.score-panel)>.window-panel`），把高度让给结论。
- **窄屏兜底**：≤1279px 退回单列（`height:auto` 恢复滚动）；≤640px 用 `100dvw` 锁宽、玩家标签竖排、终局头部按钮可换行，390px 下无横向溢出。
- **手牌/对手卡对齐**：手牌尺寸收进 `--hc` 变量统一推导（重叠、行高、卡高、悬停位移），行盒不再裁掉卡底；对手小卡行留 10px 下内边距接住绝对定位的状态代币，矮屏再缩到 52px 卡面。
- 验收：451 项测试全绿；浏览器验收 check-taskbar 23、check-layout 16、check-score 19、check-deck-share 16、check-card-hover 22、check-setup-reveal 13 全部通过；check-onescreen 四分辨率五区（操作区/手牌/当前地点/牌堆栏/日志）均在视口内。

# v0.15.40 · 回合流程与阶段操作合并为统一面板（2026-10-23）

- **合并两个窗口**：右侧「回合流程」竖排列表移除，改为**横向阶段步骤条**嵌入左上操作面板（7 步 pill：编号+名称，当前金色高亮、已过淡显），阶段提示文字（`phaseHint()`）随步骤条显示在面板内——阶段浏览与阶段操作（推进/选择/确认）同处一个面板，不再来回切换。
- **信息完整性**：7 阶段完整可见（可换行）、当前步 `aria-current="step"`、无障碍标签保留；`check-taskbar` 的 `.phase-rail` 绑定沿用（该脚本仅做存在性检查）。
- **布局**：右侧栏仅剩遭遇牌堆/胜利区/日志/说明，操作面板 sticky 吸顶不变；移动端步骤条紧凑换行。451 项测试、check-taskbar 22 项、check-layout 15 项、browser-check 全绿。

# v0.15.39 · 手牌费用检测：资源不足自动灰化（2026-10-23）

- **费用校验接入视觉**：手牌渲染时复用规则引擎 `playSpec()` 的完整校验（阶段/独特性/目标/事件时机/支付方案），当**时机合法但「匹配领域的资源不足」**时，该手牌自动加 `unaffordable` 灰化类——卡图去饱和变暗、光标 not-allowed、打出按钮禁用；其他不可打出原因（时机/目标等）维持原样不变灰。
- **悬停放大与查看保留**：灰化卡通过 article 级 `data-hover-src` 探针触发 RingsDB 式悬停大图（绕过 disabled button 不派发 hover 的浏览器限制），「查看」详情按钮不受影响。
- **实时更新**：资源变化全部经 `mutate()→render()` 全局重绘，付完费/获得资源后手牌可选状态即时切换。颜色匹配沿用引擎支付规则：只可使用**匹配领域**的英雄资源支付，可跨多个资源池。
- 新增回归测试：资源充足可选 → 清零灰化+禁用+探针存在 → 恢复资源实时可选。

# v0.15.38 · 横置改旋转表现，移除「横置/重置」文案（2026-10-23）

- **横置视觉升级**：角色卡横置不再只靠变暗——卡图改为**旋转 90°**（居中缩放 0.7 裁切在卡框内，带 0.25s 过渡），与实体桌游把卡转过来横放的动作一致。
- **删除状态文字**：说明区移除「横置 / 重置」文案（视觉已可辨识，属冗余）；「已离场 / 囚禁 / 已投入」等**非横置类状态保留**（这些没有替代视觉表达）。
- 测试无绑定旧文案；450 项测试、浏览器验收全绿。

# v0.15.37 · 角色卡数值去重：代币取代文字行（2026-10-23）

- **删除重复文字**：角色卡说明区不再重复「意 X · 攻 X · 防 X」与「伤害 X/Y」——顶部属性代币（意志/攻击/防御）与底部状态代币（资源/伤害）已完整覆盖这些数值。
- **新增生命代币**：伤害 X/Y 的分母（生命上限）原先只在文字里，现顶部属性代币补第 4 枚「生命」（`hitPoints.png`，与诡镇网页版顶部四枚一致），属性代币尺寸缩至 24px 以内保证单行不换行。
- **无障碍补齐**：数值行删除后，整卡 `aria-label` 汇总全部数值（意志/攻击/防御/生命/资源/伤害），读屏不再丢信息；盟友有资源时保留一行文字「资源 X」（资源代币按 v0.15.36 约定仅英雄显示）。

# v0.15.36 · 字号再放大 + 资源代币仅英雄（2026-10-23）

- **字号再调大两号**：`body` 16→**18px**（行高 1.7），小号文本再整体 +1px（卡牌说明 11→12px 等），`h2` 19px、`h3` 16px、眉题 13px。布局保持不变（卡宽/网格/侧栏未动，check-layout 与横向溢出检查通过）。
- **区域标题行高固定**：字号放大后 `.zone-heading` 出现 0.1px 亚像素等高偏差，补 `line-height:1.3` 修复。
- **资源代币只属于英雄**：盟友卡下方不再显示资源代币（即使有效果为其累积资源），只保留伤害代币；资源数仍可在卡牌说明文字「资源 X」中读到。更新对应回归测试。

# v0.15.35 · 正文字体可读性：字号 +2、真 Medium 字重（2026-10-23）

- **正文字重**：补嵌霞鹜文楷 **Medium** 子集（`wenkai-medium-subset.woff2` 268KB），`@font-face` 中 Regular 定为 400、Medium 覆盖 500–700——正文改用真字重 Medium，不做浏览器合成加粗（避免发糊）。
- **具体字体属性变更**：`body` 由 `font:14px/1.6` 改为 `font:500 16px/1.65 var(--font-body)`（字号 14→16px，行高 1.6→1.65，字重 400→500）；小号文本整体 +1px（10→11、11→12、12→13、13→14px，含卡牌说明、徽章、日志、侧栏）；`h2` 17→18px、`h3` 14→15px；眉题 `.eyebrow` 11→12px 并加 500 字重。
- **布局保持**：卡牌宽度（122/100px）、网格列、侧栏宽度全部未动，文字增大只影响纵向换行；check-layout 15 项与横向溢出检查通过。
- 维护：`scripts/build-font-subsets.py` 新增 Medium 任务，语料变更后一键重生成全部子集。

# v0.15.34 · 中土字体栈：京華老宋体标题 + 霞鹜文楷正文 + Cinzel 眉题（2026-10-23）

- **字体方案**（均 OFL/免费商用）：标题与章节名用「Cinzel（西文碑刻风）+ 京華老宋体（61-1 老宋复刻）」，正文与界面用「霞鹜文楷」，中文回落 Microsoft YaHei、西文数字在标题内跟随 Cinzel。`h1/h2/h3`、`.eyebrow`、剧本封面统一走 `--font-title`，`body` 走 `--font-body`。
- **按语料子集化**：新增 `scripts/build-font-subsets.py`——扫描仓库 `*.js`+`shell.html` 的全部实际用字（1282 字）生成 WOFF2：`assets/fonts/kinghwa-subset.woff2`（865KB）、`wenkai-subset.woff2`（270KB），Cinzel 全量 125KB；合计约 1.2MB 且全部在 assets/ 随行，不增大离线 index.html。`font-display:swap`，字体加载失败自动回落系统字体，界面永不白屏。
- **维护方式**：UI 或卡牌数据新增生僻字后，把新 TTF 放回 `assets/fonts/_src/`（KingHwa.ttf / LXGWWenKai-Regular.ttf / Cinzel.ttf，不入库）重跑 `scripts/build-font-subsets.py` 即可；玩家自输文本（会话名等）超出语料时回落系统字体，属预期。
- 来源与协议：京華老宋体 v3.0（SIL OFL）、霞鹜文楷 v1.520（OFL）、Cinzel（Google Fonts OFL）。

# v0.15.33 · 代币布局对齐诡镇网页版：属性在卡上、状态在卡下（2026-10-23）

- **代币不再遮挡卡牌文字**：v0.15.32 的状态代币（资源/伤害/进度）原钉在说明区顶部、半压卡面与卡名。现按《诡镇奇谈》网页版布局改为独立流式行——**角色（英雄/盟友）的属性代币（意志/攻击/防御）一行在卡牌上方，状态代币（资源/伤害）一行在卡牌下方**；敌军伤害与地点进度代币同样移到卡牌下方。当前探险卡的进度代币维持左下角叠加不变。
- **属性代币**：每张英雄/盟友卡上方新增「意志/攻击/防御」三枚圆形代币（`assets/tokens/` 同源美术），数值取自规则引擎 `stats()` 快照，与卡牌说明文字「意 X · 攻 X · 防 X」一致；属性代币为静态展示，不可拖放。
- **属性加成审计（临时/永久）**：确认显示值统一走 `stats()`，两类加成均正确计入并能还原——① **永久**：附属装备加成（01027 意志+2、01040 生命+4、01041 攻击+2/+1 矮人、01055 意志+1、01056 威胁−1、01071 意志−1）随 `attached()` 实时计入，附属离场（弃置/持有者淘汰）即自动还原；② **临时**：事件与能力产生的阶段内加成（如伊欧玟 +1 意志、偷袭/快速打击、比翁 +5 攻击）走 `phaseModifiers`，仅在本回合本阶段生效，阶段完成或新回合即清理还原。新增 3 项回归测试：属性代币取值与 `stats()` 一致、附属加成计入且离场还原、临时加成计入且过期还原。
- 无障碍与交互不变：代币行 `aria-hidden`，数值仍由卡牌说明文字完整提供；拖放表现保留（状态代币可拖、属性代币不可拖）。

# v0.15.32 · 诡镇网页版式桌面代币（2026-10-23）

- **代币上卡**：对局桌面的卡牌现在按《诡镇奇谈》网页版（DragnCards）的方式摆放代币——圆形代币图钉在卡面下缘、半压卡面，数字居中白字描边。英雄常显「资源＋伤害」两枚，盟友显「伤害」（有资源时加显资源），敌人显「伤害」，地点显「进度」，当前探险卡左下角叠「进度」代币；0 值也显示，对齐原版观感。素材取自 DragnCards 公开 S3（与诡镇网页版同源美术），已本地化到 `assets/tokens/`。
- **层叠表现**：同型数量 >1 时代币以白环错位阴影呈现层叠厚度（最多视觉 3 层），数字仍显示真实总数。尺寸随卡宽响应式缩放（24–34px，约为卡宽 25%，与原版比例一致）。
- **拖放表现**：代币可拖起（grab 光标）并放到任意卡面上，落点提示「代币数量由规则引擎自动结算」——本作交互红线是点选仅草稿、规则结算代币，因此拖放只还原手感与视觉，不改动任何状态。
- 无障碍：代币行为 `aria-hidden`，数量信息仍由卡牌说明文字（资源 X · 伤害 Y/Z）完整提供，不产生重复读屏。
- 测试：planning-dom-tests 新增 3 项（英雄代币数量与文本、敌军伤害代币、地点进度与探险卡进度代币）。

# v0.15.31 · 组卡器回填入口与牌组分享链接（2026-10-22）

- **回填原牌组**：在组卡器里改动过草稿后，标题栏出现「← 回填原牌组「名字」」——一键放弃未保存改动、回到刚才那副牌，不必再绕「返回列表 → 找到它 → 再点编辑」。草稿与源牌组内容一致时按钮自动消失（比较 `P.exportDeck` 的规范化结果，改名也算改动）。新建牌组没有源牌组，不显示该按钮。
- **分享链接**：组卡器新增「复制分享链接」。牌组压成紧凑载荷 `{n,m,h,s}` → UTF-8 → base64url，接在 URL hash `#deck=…` 上（基础版 30 张预组约 320 字符，可直接贴进聊天框）。打开这类链接会自动进组卡器并载入那副牌，读完即清 hash，刷新不会重复覆盖当前编辑；链接损坏只提示原因，不阻断启动。
  - 编码只用 `[A-Za-z0-9_-]`：`+` `/` `=` 会被聊天软件和 URL 解析吃掉或转义，这是选 base64url 而非普通 base64 的唯一理由。
  - `file://` 打开时没有可分享的地址，按钮会说明原因；剪贴板 API 不可用时退回「选中即复制」弹窗。
- **卡组页新增「分享链接」页签**：粘贴分享链接或裸分享码即可打开，与 FILE／LINK 并列。分享码只含卡牌代码与张数，不含账号信息。
- 修：`clearHashDeck` 原本写 `history.replaceState(...)`——顶层 `history` 在真实浏览器里是 Chrome 的全局访问计数对象（`window.history` 的属性），直接调用会抛 `TypeError`，导致分享链接整条启动链路中断。改为显式 `window.history.*` 并加能力守卫。
- 顺带修：`if(action==='share')` 那行多写了一个 `}`，把 `handle()` 的 try 块提前闭合，整文件语法错误（`node --check` 才发现）。
- 新增 `deck-share-tests.cjs`（7 项）：四系预组往返无损、字符集合法、张数与模式保留、卡池外代码上报为 unknown、坏载荷抛错、超量张数夹到 deckLimit、中文牌名不破坏 URL。
- `planning-dom-tests` 新增 2 项（回填按钮的出现与消失、分享按钮与分享页签存在），共 51 项。
- 新增 `scripts/check-deck-share.cjs`（16 项真实浏览器验收，起本地 http 服务而非 `file://`，因为剪贴板与分享地址都依赖 http 上下文）：复制出 `#deck=` 链接、新窗口打开进组卡器且牌名一致、hash 读完即清、卡组页粘贴可打开、坏链接不崩且有提示、全程零脚本错误。
- 回归：444 项测试通过；check-deck-share 16/16、check-catalog 54/54、check-decks OK、check-card-hover 22/22、check-layout 15/15。

# v0.15.30 · 遭遇卡与探险卡补齐 pack 字段（2026-10-22）

- 落实 v0.15.28 记录的**数据结构缺口**：`data.js` 里 45 张遭遇卡与 10 张探险卡全部补上 `pack` 字段（规范同 RingsDB `packCode`，基础版一律 `"Core"`），来源与各遭遇组的 `sources`（Core Set）一致。此前 UI 只能靠 `c.pack||'Core'` 兜底——一旦并入非基础版的遭遇卡，它们会被整体错算进基础包，按系列包筛选随即失真。
- 卡牌库代码无需改动（读取点早已预留），补数据后系列包下拉、三类分组与计数自动跟随；`app.js` 的注释同步更新为「`Core` 兜底仅对历史缺字段数据生效，新增数据必须写 pack」。
- 新增 `pack-data-tests.cjs`（4 项）：55 张战役卡全部声明 pack、packCode 形态合法、pack 与遭遇组来源一致、pack 可作为筛选键（无连续空格）。
- `check-catalog.cjs` 新增 2 项真实浏览器检查：「战役卡的 pack 字段全部有值且为基础包」「系列包下拉只列出真实存在的包」，共 54 项全 PASS。
- 回归：435 项测试通过；check-catalog 54/54、check-catalog-tabs OK、check-legacy-packs OK、check-card-hover 22/22、check-layout 15/15。

# v0.15.29 · 对局桌面重塑：状态条、进度条、叠影牌堆、BGA 式重叠手牌（2026-10-22）

- 参照诡镇奇谈网页版与 BGA 的对局布局补齐缺口，延续森林绿＋羊皮纸＋金线体系。所有 data-action 与既有类名（`.operation-dock`／`.public-table`／`.player-mat`／`.tabletop-rail`）保持不变，交互与规则验证零改动。
- **玩家状态条**：顶部玩家页签升级为 BGA 式状态胶囊——名字 + 威胁／资源／伤害三项汇总（资源与伤害为该玩家英雄实时合计）+「起始／淘汰」徽章；点按仍为切换查看玩家。
- **探险进度条**：当前探险卡下新增金色进度条（`role="progressbar"`，宽度按 progress/points 实时过渡）；特殊胜利条件剧本不显示。
- **牌堆可视化**：右侧「遭遇牌堆」从纯数字升级为三枚叠影卡背（牌库／弃牌／胜利点，空堆置灰）；玩家区标题的牌库／弃牌数字改为胶囊芯片。
- **BGA 式重叠手牌**：手牌区从平铺改为负边距重叠（每张露出约 74px），悬停/聚焦上浮 18px 展开完整卡面与合法性说明；16 张长手牌天然不横向溢出；≤760px 恢复平铺保触屏可点性；`prefers-reduced-motion` 关闭上浮动效。
- **氛围**：公共桌面加呢绒暗角与区域标题金线，克制不加噪。
- 顺带修：`browser-check` 的整轮流程对「强制效果目标」「防御响应」等窗口选项没有兜底，随机分支碰到即 stall（种子为 Date.now，此前属间歇性既有问题）——补两条兜底点击（窗口选项按钮，排除回退/详细模式/重置），三连跑 ok=true；`check-layout` 的「卡牌间距统一」排除手牌重叠行，并新增「手牌重叠间距统一」检查，共 15 项。
- 回归：432 项测试通过；浏览器验收 check-layout 15/15、check-taskbar 22/22、check-contrast 6 阶段 0 低对比、check-score 19/19、check-card-hover 22/22、check-history OK、browser-check 3 连 ok=true。

# v0.15.28 · 「基础卡牌库」更名「卡牌」，新增按系列包（pod）筛选（2026-10-22）

- 顶栏页签与侧栏默认项「基础卡牌库」更名为「卡牌」（`卡牌 128`）；系列占位面板的返回按钮同步改为「← 返回卡牌」，帮助页注明「卡牌（基础卡牌库）」。
- 卡牌库控件行新增**系列包下拉**：选项按卡牌印载扩展动态生成（带数量），默认「全部系列包」。选中某个系列包后列表只显示该包的卡，并明确按**玩家卡／遭遇卡／探险卡**三个类别分组——组名前缀从「玩家 · ／战役 · 」改为更直白的「玩家卡 · ／遭遇卡 · 」，探险卡独立成组；结果计数行给出三类拆分（如「基础包 · Core Set · 玩家卡 73 / 遭遇卡 45 / 探险卡 10，共 128 种」）。系列包筛选可与关键词搜索、三档分类叠加。
- pod 归属的落地：每条卡牌条目带 `pod` 字段。玩家卡直接取 RingsDB 快照的 `packCode`（73 张全部为 `Core`）；战役卡（`D.cards`／`D.quests`）目前没有印载扩展字段，统一回退 `Core`，数据补上 `pack` 字段后自动跟随，无需改代码。
- **数据结构支持度说明**（按用户要求）：玩家卡完全支持（`packCode`/`packName`/`position` 齐全）；遭遇卡与探险卡**不支持**——只有遭遇组（`set`）与剧本关联，无印载扩展标识。补充方案：给 `D.cards` 与 `D.quests` 各加一个 `pack` 字段（规范同 RingsDB packCode，基础版 55 张全部填 `Core`），来源可直接取 RingsDB encounter 数据或按「遭遇组→印载扩展」映射表生成；长期可让 import 脚本生成带 packCode 的遭遇卡快照，与玩家卡管线对称。
- 回归：`planning-dom-tests` 新增 pod 用例（Core 筛选含全部 128 张、三类分组齐全、计数三类拆分）并把分组断言更新为新前缀，共 49 项；`check-catalog.cjs` 新增系列包下拉、三类分组、三类计数、与搜索叠加、清空恢复 5 项检查（含计数取数改为行数），共 52 项全 PASS；432 项规则／模拟 DOM 测试通过。

# v0.15.27 · 卡牌库加侧边系列导航，基础卡牌库为默认项（2026-10-22）

- 参照诡镇奇谈网页版的侧边栏，卡牌库改为「侧边系列导航 + 主内容区」双栏布局。侧栏分两组：**基础**（基础卡牌库，默认激活，标注 128 种）与**扩展包 · 预留**（新版扩展 6 个系列直接列出，旧版扩展 15 个大盒折叠在 `<details>` 里）。
- 扩展条目不是写死的占位：从 `PRODUCT_TABS.revised` 与 `legacySeries()` 动态生成，每条带产品封面小图（懒加载，webp 缺失自动回退 jpg）。点击进入该系列的详情面板——封面、中英文名与「卡牌尚未收录，将随版本更新加入」的说明；以后某系列收录卡牌时，把 `catalogSeriesPanel()` 的占位换成按系列筛选的结果即可，导航结构无需再动。
- 样式沿用现有体系：金色小节标题、绿色激活条、封面缩略图标；`aria-current="page"` 标注激活项，`<nav aria-label>` 标注导航区。侧栏桌面端 sticky 跟随且内部可滚动。
- 移动端（≤960px）适配：双栏塌成单列，侧栏取消 sticky，条目变为可换行的自适应 chip；实测 480 宽无横向溢出，搜索与列表正常。
- 顺带加固：`filterCatalog()` 与 render 的搜索绑定补了空值守卫（系列详情面板没有 `#search`／`#resultCount` 时安全跳过）。
- 回归：`planning-dom-tests` 新增侧栏用例（双栏布局、默认激活、条目数来自产品目录 ≥6+15、点扩展出占位、返回恢复列表、系列详情下 filterCatalog 不报错）；`check-catalog.cjs` 新增 7 项浏览器检查（侧栏渲染、默认激活、折叠收起、占位面板、激活同步、返回恢复）与 4 项移动端检查（480 宽无溢出、取消 sticky、chip 排布、搜索可用），共 41 项全 PASS；430+2 项规则／模拟 DOM 测试通过。


# v0.15.26 · 悬停预览改为 RingsDB 式小图，不再近全屏放大（2026-10-22）

- v0.15.25 的悬停预览按卡牌版心 424×600（横版 600×424）还原再缩放，实测 1440×900 视口下弹出 560×792，占视口高度 88%，几乎盖住半页内容，与密集列表（行高仅 38px）也不协调。
- 参照 RingsDB 的悬停预览逻辑改为「能看清字就够」的小图：竖版基准 300 宽（约 425 高）、横版探险卡 400 宽（约 283 高），只缩不放，上限再受视口约束（宽 ≤26% 视口且 ≤380px、高 ≤58% 视口）。1440×900 下实测 300×425，占视口高度 47%。
- 定位改为「从这一行长出来」：横向仍优先贴触发元素右侧、右不够放左侧并避开侧栏；纵向从「与卡片顶部对齐」改为与触发元素垂直居中后夹进视口。缩放动画原点同步改为触发元素对应的角，弹出感更像卡片长出来。
- 动画更利落：去掉 `left`/`top` 位移过渡（否则切行时图片带着滞后滑动），缩放淡入收短到 130ms；阴影半径与圆角随小图相应减小。
- 回归：`check-catalog.cjs` 悬停断言改为「竖版 260–340 宽、不超过视口六成高」，实测 22 项（含新增比例检查）与 `check-card-hover` 22/22、`check-decks` 22/22 全过；430 项规则／模拟 DOM 测试通过。


# v0.15.25 · 合并「英雄与玩家牌」到卡牌库，卡名悬停直接看图（2026-10-22）

- 顶栏去掉「英雄与玩家牌」页签。玩家卡本来就已经并进卡牌库（v0.15.24），这一页只剩一套重复的卡片网格；牌组构筑能力不删，整体搬到「我的卡组 → 新建牌组 / 编辑」。
- 牌组构建器改用卡牌库的密集列表：按球色分组、一行一张卡名，右侧是 `− 张数 +`，选英雄改为行内按钮；点行才展开卡图与全文，每行左侧金线标记「已在牌组中」。
- 新增「悬停卡名直接显示卡图」：卡牌库与构建器的行本来为了不预载上百张图而没有 `<img>`，现在由 `data-hover-src` 标注图片地址，悬停 130ms 后按需取一张大图，竖版 424×600、横版探险卡 600×424 还原，并自动避开侧栏、夹在视口内；移开／Esc／滚动／打开对话框都会收起，触屏与 `prefers-reduced-motion` 依旧降级。已展开的行不再重复弹图（正文里本来就有卡图）。
- 顺带修：旧存档里的 `tab='players'` 历史状态现在重定向到「我的卡组」；构建器保留「从 RingsDB 更新资料」与快照日期；「我的卡组」页补齐新建入口与文案。
- 回归：`planning-dom-tests` 新增构建器用例（73 行、球色分组、加减牌与选英雄回显、返回列表）并给卡牌库补悬停卡图断言；`check-catalog.cjs` 加 5 项悬停检查；新增 `scripts/check-decks.cjs`（19 项：导航、构建器、悬停、搜索、加减牌、详情注入、拒绝不合法保存、返回）。

# v0.15.24 · 卡牌库合并玩家卡与战役卡，按「玩家／战役／两者都」组织（2026-10-22）

- 原「基础卡牌库」只有战役卡（45 种遭遇 + 10 张探险）。参照诡镇奇谈网页版的卡牌库展示逻辑改为统一卡牌库：玩家卡（RingsDB 基础版 73 种：12 英雄／20 盟友／13 附属／28 事件）与战役卡同页，顶部分三档切换——**玩家**、**战役**、**两者都**（默认）。合计 128 种。
- 列表逻辑照搬「数量大时只列名称」：默认是一行一张的密集索引，分组标题带计数，右侧小字给类型与费用／遭遇组；点开某一行才注入卡图与全文，因此首屏不会一次性加载上百张图（实测收起状态详情图 0 张）。另留「卡图」视图，需要通览封面时一键切换。
- 分组：玩家档按球色（领导／战术／精神／学识／中立），战役档按类型（敌人／地点／诡计／目标／探险卡）；「两者都」时组名前加「玩家 · 」「战役 · 」区分。
- 详情：玩家卡给卡图、球色、费用、初始威胁、四维、特性、卡包、编号与 RingsDB 英文原文（已注明未翻译）；遭遇卡给交战／威胁与攻防血、遭遇组、数量、暗影；探险卡给 A/B 两面。
- 顺带修：`#catalogTab` 上的数量改为按 `catalogStats().total` 回填（上一版只算战役卡）；「说明与完成范围」页补上卡牌库入口说明。
- 回归：`planning-dom-tests` 的卡牌库用例重写，覆盖三档计数、分组标题、跨类搜索、卡图视图本地中文图、三种详情注入与空状态；`scripts/check-catalog.cjs` 扩到 29 项（含收起不加载图、键盘可达、无横向溢出、重复进出不报错）。

# v0.15.23 · 修复「基础卡牌库」页签点了没反应（2026-10-22）

- 顶栏「基础卡牌库」页签点击后页面毫无变化。根因：`catalog()` 与 `filterCatalog()` 两个函数在 v0.9 就存在，`5647e83` 那次「诡镇式开局流程」重构把函数体删掉了，但保留了页签按钮和 `render()` 里 `tab==='catalog'?catalog():…` 的调用——一点就抛 `catalog is not defined`，`innerHTML` 赋值前中断，所以连报错都看不到。
- 恢复卡牌库页：遭遇卡检索（中文／英文名称、规则、暗影文本）+ 探险卡 A/B 两面。原实现的筛选有两处会漏，一并修掉：探险卡按 `scenarios[0].sets[0]===组` 判定只能命中剧本主组，现改为「该阶段的剧本 sets 包含所选组」；结果数与顶部说明改为按 `D.cards`／`D.quests` 实时统计（原先硬编码「45种／84张」，卡池一变文案就骗人）。
- 回归：`planning-dom-tests.cjs` 新增用例，切到 `catalog` 页签后断言页面渲染出标题与搜索／筛选控件、结果数为 45 种遭遇卡 + 10 张探险卡 = 55，并验证关键词、类型、遭遇组三种筛选都能收窄结果、无结果时给出空状态。

# v0.15.22 · 悬停放大只作用于卡牌，剧本封面不再放大（2026-10-22）

- v0.15.18 的悬停放大把开局页的剧本封面（`.ng-card-art`）也纳入了触发范围，与「看牌面细节」的用途不符：封面是入口缩略图，悬停弹出大图反而挡住相邻封面、干扰挑选。现从触发选择器移除 `.ng-card-art`，`isFace`／`pointerover`／`pointerout`／滚动重定位四处同步收紧，只保留 `.card-face`（桌面卡牌、手牌、英雄／盟友／附属／交战区）与 `.card-art`（当前探险卡、卡图库缩略图）。
- 回归：`tests.cjs` 新增一条源码级断言（剥掉注释后不得出现 `.ng-card-art`，且 `.card-face`／`.card-art` 仍在），真实浏览器 `check-card-hover` 把原「封面弹出」用例改为「封面悬停不放大」，并把「悬停 60ms 内不弹出」的防闪烁用例移到手牌段验证。

# v0.15.21 · 界面版本徽标改为单一来源（2026-10-22）

- 桌面左上角徽标原为硬编码 `MIDDLE-EARTH EXPEDITION · v0.14.0`，从 v0.15.0 之后一直没跟着版本走，用户看到的版本比实际落后 6 个版本。现抽成 `desktop-ui.js` 顶部的 `APP_VERSION` 单一常量，模板改为插值。
- 新增回归用例（`planning-dom-tests.cjs`）：断言 `APP_VERSION` 形如 `vX.Y.Z`、与 `CHANGELOG.md` 最新条目标题一致、且桌面实际渲染出的徽标包含该值——避免以后再出现「界面版本 ≠ 发布版本」。

# v0.15.20 · 开局取消窗口迁移 + 完整结算计分（2026-10-21）

## 开局翻牌改为逐张推进（ROADMAP「开局取消窗口迁移」收尾）

- 安都因「每位玩家各翻开1张遭遇卡」与多尔哥多「为每张目标各翻开1张」原先在 `applyScenarioSetup` 里一次性 `reveal()` 立即结算，导致意志考验（#01050）与埃莉诺（#01008）的取消窗口根本无从出现。现改为状态机：`beginSetupFlow` 建流程 → `setupRevealStep` 逐张翻开（翻开即暂停）→ `settleSetupCard` 结算关键词并落场 → `finishSetupFlow` 收尾（安都因放入山丘巨魔、多尔哥多选定囚犯）。
- 每张牌翻开后都会在 `setupReveal.current` 等待：可用**意志考验**（支付1资源取消其翻开效果）或**埃莉诺**（横置、弃掉该牌并补翻）。取消只抹掉「翻开」效果，厄运／涌现等关键词照常结算——与第三阶段探查规则一致。同一张牌不能二次取消，敌人／地点／目标不提供取消按钮。
- 多尔哥多的守卫指派改到结算时绑定（`o.guard = c.uid; c.guard = o.uid`），囚犯选定延后到全部翻牌完成；新增囚犯英雄索引越界断言。`finishSetupFlow` 加三重幂等守卫（`finished` / `remaining>0` / `current`），`startScenario` 加 `!s.setupReveal` 防重入。

## 完整结算计分面板

- 新增 `score-engine.js`（纯函数、不改 state）：按原版计分公式 **威胁合计 + 回合数×10 + 淘汰人数×100 + 英雄伤害 − 胜利区点数** 计算，输出分项明细、评级、每名玩家归一化分数。胜利区同名牌自动合并张数并降序；负伤害、缺失威胁按 0 计。
- 桌面在 `status==='won'` 或 `'lost'` 时于操作区顶部渲染 `.score-panel`：五行分项（含每项的计算依据文本）、总分与评级、归一化分数、模式信息、导出／重开按钮。失败局改为「过程计分」并注明不计入战绩。
- 终局时操作栏不再显示「收集资源→计划阶段」这类误导文案，改为「剧本已结束 · 见上方结算」。计分面板存在时解除 `.operation-content` 的 30vh 高度上限——终局结论不应折叠进滚动区。

## 修复：待结算面板引用未定义函数（P0）

- `desktop-ui.js` 的 `tableHTML` 一直调用 `pending()`，但该函数**从未定义**。任何时刻只要 `s.pending.length > 0`，整个桌面渲染就抛 `ReferenceError: pending is not defined`，`mutate` 捕获后回滚状态——表现为「点确认结算没反应」「开局翻牌卡在最后一张」「囚禁任务一闪而过」。现补全 `pending-panel`：事项文本 + 蜘蛛选择下拉 + 确认按钮，并按事项类型给出处理提示。
- 顺带把开局面板补上牌类型标签（敌人／地点／诡计／目标），玩家能一眼判断为何没有取消按钮。

## 验证

- 新增 `score-tests.cjs` 10 项、`check-score.cjs` 真实浏览器 19 项；`setup-reveal-tests.cjs` 9 项；`check-setup-reveal.cjs` 13 项并支持 `--seed` 固定牌序（12／33／77／101／2024／777 六个种子全过）。`planning-dom-tests.cjs` 增 3 项回归（待结算面板、计分面板渲染／隐藏）。
- 全量：**426 项规则与模拟DOM测试通过**；8 个浏览器验收脚本全过（悬停 26/26、布局 14/14、任务栏 22/22、对比度两档 0 问题、目录页签／旧版扩展／历史 OK）。

# v0.15.19 · 开局页可读性与验收脚本跨平台（2026-10-21）

- **开局页卡片文字可读性**：不可玩封面右下角的「尚未实现」原为 `#9a9f92`、11px，对比度 **2.66:1**，低于 WCAG AA 的 4.5:1。改为 `#5c6656`、12px 后 **5.91:1**；英文副标题从 9px/`opacity:.85` 改为 11px 实色 `#5b6555`（**6.0:1**）；中文标题 12px→13px 加深到 `#1f2f25`（**13.83:1**）；页签 13px、章节计数 12px、可玩徽标 11px。卡片宽度与方形栅格不变，实测 1920/1440 均无横向溢出、布局 14/14、任务栏 22/22 仍过。
- **对比度验收覆盖开局页**：`scripts/check-contrast.cjs` 的审计选择器加入 `.ng-card-body h3`、`.ng-card-en`、`.ng-card-go`、`.ng-chapter-head span` 与页签按钮——此前只审计按钮与对局桌面，开局页从未纳入。现 1440/1920 两档 6 个阶段均 0 问题。
- **验收脚本跨平台**：`check-layout`、`check-taskbar`、`check-contrast`、`check-history`、`check-catalog-tabs`、`check-legacy-packs`、`verify-local-art`、`browser-check` 原先硬编码 `C:/Program Files (x86)/Google/Chrome/...`，在 macOS／Linux 下一律直接抛「未找到浏览器」。统一改为按 `CHROME_PATH` → Linux Chromium → macOS Chrome → Windows Chrome/Edge 顺序探测，并补 `--no-sandbox`（容器内必需）。
- 回归：悬停预览 26/26、布局 14/14、任务栏 22/22、对比度两档 0 问题、历史／目录页签／旧版扩展全部 OK；404 项规则／模拟DOM测试通过。

# v0.15.18 · 卡牌悬停放大预览（2026-10-21）

- 参照《诡镇奇谈》网页版：鼠标停在卡图上即在旁边浮出大图，移开自动收起。覆盖对局桌面（英雄／盟友／附属／手牌／探查区／交战区／当前地点／剧本目标）、当前探险卡、开局页剧本封面、卡图库与英雄页缩略图——凡是 `.card-face`、`.ng-card-art`、`.card-art` 里的图都生效，新增卡牌无需额外接事件。
- 实现：新增 `card-hover-preview.js`，单一 `pointerover` 委托 + 一个 `position:fixed` 图层，`pointer-events:none`，**不移动原卡布局、不写入游戏状态**。悬停停留 130ms 才弹出（快速横扫不会闪烁），移开延迟 90ms 收起；`pointerdown`、滚动重定位、窗口缩放、`Esc`、打开任意 `dialog` 时立即收起，暂停对局弹窗时不会挡住关键界面。
- 尺寸与选边：竖版按 424×600 版心、横版（探险卡 600×424）按容器形状还原，最长边不超过视口 90%、最宽 560px，中文卡图 750px 源图放大后仍清晰。位置先试卡片右侧、再试左侧，被阶段／日志侧栏挡住时改用左/右剩余空隙，两侧都不够才居中覆盖，且始终夹在视口内——1920／1440／1280 实测均不越界、不压侧栏。
- 触屏与 `prefers-reduced-motion` 自动降级：`hover:none` 下图层 `display:none`，减少动效时取消缩放过渡。
- 验收：新增 `scripts/check-card-hover.cjs` 真实浏览器 26 项（两档分辨率 × 延迟、竖版/横版尺寸、越界、侧栏遮挡、移开恢复、点击穿透、Esc），26/26 通过；402→404 项规则／模拟DOM测试全过。

# v0.15.17 · 剧本封面改成方形（2026-10-21）

- 新游戏页所有封面框从 3:4 改为 **1:1**（`.ng-card-art{aspect-ratio:1/1}`），列表页与「选择冒险」网格同步，卡片宽度不变（1440 下约 158px，封面 156×156）。
- 尺寸选择：**长边 640**。实测卡片封面只有 156–190px 宽，640 足以覆盖 3 倍屏；比照搬诡镇的 792 小一圈，整目录 180 张 WebP 合计 2.6MB（原 3:4、长边 520 时是 2.3MB）。图片一律**不放大**——官方盒图只有 142–235px，强行拉到 640 只会更糊。
- 关键取舍：源图是竖版盒图，直接方形裁剪会把盒子裁掉边角（魔戒同盟／双塔奇兵／王者归来那三张立体盒渲染尤其明显）。最终方案是**图片保持原始比例 + `object-fit:contain` 完整显示，四周用同图放大 18px 模糊填充**（`.ng-card-art.has-art::before` + `--ng-art` 变量），既保住方形栅格，又不切坏封面。
- 配套：`convert()` 与 `extract-pdf-covers.py` 都改回「只等比缩放、不裁剪」，新增 `--rebuild-images` 参数用于整批重转；有封面时隐藏文字占位层（`.has-art .ng-art-fallback{display:none}`），否则斜纹底会在 contain 留白处透出来。
- 验证：目视检查 4 个页签与剧本网格，盒子完整、无明显裁切；六套浏览器验收全过，402 项测试通过。

# v0.15.16 · 顶栏按参考图重排：去掉品牌字，首发项改为「首页」（2026-10-21）

- 参照诡镇奇谈／DragnCards 的导航条：删掉「中土远征 THE LORD OF THE RINGS · LCG」那段品牌字，顶栏第一个菜单项直接是**「首页」**，点击回到剧本页面（有对局看桌面，无对局看剧本列表）。
- 原先的戒指图标移进「首页」按钮内部（19px，桌面视图 17px），既保留视觉锚点又不占一个独立区块；hover／选中时有金色辉光。
- 顺序改为 `首页 · 基础卡牌库 · 我的卡组 · 英雄与玩家牌 · 全部卡图 · 说明与完成范围 · ← → · 撤销/导出/导入`，全部左侧起排。
- 清掉不再使用的 `.brand` 系列样式与 `#brandHome` 绑定；`#tableTab` 点击改为 `goHome()`（同时清空新游戏与选牌状态），选牌页的提示文案也跟着改成「回到首页」。
- 验证：1920/1440 下各块 x 坐标一致；768 下菜单一行、前进后退+存档一行；`check-history` 改为点 `#tableTab`，20 项全过；布局 14/14、任务栏 22/22、对比度 0 问题、402 项测试通过。

# v0.15.15 · 顶栏改为全部左对齐（2026-10-21）

- `nav` 不再 `flex:1` 撑开，整条顶栏按「品牌 → 前进后退 → 菜单 → 存档操作」从左往右紧排，1440 与 1920 下位置完全一致，右侧留出干净空白（接近诡镇奇谈网页版的紧凑工具条）。
- 菜单与存档操作之间加一条竖分隔线（`.header-actions{border-left}`），1240px 以下自动隐藏；去掉了窄屏强制 `width:100%` 的旧规则，换行时仍保持左对齐。
- 窄屏（768）下品牌与前进后退同一行、菜单一行、存档一行，顺序都是左起，不再把 ← → 甩到最右。
- 左上角戒指图标就是首页入口（`#brandHome`），补了 hover 金色辉光与键盘焦点描边，`title="回到首页"`。
- 验证：1440/1920/1024/768 四档量过坐标均为左起；布局 14/14、任务栏 22/22、对比度 0 问题、历史前进后退 OK、目录四页签 OK、402 项测试通过。

# v0.15.14 · 顶栏品牌图标换成同一枚戒指（2026-10-21）

- 左上角原来是装饰字符 `✥`，换成内联 SVG 至尊戒，与浏览器标签图标同一套视觉。顶栏版做了小尺寸优化：环更粗（stroke 7、r 21）、去掉在 28px 下糊成一团的滕格瓦刻纹、内圈用 `#0d1710` 62% 透明度叠在深绿底上，保留左上高光。
- `shell.html` 的品牌改成 `<svg>+<span>` 结构，CSS 用 inline-flex 对齐，桌面视图（`body:has(.desktop-table)`）自动缩到 23px，900px 以下 24px。
- 渐变 id 用 `brandGold`／`brandField`，避免与页面其它 SVG 的 `gold`／`field` 冲突。
- 验证：`#brandHome` 点击回首页仍正常；布局 14/14、任务栏 22/22、对比度 6 阶段 0 问题；402 项测试通过。

# v0.15.13 · 新增浏览器标签图标（至尊戒）（2026-10-21）

- 原本没有 favicon，浏览器标签页只显示默认空白图标。新增 `assets/favicon.svg`：深墨绿圆角底 + 金色至尊戒，环上以 `stroke-dasharray` 画出一圈滕格瓦式刻纹，环内是末日火山的暗橙余温，左上有一道高光。
- 同时导出位图兜底：`favicon-16.png`／`favicon-32.png`／`favicon-48.png`／`favicon-180.png`（apple-touch-icon）与多尺寸 `favicon.ico`（16/32/48），由 Chrome 渲染 SVG 后截图 + Pillow 合成。
- `shell.html` 的 head 按浏览器优先级挂好五条 link（SVG → PNG 32/16 → ICO → apple-touch-icon），并加 `theme-color #273f32` 与页面顶栏同色。`build.py` 只内联 style/script，这些 link 会原样进入 `index.html`。
- 验证：Chrome 实际请求了 4 个图标资源、5 条 link 全都能解码；16px 下金环与暖色内圈仍可辨认（对照图见 `docs/catalog-tabs/favicon-sizes.png`）。402 项测试通过。

# v0.15.12 · 难度改为官方三模式，简单模式真正生效（2026-10-21）

- **核对官方规则**：FFG《Easy Mode Rules》与《The Wilds of Rhovanion》规则书原文写着「three modes of play are available: Easy, Standard, and Nightmare」，即**简单 / 标准 / 噩梦**，**没有「困难」**。此前界面上的 easy/normal/hard 是错的。
- 界面改为「简单 / 标准」两档（噩梦需要对应剧本的噩梦牌组，本版未收录，在说明里指出），并删掉「难度只记录不生效」的旧注释。
- **简单模式按官方规则落地**（`engine.js`）：设置时每位英雄资源池 +1；构建遭遇牌库时按官方 Easy Mode 清单移除带 difficulty 金框的卡。核心包是早期印刷没有金框，因此用官方 PDF 的逐卡清单（`EASY_REMOVE`，14 种卡、三剧本共 9–15 张）。
- 实测（穿越幽暗密林 · 单人）：标准 34 张遭遇牌库、英雄 0 资源 → 简单 25 张（正好少 9 张）、英雄各 1 资源、`Caught in a Web` 等难度卡不再出现在牌库里。桌面标题显示「· 简单」。
- `state.difficulty` 写入存档；旧存档没有该字段时按标准模式处理。
- 验证：402 项测试通过（新增 1 项简单模式规则断言：资源各 +1、遭遇牌库少 9 张、难度卡被移除、`Necromancer's Reach` 从 3 张降到 1 张）；六套浏览器验收全过。

# v0.15.11 · 视图前进后退、品牌回首页、旧版扩展去掉核心包（2026-10-21）

- **浏览器前进／后退**：把 `tab` + 新游戏步骤（列表／设置）+ 选牌状态拼成视图签名，`render()` 末尾发现签名变化才 `pushState`，所以出牌、换手牌这些高频重绘不会污染历史。`popstate` 时还原 `tab`／`newGame`／`deckChooser` 并重绘，浏览器原生 ← → 直接可用。
- 顶栏新增一对 **← / →** 按钮（品牌右侧），深度用 `history.state.depth` 维护，到头自动禁用；品牌 `✥ 中土远征` 变成**回首页**按钮（`#brandHome`，`preventDefault` 避免 `#` 跳转），回到剧本桌面并清空新游戏与选牌状态。
- 假 DOM 测试环境没有 `window.history`，用 `HAS_VIEW_HISTORY` 兜底，全部新逻辑在无 history 时静默跳过。
- **旧版扩展去掉核心包**：`SKIP_NAMES` 加 `Core Set`（它就是现在的基础游戏）。导入脚本给每个 legacy 章节新增 `box`（大盒 id，首项被跳过时为 `null`）与 `key`，`legacySeries()` 改为按 `box` 找大盒 —— 于是「黑森林的魔影」这一章没有大盒，用章节名当系列名、封面取第一个剧本，仍承载 6 个冒险包（追捕咕噜 → 重返黑森林）；其余 14 个系列不变。
- 目录 165 → 164 条；旧版扩展开头从「核心包」变成「黑森林的魔影」，副标题只显示剧本数不再重复标题。
- 验证：401 项测试通过（改为断言 `data-id="Core-Set"` 不存在 + 首张是黑森林的魔影）；新增 `scripts/check-history.cjs` 真实浏览器验收 20 项（tab 切换、进设置页、浏览器后退/前进、顶栏 ← →、品牌回首页、旧版扩展无核心包且仍有 6 个剧本、无脚本错误）；布局 14/14、任务栏 22/22、对比度 6 阶段 0 问题。三个旧审计脚本的开局入口从「支线剧情 → 穿越幽暗密林」改为「新版扩展 → 基础剧本合集」。

# v0.15.10 · 补上加拉德瑞尔之镜封面，译名统一到银星计划体系（2026-10-21）

- 加拉德瑞尔之镜（The Mirror of Galadriel）不再用缺图占位：新增 `assets/products/pod-the-mirror-of-galadriel.webp`（390×520，裁成 3:4）。导入脚本补录条目时先看这张图在不在，在就直接引用，没有才回退占位。
- 译名整体切换到**银星计划**（魔戒 LCG 中文制作组、ringsdb 中文插件所用的重置版／文景版体系），共校正 65 条 + 14 个章节名：
  - Galadriel→加拉德瑞尔、Khazad-dûm→卡扎督姆、Osgiliath→欧斯吉力亚斯、Isengard→艾森加德；
  - The Lost Realm→失落的王国、A Shadow in the East→东方魔影、The Wilds of Rhovanion→罗瓦尼安的荒野、Heirs of Númenor→努门诺尔的后裔；
  - The Siege of Annúminas→安努米那斯防卫战、The Hunt for the Dreadnaught→追捕无畏号、The Scouring of the Shire→夏尔平乱、The Nine are Abroad→九戒灵出动、The Siege of Erebor→埃瑞博防卫战；
  - 传奇：Over Hill and Under Hill→雾山奇缘、On the Doorstep→孤山秘境、The Road Darkens→前路黑暗、The Land of Shadow→魔影之地、The Flame of the West→西方之炎、The Treason of Saruman→萨茹曼的背叛；
  - 循环名：黑森林的魔影／矮人故乡／对抗魔影／铸戒者／哈拉德人／魔多的复仇；社区循环：洛希尔人的誓言／酷夏之劫。
- 验证：401 项测试通过（同步更新断言里的旧译名）；两个浏览器验收脚本 1440／768 两档 OK，支线剧情 20 张封面全部解码、0 破损。

# v0.15.9 · 支线剧情按精选清单重分类，社区循环归入旧版扩展（2026-10-21）

- 新增 `pod-manifest.json`：把 `lotr-pod-workbuddy/pod-import.json` 的 19 项（官方 POD 14 + ALeP 自制 5）加上黑森林之黯（MEC102）固化为权威清单，导入脚本按它判定「什么算支线剧情」。
- 支线剧情页签只剩两组、共 20 项：**官方 POD 15**（黑森林之黯 + 14 项官方 POD，按 MEC/OP 编号排序）、**ALeP 自制独立作品 5**。原先的基础版三张卡（穿越幽暗密林／沿安都因河而下／逃离多尔哥多）已移除——它们属于基础剧本合集，不重复出现。
- 社区循环（命运主宰 5、洛汗誓言 7、陨落之夏 3、费艾诺的遗产 2）本质也是「大盒 + 冒险包」，从支线剧情移到**旧版扩展**，作为 4 个新系列参与「大扩展 → 选择剧本」流程；旧版扩展现有 15 个大扩展、73 个剧本，社区系列带「社区」角标。
- 预购特典（摩瑞亚矿坑／逃离卡兹杜姆的 `Preorder Promotion`）一律跳过，不再出现在任何页签。
- 凯兰崔尔之镜（ALeP，目录未采集）按清单补录，`art` 留空走统一缺图占位，不借用其它产品封面。
- 目录总数 172 → 165 条（新版 6／旧版 89／支线 20／噩梦 50），中文覆盖 165/165（新增「凯兰崔尔之镜」）。
- 验证：401 项测试通过（页签断言改为官方 POD／ALeP 两组、旧版大扩展 15 个、支线不再含基础三剧本）；`check-catalog-tabs` 与 `check-legacy-packs` 两档宽度均 OK，封面 0 破损；基础三剧本改在「新版扩展 → 基础剧本合集」下验证仍全部可玩。

# v0.15.8 · 完整剧本不再列出剧本，默认从第一个开始（2026-10-21）

- 「完整剧本」模式下隐藏「选择冒险」网格，直接用该扩展的第一个剧本开局（`packs[0]`）；小字说明会写出起点剧本名，例如「完整剧本从「红角门」开始，按顺序推进」。
- 「单场冒险模式」仍然显示网格并高亮当前选中的剧本。之前两种模式共用同一个网格、campaign 下还会给首张卡描边，容易让人以为需要逐个选择。
- 验证：401 项测试通过（legacy 断言拆成两段：campaign 下 `ng-pack` 数量为 0 且写明起点；切到 standalone 后出现 6 张卡）；`scripts/check-legacy-packs.cjs` 增加 campaign 模式截图与断言（0 张剧本卡、提示含起点名），1440/768 两档 OK。

# v0.15.7 · 旧版扩展改为「一个大扩展 → 其中的剧本」（2026-10-21）

- 旧版扩展页签不再把大盒与冒险包平铺成 11 章 78 条，改为两级：列表只显示 **11 个大扩展**（核心包、卡兹杜姆、努门诺尔的继承者、艾辛格之声、失落王国、灰港、哈拉德之沙、罗瓦尼安荒野、东方阴影、霍比特人：越过山丘与洞穴、黑骑手），副标题写明「英文名 · 循环名 · N 个剧本」。
- 点开大扩展进入设置页，下方新增横跨整行的**「选择冒险」封面网格**，列出该扩展的 6 个剧本（传奇扩展为 1／5 个），对齐诡镇奇谈的布局；「完整剧本」模式下第一个剧本带绿框标记为起点。
- 剧本类型按钮简化为「完整剧本／单场冒险模式」，说明文案跟着切换（从哪个剧本开始 / 在下方挑选）。
- 可玩性判定改用 `playable`：只有基础版三个剧本可玩，其余剧本标「待实现」，且「下一步」按钮禁用并给出原因，不再允许进入一个空局。
- `PACK_SKIP` 过滤 `Preorder Promotion`（6 条）与 `Two-Player Limited Edition Starter`（1 条），它们不含新剧本，列表里不再出现。
- 清理：删掉被 `seriesById` 取代的 `CAMPAIGN` 常量与 `questArt()`（已无引用）。
- 验证：401 项测试通过（新增「legacy 列表 11 个可点条目、不再出现冒险包名」「点开卡兹杜姆有 6 张剧本卡且下一步禁用」「单场模式切换剧本」「返回不留状态」断言）；新增 `scripts/check-legacy-packs.cjs` 真实浏览器验收（1440/768 两档，列表／剧本网格／基础三剧本可玩性，封面 0 破损、0 外网请求、无横向溢出）。

# v0.15.6 · 新版扩展每个系列只留一条（2026-10-21）

- 新版扩展页签不再区分「英雄扩展」和「战役扩展」：剧本只在战役盒里，所以英雄盒条目直接跳过，每个循环只显示一条，标题就是扩展包名（安格玛觉醒／追梦者／埃瑞德米斯林）。该页签 9 条 → 6 条，全部 175 条 → 172 条。
- 卡片副标题改用去编号的英文名（`Angmar Awakened`、`The Fellowship of the Ring`），完整产品原名与 `MECxx` 编号保留在 `title` 悬停提示里，不再出现 `(MEC108)` 这种占两行的长串。
- 页签说明改为「旧循环的重制版本，剧本按系列收录。」
- `product-zh.json`：六条「· 英雄扩展 / · 战役扩展」译名合并为三条系列译名。
- 验证：401 项测试通过（新增「页面不再出现英雄扩展／战役扩展字样」「只存在战役盒 id」断言）；真实浏览器验收 OK（7 张卡片、6 张封面全解码、0 破损、0 外网请求）。

# v0.15.5 · 三个新版战役扩展改用战役书封面（2026-10-21）

- 新增 `scripts/extract-pdf-covers.py`：把战役书 PDF 的第一页渲染（200 dpi）→ 居中裁成 3:4 → 390×520 WebP q85，覆盖 `assets/products/<slug>.webp`。裁剪方向自适应（偏宽裁左右、偏高裁上下），不放大。
- 替换三个「战役扩展」封面：安格玛觉醒、追梦者、埃瑞德米斯林。此前是 Hall of Beorn 的 235×235 近方形盒图，在 3:4 封面框里被裁得只剩中间一块；现在完整保留系列主视觉与 `CAMPAIGN GUIDE` 标题。
- 「英雄扩展」三盒仍用官方盒图（PDF 是战役书，封面上写着 Campaign Guide，语义上不属于英雄扩展）。
- 文档：`docs/scenario-covers.md` 增加「用 PDF 首页做封面」一节，含映射表与「重跑导入不会还原」的注意事项。PDF 本身不入库，只提交裁好的 WebP。
- 验证：401 项测试通过；真实浏览器四页签验收 OK（175 张封面全解码、0 破损、0 外网请求、无横向溢出）。

# v0.15.4 · 产品目录改为四页签并校正中文译名（2026-10-21）

- 分类：新游戏页签由「剧本模式／支线剧情／噩梦包」改为 **新版扩展／旧版扩展／支线剧情／噩梦包**，按 Hall of Beorn 目录的 `category` 与 `group` 重新路由（`Revised Content` → 新版扩展，其余 Cycles/Sagas → 旧版扩展）。四个页签共 175 条：新版 9、旧版 78、支线 38、噩梦 50。
- 移除 5 条基础包条目：`Revised Core Set`、`Dwarves of Durin`、`Elves of Lórien`、`Defenders of Gondor`、`Riders of Rohan`（新版核心包即现在的基础游戏，页面已用「基础剧本合集」表示）。
- `The Dark of Mirkwood`（黑森林之黯）按新版 POD 归入支线剧情，独立成章「新版 POD（Revised）」。
- 章节名：修复社区章「社区 · 社区 · …」重复前缀；噩梦章补全中译（此前为 `噩梦 · Shadows of Mirkwood`），统一为「噩梦 · <循环名>」；`Stand Alone Scenarios` 改为「独立剧本合集」。支线剧情章号从 2 起编，避免与页面追加的「CHAPTER 1 · 基础版」撞号。
- 译名：按**魔戒中文维基译名表**校正 26 条，含 Carrock→卡尔岩、Rhosgobel→罗斯戈贝尔、Erech→埃瑞赫、Wainriders→战车民、Tharbad→沙巴德、Carn Dûm→卡恩督姆、Nurn→努尔恩、Osgiliath→欧斯吉利亚斯、Withered Heath→枯荒野、Old Forest→老林子、Mountain of Fire→末日火山等。
- 封面：`POD_READY` 的三个可玩剧本此前只有文字占位（深绿块），改为取各剧本第一张探险卡正面图。
- 每个页签补一句说明文案（`NG_NOTE`），替换原先写死的三分支判断。
- 验证：401 项测试通过（更新页签/条目断言）；新增 `scripts/check-catalog-tabs.cjs` 真实浏览器验收（1440/768 两档、四页签），175 张封面全部解码、0 破损、0 外网请求、无横向溢出；布局 14/14、对比度 6 阶段 0 问题、任务栏 22/22 通过。

# v0.15.3 · 产品与剧本中文适配（2026-10-21）

- 新增 `product-zh.json`：英文原名（去编号）→ 中文工作译名的映射表，覆盖 180/180 条产品；噩梦包按后缀自动生成「· 噩梦」，预购特典生成「（预购特典）」，含源站拼写错误的兼容项（`A Joureny to Rhosgobel`、`The Redhord Gate`、`The City of the Corsairs`）。
- 导入脚本 `scripts/import-product-catalog.py` 合并译名写入 `product-catalog.js` 的 `zh` 字段，并打印中文覆盖率；缺少译名时自动回退英文。
- 界面：卡片标题改为中文，英文原名降为 10px 副标题（两行截断），`title` 属性同时给出中英文；文字占位层也改用中文。标题与副标题统一高度，网格各卡对齐。
- 占位卡不再整体灰度（此前整页偏灰），改为保留原色 + 「尚未实现」标签，与已可玩卡片靠角标区分。
- 验证：401 项测试通过（补充中文标题断言）；对比度审计 6 阶段 0 问题。

# v0.15.2 · 接入官方产品目录，新游戏改为封面墙（2026-10-21）

- 数据：新增 `scripts/import-product-catalog.py`，把 Hall of Beorn 目录快照（官方 159 + 社区 21，共 180 项）导入为 `product-catalog.js`，封面转 WebP（长边 ≤520，共 2.3MB）存 `assets/products/`；脚本按 `status` 过滤失败项并打印统计。
- 页面：新游戏改为三个页签——剧本模式（官方循环/传奇/新版）、支线剧情（官方 POD + 社区作品）、噩梦包；章节按目录分组自动生成，脚本内的中文映射给出章名，`Revised Content` 合并为一章。
- 卡片：封面满幅 3:4（`object-fit:cover`），可玩条目带绿色「可玩」角标，社区条目带棕色「社区」角标；未实现条目灰度处理 + 「尚未实现」，点击只提示，不进入设置、不建局。
- 布局：封面网格改为 `auto-fill minmax(148px,1fr)`，1440 宽约 7 列，窄屏自动降列。
- 验证：滚动加载后三个页签共 181 张封面全部解码成功、0 破损；DOM 测试改为校验三页签、可玩条目唯一、锁定卡点击无副作用；总计 401 项通过。
- 文档：重写 `docs/scenario-covers.md`（导入命令、分组规则、如何加新条目、权益说明）。

# v0.15.1 · 新游戏改为章节封面网格 + 未来剧本占位（2026-10-21）

- 布局：剧本列表从「单张大卡 / 三列」改为按章节分组的封面网格（6 列，窄屏 4/3/2 列），章节头显示「CHAPTER N · 名称」与「X 项 · Y 可玩」，对齐诡镇网页版的观感。
- 占位：为后续扩展预置 9 个支线剧本与 2 个合集（暗影中的魔窟、卡兹杜姆），未实现的条目渲染为灰色封面 +「即将推出」，点击只提示、不进入设置页、不创建对局。
- 封面：统一改为读 `assets/scenarios/<id>.webp`，按 webp → jpg → png 自动回退；都没有时用内置文字占位（深绿底白字 / 灰色斜纹），不再把竖版探险卡扫描图塞进封面框。
- 已可玩的卡片右上角带「可玩」角标；封面就绪后自动覆盖占位层，无需改代码。
- 文档：新增 docs/scenario-covers.md（尺寸 1200×750、命名清单、如何追加占位条目）。
- 验证：新增 1 项 DOM 测试（占位卡数量、点击不建局、可玩卡仍可进入设置），总计 401 项通过；对比度审计 6 阶段 0 问题。

# v0.15.0 · 新游戏流程：剧本模式／支线剧情 + 设置页（2026-10-20）

- 「新游戏」首屏改为两栏标签：**剧本模式**把基础版三个剧本合并成一张「基础剧本合集」横向大卡；**支线剧情（Pod）**把三个剧本各自作为单场冒险列出（封面取各剧本第一张探险卡）。
- 进入合集后是设置页：**游戏名称**、**玩家人数**（1–4 分段按钮）、**剧本类型**（完整连续剧本，从穿越幽暗密林开始／单场冒险模式，三个剧本任选一）、**难度**（简单／普通／困难）、**高级设置 · 事件窗口触发时机**（智能：空窗口自动跳过／详细：每个窗口都停下）。
- 难度只记录并在桌面标题显示，界面上明确标注「规则仍按原版普通模式结算」，不做假实现；事件窗口设置会真正写入 `state.windowPrefs`。
- 开局信息落到 `state.session`（名称／模式／难度／剧本），桌面标题改为「游戏名（副标题：剧本 · 回合 · 人数 · 难度）」；重开时按位写入每位玩家的牌组，避免人数变化后默认牌组丢失。
- 修掉实现过程中的三处缺陷：替换 `setup()` 时误删 `table()` 与 `phaseHint()`（已恢复）；选牌确认把 `setupDraft.decks` 截断成当前人数长度，导致先开 2 人局再开 4 人局时后两位没有默认牌组；在设置页切换选项会重建 DOM 而丢失已输入的游戏名称（现在每次交互先把输入同步进状态）。
- 验证：新增 2 项 DOM 测试（首屏两栏与合集分组、设置项落到 session 与窗口模式），总计 400 项通过；真实 Chrome 四个界面截图；完整浏览器验收 report ok=true；布局 14/14、对比度 6 阶段 0、四条需求 22/22。

# v0.14.9 · 移除开局页重复的选牌区域（2026-10-20）

- 背景：v0.14.8 之后选牌集中在「选择你的牌组」页，开局页那份「为每位玩家选择牌组」面板成了重复入口，容易让人以为要填两次。
- 改法：删除该面板（含每位玩家的领域快捷按钮与牌组下拉），开局页只保留「玩家人数 / 洗牌种子 / 起始玩家」三项，并标注「牌组在点「开始远征」后由每位玩家选择」；`starterTest` 快捷选择动作与 `configs(n, ids)` 仍保留，作为默认值与测试入口。
- 连带清理：删除 `deckRow`/`setupHtml` 与对应的 `.deck-setup` 样式；`#pc-first` 移入开局行内，切换人数仍会重建选项并纠正越界值。
- 验证：更新/重写 2 项 DOM 测试（开局页不再出现该面板、每人预组选择仍按玩家写入并被选牌页继承），总计 398 项通过；真实 Chrome 3 人局实测：开局页无面板 → 选牌页默认带出 3 副预组 → 确认后正常建局；布局 14/14、对比度 6 阶段 0、四条需求 22/22。

# v0.14.8 · 「我的卡组」页与开局选牌（2026-10-20）

- 顶部导航新增「我的卡组」：LINK／FILE 两种导入入口（RingsDB 链接、本站牌组 JSON），按领域筛选、按名称搜索、按名称／张数排序；每副牌组显示三张英雄缩略图、来源徽标（预组／自定义／RingsDB #id）、张数与构筑状态，并提供「设为玩家1」「编辑」「导出」「删除」。
- 开局改为两步：点剧本的「开始远征」先进入「选择你的牌组」——「使用已有牌组」逐人选牌（多人时用玩家页签切换，选完自动跳到下一位），或「创建新卡组」粘贴 RingsDB 链接导入并直接选用；「去组卡器创建」先跳转到组卡器页面（内嵌组卡器与回填留待后续）。全员都有牌组时「开始远征」才可点。
- 数据打通：`PlayerUI.configs(n, ids)` 支持显式传入牌组列表，开局直接使用所选牌组；开局页的每位玩家牌组行保留并作为选牌的默认值来源，两边同步。
- 修复两处视觉问题：顶部导航按钮 hover 时套用了通用米色底，导致金底金字看不清；卡组缩略图里混入了「中文卡图 · 本地」说明文字。
- 验证：新增 2 项 DOM 测试（卡组页内容、开局必须逐人确认牌组后才创建对局），总计 398 项通过；真实 Chrome 截图确认两页；四套浏览器审计（布局 14、对比度 6 阶段、四条需求 22）适配选牌步骤后仍全绿。

# v0.14.7 · 牌组导入：粘贴牌表与 RingsDB 链接（2026-10-20）

- 新增「粘贴牌表导入」：逐行解析牌表，支持 `3x 卡名`、`3 卡名`、裸卡牌代码（`01014`/`#01014`）、`卡名 (01014)`；中英文名称均可，自动忽略重音与标点差异（`Celebrian` 命中 `Celebrían`），`英雄／牌组／Deck` 之类分组标题自动跳过。英雄按卡牌类型自动归位，行号级错误报告（找不到卡、张数无效、英雄超 3 名）。
- 新增「从链接导入」：粘贴 `ringsdb.com/decklist/view/<id>` 或纯编号，取 `https://ringsdb.com/api/public/decklist/<id>`（实测返回 JSON 且 `Access-Control-Allow-Origin: *`），由 `PlayerCards.fromRingsdb` 映射为内部结构（`heroes:{code:count}` → `heroes:[code]`）；成功后写入 `localStorage` 缓存，断网时自动回退到缓存，失败给出明确的国内网络提示。
- 右侧组卡器新增「导入报告」区，把解析错误与警告常驻显示，而不是只闪一条 toast；导入结果走同一套 `validateDeck`（50 张下限、每卡上限、英雄去重），通过后可直接保存，并在开局页每位玩家下拉中选用。
- 修复实现过程中的两处缺陷：`fromRingsdb` 里悬垂 `else` 导致对象形态的 `heroes` 永不解析；`render()` 先 `captureSetup()` 会读回旧下拉值（沿用上一版修复思路）。
- 验证：新增 5 项规则测试（中文/英文/代码混合、错误行号、英雄数量、RingsDB 映射、导入后走通校验并成为登记牌组），总计 396 项通过；真实 Chrome 实测粘贴 50 张牌表 → 校验通过 → 保存 → 开局下拉出现「导入牌组」；URL 导入真实牌组 #1 成功拉取并按规则报出「未接入扩展卡」；对比度与布局审计仍全绿。

# v0.14.6 · 每位玩家都能选择预组牌（2026-10-20）

- 问题：开局页显眼的「快速选择」面板写死只作用于玩家1（按钮文案就是「玩家1选用：…」），而每位玩家的牌组下拉框藏在默认折叠的详情面板里，多人局中其他玩家实际上选不到预组牌。
- 改法：删除「快速选择玩家1预组牌」面板，改为常驻的「为每位玩家选择牌组」：按当前人数逐行列出玩家1…N，每行四个领域按钮（领导／战术／精神／学识，当前选择高亮）＋该玩家的牌组下拉框（含已保存的自定义牌组），下方是起始玩家选择。
- 行为：`starterTest` 支持 `data-player`；选择落在该玩家身上；若该预组已被别人使用则自动与对方交换，保证不出现重复英雄；选择会同步到下拉框，避免重渲染时被旧值覆盖。
- 修复过程中发现的实际缺陷：`render()` 开头的 `captureSetup()` 会从尚未更新的旧下拉框读回旧值，导致按按钮切换后选择被还原——已在回写状态前同步 DOM。
- 验证：新增回归测试（玩家2 选牌落到玩家2、重复预组自动交换、开局后双方英雄各不相同），测试 390→391 全部通过；真实 Chrome 3 人局实测玩家2＝学识（01010-01012）、玩家3＝精神（01007-01009）；对比度审计 6 阶段 0 问题。

# v0.14.5 · 操作栏集中显示当前任务（2026-10-20）

- 桌面操作栏升级为单一任务条：一行内给出「当前任务标题 + 全员确认进度 + 第 N/7 阶段 + 主操作按钮」，滚动时保持吸顶（实测 top=8px）。
- 新增 `DesktopUI.status(state)`：按阶段产出任务标题与逐人确认徽标，覆盖起始手牌、待结算事项、探险派遣（待提交／待二次确认）、暂定行动、战斗方案、敌人选择、玩家攻击声明、旅行选择、主动交战、刷新方案。
- 探险派遣示例：单人提交后标题变为「等待 玩家1 提交派遣名单（1/2）」，徽标显示「玩家1 · 待提交／玩家2 · 已提交」；两人都提交后转为「名单已就绪 · 等待二次确认（0/2）」，全员二次确认后才横置并投入。
- 战斗／旅行／遭遇／刷新等阶段同样显示「已确认 x/n」，未确认者以金色徽标标出。
- 新增 `scripts/check-taskbar.cjs`：真实浏览器按四条需求逐项断言（操作栏吸顶与任务标题、公共桌面／底部玩家区／右侧栏几何关系、点牌只暂定、全员确认后才执行、规则自动结算、智能窗口与多人切换），1440 与 1920 均 22/22 通过。
- 新增 `scripts/check-contrast.cjs`：把此前的对比度审计固化为可复用脚本（阈值可调），当前 6 个阶段 0 个低对比控件。
- 测试 389→390：新增「操作栏任务与确认进度」测试，并在探险派遣测试中补充进度徽标断言。

# v0.14.4 · 统一框体尺寸与对齐（2026-10-20）

- 问题：卡牌宽度存在 122/100/110/136 四种，同一行卡牌高度 274 与 258 不等，面板内边距 13/14/16、圆角 7/8/9/10 混用，区域标题行 22 与 38 混排。
- 令牌化：新增 `--panel-pad:16px`、`--panel-radius:10px`、`--card-w:132px`（≥1700 宽 140、≤1100 宽 118）、`--card-gap:12px`、`--card-radius:8px`；操作栏、公共桌面、玩家区、右侧栏统一取值。
- 对齐：操作栏标题与内容改用同一 16px 内边距，使操作栏、桌面、玩家区的内容左边缘同为 39px；区域标题行统一 `min-height:32px` 并居中；卡牌行 `align-items:stretch` 使同行卡牌等高，标题与操作按钮上下对齐。
- 新增 `scripts/check-layout.cjs`：真实 Chrome 布局审计（14 项断言：边缘/宽度/内边距/圆角/标题等高/卡牌等宽等高/间距/横向溢出），1440 与 1920 各输出 `docs/browser-acceptance/layout-report-*.json` 与截图。
- 验证：两种宽度 14/14 通过；389 项规则／模拟DOM测试通过。

# v0.14.3 · 桌面对局浅色主题（2026-10-20）

- 背景：v0.14 桌面版把公共桌面（公开牌区、玩家区、操作栏、右侧栏）写成深蓝黑配色，首页仍是米白纸面，进入剧本后观感如同"深色模式"，用户反馈不一致。
- 改法：为桌面区域追加一套与站点一致的纸面浅色主题（米白底、深墨文字、金框选中、绿色强调），公开桌面 / 玩家区 / 操作栏 / 阶段栏 / 牌库统计 / 日志全覆盖；操作栏标题原为深底浅字，同步改深色文字。
- 二次修复（按钮文字发白）：根因是 `body:has(.desktop-table)` 整套覆盖了 CSS 变量（--ink/--paper/--green…）与 `.desktop-table button` 的文字色为深色主题值（近白 #e9f0f5），容器改浅后按钮文字仍继承近白色，对比度约 1.0。已把该块整体改为浅色等价值（--ink #24392f 等），按钮规则限定在 `main` 作用域以保留顶栏导航按钮样式；notice/badge/win/lost/warning-text 等同批适配。
- 验证：真实 Chrome 对比度审计（按钮文字 vs 实际背景，阈值 3.0）在设置、资源、计划、探险各阶段全部通过，另附截图确认；389 项测试通过（此前 only-light color-scheme 声明保留，防浏览器强制深色）。

# v0.14.2 · 卡图全量本地化（2026-10-20）

- 背景：ringsdb.com 与 hallofbeorn.com 在国内网络被阻断（TLS 握手失败），网页内所有在线英文卡图（图库英文版、遭遇卡、探险卡）无法加载。
- 镜像：新增 scripts/fetch-card-images.py（经本机代理抓取）与 scripts/optimize-card-images.py（转 WebP q80、长边 ≤620 并重建映射）。1511 张引用卡图（RingsDB 1446＋Hall of Beorn 65）全部镜像到 assets/cards-en/ 与 assets/cards-encounter/，835MB 原图压至 82MB。
- 接入：新增 local-image-map.js（远程 URL → 本地 WebP 的映射表），image-ui.js 的 safeUrl 优先返回本地路径，远程仅作无镜像时的回退；shell.html / build.py 纳入该文件。
- 验证：新增 scripts/verify-local-art.cjs 真实浏览器检查——图库玩家牌两页、遭遇页、对局桌面全部图片解码成功，页面发出的 ringsdb/hallofbeorn 请求为 0；新增 2 项模拟DOM测试，389 项通过。
- 注意：assets 体积约 96MB；更新图片请依次运行两个脚本（需可访问外网的代理）。

# v0.14.1 · 桌面真实浏览器验收与派遣提示（2026-10-20）

- 完成真实浏览器验收：本机 Chrome（155.0.8059.84，无头）＋playwright-core 打开离线 index.html；新增 scripts/browser-check.cjs 可重复执行，截图与结果写入 docs/browser-acceptance/。
- 验收覆盖：2人幽暗密林 @1440 从开局走到第2回合资源阶段（七阶段＋智能窗口＋攻防暗影）；4人都尔哥多 @1920 开局；16张长手牌无横向溢出；操作栏吸顶；本地卡图与远程遭遇图加载及失败降级；无控制台错误。
- 新增桌面改进：探险派遣提交后自动切换到下一位未提交玩家的视图（仅切换视图，不改状态）；当前查看玩家已提交时操作栏提示「等待 X 提交派遣名单」。
- 新增1项模拟DOM回归（2人派遣自动切换与提示），387项测试通过。

# v0.14.0 · 桌面交互改版（2026-10-20）

- 新增中央公共桌面、下方玩家卡牌区、右侧阶段／日志与固定操作栏，宽屏优先。
- 投入、防御、攻击采用直接点卡牌暂定；显示选择与基础数值预览，复用规则验证及全员二次确认。
- 玩家切换不改游戏状态；保留其他玩家公开角色与交战敌人、合法旅行与交战入口，以及原有费用／目标／响应对话框。
- 增加5项模拟DOM回归，386项测试通过。真实浏览器视觉验收未完成，未上传远端。

# v0.13.1 · 多人开局修复（2026-10-20）

- 预组牌快捷按钮改为只选择玩家1牌组，统一从所选剧本「开始远征」按人数创建，不再强制单人幽暗密林。
- 人数、种子、牌组及先手在会话内切页／重绘时保留；先手候选随人数变化。快捷选择重复预组牌时交换牌组，避免重复英雄。
- 381项规则／模拟DOM测试通过，真实浏览器验收待做。已开始的旧单人对局不会被自动改成多人，请重新开局。

# v0.13.0 · 智能行动窗口（2026-10-20）

- 新局默认智能推进；旧存档无设置保留详细模式。空普通行动窗口自动让过，集中展示全队合法事件与能力。
- 增加「全队继续到下一决策点」、按卡牌及玩家的「本阶段不再提醒」与恢复提醒。
- 实际操作仍使用原费用／时点／目标检查、暂定清单及二次确认；响应、翻牌、攻防、伤害与阶段入口保持明确控制。
- 377项规则／模拟DOM测试通过；修复安都因旧测试随机选到受限狙击手的不稳定夹具。真实浏览器视觉验收待做。

# v0.12.0 · 第七阶段刷新（2026-10-20）

- 接通刷新与下一回合资源入口；蛛网费用暂定、全队确认、重置、威胁、淘汰与先手轮换。
- 刷新行动沿用暂定清单与全队确认；阶段结束与回合结束分别处理，支持甘道夫、地牢火炬、暗影钥匙及顺序选择。
- 保留资源、伤害、回合能力限制；防止重复刷新和资源收集，支持流程中存档恢复。
- 更新界面提示、项目记忆、phase7-acceptance；353项规则／模拟DOM测试通过，真实浏览器视觉验收未完成。

# v0.11.0 · 战斗阶段（2026-10-20）

- 第五阶段结束后进入战斗；分配隐藏暗影，敌人顺序、防御名单与攻击名单支持暂定、修改与全队确认。
- 逐步开放行动、即时防御响应和暗影取消；自动计算攻防、伤害与英雄／盟友离场。
- 支持基础版17种暗影分派、额外暗影、插入骑手攻击、巨魔溢出、酋长资源、座狼回探查区与狙击手。
- 支持警戒、远程、杜内希尔、森林陷阱、佯攻、共同防御、长矛兵、迅捷打击、仓促一击及击杀进度响应。
- 修复卡牌库在没有场上实例时读取动态属性的问题；只展示已翻开的暗影。
- 332项Node规则与模拟DOM检查通过；真实浏览器视觉验收未完成。第六阶段末停止，未开放刷新或联机。

# v0.10.0 · 遭遇阶段（2026-10-20）

- 旅行完成后进入遭遇；主动交战方案可撤销，修改清除全员二次确认，全员确认后按先手顺序执行。
- 主动交战与交战检定之间、检定后开放暂定事件与能力窗口。
- 循环交战检定、同值选择、巨蜂伤害与英雄离场响应、森林蜘蛛整回合叠加加成。
- 安都因河航道跳过检定；存档保留确认、强制选择与检定游标；第五阶段末停止。
- 272项规则与模拟DOM检查；包含原回归和第五阶段新增检查。浏览器验收见 phase5-acceptance.md。

# 版本记录

此文件区分发行记录与 Git 历史：Git 从导入 v0.9.0 快照开始，早期发行没有对应 Git 提交。

## GitHub 私有仓库导入 · 2026-10-19

用户明确授权后同步 v0.9.0 源码、73张基础卡图与项目记忆到独立分支，以草稿PR审查。保留原 main 祖先和四份原始剧本／术语文件。本地旧独立历史单独归档，不强推 main。游戏规则版本不变。

## 项目管理整理 · 2026-10-19

建立项目记忆入口、协作约定、决定／路线／问题记录、Git流程和统一检查命令。游戏规则版本仍为 v0.9.0。

## v0.9.0

第四阶段旅行、费用、地点强制与可选响应、交流缓冲、阶段结束处理；第三阶段防重复初始化。243项规则与模拟DOM测试通过。

## v0.8.3

暂定事件和能力，全队二次确认后执行；可取消放弃，调整方案清除相关全队确认。218项测试。

## v0.8.2

全员确认前可以修改已提交派遣名单。207项测试。

## v0.8.1

派遣核对弹窗、清空选择、本地整桌回退。202项测试。

## v0.8.0

第三阶段探险状态机、投入、逐张遭遇与取消、自动结果。199项测试。

## v0.7.3 及以前

基础中文卡图、遭遇／探险机制释义、计划阶段、事件窗口、开局与资源阶段逐步完成。详见各验收文件与旧发行包；未补造 Git 提交。
