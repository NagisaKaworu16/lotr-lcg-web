# 批次6C 报告 — 战役扩展 + Messenger of the King 玩家卡译文

产物：`ce-motka-text-zh.json`（key=卡的 code，traitsZh/rulesTextZh 直写，nameZh 仅空值回填）。

## 1. 卡数自查

| packCode | 全称 | 需译卡数 | 产物条目数 |
|---|---|---|---|
| MotKA | Messenger of the King Allies | 84 | 84 |
| ALePMotKA | A Long-extended Party (MotK) 盟友补充 | 16 | 16 |
| DCCE | Dream-chaser Campaign Expansion | 37 | 37 |
| EMCE | Ered Mithrin Campaign Expansion | 31 | 31 |
| AACE | Angmar Awakened Campaign Expansion | 29 | 29 |
| RevCore | Revised Core Set | 7 | 7 |
| Starter | Two-Player Limited Edition Starter | 2 | 2 |
| **合计** | | **206** | **206** |

校验脚本结论：json 可解析；206 个 key 全部命中 player-carddata.json 且 packCode 属于本批清单；无多余 key；rulesTextZh/traitsZh 全部存在；`\n` 换行数与原文逐卡对齐（ALL OK）；`**` 加粗配对完整；`<>` HTML 残留为零。原文规则文本为空的卡：**无**（206 张 rulesText 均非空，故无 rulesTextZh="" 条目）。

nameZh 回填情况：204 张回填（先例沿用 94 张——与数据内其他 pack 或 encounter-carddata 同名卡一致；新译 110 张），Starter 2 张（22001、22081）nameZh 现值非空，未写 nameZh 键。

## 2. 新术语裁决提案（未在 TERMS.md 收录）

### 2.1 特质

| EN 原文 | 建议译名 | 理由 |
|---|---|---|
| Undead | 亡灵 | 社区通行；与「亡者之王」先例呼应 |
| Oathbreaker | 背誓者 | 银星亡者阵营通行译法（誓约已背弃语境） |
| Wose | 伍斯人 | Drúedain 别名的音译，Ghân-buri-Ghân 相关卡专用 |
| Bree | 布理 | 地名特质，社区通行 |
| Servant | 仆役 | Bob（鲍伯）的马房伙计身份 |
| Pony | 小马 | 与 Bill the Pony=小马比尔 先例成对 |
| Accolade | 荣衔 | EMCE 的 Title 类荣誉特质，区别于 Title=头衔 |
| Doom | 厄运 | 与 Doomed X=厄运X 成对 |
| Elite | 精英 | 通行 |
| Raider | 掠夺者 | 海盗循环的 Raider 敌人族群 |
| Menacing | 凶恶 | DC 循环海怪关键字，表威吓 |
| Hazard | 危害 | 通行 |
| Spider | 蜘蛛 | 通行（昂哥立安虫群） |
| Dragon | 巨龙 | 区别于普通生物 |
| Tactic | 战术 | DCCE 号令卡的特质 |
| Modification | 改装 | 船只升级件特质 |
| Ship | 船只 | 航海扩展核心特质 |
| Sorcery | 巫术 | AACE 关键词（文本内以**巫术**加粗出现） |
| Fear | 恐惧 | AACE 附魔敌人用的附属特质 |
| Thaurdir | 索迪尔 | AACE 人名特质，按人名音译 |
| Devoted | 忠贞 | MotK 同人关键词（Balin），具体机制文本不在本批卡面 |
| Goblin | 哥布林 | 与 Orc=兽人 区分的亚种 |
| Edain | 伊甸人 | 卡名内出现（Axe of the Edain），标准译名 |

### 2.2 机制词

