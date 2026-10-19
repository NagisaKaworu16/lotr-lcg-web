# GitHub 同步与版本来源 · 2026-10-19

目标：私有仓库 `NagisaKaworu16/lotr-lcg-web`。

## 当前导入分支

`codex/project-memory-v090` 包含 v0.9.0 完整项目、73张本地基础卡图和项目记忆。通过草稿PR审查；本次上传不会自动合并 main。实际分支、PR及合并状态以 GitHub 页面为准：

- 分支：https://github.com/NagisaKaworu16/lotr-lcg-web/tree/codex/project-memory-v090
- 差异：https://github.com/NagisaKaworu16/lotr-lcg-web/compare/main...codex/project-memory-v090

导入以原 main 提交 `20c16114e55572a57d4567ef0ae96f343557a113` 为祖先，保留原8次提交历史，以及根目录4份剧本／术语文件的原始字节。不是用独立初始化的本地 main 强推覆盖远端。

## 授权与前次准备

前次少量准备对象上传后，自动审批因缺少图片及目标仓库的明确授权而停止后续卡图上传，未修改分支文件树。2026-10-19 用户已明确同意将当前源码和73张基础卡图上传到上述私有仓库，随后继续完成导入。此授权不包含把仓库改为公开或自动合并 main。

## 本地历史与恢复

导入前的独立本地快照保留于 `archive/local-v090-import` 分支和先前交付的 Git bundle；`v0.9.0` 标签是该本地游戏基线，不代表 GitHub 已创建同名发行标签。导入完成后的日常开发使用与远端一致的工作分支及祖先历史。

当前会话通过已连接的 GitHub 接口写入远端；终端仍没有独立的 Git HTTPS 登录凭据。不能把远端写入成功理解成终端 `git push` 已经登录。以后在自己的电脑或其他环境克隆私有仓库，须使用有仓库访问权限的 Git 连接。

验证：本地构建与243项规则／模拟DOM测试通过；73张卡图的 Git 内容哈希与远端上传对象一致。真实浏览器视觉验收及联机尚未完成。
