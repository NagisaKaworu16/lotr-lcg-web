# 批次2 翻译自查报告：Mirkwood + Dwarrowdelf 循环玩家卡

- 日期：2026-11-03
- 执行：translate-zh（机器辅助译文，`reviewed: false`）
- 产物：`docs/data/zh-overrides/cycles1-text-zh.json`
- 术语基准：`TERMS.md`（2026-11-03 裁决版：探查区/受限/横置/重整/当前地点）

## 1. 批次范围与覆盖率

| 循环/包 | packCode | 卡数 |
|---|---|---|
| 魔戒：魔影暗林（Shadows of Mirkwood）6 剧情包 | HfG/RtR/CatC/JtR/TDM/RtM | 60 |
| 都灵的矮人隧道（Dwarrowdelf）6 剧情包 | TRG/WitW/TLD/FoS/DR/SaF | 60 |
| Dwarrowdelf deluxe 前置盒 Khazad-dûm | KD | 13 |
| **合计** | 13 包 | **133/133（100%）** |

口径说明：任务预估 200-300，实际两循环唯一卡为 120 张；KD 是 Dwarrowdelf 循环的 deluxe 前置盒（矮人主题主力卡所在），按"循环玩家卡"意图纳入，合计 133。若 lead 意图不含 KD，删除该 13 张即可，其余不受影响。

nameZh 口径：本批 133 张既有 nameZh **全部非空**（0 张空缺），按要求不覆盖——产物 cards 内**不含 nameZh 键**，merge 时跳过该字段（meta 已注明）。

## 2. 机检结果

- 覆盖 133/133，无多无漏；
- 分段结构（\n）逐卡与原文一致；
- token 逐卡一致（大小写归一后比对，本批无 [Defense] 类噪声）；
- 文本内数字 20 处差异逐条人工复核，均为三类良性：量词补全（"top card"→"1张卡"）、Secrecy 括注重复计数、"一/双"汉字未被 \d 匹配，无机制偏差；
- 无 HTML 残留；无废弃术语（舞台区/限定）残留；
- traits 中英文特质词数量逐卡一致（新增特质词全部落表，见 §4）。

## 3. 可疑译法清单（待复核，≤10 条）

1. **Secrecy X→隐秘X**：**已裁决**（2026-11-03）：改为**隐秘**，依据 data.js 既有「隐秘」2 处 + app.js 帮助先例；译文已修订（8 处），括注（Secrecy X）保留。
2. **Song（特质）→歌谣**：**已裁决**：维持。
3. **Signal（特质）→信号**：**已裁决**：维持。
4. **engagement cost / engagement check→交战费用 / 交战检定**：与 Engage=交战 成对。
5. **victory display→胜利展示区**：**已裁决**：维持。
6. **staging step→探查步骤**：随 staging area=探查区 派生。
7. **unique / non-unique→独特 / 非独特**：**已裁决**（2026-11-03）：改为**独特/非独特**，依据 app.js 帮助文本「独特和受限限制」先例；译文已修订（2 处）。
8. **Dale（特质）→谷地**：亦有音译"戴尔"。
9. **Shirriff→治安官**：夏尔霍比特警长职衔，仅 12089 一处。
10. **小特质词**：Mount=坐骑、Boon=恩惠、Mathom=马松（随既有卡名"古老的马松"）、Creature=生物、Eagle=鹰、Forest=森林、Underground=地下、Dark=黑暗、Mountain=山地——均已入 TERMS.md 建议，复核后统一入表。

数据备注：02117（Dúnedain Signal）既有 nameZh 为"杜内丹人的记号"，与 02002（Dúnedain Mark）中文名完全相同，疑似既有数据瑕疵，非本批产物，仅记录不擅改。

## 4. 本批新增特质词（建议并入 TERMS.md）

信号(Signal)、歌谣(Song)、坐骑(Mount)、恩惠(Boon)、马松(Mathom)、生物(Creature)、鹰(Eagle)、森林(Forest)、地下(Underground)、黑暗(Dark)、山地(Mountain)、医者(Healer)、谷地(Dale)、治安官(Shirriff)。

## 5. 抽样对照（5 张）

### 12083 矮人雇佣兵（Dwarven Sellsword）
> **Forced:** At the end of the round, discard Dwarven Sellsword unless the players as a group spend 1 [leadership] resource.

**强制：**在每轮结束时，除非玩家们合计支付1点 [leadership] 资源，否则弃掉矮人雇佣兵。

### 03009 齐吉尔矿工（Zigil Miner）
> **Action:** Exhaust Zigil Miner and name a number to discard the top 2 cards of your deck. If at least one of those cards has cost equal to the named number, choose a hero you control. For each card that matches the named number, add 1 resource to that hero's resource pool.

**行动：**横置齐吉尔矿工并报出一个数字，弃掉你牌库顶的2张卡。若其中至少一张卡的费用等于所报数字，选择你控制的一名英雄。每有一张卡与所报数字相符，便为该英雄的资源池加入1点资源。

### 04005 持续击杀（Keeping Count）
> Attached hero gets +1 [attack] for each resource token on another copy of Keeping Count that is above the current number of resource tokens on this card.

另一张持续击杀上的资源标记每比本卡当前资源标记多出1个，所附属的英雄便+1 [attack]。

### 02123 黑森林信使（Mirkwood Runner）
> While Mirkwood Runner is attacking alone, the defending enemy does not count its [defense].
> "...let a ploughman plough, but choose an otter for swimming, and for running light over grass and leaf or over snow-an Elf."
> –Legolas, The Fellowship of the Ring

当黑森林信使独自攻击时，防御的敌人不计其 [defense]。
"……让农夫去耕田，但游泳要选水獭，而在草地和树叶上、或雪地上轻快奔跑的，要选精灵。"
——莱戈拉斯，《魔戒同盟》

### 04137 维雅（Vilya）
> Attach to Elrond. He gains a [spirit] resource icon.
> **Action:** Exhaust Elrond and Vilya to reveal the top card of your deck. You can immediately play or put into play the revealed card for no cost, if able. Otherwise, move the revealed card to the bottom of your deck.

附属到埃尔隆德身上。他获得一个 [spirit] 资源图标。
**行动：**横置埃尔隆德和维雅，以展示你牌库顶的1张卡。若可能，你可以立即无偿打出或置入该展示的卡。否则，将该展示的卡移到牌库底。

## 6. 后续

- 待复核项：§3 全部 10 条 + §4 特质词，确认后更新 TERMS.md 并去隐匿括注；
- 下一批建议：Against the Shadow 循环（HoN deluxe + 6 包）或安都瑞尔/梦寻者循环，口径与本批一致。
