# 魔戒 LCG · 中土远征 —— 跨设备交接记忆

> 导出时间：2026-10-22 18:24（本机 Windows 设备导出，供手机端云端任务接手用）
> 仓库：https://github.com/NagisaKaworu16/lotr-lcg-web.git
> 本地路径（Windows 机）：`C:\Users\Administrator\WorkBuddy\魔戒LCG`

## 一、当前状态速览（2026-10-22 18:23）

- **分支**：`feature/setup-cancel-scoring`，本地与远端完全一致（HEAD = `0e2d02c`）。
- **最新版本**：v0.15.29（对局桌面重塑：玩家状态条、探险进度条、叠影牌堆、BGA 式重叠手牌）。
- **已推送**：v0.15.22–v0.15.29 共 8 个提交已于 2026-10-22 18:13 推送（`a75dd32..0e2d02c`），无本地未推送提交。
- **测试**：432 项单元/DOM 测试全过；真实浏览器验收 11 个脚本全绿（layout 15/15、taskbar 22/22、对比度 0 问题、score 19/19、悬停 22/22、browser-check ok=true）。
- **远端分支**：main=`20c1611`（不动）、`feature/tabletop-ui-v0140`=9696fd0（旁支，止于 v0.15.17）、`feature/setup-cancel-scoring`=0e2d02c（工作分支）。

## 二、版本历史（v0.15.18 起）

| 版本 | 提交 | 内容 |
|---|---|---|
| v0.15.18–20 | 另一台设备 | 悬停放大预览、开局页可读性、开局逐张翻牌+意志考验/埃莉诺取消窗口、结算计分面板、`pending()` P0 修复 |
| v0.15.21 | `a75dd32` | APP_VERSION 单一常量 + 校验测试；补齐全套浏览器验收 |
| v0.15.22 | `83ddad1` | 悬停放大只给卡牌（`.card-face`/`.card-art`），剧本封面 `.ng-card-art` 不放大 |
| v0.15.23 | `5577764` | 修复「基础卡牌库」页签 ReferenceError（catalog()/filterCatalog() 被误删） |
| v0.15.24 | `c30ec43` | 卡牌库合并玩家卡（73 种 RingsDB）+ 战役卡（45+10），「玩家/战役/两者都」三档，密集名称列表 + details 展开注入卡图 |
| v0.15.25 | `633d164` | 删「英雄与玩家牌」页签，构筑器搬到「我的卡组」；`[data-hover-src]` 卡名悬停看图 |
| v0.15.26 | `452cbdb` | 悬停预览改 RingsDB 式小图：竖版 300 宽/横版 400 宽、只缩不放、高≤58% 视口、垂直居中 |
| v0.15.27 | `22344dd` | 卡牌库侧边系列导航（6 新版系列 + 15 旧版大盒，扩展占位面板） |
| v0.15.28 | `1878383` | 更名「卡牌」；pod 下拉筛选，三类分组计数；D.cards/D.quests 无印载扩展字段（补 pack 字段方案已写入 CHANGELOG） |
| v0.15.29 | `0e2d02c` | 对局桌面重塑：tabStats 状态条、.quest-progress 金色进度条、.pile 叠影牌堆、BGA 式重叠手牌（-58px，hover 上浮 18px，≤760px 平铺） |

## 三、关键约定（接手必读）

