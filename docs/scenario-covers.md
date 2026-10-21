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
| `category == Nightmare Decks` | 噩梦包 |
| `base in POD_OVERRIDES`（如 `The Dark of Mirkwood`） | 支线剧情 |
| `category == Print on Demand` 或非 FFG 出版 | 支线剧情 |
| `category == Revised Content` | 新版扩展 |
| 其余（Cycles / Sagas） | 旧版扩展 |

- 新版扩展 / 旧版扩展 / 支线剧情 / 噩梦包 四个页签，共 175 条（另 5 条被跳过）。
- 跳过 `SKIP_NAMES`：`Revised Core Set`（即现在的基础游戏）、`Dwarves of Durin`、`Elves of Lórien`、
  `Defenders of Gondor`、`Riders of Rohan` —— 基础版本身在页面里以「基础剧本合集」出现，不再重复列出。
- 章节 = 目录里的 `group`，`GROUP_ZH` 给出中文章名；噩梦包章节统一为「噩梦 · <循环名>」，
  社区作品统一加「社区 · 」前缀。
- 只有基础版（`core`）与三个核心剧本标记为 `ready: true`，其余是 `ready: false` 的占位：
  点击提示「只是封面占位」，不会进入设置页，也不会创建对局。
- `ready: true` 的剧本没有产品封面时，`POD_READY` 会取各剧本第一张探险卡正面图作封面。

## 加新条目

两种方式：

1. **有官方产品**：把新快照的 `products.json` 放进同一目录，重跑上面的命令即可。
2. **手写条目**：在 `app.js` 的 `CHAPTER_VIEWS` 里追加
   `{id, name, en, art, ready:false, meta}`，`art` 指向 `assets/products/…webp` 或 `assets/scenarios/<id>.webp`。

## 权益说明

产品封面版权归各自权利人，仅作离线原型展示；来源与原图链接保存在采集输出
（`products.json` / `products.html` / `products.csv`）中，不随本仓库分发。

## 中文译名

`product-zh.json` 保存「英文原名（去掉 MECxx 编号）→ 中文工作译名」的映射，导入脚本按以下顺序解析：

1. 原名精确匹配；
2. 噩梦包后缀（`Nightmare Deck / Decks / Product`）→ 取基础名译名 + 「· 噩梦」；
3. 预购特典后缀（`Preorder Promotion`）→ 基础名 + 「（预购特典）」；
4. 都没有则留空，界面回退显示英文原名。

当前覆盖率 175/175。卡片标题显示中文，英文原名作为副标题保留，便于和官方产品对照。
译名以**魔戒中文维基译名表**为准（如 Carrock→卡尔岩、Rhosgobel→罗斯戈贝尔、Erech→埃瑞赫、
Wainriders→战车民、Tharbad→沙巴德、Carn Dûm→卡恩督姆、Nurn→努尔恩、Osgiliath→欧斯吉利亚斯）。
要改某个名字，直接编辑 `product-zh.json` 再重跑导入脚本即可。

## 验收

```bash
NODE_PATH="<node workspace>/node_modules" node scripts/check-catalog-tabs.cjs
```

真实 Chrome 打开 index.html，在 1440 / 768 两档宽度下逐页签检查：页签标签、章名、
各章条目数、可玩/锁定/社区角标计数、封面解码失败数、横向溢出、外网请求数。
结果写入 `docs/catalog-tabs/`（截图 + report.json）。
