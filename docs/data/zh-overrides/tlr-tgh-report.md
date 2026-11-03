# 批次4 翻译自查报告：The Lost Realm + The Grey Havens 循环玩家卡

- 日期：2026-11-03
- 执行：translate-zh（机器辅助译文，`reviewed: false`）
- 产物：`docs/data/zh-overrides/tlr-tgh-text-zh.json`
- 术语基准：`TERMS.md`（含批次3裁决：支线探险/会战/攻城/英勇）

## 1. 批次范围与覆盖率

| 循环/包 | packCode | 卡数 |
|---|---|---|
| The Lost Realm（Angmar Awakened）：deluxe | TLR | 15 |
| Angmar Awakened 剧情包 | WoE/TGoF/TWH/TLoS/MG | 51 |
| The Grey Havens（Dream-chaser）：deluxe | TGH | 15 |
| Dream-chaser 剧情包 | CoC/TotD | 19 |
| **本批合计** | 9 包 | **100/100（100%）** |

**不在本批的循环内卡（均为既有覆盖，非遗漏）：**
- DR The Drowned Ruins（10 张）→ 已于批次2 译出（cycles1-text-zh.json）
- SoCH A Storm on Cobas Haven（11 张）→ 已于批次3 译出（ats-rm-text-zh.json）
- 两循环玩家卡合计 121 张唯一卡 = 本批 100 + 前批 21，无重复收录（fe2 overlap 守卫维持零重叠）。

**数据缺口如实记录（不跨源补抓）：**
1. DD Deadmen's Dike（Angmar Awakened 第2包）——player-carddata.json 中无此包；
2. VAB Voyage Across Belegaer（Dream-chaser 第1包）——同上。

## 2. 勘误（诚实性记录）

批次2 报告曾将 DR（The Drowned Ruins）归入 Dwarrowdelf 循环——**归类错误**，DR 实属 Dream-chaser 循环（The Grey Havens）。DR 的译文本身无误，仅批次2 报告的归属表与 cycles1-text-zh.json 的 meta.scope 注释有误。连带更正：**Dwarrowdelf 循环第5包 Flight from Moria (FfM) 同样缺失于 player-carddata.json**（批次2 因误把 DR 凑数而未察觉）。即批次2 实际覆盖：Mirkwood 6/6 完整 + Dwarrowdelf 5/6（缺 FfM）+ 误含 1 张 Dream-chaser 包。请 data 侧将 FfM、DD、VAB（及 SCA）一并列入缺包清单。

## 3. 机检结果

- 覆盖 100/100，无多无漏；与前三批产物零重叠（代码比对）；
- 分段结构逐卡一致（初稿 3 处单段误拆已修正）；token（大小写归一）逐卡一致；traits 特质词数逐卡一致；
- 数字差异 6 处复核均为量词补全良性（"a Signal card"→"1张信号卡"等），另 09010 初稿将 "by 1 for each enemy" 抽象为 X，已改为忠实直译"每有一名敌人便降低1"；
- 无 HTML 残留；无废弃术语（舞台区/限定/隐匿/独占/支线任务）残留；无空文本卡。

## 4. 本批新术语（待复核）

1. **Guarded (enemy or location)→看守（敌人或地点）**：亦有"护卫/设防"。
2. **Contract（卡类型）→契约**：22134 Messenger of the King 首张契约卡，Side A/B 译"A面/B面"。
3. **setup / setup hand / mulligan→准备 / 起手牌 / 重抽**：11002 加尔多卡内含 mulligan 规则。
4. **Encounter（09015 关键字，与 Surge 并列）→遭遇**：与 Encounter Action=遭遇行动 同词不同义（一个是关键字一个是行动窗口），展示层注意区分。
5. **Burglar（特质）→窃贼**（19112 比尔博）、**Pipe（特质）→烟斗**（22115/22116）。
6. **threat cost→威胁费用**（12143 英雄威胁值）、**starting threat→起始威胁**。
7. **"top card of your discard pile" 条件系列**（11003/11006/11012）→"弃牌堆顶的卡是X时"。

