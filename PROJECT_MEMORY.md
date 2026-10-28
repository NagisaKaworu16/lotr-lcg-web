# 项目记忆入口

更新日期：2026-10-27（北京时间）。此文件只保存魔戒 LCG 项目状态。

## 当前基线

- 离线网页版魔戒 LCG 桌面，原版基础版普通模式、三个独立剧本、1–4人同机。
- 游戏版本 v0.15.81（2026-10-27，分支 `feature/setup-cancel-scoring`）。今日推进：
  - **v0.15.81**：决策面板统一为「一行触发条 + 非模态浮层」——`.decide-box` 只剩两样：`.decide-trigger`（高 40–42px，占满宽，状态圆点 todo=金／info=灰 + 标题 + hint + chevron）与非模态浮层 `.decide-pop`（DOM 子节点，`position:absolute;bottom:calc(100%+8px)`，宽 `min(880px,100vw-48px)`，高 `max-height:min(62vh,600px)`，头固定／体滚动；≤760px 变底部抽屉）。**开合钥匙** `(round, phase, kind, bodyHash)`，`bodyHash` 走 `stableBody()` 归一化（去 `<details>`、`\d+ 名 · 意志 \d+`、`checked`、`data-state`、`提交空名单`）——草稿勾选与 `<details>` 展开不再改 key，也就不会自己弹开／弹回。key 变且有未 disabled 的 button → 自动打开；key 变但无可点按钮（纯资讯）→ 自动收起；手动关闭后同 key 不再自动打开。关闭途经 ×／Esc（`dialog[open]` 时让位）／点外部，关闭后焦点回触发条；同一时刻只允许一个浮层。**`pickState` 整套开合状态机退役**（改由 DecisionUI 统一管），`pickInner` 拆成 `QuestUI.popExtra()`（`.pick-panel` 内联进 `.decide-pop` 体）+ `QuestUI.pickHint()`（「已选 N 名（意志 X）」搬到触发条 hint），R1–R5 与 `drafts` 分槽全保留。`pickApprove`／`pickDismiss` 退役（`pickApprove` 只做别名），C1 一屏只留一颗绿按钮（`approveDeployment`）。祖先裁剪用 `.player-mat:has(.decide-pop){overflow:visible}` 放行；`scrollMainActionIntoView()` 加滚 `.decide-box` 锚点（浮层向上弹出，触发条在折线下方时整块会被切）。测试 489 项（quest-overlay-tests.cjs 重写为 11 项 DecisionUI 版）+ check-quest-panel 40 + check-quest-r0 30 + check-taskbar 24 + check-contrast + check-layout 17 + check-attachment 5 + check-setup-reveal 13 + check-window-skip 8 + check-score 19 + browser-check ok（第3回合）。
  - **v0.15.80**：探险阶段「投入角色」非模态浮层——`.decide-box` DOM 子节点向上弹出（`.quest-pick`，absolute bottom:calc(100%+8px)，三段 head/body(scroll)/foot，动效照抄 .card-hover-box；≤760px 全宽底部抽屉）。缩略图网格（minmax(96px,1fr)）按英雄/盟友分组，单卡=卡图+卡名+属性代币+费用徽标+「查看」角标；状态含已选/待确认/已横置/已离场（后三类 aria-disabled 禁点）。触发按钮常显「已选 N 名（意志 X）」徽标，开合以 (round,phase,step,handView) 为键由 `QuestUI.syncPick` 恢复；自动弹出=进 commit 未提交/提交后交接/全员交齐 C1/withdraw 退回 A；自动收起=锁定/离开 commit/手动切人；点外部关闭只摘浮层节点不 render（防吞点击）。C1「确认派遣」在浮层内先翻转内联确认条（pickApprove→[再想想][就是现在 approveDeployment]）；eligible 空「提交空名单」保持可用。**R4** 草稿改按 pid 分槽 Map（根治切人丢草稿）。两条祖先 overflow（bottom-deck/player-mat）用 `:has(.quest-pick)` 放行，否则浮层被裁、命中测试穿透。`.player-mat .decide-box .decide-body` 保底 min-height:44px，否则触发按钮把内联面板窗体挤到比主按钮矮、#8 三窄档全挂。测试 485 项（新增 quest-overlay-tests.cjs 7 项）+ check-quest-panel 40 + check-quest-r0 30 + check-taskbar 24 + check-contrast + check-layout 17 + browser-check ok（第3回合）。
  - **v0.15.72**：派遣面板 R0 跨状态不横跳——更正 v0.15.71「`.r0-num` 右对齐即右缘恒定」的错判（`.r0` 是 `flex:0 1 auto` 的内容宽盒，`text-align:right` 无宽度可对齐，A→D 左右缘一起位移 20px）；改为内容宽、左锚，跨状态稳定的是**数字文本起点**，靠 `.state-pill` 等宽（`min-width:77.16px`，窄屏 `69.16px`）+ 前缀五态都写两个汉字（`暂定`／D 态 `实际`）+ `.r0-num{flex:none;tabular-nums}` 去掉 `text-align:right`。一次交互一次重绘（`commit`／`approveDeployment` 各自合并进单个 `mutate()`），修掉 `approveDeployment` 后焦点被第二次替换抹掉的 U18-a。`.door-go:disabled` 换中性底 `#eceae0`。**#8**：`questing.step` 变为 `commit` 那一次把 `.quest-main-action` 主按钮 `scrollIntoView({block:'nearest'})`（锚按钮不锚面板，`lastScrolledStep` 保证同一步只滚一次），旧判据「面板 top ≥ 0」作废（在 v0.15.71 上恒绿）。测试 477 项 + 浏览器 `check-quest-panel.cjs` 37 条 + 新建 `check-quest-r0.cjs` 30 条（三档 × W1–W9，`num.left` 极差实测 0）。
  - **v0.15.71**：探险阶段「派遣名单」面板收尾——状态枚举 `C-in/C-out` 改名 `C1/C2`；R0 拆成 pill + 前缀 + 数字三段（数字右对齐 `tabular-nums`，前缀字数变化不横跳）；R2 改成「一个位置演化」：A 勾选网格 → B/C1/C2 只读「已提交：…」→ D 只读「已投入：…」，承载「提交 ≠ 投入」；R4 `<details>`（summary 固定「规则与名单」）新增全队名单明细 `.quest-roster`（名字／N 名·意志 M／已提交·草稿·未提交），展开态由 `rulesOpen` 记住；`withdraw` 在已有人确认时先二次确认（说明会清除全队 N 次确认）；新增纯函数 `draftPeek()` 与有副作用的 `draftFor()` 分离；有卡牌响应待结算时不渲染派遣控件。全部 20 套 477 项测试零失败。
  - **v0.15.70**：探险阶段「派遣名单」面板精简——玩家分段按钮组（`role=radiogroup`）取代下拉＋并排徽章、四态枚举渲染（草稿／已提交／待确认／已锁定，不再两条 if 叠加渲染）、单一主操作（一屏只留一颗绿按钮）、说明收进 `<details>`；删掉 `.table-selection` 里第 3 颗提交入口；结束阶段门禁同时计入未提交与未确认；淘汰玩家不再计入「全员」（修掉中途淘汰必卡死的死锁）；新增 `#live` a11y 播报与 `data-focus-key` 焦点保持。
  - **v0.15.64**：修复开局弃牌阶段看不到手牌（空态占位挤占、开局面板迁入决策弹窗）。
  - **v0.15.65**：1920×1080 全流程真实浏览器验收中发现「交战区敌人多时手牌被挤到视口外」，反转 flex 优先级修复（bottom-deck 按内容占高，上方公共区压缩滚动）。
  - **v0.15.66**：空操作跳过二次确认——不旅行/全队不交战/本回合不攻击直接执行；单人模式自动确认（旅行/交战/战斗方案/派遣）。
  - **v0.15.67**：全员确认后自动推进——开局手牌全员确认后自动执行剧本设置；刷新阶段「空确认」语义（无蛛网玩家视为已确认不阻塞、全员无蛛网直接结算、单人提交蛛网方案后自动确认）。有蛛网的多人对局仍保留完整确认门。
  - 测试：全部 20 套 477 项零失败；1920×1080 十张验收截图在 `/workspace/验收-1920/`（会话产物，未入库）。
