# 批次6D 循环散包译文报告（cycle-misc-text-zh.json）

- 日期：2026-11-06（收尾复核轮）
- 产物：`docs/data/zh-overrides/cycle-misc-text-zh.json`
- 覆盖范围：TSF, TDT, FotS, TitD, UtAM, WaR, BoCD, TDR, TFoN, TBS, TDoM, HoN, Core, TOF, ASitE, ToR 共 16 包的玩家卡（`player-carddata.json`）

## 1. 张数盘点（按 packCode）

16 包合计 **226 张**玩家卡。上一轮工人实际已完成 **86 条**（84 张新译 + 2 张空原文卡），本轮**补齐 0 条**——交叉核对确认无剩余缺口：

| packCode | 包内卡数 | 译文来源 | 既有条目（上一轮） | 本轮新增 |
|---|---|---|---|---|
| TDT | 10 | cycle-misc | 10 | 0 |
| FotS | 11 | cycle-misc | 11 | 0 |
| TitD | 9 | cycle-misc | 9 | 0 |
| WaR | 10 | cycle-misc | 10 | 0 |
| BoCD | 10 | cycle-misc | 10 | 0 |
| TDoM | 9 | cycle-misc | 9 | 0 |
| TOF | 1 | cycle-misc | 1 | 0 |
| ASitE | 14 | cycle-misc | 14 | 0 |
| ToR | 10 | cycle-misc | 10 | 0 |
| Core | 73 | core-text 71 + cycle-misc 2（01013/01028 空原文卡） | 2 | 0 |
| TSF | 10 | ats-rm-text-zh | —（既有产物已覆盖） | 0 |
| HoN | 18 | ats-rm-text-zh | —（同上） | 0 |
| TBS | 10 | vom-text-zh | —（同上） | 0 |
| UtAM | 10 | vom-text-zh | —（同上） | 0 |
| TFoN | 11 | vom-text-zh | —（同上） | 0 |
| TDR | 10 | vom-text-zh | —（同上） | 0 |
| **合计** | **226** | | **86** | **0** |