| EN 原文 | 建议译名 | 理由 |
|---|---|---|
| campaign card | 战役卡 | 战役扩展核心词，全批一致 |
| Campaign Pool | 战役池 | 任务给定基准 |
| Campaign Log | 战役日志 | 通行 |
| boon / burden | 恩惠 / 负担 | 任务给定基准（Boon 已在 TERMS.md） |
| part number（战役卡） | 部件编号 | 指 A/B 面序号，影响 X 值 |
| Permanent | 永续 | RevCore/AACE 关键词，通行 |
| Sailing test | 航海检定 | DC 循环检定类型 |
| Boarding value | 登船值 | DC 敌船属性 |
| Dream-chaser | 追梦人 | 船名，意译 |
| treasure | 宝藏 | EMCE 机制词 |
| guarded objective | 被看守的目标 | 与 Guarded=看守 成对 |
| Caves deck | 洞穴牌库 | EMCE 副牌库 |
| victory X | 胜利X | 11178 关键字（victory 3） |
| indestructible | 不灭 | 11216 关键词 |
| Uncharted | 未知 | 地点关键字（望远镜卡） |
| resource match | 资源匹配 | 「不需要资源匹配」 |
| objective / non-objective | 目标 / 非目标 | 10169、12167 |
| 人名新译 | 见 2.3 | — |

### 2.3 人名新译（无数据内先例，音译）

Iârion=伊亚里昂、Eärnur=埃雅努尔（托尔金规范）、Silverthorn=银棘（物件名）、Berelind=贝瑞琳德、Coruhaer=科鲁海尔、Laermuin=莱尔穆因、Daechanar=达契纳尔、Iârchon=伊阿尔孔、Dagnir=达格尼尔、Thaurdir=索迪尔、Crowley=克劳利、Graxar=格拉克萨、Calaerion=卡莱里昂、Starla=斯塔拉、Sahír=萨希尔、Turayn=图雷恩、Melanwar=梅兰瓦尔、Isolde=伊索尔德、Beldis=贝尔迪丝、Urdug=乌尔杜格、Mendor=门多、Lanwyn=劳温（11210 文本内出现）、Drû-buri-Drû=德鲁-布里-德鲁（与 Ghân-buri-Ghân=悍-不里-悍 先例风格协调，取近似音节）。

## 3. 歧义与存疑清单（源数据笔误及处理）

1. **11178（Crowley）**：源文 `he gains victory 3.NNN` 中 `NNN` 为抓取噪声。译文按「获得胜利3」处理，丢弃 NNN；且源文该行为单段（`Forced` 无换行），译文保持单段。
2. **9912142（Súlien）**：源文 `gets ?1 [threat]` 的 `?` 为编码损坏，原版卡为 –1 [threat]。译文按「–1 [threat]」处理。
3. **99146007 / 99146008（Elladan/Elrohir）**：源文 `<b.Response:</b>` 为 `<b>Response:</b>` 笔误。译文按 **响应：** 处理。
4. **9921006（Derufin）**：源文 `Ranged.\nRanged.` 重复一次「远程」。译文保留一次（重复无规则含义），保留换行结构。
5. **22081（Gildor Inglorion）**：源文 `(Limit once per round.)` 缺左括号。译文按「（每轮限一次。）」处理。
6. **9906112（Emery）**：源文 `the top 3 card`（单数笔误），按「3 张卡」处理。
7. **11192（Black Key 敌人版）**：卡名与 11183（角色版）同名「黑钥匙」，但 A/B 面效果完全不同（敌人增强 vs 角色增强），疑为 RingsDB 数据归档问题；按源如实翻译。
8. **12172（The Threat to Wilderland）**：`either raise each player's threat by 2 or all encounter cards are immune...` 未写明由谁选择，源文即含糊，译文如实保留。
9. **11176 / 11210-11214 / 12167 / 12172 / 12173 / 12174 / 12185 / 12191 / 12192 / 12194 等**：源文部分关键词（When Revealed / Setup）无 `<b>` 加粗标记，译文按「源有标记才加 **」原则处理，展示层样式可能不统一，属源数据固有差异。
10. **11195（Come Together）**：源文末行缺句号、`Trait` 斜体加粗不完整（`<b><i>Trait</i></i>`），译文末行如实无句号，特质按 **特质** 处理。
11. **MotKA 大量卡的源文为社区重印改文**（如重复人名的不同版本 Bofur×2、Faramir×3），均已按各自卡面文本独立翻译。
12. **人名音译**（2.3 节）未经社区核对，建议 review 时重点复核 Thaurdir（索迪尔）、Sahír（萨希尔）、Iârchon（伊阿尔孔）三个非常用名。
