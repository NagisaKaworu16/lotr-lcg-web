# TERMS.md — 魔戒LCG 全量汉化术语基准表

> 本文件是后续 4700+ 张卡翻译的**唯一术语基准**（2026-11-03 起生效）。
> 裁决原则：与 data.js 既有惯例保持一致（已 grep 计数核实）；data.js 无先例时采用社区通行译法；拿不准的术语在译文后括注英文原文。
> 首批校准数据：Core 玩家卡 73 张（见 `core-text-zh.json` / `pilot-report.md`）。

## 1. 核心术语（已裁决，data.js 惯例计数在括号内）

| 英文 | 中文 | 依据 |
|---|---|---|
| exhaust | 横置 | data.js 9 处 |
| ready | 重整 | 与横置成对 |
| staging area | 探查区 | data.js 44 处（初译"舞台区"已废弃） |
| active location | 当前地点 | data.js 3 处 |
| Restricted | 受限 | data.js 3 处（初译"限定"已废弃） |
| Action / Response | 行动 / 响应 | 任务给定的术语基准 |
| Event / Attachment / Ally / Hero | 事件 / 附属 / 盟友 / 英雄 | 同上 |
| Enemy / Location / Treachery | 敌人 / 地点 / 诡计 | 同上 |
| Quest | 任务（探险，按语境） | 同上 |
| Willpower / Attack / Defense | 意志 / 攻击 / 防御 | 同上 |
| Hit Points / Threat / Progress | 生命 / 威胁 / 进度 | 同上 |
| Resource / Engage | 资源 / 交战 | 同上 |
| Surge / Doomed X | 涌现 / 厄运X | 同上 |
| Shadow / Archery / Capture | 暗影 / 箭伤 / 俘虏 | 同上 |

## 2. 常用规则用语（Core 批已采用，无 data.js 冲突）

| 英文 | 中文 |
|---|---|
| Combat Action / Quest Action | 战斗行动 / 任务行动 |
| Sentinel / Ranged | 哨兵 / 远程 |
| commit to a quest | 被指派参加任务 |
| "when revealed" effects | 「展示时」效果 |
| shadow card / shadow effect | 暗影卡 / 暗影效果 |
| resource pool | 资源池 |
| discard pile / deck / hand | 弃牌堆 / 牌库 / 手牌 |
| enters play / leaves play / in play | 进场 / 离场 / 场上 |
| put into play | 置入场上 |
| printed cost | 印刷费用 |
| sphere of influence | 势力范围 |
| Limit once per round / Limit 3 times per phase | 每轮限一次 / 每阶段限3次 |
| Orc | 兽人 |

## 3. 特质（traits）对照表（25 词，Core 批已全落）

| 英文 | 中文 | | 英文 | 中文 |
|---|---|---|---|---|
| Dúnedain | 登丹人 | | Title | 头衔 |
| Noble | 贵族 | | Artifact | 秘宝 |
| Ranger | 游侠 | | Item | 物品 |
| Rohan | 洛汗 | | Beorning | 比翁族 |
| Warrior | 战士 | | Weapon | 武器 |
| Dwarf | 矮人 | | Armor | 护甲 |
| Silvan | 西尔凡 | | Hobbit | 霍比特人 |
| Gondor | 刚铎 | | Condition | 状态 |
| Steward | 宰相 | | Craftsman | 工匠 |
| Noldor | 诺多 | | Minstrel | 吟游诗人 |
| Scout | 侦察兵 | | Trap | 陷阱 |
| Archer | 弓手 | | Skill | 技艺 |
| Istari | 伊斯塔瑞 | | | |

## 4. 译文格式规范

1. 保留原文换行与分段结构（`\n`，源数据 `\r\n` 统一归一为 `\n`）；
2. `<b>Action:</b>` 类标记转 `**行动：**` 风格（markdown 极简标记，字段内不存 HTML）；
3. `[attack]`/`[willpower]`/`[defense]`/`[spirit]`/`[threat]` 等 token 保留原样不翻，展示层统一处理；
4. 数值/限制词必须精确；拿不准宁可加括注英文原文；
5. 短卡（英雄签名卡等）逐字译；长卡可轻度精炼但不得丢机制；
6. 原文缺句尾句号的如实保留，不补不删。

## 5. 待定术语备忘（遇到时优先括注原文）

- Istari：现用音译"伊斯塔瑞"，若决定意译为"巫师"需全局替换并避免与游戏词混淆；
- Condition（附属特质）：现用"状态"，与"状况/境况"等译法待长期统一；
- 人名地名：优先沿用 carddata 既有 nameZh（RingsDB 中文社区译名），无先例时音译并括注原文。