- 二次确认引擎总体语义（v0.15.62 起）：`propose` 暂定 → 全员 `approve` → 锁定执行；v0.15.66 起纯空操作短路；v0.15.67 起无决策点玩家按空确认处理。
- 工程注意：所有引擎/UI 代码在 index.html 有内联副本，任何修改必须对两个文件做相同替换（python 脚本 + `assert count==1`）；DOM 连续点击须每次重新查询节点（render 会替换 DOM）。
- 此前 v0.15.42：远征日志重构为「阶段色带 + 按阶段着色 + 单条回退」；此前 v0.15.41 单屏四区布局、v0.15.19 开局页对比度修正；开局页卡片文字对比度修正（2.66→5.91:1）并把开局页纳入对比度验收；七个浏览器验收脚本改为跨平台浏览器探测。此前 v0.15.18：新增卡牌悬停放大预览（card-hover-preview.js，真实浏览器 26 项验收）；此前 v0.14.2：v0.14.0 桌面改版＋真实浏览器验收＋派遣提交自动切换视图＋卡图全量本地化（v0.14.1/0.14.2）；七阶段框架、回合循环及智能普通行动窗口；保留开局迁移限制。
- 最近验证：489 项 Node 规则／模拟 DOM 测试通过（2026-10-27，v0.15.81）；同日真实浏览器（本机 Chrome 无头）完成桌面验收，2 人局从开局走到第 3 回合、4 人 1920 开局、长手牌与溢出检查全部通过，详见 tabletop-acceptance.md 与 docs/browser-acceptance/。
- 卡图已全量本地化：ringsdb.com／hallofbeorn.com 国内被墙，1511张引用卡图镜像为 assets 下 WebP（约96MB），local-image-map.js 映射，页面不再发出外网图片请求；维护脚本 scripts/fetch-card-images.py＋scripts/optimize-card-images.py（需代理）。
- 包含73种基础英雄／玩家牌本地中文卡图；45种遭遇、10张双面探险卡机制说明。其他扩展主要用于资料／图片查询。
- 外部游戏资料使用 RingsDB 快照；工作中文释义不是官方译文。

