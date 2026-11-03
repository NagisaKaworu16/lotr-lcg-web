# Core Set 玩家卡中文翻译试点报告

- 日期：2026-11-03
- 执行：translate-zh（机器辅助译文 + 人工核对，`reviewed: false`）
- 产物：`docs/data/zh-overrides/core-text-zh.json`

## 1. 覆盖率

| 项目 | 数值 |
|---|---|
| 任务预估卡数 | 134 |
| 实际 Core 玩家卡（唯一卡） | **73** |
| 已翻译 | **73/73（100%）** |

说明：player-carddata.json 中 `packCode=='Core'` 的玩家卡为 73 张唯一卡（RingsDB 源，无重复条目）；任务预估的 134 应为按数量（quantity）或含重印的口径。本批按唯一卡全量覆盖，后续批次建议沿用唯一卡口径。

机检结果（见自检脚本逻辑）：
- 分段结构（\n）：73/73 与原文段落数一致；
- `[attack]`/`[willpower]`/`[defense]`/`[spirit]`/`[threat]` token：逐卡完全一致；
- 文本内数字：逐卡核对，仅 5 处为"每X点…1点"复述式或"1张卡"量词补全，语义一致，无机制偏差；
- 无 HTML 残留（`<b>/<i>` 已转 `** **`）；空文本卡 2 张（01013 城堡卫兵、01028 老练斧手）如实存空串。

## 2. 术语表（本批基准）

| 英文 | 中文 | 备注 |
|---|---|---|
| Action / Response | 行动 / 响应 | **行动：** 风格，markdown 加粗 |
| Combat Action / Quest Action | 战斗行动 / 任务行动 | |
| Event / Attachment / Ally / Hero | 事件 / 附属 / 盟友 / 英雄 | |
| exhaust / ready | 横置 / 重整 | 见可疑清单 #1 |
| commit to a quest | 被指派参加任务 | 见可疑清单 #5 |
| staging area | 舞台区 | 见可疑清单 #2 |
| active location | 当前地点 | 见可疑清单 #3 |
| engaged / engage | 交战 / 与…交战 | |
| Sentinel / Ranged | 哨兵 / 远程 | 关键字 |
| Restricted | 限定 | 见可疑清单 #4 |
| "when revealed" effects | 「展示时」效果 | |
| shadow card / shadow effect | 暗影卡 / 暗影效果 | |
| resource pool | 资源池 | |
| discard pile / deck / hand | 弃牌堆 / 牌库 / 手牌 | |
| enters play / leaves play / in play | 进场 / 离场 / 场上 | |
| printed cost | 印刷费用 | |
| sphere of influence | 势力范围 | |
| Limit once per round | 每轮限一次 | |
| Hit Points | 生命 | |
| Orc | 兽人 | 与既有卡名"长须兽人杀手"一致 |
| Treachery | 诡计 | |

特质（traits）对照：Dúnedain=登丹人、Noble=贵族、Ranger=游侠、Rohan=洛汗、Warrior=战士、Dwarf=矮人、Silvan=西尔凡、Gondor=刚铎、Steward=宰相、Noldor=诺多、Scout=侦察兵、Archer=弓手、Title=头衔、Artifact=秘宝、Item=物品、Beorning=比翁族、Weapon=武器、Armor=护甲、Hobbit=霍比特人、Condition=状态、Craftsman=工匠、Minstrel=吟游诗人、Trap=陷阱、Skill=技艺、Istari=伊斯塔瑞。

## 3. 可疑译法清单（待复核，≤10 条）

1. **exhaust→横置**：社区亦有译"耗尽"。本批统一"横置"（与 ready=重整 成对）。
2. **staging area→舞台区**：亦有译"布景区/集结区"，需与遭遇侧统一。
3. **active location→当前地点**：亦有译"活动地点"。
4. **Restricted→限定**：LCG 附属栏位限制术语，亦有译"限制"。
5. **commits to a quest→被指派参加任务**：亦可"commit→指派/承担"，长句中用被动以明确时序。
6. **Condition（特质）→状态**：作为附属特质词，与"状况/境况"等译法需统一。
7. ** Istari→伊斯塔瑞**：音译，亦有"巫师"意译（如译"巫师"需避免与游戏词混淆）。
8. **put into play→置入场上**：与"进场（enters play）"区分，但中文均含"场上"，靠上下文区分。
9. **01073 甘道夫 "(choose 1)"→（选择1项）**：原文括号位置特殊，保留括号结构。
10. **01027/01065/01066/01071 原文缺句尾句号**：译文如实未补句号（忠实原文）。

## 4. 抽样对照（5 张）

### 01001 阿拉贡（Aragorn）
> Sentinel.
> **Response:** After Aragorn commits to a quest, spend 1 resource from his resource pool to ready him.

哨兵。
**响应：**在阿拉贡被指派参加任务后，从他的资源池支付1点资源来重整他。

### 01031 比翁（Beorn）
> **Action:** Beorn gains +5 [attack] until the end of the phase. At the end of the phase in which you trigger this effect, shuffle Beorn back into your deck. (Limit once per round.)

**行动：**比翁在本阶段结束前+5 [attack]。在你触发此效果的那个阶段结束时，将比翁洗回你的牌库。（每轮限一次。）

### 01036 长矛之林（Thicket of Spears）
> You must use resources from 3 different heroes' pools to pay for this card.
> **Action:** Choose a player. That player's engaged enemies cannot attack that player this phase.

你必须使用来自3名不同英雄资源池的资源来支付此卡的费用。
**行动：**选择一名玩家。该玩家的交战敌人在本阶段不能攻击该玩家。

### 01051 挺身战斗（Stand and Fight）
> **Action:** Choose an ally with a printed cost of X in any player's discard pile. Put that ally into play under your control. (The chosen ally can belong to any sphere of influence.)

**行动：**在任意玩家的弃牌堆中选择一名印刷费用为X的盟友。将该盟友置入场上，由你控制。（所选择的盟友可以属于任意势力范围。）

### 01073 甘道夫（Gandalf）
> At the end of the round, discard Gandalf from play.
> **Response:** After Gandalf enters play, (choose 1): draw 3 cards, deal 4 damage to 1 enemy in play, or reduce your threat by 5.

在每轮结束时，将甘道夫从场上弃掉。
**响应：**在甘道夫进场后，（选择1项）：抽3张卡、对场上1名敌人造成4点伤害，或将你的威胁降低5。

## 5. 后续建议

- merge 接线由 fe2 完成：展示层需支持 `** **` 加粗、`\n` 分段、`[xxx]` token 渲染；
- 若术语表有改动（尤其 #1–#5），建议在本批基础上做一次全局替换再扩量；
- 遭遇卡（encounter-carddata.json）的翻译可复用本术语表，但需补充 Surge=涌现、Doomed X=厄运X、Archery=箭伤、Capture=俘虏 等遭遇侧术语。
