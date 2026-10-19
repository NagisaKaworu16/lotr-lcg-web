> 本文记录 v0.3 数据层。v0.7 已另增 planning-engine.js 与 planning-ui.js，实现阶段2适用规则；能力支持状态以 phase2-acceptance.md 为准。

# RingsDB API 接入说明 · v0.3

本次范围为原版基础版的英雄、盟友、附属、事件，不自动引入扩展牌或玩家支线任务。

## 端点

- API 说明：https://ringsdb.com/api/
- 接口文档：https://ringsdb.com/api/doc
- 本项目分包接口：https://ringsdb.com/api/public/cards/Core.json
- 单卡接口示例：https://ringsdb.com/api/public/card/01001

已通过真实网络请求核对。全卡接口与分包接口中的费用字段可能分别返回数值与数值字符串，不能直接假定类型一致。

## 字段映射

| API 字段 | 本地字段 | 处理 |
|---|---|---|
| code | code | 保持字符串，保留前导0 |
| name | name | 原始英文名；nameZh 为项目工作译名 |
| type_code | type | 仅接入 hero / ally / attachment / event |
| sphere_code | sphere | 保留领域代码 |
| threat | startingThreat | 仅英雄需要，缺失即拒绝；不是游戏中的探查威胁 |
| cost | cost | 数值字符串规范为整数；保留 X 和 -；英雄为 null |
| willpower / attack / defense / health | 同名 | 缺失保持 null，不填造0；英雄四项必须完整 |
| is_unique | isUnique | 必须为布尔值 |
| deck_limit | deckLimit | 构筑上限，区别于盒内张数 |
| quantity / packs[].quantity | quantity | 选用 Core 印刷的实物数量 |
| packs | printings | 记录重印归属，防止把新版数量当原版数量 |
| text | rulesText | 转为普通文本，保留规则符号；不作为可执行代码 |
| has_errata | hasErrata | 保留 API 的勘误标记；不另外猜测勘误 |

不保存背景故事 flavor 或卡牌美术。卡牌详情提供 RingsDB 原卡链接。英文规则版权归相应权利人；中文仅为工作译名，未宣称官方翻译。

## 数据与执行状态分离

每种牌均标记 `abilityStatus: data-only` 和 `abilityVersion: null`。即使牌本身没有印刷能力，也不会据此宣称已通过完整游戏引擎验证。

牌组校验返回 `automated: false`；开局保存英雄和所用非英雄牌的完整数据快照。更新卡库不改变已开局对局的数据。

本版不会解析英文句子来自动扣资源或造成伤害。后续必须用卡牌 code 对应经过测试的能力实现，再单独提升执行状态。

## 构筑校验

- 1–3名英雄，不能重复；多名玩家也不能选择同名英雄。
- 标准构筑至少50张非英雄玩家牌。
- 按 deckLimit 校验数量，不按原版盒内 quantity 错误限牌。当前没有“仅拥有一盒”的库存限制模式。
- 30张教学模式只允许四个原版预设的准确牌表与英雄；编辑后转为标准构筑。
- 缺少对应领域资源、同名独特英雄与盟友等情况显示提醒；这些限制不能代替后续打牌时的合法性校验。
- 导入支持公开牌组JSON的 slots 字段，不涉及账号授权或写入 RingsDB。

## 缓存与失败处理

- 随包提供本次验证过的73种基础版离线快照；正常启动不联网。
- 用户可点击“从RingsDB更新资料”。采用浏览器默认 HTTP 缓存，避免在10分钟内重复请求当前快照。
- 网络失败、超时、不完整牌表、重复code、类型异常均保持旧资料，不使用零值替代。
- 开发脚本 `node sync-ringsdb.cjs` 支持 Last-Modified 条件请求；校验成功后原子替换快照。
- 更新源快照后运行 `python3 build.py` 生成新的自包含 index.html。

快照并不保证随时包含出版方全部最新勘误；更新内容以 RingsDB 实际返回为准。