## 用户已确认的体验

角色投入、事件和主动能力先暂定，保留交流和缓冲时间。相关玩家全员二次确认后才执行。确认前可撤销／更改方案和取消放弃；修改会清除全队对应二次确认。即时响应仍按规则触发。同机“回退一步”恢复整个状态，不等于规则中的重置角色，也不等于联网回退。

2026-10-20新增体验决定：保持网页版规则自动化；通过智能窗口减少点击，不改成TTS式依靠玩家自行判断全部时点。新局默认智能，旧存档无设置保留详细。空普通窗口自动让过；全队继续仅让过当前窗口。单卡「本阶段不再提醒」按玩家／来源／回合／阶段区分，实际出牌和攻防方案仍保留暂定及二次确认，响应不受普通行动提醒设置影响。

开局入口已统一：预组牌快捷按钮只为玩家1选牌，不再绕过人数创建单人幽暗密林；点击剧本「开始远征」才创建对局。开局人数、种子、牌组与先手保存在本次页面会话中，切页／重绘保留；先手候选随人数调整。详见 setup-acceptance.md。

## v0.14.x 桌面与当前开发分支

工作分支 `feature/tabletop-ui-v0140`，基于远端 v0.13.1 提交 `c6f07243a12af2f592102d786b39fe0f7881afdc`。2026-10-21 用户两次明确要求同步进度：v0.14.1–v0.15.0 推到 `b822a6d`／`f78784d`，随后 v0.15.4–v0.15.17 推到 `4f166d6`（详见 docs/REMOTE_STATUS.md）；只更新该分支，不建 PR、不合并 main（远端 main 仍为 `20c1611`）。终端 `git push` 可直连 GitHub，HTTPS 凭据由凭据管理器保存。

采用固定操作栏＋中央公共桌面＋下方玩家区域＋右侧阶段和日志。蓝框表示合法操作，金框表示暂定选择。投入／防御直接点角色；攻击先点敌人再点角色，显示基础数值预览。点选与切换玩家不写游戏状态／撤销历史；提交复用现有规则验证，全队确认后才执行。渲染阶段在副本上验证可主动交战的敌人，不改变真实状态。复杂费用与目标、强制效果和即时响应保留原有选择框。其他玩家公开英雄／盟友／交战区常驻，手牌和完整附属区通过玩家切换查看。同机不保证私密手牌。

## 两个并行分支（2026-10-22 确认，重要）

