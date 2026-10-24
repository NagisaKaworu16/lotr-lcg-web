# 路线与验收

| 工作 | 状态 | 验收依据 |
| --- | --- | --- |
| 组牌、起始手牌、资源阶段 | 已实现 | opening-tests、player-tests |
| 第二阶段计划、支付与能力 | 已实现 | planning-tests、phase2-acceptance |
| 第三阶段探险、交流缓冲 | 已实现 | quest-tests、phase3-acceptance |
| 第四阶段旅行 | 已实现，待用户继续验收 | travel-tests、phase4-acceptance |
| 项目记忆与 Git | 已整理，完整项目导入私有工作分支 | AGENTS、PROJECT_MEMORY、Git工作流 |
| 第五阶段遭遇 | 已实现，待验收 | engagement-tests、phase5-acceptance |
| 第六阶段战斗 | 已实现，待验收 | combat-tests、phase6-acceptance |
| 第七阶段刷新 | 已实现，待用户验收 | refresh-tests、phase7-acceptance |
| 智能普通行动窗口 | 已实现，待用户验收 | window-tests、window-acceptance |
| 桌面交互改版 | 已实现并通过四条需求验收（v0.14.5） | tabletop-acceptance、check-taskbar、planning-dom-tests |
| 真实浏览器验收（桌面） | 已完成（2026-10-20，Chrome 155 无头） | tabletop-acceptance、docs/browser-acceptance |
| 开局取消窗口迁移 | 已完成（2026-10-21）：安都因／多尔哥多改为逐张翻开逐张结算，意志考验／埃莉诺获得合法响应窗口 | setup-reveal-tests、check-setup-reveal（多种子 13 项）、planning-dom-tests（待结算面板回归） |
| 完整结算计分 | 已完成（2026-10-21）：威胁＋回合×10＋淘汰×100＋英雄伤害−胜利点，含分项明细与评级 | score-tests、check-score、planning-dom-tests |
| 牌组导入与组卡器 | 我的卡组页、开局选牌、文本/URL 导入、回填原牌组、分享链接（URL hash 自包含）已完成（2026-10-22）；扩展卡池待做 | player-cards.encodeDeck/decodeDeck、deck-share-tests、check-deck-share、player-tests |
| 卡牌库系列包筛选 | 已完成（2026-10-22）：玩家卡用 packCode，遭遇卡与探险卡补齐 `pack` 字段（基础版 55 张为 Core），三类分组与计数自动跟随 | pack-data-tests、check-catalog、planning-dom-tests |
| 新游戏流程（四页签产品墙） | 已接入 165 项封面墙；新版扩展一系列一条，旧版扩展按「大盒 → 6 个剧本」两级展开；连续剧本跨剧本推进、战役恩惠负担待做 | app.js newGame、planning-dom-tests、check-catalog-tabs、check-legacy-packs |
| 单屏桌面布局（BGA 式左桌右栏） | 已完成（2026-10-23，v0.15.41）：锁定 100vh 单屏不滚动，四区网格 `table/dock/mat/rail`，1920×1080 / 1600×900 / 1440×900 / 1366×768 五区全在视口内；终局计分总分不折叠；窄屏 ≤1279 退回单列 | check-onescreen、check-layout、check-taskbar、check-score |
| 联机 | 后续独立里程碑 | 服务器、身份、私密手牌、断线恢复与操作版本 |

桌面真实浏览器验收已完成；开局取消窗口迁移与完整计分已于 2026-10-21 完成；单屏布局改版于 2026-10-23 完成（纯 CSS 重排，未动 DOM 与规则引擎）。当前优先收集用户上手反馈，并审计跨阶段规则的卡牌时点。新增功能放到独立分支，保留已验证基线。
