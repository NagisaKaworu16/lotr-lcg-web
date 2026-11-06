# 批次6B 译文报告 — ALeP 银星同人循环玩家卡

- 产物：`docs/data/zh-overrides/alep-text-zh.json`（203 条，code 精确匹配）
- 源数据：`docs/data/player-carddata.json`（cards 数组）
- 术语：遵循 `docs/data/zh-overrides/TERMS.md`；未收词见下文提案
- 译文未人工复核（meta.reviewed=false）

## 1. 卡数自查（node 校验脚本核过，校验后已删除）

| packCode | 张数 | packCode | 张数 |
|---|---|---|---|
| CoE | 21 | TSR | 23 |
| THo | 20 | SNiB | 11 |
| TMoG | 15 | MotR | 11 |
| FitD | 14 | TAP | 11 |
| FotE | 14 | TBP | 11 |
| TGoR | 13 | BitI | 10 |
| TSotS | 6 | TGC | 10 |
| HoEM | 10 | TNaA | 1 |
| TSoEr | 1 | THftD | 1 |

**合计 203 张**，与提取清单完全一致；无清单外卡混入、无遗漏（uncovered=[]）、无 nameZh 回填违例。

- rulesTextZh 全部非空源文本，本批无「原文为空写 ""」的卡。
- nameZh 回填 33 张（仅卡现 nameZh 为空时带键）：TBP 德鲁阿丹系 10 张（310075–310084）、THo 宝藏/契约/附属 13 张（503008/503009/503012–503019/503021–503023/503069–503071）、TMoG 2 张（505016/505062）、TSotS 5 张（500038–500042）。

## 2. 新术语裁决提案（TERMS 未收词，本批首次出现）

### 2.1 特质

| EN 原文 | 建议译名 | 理由 |
|---|---|---|
| Devoted | 献身 | ALeP 玩家关键词（CoE/FotE/MotR/TGoR/TGC/TSR 多包出现），data.js 无先例；取「献身」简洁独立成词，建议对照 ALeP 官方规则定义复核 |
| Wose | 伍斯 | 德鲁阿丹人对本族的自称（TBP 全包特质）；音译，与既有 nameZh「德鲁阿丹森林」（encounter-carddata 先例，Drúedain=德鲁阿丹）配套 |
| Oathbreaker | 背誓者 | FitD 关键特质；社区通行（山中亡者「背誓者」），与**恐惧**附属机制配套 |
| Undead | 不死生物 | FitD 特质；通用语汇 |
| Wall | 城墙 | FitD「Ring Wall」机制特质；直译 |
| Fear | 恐惧 | FitD 附属特质（仅正文引用，未上特质栏）；直译 |
| Easterling | 东方人 | SNiB 特质；译林惯例（东方人/东方部落） |
| Rhûn | 鲁恩 | SNiB 特质；译林惯例 |
| Khand | 坎德 | SNiB 特质；译林附录音译（存疑，见 §4） |
| Balchoth | 巴尔寇斯 | SNiB 特质；译林附录音译 |
| Bree | 布理 | TGoR 特质；pack-zh.js「布理奇闻」同名先例 |
| Servant | 仆役 | CoE/TGoR 特质（Nob/Bob/Squire）；「仆人」偏白话，「仆役」更合卡牌语域 |
| Legend | 传奇 | TSR 特质（汤姆·邦巴迪尔）；直译 |
| Instrument | 乐器 | TSR 特质；直译 |
| Spirit（特质） | 灵体 | TGC/TSR 特质（河魂/幽魂，如 Goldberry、Wandering Spirit）；注意与势力 token [spirit] 区分，token 保持英文不译 |
| Pony | 小马 | MotR/TGoR 特质；与既有 nameZh「贝奥恩一族小马」「布理小马」一致 |
| Gift | 赠礼 | TMoG 特质（加拉德瑞尔赠礼系列）；「赠礼」比「礼物」合语域 |
| Providence | 天佑 | TMoG 特质（宝藏层级词）；「天佑」与「恩惠(Boon)」区分 |
| Tier 1 / Tier 2 | 等级1 / 等级2 | TMoG 宝藏层级特质；直译 |
| Service | 服务 | THo 特质（Two by Two）；直译，含义偏「劳役」，可再议 |
| Advice | 忠告 | TSR 特质（Keep It Secret 目标卡）；直译 |

### 2.2 关键词 / 规则用语

