# 魔戒LCG 网页版 · 项目长期笔记（WorkBuddy 工作区）

项目根：`C:\Users\Administrator\WorkBuddy\魔戒LCG`（即 Git 仓库根，分支 feature/tabletop-ui-v0140）。

## 权威信息源（每次接手先读）
1. `AGENTS.md` → `PROJECT_MEMORY.md` → `docs/memory/DECISIONS.md` → `docs/memory/ROADMAP.md`（涉及已知问题读 `docs/memory/ISSUES.md`）
2. `git status --short`、当前分支、最近提交
3. 交接记忆：WorkBuddy 聊天附件 `WORKBUDDY_LOTR_LCG_MEMORY.md`（含完整版本/授权状态表）

## 关键约定
- 纯 HTML/CSS/JS，`python build.py` 生成离线 index.html；改源码后必须重建并一起提交。
- 检查：`python scripts/check_project.py`（构建+全部 *tests.cjs，需 Python3+Node；tests 在仓库根目录而非 scripts/）。
- 提交作者沿用 NagisaKaworu16 <108867159+NagisaKaworu16@users.noreply.github.com>（本机无全局 git 身份，用 -c 指定）。
- v0.14.x 尚未上传远端：未经用户明确授权不 push、不建 PR、不合并 main；历史授权不自动延续。
- 交互红线：点选只是 UI 草稿；全员二次确认才执行；即时响应不进暂定区；整桌撤销≠联机回退。

## 本机环境（2026-10-20）
- 本机 Chrome：`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`（155.0.8059.84）；Edge 也在 x86 目录。
- playwright-core 装在 `C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules`；运行浏览器脚本需 NODE_PATH 指向它，且沙箱会拦截浏览器进程（需沙箱外运行）。
- 浏览器验收脚本：`scripts/browser-check.cjs` → 输出 `docs/browser-acceptance/`。
- 网络：境外站基本被墙（github/jsdelivr 不通），ringsdb.com/hallofbeorn.com 也不通；可用通道是本机代理 `http://127.0.0.1:7899`（curl -x / pip --proxy）。curl 测连通性需沙箱外运行。
- pip：清华源不可用，用 `pip install --proxy http://127.0.0.1:7899 -i https://pypi.org/simple`；Pillow 在 venv `C:/Users/Administrator/.workbuddy/binaries/python/envs/default`。

## 卡图本地化（v0.14.2，2026-10-20）
- ringsdb/hallofbeorn 在线图已全部镜像：assets/cards-en（1446）＋assets/cards-encounter（65），WebP q80，约 96MB；`local-image-map.js` 映射，image-ui.js safeUrl 优先本地。
- 维护：新引用图片后先 `scripts/fetch-card-images.py --proxy http://127.0.0.1:7899` 再 `scripts/optimize-card-images.py`（venv python，含 Pillow）；map 的 key 必须是页面原始 URL，勿按文件名重建。
- 浏览器图片验证：`scripts/verify-local-art.cjs`（要求外网图片请求为 0）。

## 进度快照（2026-10-20）
- v0.14.1：真实浏览器验收完成（14项检查通过），派遣提交自动切换视图，提交 c497e39。
- v0.14.2：卡图全量本地化完成，389项测试通过，提交 90de561。
- 待办：用户上手验收 → 安都因/多尔哥多开局取消窗口迁移 → 完整计分 → 跨阶段规则审计（I008）→ 联机为独立里程碑。
