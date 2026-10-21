# 新游戏的剧本与产品封面

「新游戏」页的每一张卡都是一条 **产品/剧本条目**，封面来自 Hall of Beorn 官方目录快照，
由 `scripts/import-product-catalog.py` 离线导入，仓库内不联网也能显示。

## 数据与文件

| 路径 | 作用 |
|---|---|
| `product-catalog.js` | 生成文件：180 条产品，按页签与章节分好组（无需手改） |
| `assets/products/<slug>.webp` | 产品封面，长边 ≤520，q82，共约 2.3MB |
| `assets/scenarios/<id>.webp` | 可选：覆盖「可玩剧本」的封面（缺省用文字占位） |
| `scripts/import-product-catalog.py` | 导入脚本（Pillow，需 venv） |

## 重新导入 / 更新

```bash
"C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe" \
  scripts/import-product-catalog.py --source "C:/Users/Administrator/Downloads/lotr-lcg-products"
python build.py
```

目录里 `products.json` 的 `status` 必须为 `ok`，脚本会跳过失败项并在结尾打印统计。

## 分组规则（脚本内）

| 判断 | 页签 |
|---|---|
| 产品编号命中 `pod-manifest.json` | 支线剧情（按 `type` 分「官方 POD」／「ALeP 自制独立作品」） |
| `base in POD_OVERRIDES`（manifest 缺失时的后备） | 支线剧情 |
| `category == Nightmare Decks` | 噩梦包 |
| `category == Print on Demand` | 支线剧情 |
| 非 FFG 出版（社区） | 旧版扩展（社区循环同样是大盒 + 冒险包） |
| `category == Revised Content` | 新版扩展 |
| 其余（Cycles / Sagas） | 旧版扩展 |

- 新版扩展 / 旧版扩展 / 支线剧情 / 噩梦包 四个页签，共 164 条。
- **支线剧情由 `pod-manifest.json` 定义**（来源 `lotr-pod-workbuddy/pod-import.json`）：官方 POD 14 项
  + ALeP 自制独立作品 5 项 + 你指定保留的黑森林之黯（MEC102）= 20 项。清单外的官方 POD 特性与社区作品
  不会进入这个页签；预购特典（`Preorder Promotion`）一律跳过，因为不含新剧本。
  清单里目录没采集到的条目（加拉德瑞尔之镜）会自动补录：先在 `assets/products/pod-the-mirror-of-galadriel.webp`
  放好封面就用它，没有则 `art` 留空走缺图占位。
- **旧版扩展每个系列只出一条**：一个循环重制成「英雄扩展 + 战役扩展」两盒，剧本只在战役盒里，
  所以英雄盒直接跳过（`HERO_RE`），条目落在战役盒上，标题用系列名（如「安格玛觉醒」）、
  副标题用系列英文名（`Angmar Awakened`），点击后对应的是战役盒。传奇扩展（魔戒同盟等）本来就是单盒，不受影响。
  `assets/products/` 里仍保留英雄盒封面，以后要恢复成两条时可以直接引用。
- 跳过 `SKIP_NAMES`：`Revised Core Set`、`Core Set`（两个核心包都等于现在的基础游戏）、`Dwarves of Durin`、
  `Elves of Lórien`、`Defenders of Gondor`、`Riders of Rohan` —— 基础版本身在页面里以「基础剧本合集」出现。
- **没有大盒的循环**：导入脚本给每个 legacy 章节写 `box`（大盒 id，首项被跳过时为 `null`）与 `key`。
  核心包被移除后，「黑森林的魔影」这一章 `box` 为 null，`legacySeries()` 就用章节名当系列名、封面取第一个剧本，
  承载剩下的 6 个冒险包；其它章节仍按 `box` 找大盒。判定逻辑不要改回「首项即大盒」。
- 章节 = 目录里的 `group`，`GROUP_ZH` 给出中文章名；噩梦包章节统一为「噩梦 · <循环名>」，
  社区作品统一加「社区 · 」前缀。
- 只有基础版（`core`）与三个核心剧本标记为 `ready/playable: true`，其余是占位：
  点击剧本会提示「只是封面占位」，不会创建对局。

## 加新条目

两种方式：

1. **有官方产品**：把新快照的 `products.json` 放进同一目录，重跑上面的命令即可。
2. **手写条目**：在 `app.js` 的 `CHAPTER_VIEWS` 里追加
   `{id, name, en, art, ready:false, meta}`，`art` 指向 `assets/products/…webp` 或 `assets/scenarios/<id>.webp`。

## 用 PDF 首页做封面

官方目录快照里的封面只有 235×235（近方形），放进 3:4 的封面框会被裁得很厉害。
战役书 PDF 的第一页就是完整竖版封面，可以直接拿来替换：

```bash
"C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe" \
  scripts/extract-pdf-covers.py --source "C:/Users/Administrator/Downloads"
```