建议并入 TERMS.md：看守/契约/窃贼/烟斗/威胁费用/起始威胁 + 上述关键字区分备注。

## 5. 抽样对照（5 张）

### 11002 灰港的加尔多（Galdor of the Havens）
> **Response:** After drawing your setup hand, instead of taking a mulligan, you may discard any number of cards from your hand. Then, draw that many cards.
> **Action:** If you have no cards in your hand, draw 6 cards. (Limit once per game.)

**响应：**在抽完起手牌后，你可以选择不进行重抽，改为弃掉手牌中任意数量的卡。然后，抽等量的卡。
**行动：**若你的手牌中没有卡，抽6张卡。（每局游戏限一次。）

### 12138 伊姆拉希尔亲王（Prince Imrahil，hero）
> **Combat Action:** Spend 1 resource from Prince Imrahil's resource pool to search the top 5 cards of your deck for an ally who shares at least 1 **Trait** with him, and put that ally into play. Shuffle your deck. At the end of the phase, if that ally is still in play, shuffle it into your deck. (Limit once per round.)

**战斗行动：**从伊姆拉希尔亲王的资源池支付1点资源，在你牌库顶的5张卡中搜寻一名与他共享至少1个**特质**的盟友，将该盟友置入场上。洗你的牌库。在本阶段结束时，若该盟友仍在场上，将其洗入你的牌库。（每轮限一次。）

### 19010 阿肯宝钻（The Arkenstone）
> Guarded (enemy or location).
> Attach to a hero.
> Each unique character you control gains +1 [willpower].
> **Action:** Reduce your threat by 2 to attach The Arkenstone to a hero controlled by another player and raise that player's threat by 2. (Limit once per round.)

看守（敌人或地点）。
附属到一名英雄身上。
你控制的每名独特角色+1 [willpower]。
**行动：**将你的威胁降低2，将阿肯宝钻附属到另一名玩家控制的一名英雄身上，并将该玩家的威胁提升2。（每轮限一次。）

### 22134 国王的信使（Messenger of the King，契约卡）
> **Side A**
> You cannot choose more than 2 heroes during setup.
> **Setup:** Choose a non-neutral unique ally from your deck and put it into play. Add the sum of that ally's printed [willpower], [attack], [defense], and hit points to your starting threat. Then, flip this card over and attach it to that ally.
> **Side B**
> Attached ally loses the ally card type and gains the hero card type.
> Attached character cannot be readied more than once per phase.
> Messenger of the King is immune to card effects while attached character is in play.
> **If attached character leaves play, remove Messenger of the King from the game.**

**A面**
准备阶段你最多只能选择2名英雄。
**准备：**从你的牌库中选择一名非中立独特盟友，将其置入场上。将该盟友印刷的 [willpower]、[attack]、[defense] 与生命值之和加入你的起始威胁。然后，将此卡翻面并附属到该盟友身上。
**B面**
所附属的盟友失去盟友卡牌类型，获得英雄卡牌类型。
所附属的角色每阶段被重整不能超过一次。
所附属角色在场上时，国王的信使免疫卡牌效果。
**若所附属角色离场，将国王的信使移出游戏。**

### 09015 北方的游民（Ranger of the North）
> Encounter. Surge. Ranged. Sentinel.
> **When Revealed:** The first player chooses a player to take control of Ranger of the North. Then, either deal 2 damage to an enemy or place 2 progress tokens on a location.

遭遇。涌现。远程。哨兵。
**展示时：**第一名玩家选择一名玩家接管北方的游民的控制权。然后，要么对一名敌人造成2点伤害，要么在一个地点上放置2个进度标记。

## 6. 后续

- 缺包汇总（供 data 侧）：SCA、FfM、DD、VAB（均为源站/抓取缺口，涉及本批前各循环）；
- 待裁决：§4 的 7 条新术语，确认后入 TERMS.md；
- 待命，可接下一循环批次（候选：Ring-lore 传奇三部曲 / Harad / Ered Mithrin / Angmar Awakened Campaign Expansions）。
