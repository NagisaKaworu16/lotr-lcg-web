# 批次5 翻译自查报告：The Haradrim + Ered Mithrin 循环玩家卡

- 日期：2026-11-03
- 执行：translate-zh（机器辅助译文，`reviewed: false`）
- 产物：`docs/data/zh-overrides/harad-em-text-zh.json`
- 术语基准：`TERMS.md`（含批次4裁决：看守/契约/设置/调度）

## 1. 批次范围与覆盖率

| 循环/包 | packCode | 卡数 |
|---|---|---|
| The Haradrim：deluxe The Sands of Harad | TSoH | 13 |
| Harad 剧情包 | BtS/DoCG/RAH/M/CoP | 50 |
| Ered Mithrin：deluxe The Wilds of Rhovanion | TWoR | 15 |
| Ered Mithrin 剧情包 | RAR/CotW/TCoU/EfMG/FitN/TFoW | 62 |
| **本批合计** | 13 包 | **140/140（100%）** |

说明：Harad 循环在 carddata 中为 deluxe+5 剧情包形态（无第 6 包可辨识，已按 packName 全量盘点）。Ered Mithrin 的 TWH（The Withered Heath）属 Angmar Awakened 循环，已于批次4 覆盖，非遗漏。

同笔提交附带的修订：
1. **TMV 勘误补译（10 张入 ats-rm-text-zh.json，现 154 张）**：批次3 报告将 SoCH 归入 AtS 循环系归类错误（SoCH 实属 Dream-chaser，已于批次4 报告勘误），连带发现 AtS 第6包 The Morgul Vale (TMV) 遗漏，本笔已补译。AtS 循环实际覆盖：HoN+EaAD/TDF/AoO/BoG/TMV（6/6 中的 5 包，SCA 缺数据）。
2. **批次4 术语裁决落实（tlr-tgh-text-zh.json）**：重抽→调度（11002）、准备→设置（22134 设置阶段/**设置：**），残留 PASS。
3. **TERMS.md**：并入批次4 裁决全条目 + 批次5 新特质词 5 个。

## 2. 机检结果

- 覆盖 140/140，无多无漏；与全部前批产物零重叠；
- 分段结构逐卡一致（初稿 9 处单段误拆已全部修正复检通过）；
- token（大小写归一）、traits 特质词数逐卡一致；
- 数字差异 22 处逐条复核均为良性（量词补全、"（选择2项）"计数、Secrecy 括注），无机制偏差；
- 无 HTML 残留；无废弃术语（舞台区/限定/隐匿/独占/支线任务/重抽/准备阶段）残留；无空文本卡。

## 3. 可疑译法清单（待复核，≤10 条）

1. **Harad→哈拉德 / Haradrim→哈拉德民**：民族名与地名两个特质分开译；亦有统一"哈拉德人"。
2. **Master（特质）→宗主（Master）**：至尊魔戒系列附属特质，文本内括注，待裁决。
3. **The One Ring→至尊魔戒**：22033/22055 附属目标；社区通行。
4. **resource match→资源匹配**："does not require a resource match"→"不需要资源匹配"。
5. **play area→打出区**：陷阱类附属（17139/19062）的放置区域。
6. **main quest→主线任务**（17034 Backtrack）：与支线探险（side quest）成对。
7. **Travel Action→旅行行动**：新行动窗口。
8. **guarding→看守着**（19112 "if it is guarding a card"）：与 Guarded=看守 关联词，现按动词化处理。
9. **17009 卡名"插翅难飞"（Coney in a Trap）** 等既有 nameZh 未动，rulesText 照译。
10. **源数据噪声记录**：19152 重复行 "Guarded (location)."×2（如实保留两行）；22063 句尾多余右括号（已去）；17006 特质 "Warrior" 缺句号；16004 "from you hand"（you→your）；17060 "exaust"（拼写）；19146 "of have attachments"（of→or）、"it's owner's"（it's→its）。均已按语义正确翻译。

## 4. 本批新增特质词（已并入 TERMS.md）

哈拉德(Harad)、哈拉德民(Haradrim)、埃斯加洛斯(Esgaroth)、手杖(Staff)、宗主(Master)。

## 5. 抽样对照（5 张）

### 10028 罗塞尔（Rossiel）
> If the active location shares a **Trait** with a location in the victory display, Rossiel gets +2 [willpower].
> If the attacking enemy shares a **Trait** with an enemy in the victory display, Rossiel gets +2 [defense].

若当前地点与胜利展示区中的某个地点共享一个**特质**，罗塞尔+2 [willpower]。
若进攻敌人与胜利展示区中的某名敌人共享一个**特质**，罗塞尔+2 [defense]。

### 17028 夙林迪尔（Thurindir）
> Thurindir gets +1 [willpower] for each side quest in the victory display.
> **Setup:** Search your deck for a side quest and add it to your hand. Shuffle your deck.

胜利展示区中每有1张支线探险，夙林迪尔便+1 [willpower]。
**设置：**在你的牌库中搜寻一张支线探险，将其加入你的手牌。洗你的牌库。

### 19033 野生种马（Wild Stallion）
> Cannot have attachments
> **Planning Action:** Attach Wild Stallion to an ally you control. (Counts as a **Mount** attachment with the text: "Restricted. Limit 1 per ally. Attached ally gets +1 [willpower], +1 [attack], +1 [defense], and +1 hit point.")

不能拥有附属。
**谋划行动：**将野生种马附属到你控制的一名盟友身上。（视为一张**坐骑**附属，文本为："受限。每名盟友限1匹。所附属的盟友+1 [willpower]、+1 [attack]、+1 [defense] 和+1生命。"）

### 22049 冲啊，三位猎手！（Forth, The Three Hunters!，契约卡）
> **Side A**
> Your deck cannot include ally cards.
> Each of your heroes can have 1 additional restricted attachment. Reduce the cost of the first restricted attachment you play on each of your heroes each round by 1.
> **Refresh Action:** If each of your heroes has at least 2 restricted attachments, flip this card over.
> **Side B**
> Each of your heroes can have 1 additional restricted attachment and gets +1 [willpower] for each restricted attachment on it.
> **Action:** Exhaust this card to heal 1 damage from each of your heroes.

**A面**
你的牌库不能包含盟友卡。
你的每名英雄可以多拥有1张受限附属。你每轮在每名英雄身上打出的第一张受限附属费用降低1。
**重整行动：**若你的每名英雄都至少拥有2张受限附属，将此卡翻面。
**B面**
你的每名英雄可以多拥有1张受限附属，且其身上每有1张受限附属便+1 [willpower]。
**行动：**横置此卡，治疗你每名英雄身上的1点伤害。

### 22054 萨茹曼（Saruman，hero）
> When a player card effect would reduce your threat by any amount, reduce that amount to 1.
> While playing an event with the printed doomed keyword, Saruman gains the printed [leadership], [spirit], and [tactics] icons.
> **Response:** After you play a card with the doomed keyword, ready Saruman.

当一张玩家卡效果将你的威胁降低任意数值时，将该数值降为1。
打出拥有印刷厄运关键字的事件时，萨茹曼获得印刷的 [leadership]、[spirit] 和 [tactics] 图标。
**响应：**在你打出一张拥有厄运关键字的卡后，重整萨茹曼。

## 6. 后续

- 待裁决：§3 的 Master→宗主（括注待去）与 Haradrim 译法；
- 批次6 收官预告：Vengeance of Mordor 循环（VoM deluxe + 5~6 包，约 60 张），译完即官方循环玩家卡全量覆盖；
- 待命。
