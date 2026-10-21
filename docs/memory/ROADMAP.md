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
| 开局取消窗口迁移 | 待做 | 安都因／多尔哥多开局 |
| 牌组导入与组卡器 | 我的卡组页、开局选牌、文本/URL 导入已完成；内嵌组卡器回填、扩展卡池与分享链接待做 | player-cards.parseTextDeck/fromRingsdb、player-tests |
| 新游戏流程（四页签产品墙） | 已接入 175 项封面墙，分新版扩展／旧版扩展／支线剧情／噩梦包；连续剧本跨剧本推进、战役恩惠负担待做 | app.js newGame、planning-dom-tests、check-catalog-tabs |
| 联机 | 后续独立里程碑 | 服务器、身份、私密手牌、断线恢复与操作版本 |

桌面真实浏览器验收已完成；当前优先收集用户上手反馈，同时迁移安都因／多尔哥多开局取消窗口、补完整计分并审计跨阶段规则。新增功能放到独立分支，保留已验证基线。
