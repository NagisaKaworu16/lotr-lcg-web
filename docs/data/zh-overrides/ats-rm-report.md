# 批次3 翻译自查报告：Against the Shadow + The Ring-maker 循环玩家卡

- 日期：2026-11-03
- 执行：translate-zh（机器辅助译文，`reviewed: false`）
- 产物：`docs/data/zh-overrides/ats-rm-text-zh.json`
- 术语基准：`TERMS.md`（含 2026-11-03 二次裁决：隐秘/独特/歌谣/信号/胜利展示区）

## 1. 批次范围与覆盖率

| 循环/包 | packCode | 卡数 |
|---|---|---|
| Against the Shadow：deluxe Heirs of Númenor | HoN | 18 |
| Against the Shadow：5 剧情包 | EaAD/TDF/AoO/BoG/SoCH | 51 |
| The Ring-maker：deluxe The Voice of Isengard | VoI | 15 |
| The Ring-maker：6 剧情包 | TTT/TiT/AtE/NiE/CS/TAC | 60 |
| **合计** | 13 包 | **144/144（100%）** |

**数据缺口如实记录**：AtS 循环第 5 包 The Siege of Cair Andros（SCA）在 player-carddata.json 中不存在（源数据缺失），本批无法覆盖，建议 data 侧补抓。

nameZh 口径：本批 144 张既有 nameZh 全部非空，按要求不覆盖——产物 cards 内不含 nameZh 键。

## 1b. 勘误补记（2026-11-03）

批次3 范围曾误含 SoCH（实属 Dream-chaser 循环，已于批次4 覆盖），并因此遗漏 AtS 第6包 TMV（The Morgul Vale，10 张）——2026-11-03 已补译并入本产物（cards 现共 154 张），机检同口径通过。本循环唯一未覆盖包仅剩 SCA（源数据缺失，见批次4 报告缺包清单）。

## 2. 机检结果

- 覆盖 144/144，无多无漏；分段结构、token（大小写归一）、traits 特质词数逐卡一致；
- 数字差异 10 处逐条复核全部良性（量词补全、"隐秘（Secrecy X）"括注重复计数、英文 "five" 未被 \d 匹配），无机制偏差；
- 无 HTML 残留；无废弃术语（舞台区/限定/隐匿/独占）残留；
- 空文本卡 1 张（05007 Defender of Rammas）如实存空串。

## 3. 可疑译法清单（含裁决结果）

1. **Battle→会战 / Siege→攻城**：**已裁决**：维持（无 data.js 先例，采社区通行）。括注（Battle/Siege）保留待展示层确认。
2. **Valour→英勇**：**已裁决**：维持。括注保留。
3. **side quest→支线探险**：**已裁决**（2026-11-03）：改为**支线探险**，依据 data.js 3 处先例（全站词汇表 探险=quest）；译文已修订（1 处，10056）。
4. **Outlands→边地**：刚铎边地领特质，亦有"外境/外领"，涉及 6 张卡。
5. **Corsair→海盗**：12109 娜阿西雅特质，亦有"科梭海盗"。
6. **Ent→恩特 / Woodman→林中人 / Record→记录 / Spell→咒语 / Isengard→艾森加德**：新特质词 5 个，见 §4。
7. **Planning Action→谋划行动 / Encounter Action→遭遇行动**：新行动窗口名。
8. **first player token→首要玩家标记**：亦有"起始玩家标记"。
9. **optionally engage→主动交战**：亦有"选择性交战"。
10. **undefended attack→未防御的攻击**：亦有"无防御攻击"。

源数据噪声记录（已按语义正确翻译，仅备忘）：12118 源文 `<b><i>Heale</i>r</b>` 标签断裂；06084 源文 "Knight of Minas Tirith Tirith" 重复词；12115 源文 "resouce" 拼写错误。

## 4. 本批新增特质词（建议并入 TERMS.md）

恩特(Ent)、边地(Outlands)、记录(Record)、海盗(Corsair)、林中人(Woodman)、艾森加德(Isengard)、咒语(Spell)。

## 5. 抽样对照（5 张）

### 10063 重燃希望（Hope Rekindled）
> **Action:** Reduce the cost of the next event that has a **Valour** trigger you play this phase by 2.
> **Valour Action:** Search the top 10 cards of your deck for an event that has a **Valour** trigger and add it to your hand. Shuffle your deck.

**行动：**使你本阶段打出的下一张拥有**英勇**触发条件的事件费用降低2。
**英勇行动（Valour Action）：**在你牌库顶的10张卡中搜寻一张拥有**英勇**触发条件的事件，将其加入你的手牌。洗你的牌库。

### 03009 → 本批 03009 无；改用 06090 真知晶球（Palantir）
> **Planning Action:** Exhaust Palantir and attached hero to name a card type and look at the top 3 cards of the encounter deck. For each of those cards that matches the named type, draw a card. For each of those cards that does not match the named type, raise your threat by 2.

**谋划行动：**横置真知晶球和所附属英雄，报出一种卡牌类型，并查看遭遇牌库顶的3张卡。其中每有一张与所报类型相符的卡，抽1张卡；每有一张不符的卡，将你的威胁提升2。

### 06115 剧毒木桩（Poisoned Stakes）
> Play Poisoned Stakes into the staging area unattached.
> If unattached, attach Poisoned Stakes to the next eligble enemy that enters the staging area.
> At the end of each round, deal 2 damage to attached enemy.

将剧毒木桩打出进探查区，不附属。
若处于未附属状态，当下一名符合条件的敌人进入探查区时，将剧毒木桩附属到该敌人身上。
在每轮结束时，对所附属敌人造成2点伤害。

### 06036 战前操练（Trained for War）
> Play only if each hero you control has the printed [tactics] resource icon.
> **Action:** Until the end of the phase, if the current quest does not have Siege, it gains Battle.

只有当你控制的每名英雄都拥有印刷的 [tactics] 资源图标时才能打出。
**行动：**直到本阶段结束，若当前任务没有攻城（Siege）关键字，则其获得会战（Battle）关键字。

### 07003 萨茹曼（Saruman）
> Doomed 3.
> At the end of the round, discard Saruman from play.
> **Response:** After Saruman enters play, choose a non-unique enemy or location in the staging area. While Saruman is in play, the chosen enemy or location is considered to be out of play.

厄运3。
在每轮结束时，将萨茹曼从场上弃掉。
**响应：**在萨茹曼进场后，选择探查区中的一名非独特敌人或一个地点。只要萨茹曼在场上，所选择的敌人或地点视为不在场。

## 6. 后续

- 裁决已落实（2026-11-03）：会战/攻城/英勇维持，side quest→支线探险（data.js 先例），括注保留待展示层确认；
- 数据侧：SCA（The Siege of Cair Andros）缺失，补抓后可单独补译 10 张；
- 我这侧待命，可接下一循环批次。
