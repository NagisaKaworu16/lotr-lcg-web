# zh-overrides — 中文卡名覆盖层

## edge-translation.json / edge-pack.json

- **来源**：用户提供的《魔戒網頁工具 v3.6》浏览器扩展（银星计划 EDGE 扩展，2026-11 由用户提供 zip 解包）。
- **edge-translation.json**：EN→CN 名称映射 1068 条，混含卡名、特质、包名（按页面名翻译，同名卡共用同一译名）。
- **edge-pack.json**：银星 ALeP 各弹 `pack.code`/`pack.name` + `cards`（RingsDB 数字 code → 中文名），玩家卡侧。
- **用途**：`scripts/fetch-card-data.py` / `scripts/fetch-encounter-data.py` 产出 carddata 后的 nameZh merge 来源之一。匹配顺序：code 精确 → 规范化英文名（小写、去非字母数字）。
- **覆盖实测**（对本仓库数据集）：玩家卡 1038/1315 ≈ 78.9%；遭遇侧极弱（location 1/981、enemy 16/890、treachery 4/811、quest 10/517）。遭遇卡中文需后续另寻数据源或人工补录。
- **注意**：translation.json 含特质/包名等非卡名条目，merge 时只对能命中卡牌名的条目写 nameZh，不要把特质译名写进卡名字段。