1. **技术栈**：纯 HTML/CSS/JS，无框架。`python build.py` 生成离线 index.html（内联 CSS/JS）——**改源码后必须重建并一起提交**。
2. **检查命令**：`python scripts/check_project.py`（构建 + 全部 *tests.cjs，需 Python3 + Node；测试文件在仓库根目录，不在 scripts/）。
3. **提交作者**：NagisaKaworu16 <108867159+NagisaKaworu16@users.noreply.github.com>（本机无全局 git 身份，用 `git -c user.name=... -c user.email=...` 指定）。
4. **推送纪律**：origin 只更新 `feature/setup-cancel-scoring` 分支，不建 PR、不合并 main；**每次推送必须获得用户当次明确授权**，历史授权不自动延续。
5. **分支红线**：`feature/tabletop-ui-v0140` 与 `feature/setup-cancel-scoring` 历史无关（后者是超集），**禁止 `git merge` 这两条历史**，回流按差异移植。
6. **交互红线**：点选只是 UI 草稿；全员二次确认才执行；即时响应不进暂定区；整桌撤销 ≠ 联机回退。
7. **测试绑定 DOM**（不可随意改名）：`.operation-dock`、`.public-table`、`.player-mat`、`.tabletop-rail`、`.player-tabs`、`.hand-zone .hand-card`、`.table-card`、`.card-face`、`.quest-progress`、`.pile`；所有 `data-action`（desktop/view/pick/submit、catSide/catView/catNav/catSection 等）。
8. **开局导航唯一稳定写法**（写浏览器脚本照抄）：`#playerCount` → `.ng-tabs` 点「新版扩展」→ `.ng-card` 点「基础剧本合集」→ `[data-action="ngNext"]` → `[data-action="chooserConfirm"]` → `keepHand` → `finishSetup`。
9. **Windows 构建坑**：build.py 产出的 index.html 是 CRLF，仓库内 LF，`git status` 显示 M 属正常噪声（.gitattributes 归一化），不要误判产物过期。
10. **CHANGELOG 编辑坑**：用 Edit 在顶部插新条目时，old_string 只含旧标题行会把旧标题吞掉——new_string 末尾必须还原旧标题。

## 四、本机环境（Windows 设备，手机上不适用但需知晓）

- Chrome 路径：`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`（验收脚本用 CHROME_PATH 指定）。
- playwright-core 在 `C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules`（NODE_PATH 指向）；浏览器脚本需沙箱外运行。
- 验收脚本：`scripts/` 下 11 个（check-layout/taskbar/contrast/score/card-hover/catalog/decks/history/setup-reveal、verify-local-art、browser-check），产物输出 `docs/browser-acceptance/` 与 `docs/catalog-tabs/`。
- 网络：境外站基本被墙，走本机代理 `http://127.0.0.1:7899`（curl -x / pip --proxy）；pip 清华源不可用，用 `pip install --proxy http://127.0.0.1:7899 -i https://pypi.org/simple`。
- 卡图本地化：assets/cards-en（1446）+ assets/cards-encounter（65），WebP q80 约 96MB，`local-image-map.js` 映射；新增图片先 fetch-card-images.py 再 optimize-card-images.py；map 的 key 必须是页面原始 URL。

## 五、数据结构要点

- 玩家卡：`RINGSDB_SNAPSHOT.cards`（73 种，有 packCode/packName/position，全 'Core'）。
- 战役卡：`D.cards` 45 种遭遇卡（84 张，7 个遭遇组 set）+ `D.quests` 10 张双面探险卡（id/name/stage/points/front/back）。**两者均无印载扩展字段**，entry.pod 回退 'Core'；补 `pack` 字段方案已写入 CHANGELOG（7 行映射表即可）。
- 卡牌库合计 128 种；`catalogStats().total` 动态统计页签数量，勿写死。

## 六、待办与方向

1. 用户上手验收 v0.15.29 对局桌面效果。
2. 跨阶段规则审计（I008）。
3. 联机对战为独立里程碑。
4. （可选）遭遇卡/探险卡补 `pack` 字段以支持按扩展筛选。
5. 工作区遗留：3 张 `docs/catalog-tabs/history-*.png` 时间戳截图差异，未提交（内容无实质变化）。

## 七、权威信息源

接手后按顺序读：`AGENTS.md` → `PROJECT_MEMORY.md` → `docs/memory/DECISIONS.md` → `docs/memory/ROADMAP.md`（已知问题看 `docs/memory/ISSUES.md`）；再 `git status --short` + 最近提交核对状态。
