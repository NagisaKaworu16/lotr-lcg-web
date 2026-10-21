# 剧本封面（占位与替换）

「新游戏」页的封面卡按 **文件名 = 剧本 id** 读取，放在 `assets/scenarios/`：

```
assets/scenarios/
  core.webp                 ← 基础剧本合集
  shadow-of-mirkwood.jpg    ← 暗影中的魔窟（合集卡）
  the-hunt-for-gollum.webp  ← 支线：希尔凡精灵的猎杀
```

- 支持 `.webp` → `.jpg` → `.png` 自动回退；都找不到时显示内置文字占位（不会破图）。
- 建议尺寸 **1200×750（16:10）**，或 1000×625；单张 ≤ 300KB。
- 不需要改代码：文件放对位置、刷新页面即可生效；`python build.py` 不会内联图片，仍随 assets 目录分发。

## 当前占位 id 清单

### 剧本模式（合集卡）
| id | 名称 |
|---|---|
| `core` | 基础剧本合集（已可玩） |
| `shadow-of-mirkwood` | 暗影中的魔窟（占位） |
| `khazad-dum` | 卡兹杜姆（占位） |

### 支线剧情（Pod）
已可玩（无需封面也会显示名称占位）：`mirkwood`、`anduin`、`dolguldur`

占位待做：
`the-hunt-for-gollum`、`conflict-at-the-carrock`、`a-journey-to-rhosgobel`、
`the-hills-of-emyn-muil`、`the-dead-marshes`、`return-to-mirkwood`、
`into-the-pit`、`the-seventh-level`、`flight-from-moria`

## 新增更多占位

编辑 `app.js` 里的 `POD_FUTURE` / `CAMPAIGN_CHAPTERS`：加一行 `['id','中文名','English Name']`
（或章节对象），id 与封面文件名保持一致即可。未设置 `ready` 的条目自动渲染为灰色占位、点击提示「即将推出」。
