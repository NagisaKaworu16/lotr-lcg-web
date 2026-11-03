# 批次6收官报告 — Vengeance of Mordor 循环玩家卡

日期：2026-11-03
产物：`vom-text-zh.json`（41 张）+ TSF 补译 10 张（并入 `ats-rm-text-zh.json`，144→154→164）

## 1. 本批覆盖

- `player-carddata.json` 中 packCode = **TBS / UtAM / TFoN / TDR** 的 41 张唯一卡，全部为循环尾部未译存量。
- 加上批次5已译入 harad-em 的 **TCoU**（City of Ulfast，11 张），data 中 VoM 相关玩家卡已全量译毕。
- 41 张既有 nameZh 均非空，产物 cards 内不含 nameZh 键（merge 跳过）。

## 2. 数据疑点上报（research-data）

TBS/UtAM/TFoN/TDR 四包（packCode 确认）共 41 张卡，其 packCode 与卡牌内容主题明显不符：

- Arwen Undómiel（hero, 10140）挂在 TDR（The Drowned Ruins）
- Fastred（hero, 17081）挂在 TBS
- Roamign Exile / Stone of Elostirion 等卡的主题与四包剧本不符

疑似 data 源的包归属错位（可能被误归入 VoM 循环尾部包）。**译文已按 code 照常覆盖**（文本本身无碍），归属待数据侧核实。

## 3. 勘误与补译

| 事项 | 说明 | 处理 |
|---|---|---|
| TSF 漏译 | 批次3 漏掉 AtS 第1包 The Steward's Fear（06001-06010，10张） | 已补译入 ats-rm-text-zh.json，现 164 张 |
| TCoU 归属存疑 | 批次5 将 TCoU 归入 EM 循环，其可能实为 VoM deluxe | 文本无碍，归属待核实；不影响覆盖（VoM 全量已译） |
| 裁决落实 | 至尊魔戒→至尊戒（harad-em 22033/22055 共2处）、主线任务→主线探险（17034） | sed 全量替换并验证零残留 |

## 4. 机检结果（全过）

- code 集合与源提取一致（41/41）
- 分段结构一致（\r\n 归一 \n，含 17082/22147 双分段）
- token 逐卡一致（[attack]/[willpower]/[defense]/[threat]/[fellowship]/[baggins]/[leadership]/[lore]/[spirit]/[tactics]）
- 数字逐卡核对（含 17084 十位数 X、22147 恰好50张/每势力10张/至多2张）
- traits 特质词数一致（41/41；17089 Pipeweed 括注处理）
- 废弃词零出现（舞台区/限定/支线任务/至尊魔戒/主线任务/重抽/哨卫等）

## 5. 新增/沿用术语

- 本次裁决：The One Ring=**至尊戒**、main quest=**主线探险**（已写入 TERMS.md）
- 沿用：宗主（Master）、烟斗（Pipe）、看守（Guarded）、支线探险（side quest）、英勇（Valour）、谋划行动（Planning Action）、契约（Contract）、哨兵/远程、探查区/探查步骤、独特/非独特、受限
- 新词：烟斗草（Pipeweed，traits 首见，括注原文备审）

## 6. 收官状态

官方全部循环玩家卡汉化**收官**（ALeP 与源缺包除外）。累计：

| 批次 | 文件 | 张数 |
|---|---|---|
| 试点 Core | core-text-zh.json | 73 |
| 批次2 Mirkwood+Dwarrowdelf | cycles1-text-zh.json | 133 |
| 批次3 AtS+RM（含 TMV/TSF 补译） | ats-rm-text-zh.json | 164 |
| 批次4 TLR+TGH | tlr-tgh-text-zh.json | 100 |
| 批次5 Haradrim+EM | harad-em-text-zh.json | 140 |
| 批次6 VoM | vom-text-zh.json | 41 |
| **合计** | | **651** |

全部 `reviewed: false`（机器辅助译文，如实标注）。