- `feature/tabletop-ui-v0140`：历史连续的主线，止于 v0.15.17（47 个提交）。
- `feature/setup-cancel-scoring`：**另一台设备重新 `git init` 后上传的分支，与主线无共同基点（unrelated histories）**，止于 v0.15.20，内容为 v0.15.17 完整代码 + v0.15.18 卡牌悬停预览 + v0.15.19 开局页可读性与验收脚本跨平台 + v0.15.20 开局逐张翻牌／取消窗口、结算计分面板、待结算面板 P0 修复。文件树是主线内容的超集，无文件被删除。
- 本机已切到 `feature/setup-cancel-scoring`（两台设备同分支，避免再次分叉），v0.15.21 的版本徽标修正提交在该分支上。**不再用 merge 合并两条历史**（内容重合，合并会产生无意义冲突）；如需回流主线，用「按差异移植」的方式，不要 `git merge`。
- 判断依据：`git diff --name-status <主线> <另一分支>` 无 `D` 条目即为其超集。

2026-10-20新增：探险派遣提交后自动把视图切到下一位未提交玩家（仅视图）；当前查看玩家已提交时操作栏显示「等待 X 提交派遣名单」。真实浏览器验收已完成（本机 Chrome 155 无头，playwright-core；脚本 scripts/browser-check.cjs，截图与 report.json 在 docs/browser-acceptance/）。新增1项模拟DOM测试，总计387项通过。同日卡图本地化（v0.14.2）：1511张卡图镜像到assets（WebP q80），local-image-map.js 映射，verify-local-art.cjs 验证外网请求为0。v0.14.3-0.14.5 重做对局配色为浅色纸面、统一框体尺寸与对齐、操作栏升级为单一任务条（当前任务＋全员确认进度＋阶段序号）。真实浏览器三套审计：check-layout（14项几何）、check-contrast（对比度）、check-taskbar（四条需求，1440/1920 各22项）；开局页改为每位玩家各自的预组选择（v0.14.6，修复多人局只有玩家1能选）。v0.14.7 增加牌组导入：粘贴牌表（中英文/代码/带x张数，行号级错误）与 RingsDB 链接导入（/api/public/decklist/<id>，CORS 允许，超时15秒，失败回退 localStorage 缓存），导入走同一套 validateDeck 后可保存并在开局选用。v0.14.8 新增顶部「我的卡组」页（LINK/FILE 导入、筛选搜索排序、卡组卡片操作）与开局两步流程：开始远征先进入「选择你的牌组」（使用已有牌组逐人选用／创建新卡组粘贴 RingsDB 链接导入），全员选定后才开局；configs 支持显式牌组列表。v0.14.9 移除开局页重复的选牌面板，开局页只留人数／种子／起始玩家，牌组统一在「选择你的牌组」页选。v0.15.0 重做开局流程：首屏「剧本模式（基础剧本合集）／支线剧情（Pod）」两栏，进入后设置页可填游戏名称、人数、剧本类型（完整连续／单场）、难度与事件窗口时机；难度仅记录，窗口时机写入 windowPrefs。v0.15.1 新游戏改为章节封面网格（6列），为未来扩展预置 9 个支线剧本与 2 个合集占位（灰色＋即将推出，不可进入）；封面按 assets/scenarios/<id>.webp|jpg|png 读取，缺图用内置文字占位，规格见 docs/scenario-covers.md。v0.15.2 接入 Hall of Beorn 产品目录（180 项）：scripts/import-product-catalog.py 生成 product-catalog.js 与 assets/products 封面；新游戏分三页签（剧本模式/支线剧情/噩梦包），章节按目录分组，仅基础版可玩，其余为灰度占位。v0.15.3 产品中文适配：product-zh.json 维护英→中工作译名（180/180，噩梦/预购按后缀生成），卡片标题显示中文、英文作副标题；译名非官方，改表后重跑脚本即可。测试总计401项。

## 当前行为

第三阶段自动管理投入、逐张遭遇、取消窗口、意志／威胁比较、当前地点优先吸收进度和探险推进；第四阶段处理暂定目的地、费用、强制效果、旅行响应及旅行后行动，结束后可进入第五阶段。第五阶段先暂定每人至多1名敌人或不交战，全员二次确认后按起始玩家顺序执行，修改方案清除全队确认。主动交战后、检定后各有行动窗口；检定逐人循环，最高符合交战值优先，同值由起始玩家选择。巨蜂伤害暂停选择己方英雄；森林蜘蛛加成按本回合交战次数叠加。第五阶段结束后可进入第六阶段。战斗按先手顺序分配隐藏暗影、声明敌人攻击／防御与玩家攻击，名单全队确认后执行。17种基础暗影通过显式分派处理；支持警戒、远程、杜内希尔、佯攻、陷阱、共同防御、长矛兵、迅捷打击、仓促一击与击杀进度。暗影插入攻击保存父攻击后恢复，虚拟骑手不产生重复实体牌。战斗结束处理狙击手与延迟效果后，可显式进入刷新。刷新先暂定蛛网费用，全员确认后重置、威胁增加、先手轮换；其后开放行动窗口。阶段结束效果先结算，再处理甘道夫、火炬、钥匙等回合结束效果，多效果由当前先手排序。完成后显式进入下一回合资源阶段，资源与抽牌仍须单独执行且每回合一次。古老森林道路可实际重置起始玩家己方角色。地点旅行时保留已有进度。