- 渲染首页（200 dpi）→ 居中裁成 3:4 → 390×520 WebP q85 → 覆盖 `assets/products/<slug>.webp`。
- 裁剪方向自适应：原图偏宽裁左右，偏高裁上下；永远不放大。
- 映射写在脚本的 `MAPPING` 里（PDF 文件名 → 产品 slug）：

| PDF | 目标 slug |
|---|---|
| `安格玛觉醒.pdf` | `Angmar-Awakened-Campaign-Expansion` |
| `逐梦者.pdf` | `Dream-chaser-Campaign-Expansion` |
| `埃瑞德米斯林.pdf` | `Ered-Mithrin-Campaign-Expansion` |

**注意**：`import-product-catalog.py` 只在目标文件不存在时才转换图片，所以重跑导入不会把这几个封面还原成官方盒图；
真要还原，删掉对应的 `.webp` 再跑导入脚本。PDF 本身不入库（体积大且受版权保护），仓库只保存裁好的 WebP。

## 权益说明

产品封面版权归各自权利人，仅作离线原型展示；来源与原图链接保存在采集输出
（`products.json` / `products.html` / `products.csv`）中，不随本仓库分发。

## 旧版扩展：一个大盒 → 其中 6 个剧本

旧循环在目录里是「一个大扩展 + 6 个冒险包」，界面按诡镇奇谈的做法拆成两级（`app.js` 的 `legacySeries()`）：

1. **列表页**只显示大扩展（11 个）。每个循环取目录分组里除促销品外的第一项作为大盒，
   其余条目成为它里面的剧本。副标题写「英文名 · 循环名 · N 个剧本」。
2. **设置页**左侧是扩展封面与名称，右侧是名称／人数／剧本类型／难度／高级设置。
   剧本类型为**完整剧本**时不显示剧本列表，默认从该扩展的第一个剧本开始；切到**单场冒险模式**
   才会在下方横跨整行显示「选择冒险」封面网格，点一张封面即切换剧本。

规则：

- `PACK_SKIP` 过滤掉 `Preorder Promotion` 与 `Two-Player Limited Edition Starter` —— 都不含新剧本。
- 剧本网格只在「单场冒险模式」下出现；「完整剧本」默认取 `packs[0]`，不渲染列表。
- 剧本是否可玩由条目自身的 `playable` 决定：只有基础版三个剧本为 `true`，
  其余是占位，卡片标「待实现」，点「下一步」会拦下并提示。
- 传奇扩展（霍比特人／魔戒）同样适用：首盒当大盒，其余盒成为它里面的剧本
  （霍比特人 1 个、魔戒 5 个），因为它们是按顺序推进的一串剧本。
- 基础剧本合集的三个剧本由 `CORE_SERIES`（`seriesById('core')`）提供；支线剧情页签不再重复这三个剧本。

验收：

```bash
NODE_PATH="<node workspace>/node_modules" node scripts/check-legacy-packs.cjs
```

检查大扩展数量（11）、每个系列的剧本数（6）、封面解码、横向溢出，
以及基础三剧本在单场模式下仍全部可选。结果写入 `docs/catalog-tabs/`。

## 中文译名

`product-zh.json` 保存「英文原名（去掉 MECxx 编号）→ 中文工作译名」的映射，导入脚本按以下顺序解析：

1. 原名精确匹配；
2. 噩梦包后缀（`Nightmare Deck / Decks / Product`）→ 取基础名译名 + 「· 噩梦」；
3. 预购特典后缀（`Preorder Promotion`）→ 基础名 + 「（预购特典）」；
4. 都没有则留空，界面回退显示英文原名。

当前覆盖率 165/165。卡片标题显示中文，副标题用去编号的英文名（新版扩展的系列名，如 `Angmar Awakened`；
完整产品原名与 `MECxx` 编号保留在卡片的 `title` 悬停提示里），便于和官方产品对照。
译名以**银星计划**（魔戒 LCG 中文制作组，ringsdb 中文插件所用的那套）为准，即重置版／文景版体系：
Galadriel→加拉德瑞尔、Khazad-dûm→卡扎督姆、Osgiliath→欧斯吉力亚斯、Isengard→艾森加德、
Isengard 之声→艾森加德之声、The Lost Realm→失落的王国、A Shadow in the East→东方魔影、
The Shire's Reckoning→夏尔纪年、The Siege of Erebor→埃瑞博防卫战、The Hunt for the Dreadnaught→追捕无畏号。
循环名同步为黑森林的魔影／矮人故乡／对抗魔影／铸戒者／哈拉德人／魔多的复仇，
社区循环为洛希尔人的誓言／酷夏之劫。
要改某个名字，直接编辑 `product-zh.json` 再重跑导入脚本即可。

## 验收

```bash
NODE_PATH="<node workspace>/node_modules" node scripts/check-catalog-tabs.cjs
```

真实 Chrome 打开 index.html，在 1440 / 768 两档宽度下逐页签检查：页签标签、章名、
各章条目数、可玩/锁定/社区角标计数、封面解码失败数、横向溢出、外网请求数。
结果写入 `docs/catalog-tabs/`（截图 + report.json）。
