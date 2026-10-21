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
| `category == Print on Demand` 或非 FFG 出版 | 支线剧情 |
| 其余（Cycles / Sagas / Revised Content） | 剧本模式 |

- 章节 = 目录里的 `group`；`Revised Content` 合并为一章「新版内容（Revised）」。
- 社区作品（A Long-extended Party / Tales from the Cards / Marc Lommert）带棕色「社区」角标。
- 只有基础版（`core`）与三个核心剧本标记为 `ready: true`，其余是 `ready: false` 的占位：
  封面灰度处理、点击提示「只是封面占位」，不会进入设置页，也不会创建对局。

## 加新条目

两种方式：

1. **有官方产品**：把新快照的 `products.json` 放进同一目录，重跑上面的命令即可。
2. **手写条目**：在 `app.js` 的 `CHAPTER_VIEWS` 里追加
   `{id, name, en, art, ready:false, meta}`，`art` 指向 `assets/products/…webp` 或 `assets/scenarios/<id>.webp`。

## 权益说明

产品封面版权归各自权利人，仅作离线原型展示；来源与原图链接保存在采集输出
（`products.json` / `products.html` / `products.csv`）中，不随本仓库分发。