用户曾反馈第三阶段结束后似乎再次开始：正常代码路径未复现，具体操作或存档未知。已加同回合初始化保护，并提供明确“进入第四阶段 · 旅行”入口。不能声称已确定原始根因。

## 限制

无联机、无私密手牌。安都因／多尔哥多开局已改为逐张翻牌逐张结算，意志考验与埃莉诺的取消窗口可用（2026-10-21）；开局翻出的诡计仍需玩家按牌面文字人工结算后点「确认结算」，属设计取舍。结算计分面板已实现（score-engine.js，官方公式五项分项 + 评级 + 归一化分）。七阶段循环不等于所有卡牌规则已完整验收。触屏与真实远程网络环境图片可用性、键盘焦点顺序未专门验收。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| window-engine.js / window-ui.js | 合法行动检测、空窗口推进、阶段提醒设置与全队集中操作 |
| engine.js | 对局、阶段入口、牌堆、推进与模块组装；开局逐张翻牌状态机（beginSetupFlow／setupRevealStep／settleSetupCard／finishSetupFlow） |
| score-engine.js | 结算计分纯函数：威胁、回合、淘汰、伤害、胜利点五项分项与评级 |
| planning-engine.js | 共享卡牌状态、费用、能力、响应、阶段结束；已扩展到阶段2–7 |
| quest-engine.js | 第三阶段、共用逐张翻牌和暂定行动缓冲 |
| refresh-engine.js / refresh-ui.js | 第七阶段蛛网费用、重置、威胁、先手、回合结束及界面 |
| combat-engine.js / combat-ui.js | 第六阶段攻防名单、暗影、响应、伤害与战斗界面 |
| encounter-engine.js / encounter-ui.js | 第五阶段主动交战方案、检定、同值选择、强制效果与界面 |
| travel-engine.js | 第四阶段旅行、费用与旅行响应 |
| app.js / *-ui.js | 桌面、表单、交互、存档；`mutate()` 记录 logMarks（操作前后日志条数＋绝对序号）供日志回退 |
| phase-log.js | 远征日志：行解析（回合/阶段/文本）、阶段色带、按阶段着色、单条回退定位纯函数 |
| card-hover-preview.js | 卡牌悬停放大预览（只读 DOM 截图，不写游戏状态） |
| data.js / ringsdb-snapshot.js | 遭遇／探险定义与基础玩家牌快照 |
| shell.html / style.css / build.py | 页面源文件与离线构建 |
| index.html / assets | 可直接打开的发行页面和本地图片 |

## 继续工作

先看 docs/memory/ROADMAP.md 和 ISSUES.md。

2026-10-24：远征日志已重构（phase-log.js）。日志格式为「回合N · §Pn§文本」，`§` 标记可被外部工具直接切掉，`PhaseLog.parse()` 对旧存档无标记行按关键词猜测、认不出时归当前阶段。回退依赖 `app.js` 的 `logMarks`（每次 mutate 记录操作前后日志条数 + 绝对序号 seq），**不要**改回「history 下标 = 日志下标」的写法：history 存操作前状态、日志在操作后写入，两者天然错位一格，早期实现会把玩家退回建局前。真实浏览器桌面验收已完成（2026-10-20）；开局取消窗口迁移与完整计分已于 2026-10-21 完成。下一优先事项：用户上手验收并收集反馈、全流程规则审计（跨阶段卡牌时点）、牌组导入与内嵌组卡器。阶段说明见 phase2-acceptance.md 至 phase7-acceptance.md，桌面与浏览器验收见 tabletop-acceptance.md；现行版本说明优先于旧历史。

