# 项目记忆与 Git 使用方法

## 继续开发

告诉助手：“读取 AGENTS.md 和 PROJECT_MEMORY.md，检查 Git 状态后继续魔戒 LCG 项目。”无需重述全部聊天。这些文件记录进度和决定，Git记录实际代码变化；两者结合才能恢复上下文。ChatGPT聊天记忆不能代替文件或代码备份。

## 常用命令

在解压后的项目目录中打开终端。项目可直接打开 index.html，只有开发检查需要 Python 与 Node。

```bash
git status --short
git log --oneline --decorate -8
git switch -c feature/phase5-encounter
python scripts/check_project.py
git diff
# 只加入本次改动的文件，检查后提交
git add <本次文件>
git commit -m "feat: implement encounter phase checks"
```

修复用 `fix/...`；阶段功能用 `feature/...`。每次提交一起更新受影响的项目记忆、验收说明、测试和生成页面。阶段验收完成后打版本标签，版本号不得指向不同内容反复移动。

## 当前历史与远端同步

私有仓库：`NagisaKaworu16/lotr-lcg-web`。当前完整项目在 `codex/project-memory-v090`，通过草稿PR审查；未合并之前，main 仍只有原始剧本资料。同步详情见 REMOTE_STATUS.md。

在新电脑上恢复当前工作版本：

```bash
git clone --branch codex/project-memory-v090 https://github.com/NagisaKaworu16/lotr-lcg-web.git
cd lotr-lcg-web
python scripts/check_project.py
```

已有克隆先获取远端状态，再切换工作分支。不要把旧独立初始化的 main 强推上去。后续开发应从这个已验证工作版本创建 feature 或 fix 分支；合并导入PR后再以最新 main 为起点。

导入继承原 main 8次提交历史，原4份剧本／术语资料保留。首次本地 v0.9.0 快照及其后管理提交保留在 archive/local-v090-import 和原 Git bundle，不伪造成更早的远端开发历史。v0.9.0 标签属于本地备份基线，GitHub发行标签待后续版本流程创建。

当前会话使用 GitHub 连接接口进行同步；终端仍需单独的 Git HTTPS 凭据才能直接 push。远端推送、PR审查、合并是不同动作，分别核验结果。

## 回退和恢复

- 游戏内“回退一步”恢复一份对局状态；Git回退改变代码，两者独立。
- 查看旧版可用 `git switch --detach v0.9.0`，返回 `git switch main`。切换前保持工作目录干净。
- 已共享的错误提交优先用 `git revert <提交号>` 建立反向提交，不改写公共历史。
- 如收到 Git bundle，可 `git clone lotr-lcg-history.bundle lotr-lcg-web` 恢复完整本地提交与标签，再查看此文档。
- 不把临时会话目录当作唯一备份；保留下载包、bundle或已同步的远端版本。