| EN 原文 | 建议译名 | 理由 |
|---|---|---|
| turncoat | 变节 | ALeP 关键词（SNiB Word of Persuasion、TMoG Word of Healing）；直译 |
| retreat X | 撤退X | ALeP 关键词（TMoG 环带兵）；与「厄运X」句式一致 |
| threat elimination level | 威胁淘汰等级 | ALeP 进阶威胁机制（FitD/SNiB/TSR/THftD）；直译 |
| secrecy level | 隐秘等级 | 随 Secrecy=隐秘（既有裁决）派生 |
| main quest | 主线探险 | 与 side quest=支线探险（既有裁决）成对 |
| attribute token | 属性指示物 | SNiB/TBP 机制（[willpower]/[attack]/[defense] 指示物） |
| play area | 出牌区域 | FFG 官方中文规则书用语；「进场」仍按 TERMS 惯用，仅「进入/附属到某玩家的出牌区域」「附属到你的出牌区域」处使用全称 |
| collection（search your collection） | 收藏 | ALeP 特有检索范围（全收藏而非牌库）；直译 |
| boons area | 恩惠区 | THo 比尔博机制；随 Boon=恩惠（既有裁决）派生 |
| first player token | 先手玩家标记 | MotR；直译 |
| Travel Action | 旅行行动 | TAP；随 Travel effect=旅行效果派生 |
| campaign mode | 战役模式 | TSotS 契约；通用语汇 |
| Ring-lord player | 持戒玩家 | TMoG 承担至尊戒的玩家；意译，可再议 |
| 译名类名（正文引用的遭遇卡/角色名） | 五军之战、湖上之人、丹恩的矮人、幽暗密林的精灵、大鹰、巨人之怒、窃贼、生日礼物、饥饿的生物 | THo/TSR 正文引用的备置卡名按通行译名意译 |

### 2.3 nameZh 新译名（33 张，随条目回填，供复核）

奥塞-波里-奥塞（Ose-bori-Ose，仿「悍-不里-悍」构词）、目光锐利的德鲁、采蘑菇者、德鲁-布里-德鲁、德鲁阿丹先知、戈尔贡猎手、淬毒飞镖、普克尔人像、酋长手杖、森林之主、幸运数字、没袋子罩得住我、隐行之人、鹰之宾客、熊之友、刺人的苍蝇、剪网者、溺毙朋友者、骑桶者、瑟罗尔的金杯、未戴帽子、成双成对、思乡、超越原有的约定、索林一行、飞贼大师、鹰来了！、加拉德瑞尔的赠礼、如星宝石、闪亮锁甲、斯卡萨的号角、挺拔身形、去往西方。

## 3. 处理惯例备注

- `** **` 加粗与 `\n` 换行原样保留；`<b>Response</b>: ` → `**响应：**`；特质引用（`<b><i>Trait</i></b>`）按 harad-em 范例加粗直写。
- RingsDB token（[willpower]/[attack]/[defense]/[threat]/[leadership]/[lore]/[spirit]/[tactics]/[baggins]/[fellowship]/[pp]）保持英文原样。
- 307023 源文中的 `<threat>` 为 RingsDB 模板 token（非 HTML 标签），原样保留。
- 「The One Ring」沿用 encounter-carddata 既有 nameZh 先例译「至尊戒」。
- 契约 A面/B面=Side A/B（既有裁决），写作「**A面**/**B面**」。

## 4. 歧义与存疑清单

1. **Devoted（献身）**：关键词规则含义需对照 ALeP 官方定义确认译名是否贴切（影响 CoE/FotE/MotR/TGoR/TGC/TSR 共 13 张）。
2. **Khand（坎德）**：译林附录作「坎德」，另有「可汗德」译法；SNiB 308004 特质栏用了「坎德」，请复核。
3. **Wose（伍斯）**：纯音译，若社区已有通行译法（如「德鲁人」）建议全局统一（影响 TBP 10 张特质栏+正文）。
4. **308010 Word of Persuasion**：原文 "attach … to a printed enemy engaged with you" 中 "printed" 语义存疑（疑为 RingsDB 模板残留），译文按「与你交战的敌人」处理，X 取「该敌人最高的印刷属性」保留 printed 语义。
5. **503014 Friend of Bears**：备置卡名 "Giant-sized Wrath" 译作「巨人之怒」，原意可能为「巨人量级的怒火」（某卡名），未查到该卡既有 nameZh，请复核。
6. **505009 Ring-bound Soldiers**：正文 "retreat X" 与「持戒玩家」为 TMoG 剧本机制，需与该循环遭遇侧译文统一（建议 team-lead 在批次6A/6C 报告中核对）。
7. **TBP 310075 Ose-bori-Ose**：仿「悍-不里-悍」的镜像构词名，音译「奥塞-波里-奥塞」，专名无官方译名。
8. **TSotS 500042 Into the West**：契约名译「去往西方」，若与 LOTR 通行曲名译法（如「西渡」）有社区惯例可再统一。
9. **THo 503007 恩惠区**：源文 "boons area" 与既有「恩惠(Boon)」特质语义相关但非同一区域，展示层如需区分可改「恩惠放置区」。
10. **THftD 40047**：Side A 原文行动标签 `Action:` 未加粗（源数据 `<b>` 缺失），译文按风格规范补为 `**行动：**`；Side A/B 之间的空行（`\n\n`）原样保留。