产品目录现状（v0.15.12）：新游戏页四个页签（新版扩展／旧版扩展／支线剧情／噩梦包），数据由 `scripts/import-product-catalog.py` 从 Hall of Beorn 快照生成到 `product-catalog.js`，共 164 条。**两级结构**：新版扩展每个循环只出一条（系列名，英雄盒被 `HERO_RE` 跳过）；旧版扩展列表显示 15 个系列（11 个官方循环/传奇 + 4 个社区循环），点开后由 `legacySeries()` 提供其中的剧本。两个核心包都已跳过，「黑森林的魔影」没有大盒，用章节名当系列名（章节数据带 `box`/`key`，别改回「首项即大盒」）。**支线剧情由 `pod-manifest.json` 定义**（来源 `lotr-pod-workbuddy`）：官方 POD 15（含黑森林之黯）+ ALeP 自制 5 = 20，基础三剧本不再出现在这里。设置页的「选择冒险」网格只在剧本 `playable` 为 true 时可玩，目前只有基础版三个剧本。**难度只有官方两种**：标准 Standard 与简单 Easy（设置时每位英雄 +1 资源、按官方清单移除遭遇牌库的难度标记卡，清单在 `engine.js` 的 `EASY_REMOVE`）；官方第三种 Nightmare 需噩梦牌组，未收录。不要恢复「困难」选项。中文译名在 `product-zh.json`，以**银星计划**（重置版／文景版体系，ringsdb 中文插件同一套）为准，不要再按魔戒中文维基的旧译名改回去。三个战役扩展封面来自战役书 PDF 首页（`scripts/extract-pdf-covers.py`，导入脚本不会还原）。改目录或译名后必须重跑导入脚本 + `python build.py`，并跑 `scripts/check-catalog-tabs.cjs` 与 `scripts/check-legacy-packs.cjs` 做真实浏览器验收。

Git状态：本地 v0.13.1 位于 fix/multiplayer-setup-v0131，基于v0.13.0提交c58331b95058e0b4ea12157bc68423cb9479d0a6（feature/smart-windows-v0130）。v0.13.0继承 v0.12.0 提交1154bfb043e8c721cb7e6890b1a687cb2adc3c2e（feature/refresh-phase-v0120）。v0.12.0基于远端 v0.11.0 提交 efe8d928d402befacf16776a9b0efd0b7b60c148（完整文件树 a8338623b8946b3825ad03a79fb8e7507910d7b4）。此前远端最新已上传版本为 feature/combat-phase-v0110，草稿PR #3以 feature/encounter-phase-v0100 为基底，未合并。用户明确上传授权覆盖v0.10.0与v0.11.0代码、更新后的项目记忆及验收记录；2026-10-20用户随后明确要求上传v0.13.1并新建不含「草稿」的分支；此次交付包含v0.13.1整合的v0.12.0刷新、v0.13.0智能窗口及更新记录。交付分支为fix/multiplayer-setup-v0131，本次只创建分支，不新建PR或合并main；实际远端提交以GitHub及docs/REMOTE_STATUS.md为准。main保留原剧本资料，PR #1/#2/#3保留。实际同步结果见 docs/REMOTE_STATUS.md。

检查命令：`python scripts/check_project.py`。Git流程见 docs/GIT_WORKFLOW.md。聊天上下文可能丢失，提交后的这些文件是继续工作的依据。

## 后续候选方案（2026-10-26 记录，尚未实施，按用户优先级排序）

1. **迁移安都因 / 多尔哥多开局取消窗口**：基础三剧本中幽暗密林的开局逐张翻牌/取消窗口已完整；安都因（Journey Along the Anduin）与多尔哥多（Dol Guldur）仍走旧的开局揭示路径，需要把「逐张翻牌 + 可取消」的开局窗口迁移到这两个剧本，含遭遇牌库顺序暂定与撤销语义、planning-dom 用例与真实浏览器验收。
2. **完整计分面板**：对局结束（胜利/阵亡）后的结算计分面板目前只有 P0 版（v0.15.20 修过待结算面板）；完整版需覆盖官方计分规则——剩余威胁、回合数、阵亡英雄、胜利条件加成等明细逐项展示，并支持多局累计。
3. **多分辨率回归验收**：v0.15.65 后已在 1920×1080（十张全流程截图）与 1440×577 抽测通过；完整回归还需覆盖 2560×1440、1366×768、竖屏窄窗等档位的「各区独立滚动、页面不滚」布局与手牌可见性。
4. （观察项）**多人有蛛网对局的刷新确认体验**：v0.15.67 保留了有蛛网时的完整确认门，真实多人同机对局中若仍显繁琐，可考虑「方案未变时保留上轮确认」等更细粒度的空确认扩展。