要点：任务下达时「约 52 张缺译」的估计与实际不符。经将全部 zh-overrides/*.json 条目模拟合并回 player-carddata.json 后逐卡核验，16 包中缺 rulesTextZh 或 traitsZh 的卡为 **0 张**——上一轮 86 条恰好完整覆盖清单内全部缺译卡，既有产物（core/ats-rm/vom）覆盖其余 140 张。

## 2. 既有 86 条的构成

- 84 张新译：TDT 10 / FotS 11 / TitD 9 / WaR 10 / BoCD 10 / TDoM 9 / TOF 1 / ASitE 14 / ToR 10；
- 2 张空原文卡（Core 01013 城堡卫兵 / 01028 老练斧手）：英文 rulesText 为空，rulesTextZh 照写空串，traitsZh 正常直写。与 core-text-zh.json 中同 code 条目内容完全一致（traitsZh 相同、rulesTextZh 均为空串），合并顺序无覆盖风险；
- nameZh 键仅 10 张现值为空的卡写入（41041–41049 + 147024），符合「仅回填空值」规则。

## 3. 新术语提案（EN / 建议译名 / 理由）

### 3.1 特质（traits）

| EN | 建议译名 | 理由 |
|---|---|---|
| Gollum | 咕噜 | ASitE 咕噜角色卡；社区通行音译，与 data.js 人名无冲突 |
| Goblin | 哥布林 | TDoM；社区通行，与既有「兽人 Orc」区分种族层级 |
| Treasure | 宝藏 | TDoM 宝藏机制卡；社区通行 |
| Adaptation | 适应 | TDoM 战役附属特质；意译贴合「随战役成长」机制 |
| Legend | 传奇 | WaR 汤姆·邦巴迪尔特质；社区通行 |
| Tale | 传说 | TOF「Old Bogey-stories」特质；与 Legend 区分（故事类 vs 人物类） |
| Instrument | 乐器 | ToR「Silver Harp」附属；物品类细分特质 |

### 3.2 规则用语

| EN | 建议译名 | 理由 |
|---|---|---|
| threat elimination level | 威胁淘汰线 | BoCD 10124 / ASitE 21001；「淘汰线」直观表达出局阈值 |
| threat dial | 威胁转盘 | BoCD 10124 附属对象；社区通行 |
| loot deck | 战利品牌库 | WaR 22024 窃贼契约专属牌库；与「牌库/遭遇牌库」构词一致 |
| guarded objective | 看守目标 | WaR 22024；与已裁决「Guarded=看守」成对派生 |
| Campaign Log | 战役日志 | TDoM 41044–41047；官方战役记录机制 |
| Campaign Pool | 战役牌池 | TDoM 41048；Campaign Log 同族构词 |
| collection | 收藏 | TDoM/41041 指玩家全部卡牌集合；社区通行 |
| Master / The Master Ring | 宗主 / 宗主（Master） | TERMS §3 已收 Master=宗主，本批沿用，无新增 |

## 4. 歧义与存疑清单

| code | 问题 | 处理 |
|---|---|---|
| 21006 Derufin | 英文原文整行重复（"Ranged.\nRanged."） | 如实照译保留，疑为数据源瑕疵 |
| 22006 Durin's Axe | 英文原文整行重复（"Guarded (enemy). Restricted." ×2） | 同上 |
| 22005 Tom Bombadillo! | 英文原文拼写瑕疵 "Tom Bombadillo the the victory display" | 按语义译出，忽略重复冠词 |
| 22007 Charge into Battle | 英文原文 "staging are"（应为 area） | 按语义译出 |
| 41049 Ranger Sense | 英文原文 "Campaign Pooll"（多一个 l） | 按语义译出 |
| 21008 Put Off Pursuit | 英文原文 "an non-unique"（冠词瑕疵） | 按语义译出 |
| 22006 Durin's Axe | "After attach hero attacks"（应为 attached） | 按语义译出 |
| 22008 Silver Circlet | 英文原文将 [spirit] token 套在粗斜体标记内（`<b><i>[spirit]</i></b>`） | 译文保留为 `**[spirit]**`，token 原样不译 |
| 10124 Favor of the Valar | 译名「维拉的看重」措辞生硬，社区更常用「维拉的眷顾」 | 本轮不改既有条目（任务要求原样保留），留人工复核 |
| 41048 / 41049 | 同卡两个并列 Quest/Action 选项为设计本意（非重复错误） | 如实照译 |

## 5. 空原文卡说明

- Core 01013（Guard of the Citadel / 城堡卫兵）、01028（Veteran Axehand / 老练斧手）：英文 rulesText 为空字符串，属数据源本身无规则文本（简单属性卡），非漏抓；rulesTextZh 照写 ""。既有 2 条如此，本轮未动。

## 6. 强制自查输出（node 实跑）

```
1) JSON 可解析: OK, cards=86
2) 重复 key: OK（无）
3) 未命中 player-carddata: OK（0）
   packCode 不在清单内: OK（0）
4) ** 计数为偶: OK（全部）
5) [token] 原样保留: OK（全部）
6) 条目清单: 01013,01028,08001,...,41049,147024（86 个，全部命中且 packCode ∈ 16 包清单）
7) 带 nameZh 键条目: 41041,41042,41043,41044,41045,41046,41047,41048,41049,147024
   （对应卡 nameZh 现值均为「空」，回填合规）
```

附加交叉核验：
- 86 条与其它 zh-overrides 文件唯一重复项为 01013/01028（core-text-zh.json），内容一致无冲突；
- 模拟全量合并后，16 包 226 张卡缺 rulesTextZh = 0、缺 traitsZh = 0、空原文未处理 = 0。

## 7. 结论

批次6D 无剩余缺口，`cycle-misc-text-zh.json`（86 条）已达到可接入 `zh_merge.py merge_text_zh` 管线的状态。未运行 build/merge 脚本、未改动 player-carddata.*、未做 git 操作（按任务禁令）。
