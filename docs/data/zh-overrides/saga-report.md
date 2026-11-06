# 批次6A 报告 — saga 传说扩展玩家卡

日期：2026-11-03
产物：`saga-text-zh.json`（171 张）

## 1. 覆盖范围

player-carddata.json 中 packCode ∈ {OHaUH, OtD, FotBd, TBR, TRD, ToS, FotW, LoS, MoF}，共 **171 张唯一卡**（与派单预估一致）：

| 包 | 张数 | 包 | 张数 |
|---|---|---|---|
| OHaUH（意外之旅） | 22 | ToS（双塔奇兵） | 22 |
| OtD（史矛革之战） | 24 | FotW（西方之火） | 18 |
| FotBd（弗罗多之感） | **1** | LoS（王者归来） | 16 |
| TBR（黑骑手） | 29 | MoF（魔戒之战） | 14 |
| TRD（路上风险） | 25 | | |

**数据说明**：FotBd 仅 1 张（148021 Ho! Tom Bombadil!）——该包其余卡不在 player-carddata.json 中，疑似数据缺口（FotBd 官方为全 saga 通用宝物包，应有更多张），待数据侧核实。

## 2. nameZh 处理

- 141 张既有 nameZh 非空 → cards 内不含 nameZh 键（merge 跳过）；
- 30 张 nameZh 为空（全部为 treasure/boon-burden 类）→ 补写 nameZh 键：瑟罗尔的战斧/猎弓/金杯（132022-132024）、甘道夫的迟延、魔戒牵引着它们、魔戒之重、被发现的恐惧、活活吞掉！、惊慌失措、惊惧交加（141078-141084）、觊觎魔戒、恐惧之影、敌人穷追、被悲痛压倒、重创、黑夜追随、厄运缠身（142084-142090）、威吓、有备无患、众人的领袖、超乎一切希望、谗言毒计、萨鲁曼之声（143015-143068）、一对幼兔、搜索之眼、沉重的负担（144014-144052）、洛汗侍从、刚铎侍从、被恐惧压倒、带翼戒灵（145014-145062）。

## 3. 机检结果（全过）

- code 集合与源一致（171/171）
- 分段结构一致（\r\n 归一 \n；含 141078/141079 双分段）
- RingsDB token 逐卡一致（[attack]/[willpower]/[defense]/[threat]/[fellowship]/[baggins]/[leadership]/[lore]/[tactics]/[spirit]）
- 数字逐卡核对：11 处差异逐一人工复核，均为良性（"the top card"→"…的1张卡"量词补全、"1 shadow card"→"一张暗影卡"汉字一、源文 "Limit one"（英文单词 one）→"1"）
- traits 特质词数一致（171/171；新特质词按括注口径处理）
- 废弃词零出现（舞台区/限定/支线任务/至尊魔戒/主线任务/重抽/哨卫等）

## 4. 新术语裁决提案（待确认后并入 TERMS.md）

### 4a. 关键字/规则用语（saga 特有）

| EN | 建议译名 | 理由 |
|---|---|---|
| Ring-bearer | 持戒人 | 社区通行；Frodo/Bilbo hero traits 及 7 张卡的规则文本高频出现 |
| treasure（卡类型） | 宝物 | 与 Artifact=秘宝 区分（saga treasure 是独立卡类型） |
| Permanent（关键字） | 永久 | saga boons/burdens 专属关键字，社区通行 |
| Peril（关键字） | 危险 | saga 专属关键字（可在任务阶段打出），社区通行 |
| campaign pool | 战役池 | campaign 模式官方机制，9 张卡引用 |
| threat dial | 威胁表盘 | 145016 附属到威胁表盘 |
| hero limit | 英雄上限 | 132001 |
| Forced | 强制 | 既有产物先例（cycles1/ats-rm 已用"强制："），无冲突 |
| quest point | 任务点数 | 随"印刷任务点数"先例派生 |

### 4b. 特质词（本批首见，译文已采用括注口径）

| EN | 建议译名 | 理由 |
|---|---|---|
| Gift | 礼物 | TRD 四张礼物卡（Gifts of Galadriel 机制） |
| Favor | 眷顾（Favor） | 与 Boon=恩惠 区分 |
| Corruption | 腐化 | 142084/143021 |
| Despair | 绝望 | 142087/142090 |
| Wound | 创伤 | 142088 |
| Fear | 恐惧 | 145016 |
| Nazgûl | 戒灵 | 145062，社区通行 |
| Undead | 不死 | 145068 |
| Enchantment | 附魔 | 143068 |
| Pony | 小马 | 141006 Bill the Pony |
| Bree | 布理 | 141007，地名惯例 |
| Erebor | 孤山（Erebor） | 132020-132024，社区通行 |
| Fellowship（特质） | 同盟 | 142010 魔戒同盟，社区通行 |
| Wose | 野人（Wose） | 145007 悍-不里-悍 种族（Drúedain），社区通行 |
| Mearas | 梅拉斯（Mearas） | 143014 捷影 品种，首见音译 |
| Morgul | 魔窟（Morgul） | 145062 非魔窟附属，社区通行 |
| Burglar | 窃贼 | 沿用批次4已裁决（132001 traits） |

### 4c. 遭遇类 treasure 卡的暗影文本

141081-141084、142086、146041 等卡含 `<i><b>Shadow:</b>…</i>` 暗影段落。因渲染层 rich() 仅识别 `**`，已统一转 **暗影：**（放弃斜体），与 encounter 侧惯例一致。

## 5. 歧义与存疑清单

1. **FotBd 仅 1 张**（见 §1）——数据缺口待 research-data 核实；
2. **145068 亡者大军源文重复**：首句与 Setup 段内容重复（"The first player gains control…" / "Setup: The first player takes control…"），如实照译未删；
3. **源文笔误已按义译出**（未复制笔误）：146007/146008 `<b.Response:` → 响应；145013 "commited"→被指派参加任务；145062 "enagement cost"→交战费用；145010 "it's [defense]"→其 [defense]；141011 "Lower the cost play"→打出…的费用；146009 "Discard Orc Disguise. ." 双句点归一为单句号；131016 "an<b><i> Orc" 粘连→兽人；
4. **143014 捷影**：nameZh 既有值"捷影"（Shadowfax），沿用；
5. **145007 悍-不里-悍**：nameZh 既有值沿用（Ghân-buri-Ghân 连字符音译）；
6. **Boon/Burden 机制卡**：本批 treasure 中 Gift/Favor/Corruption/Wound/Fear 等即 saga 的恩惠/负担体系，译法已按 4b 提案，待裁决后统一（若 Favor 改译"恩宠"等，涉及 143019 一张，可全局替换）。

## 6. 纪律声明

- 未运行 zh_merge.py、build.py，未做任何 git 操作（按要求）；
- `reviewed: false` 如实标注（机器辅助译文）；
- 临时文件 `_saga-extract.json`、`_sagawrite.cjs` 待任务确认后清理（或由落库方一并清理）。
