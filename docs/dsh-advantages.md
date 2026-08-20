# 对标 DeepSeek Harness：只吸收的优点

本仓库吸收 dsh 的架构优点，刻意不搬其问题面（肥 God Service、多层 profile 叠层、贡献闸门税等）。

## 吸收的优点

1. **一切皆插件 + 服务键依赖** — 能力通过 `ctx.plugin` 挂载，依赖 `inject` 服务键而非具体实现。
2. **Append-only session 为模型历史权威** — `deriveMessages` 从日志投影；模型可见即已记录。
3. **可替换 Agent loop factory** — `ctx.agentLoop.setFactory` 换策略，agents 句柄/inbox 不变。
4. **Capability seam（先做 shell）** — `ctx.shell` 定义接口，`setRunner` 换实现，`bash` tool 只消费接口。
5. **Tools 管线 + waterfall/guard 审批** — 敏感工具 hold；超时默认 deny。
6. **System prompt 分段组装** — 插件 `register` 段；每 turn 只写一次 `system/prompt`。
7. **事件分流雏形** — session / agent / capability 三域；不引入完整配置操作系统。
8. **Subagent 组合** — 默认空会话；`inherit` 时 `sessions.fork`。
9. **MCP / terminal 可编排面** — list/call/addStdio/remove；terminal open/write/read/close。
10. **Web：session/event 投影对话** — 浏览器不持能力；线程从 append-only 日志投影 user / assistant / tool 节点；LLM SSE 增量 `assistant/chunk` 经 WS 实时投影。
11. **Web：agents 驱动输入** — 发送走 `/api/sessions/:id/messages`，可取消；WS 收 `session` / `agent` / `approval`。
12. **Web：审批可观察** — hold 待批出现在 composer dock，允许/拒绝回调 host。
13. **Web 壳对标 dsh 观感** — 最左 **模块轨**（Agent / Workspace…）；Agent 模块内再挂 Sessions 侧栏 + Chat hero / Trajectory；演示插件进 Settings modal。
14. **Web：可恢复会话列表 + 真 New Session / Fork** — `GET /api/sessions` 列出会话；Agent 侧栏切换 `load`；Fork 走 `POST /api/sessions/:id/fork`。
15. **Web：Trajectory 事件账本** — Chat/Trajectory 可切换；`projectTrajectory` 从 append-only 日志投影；点击行打开事件详情；`assistant/message` 详情用 `deriveMessages(seq 前缀)` 投影本步 request（不另持久化 messages 快照）与 response；工具行可 `inspectCall` 跳到对应 seq 并高亮；provider `usage` 写入事件并显示。
16. **Web：Chat Markdown** — 用户/助手气泡用 `react-markdown` + `remark-gfm` 渲染。
17. **Web：审批 mode + 重水合** — `auto`/`hold` 可切换；启动与 `load` 时 `GET /api/approvals` 恢复 pending，不只依赖 WS。
18. **Web：运行中 Steer/inject** — agent 忙时输入仍可用，`kind: 'inject'` 入队，不搬完整 QueueDock。
19. **Web：React Router（单向）** — `/` · `/s/:id` · `/s/:id/trajectory` · `/workspace`；URL → `applyRoute`；跳转只用 `Link`/`navigate`，无双向 bridge。
20. **Web：应用模块轨** — Agent 仅为模块之一；切到 Workspace 等其它模块不卸载 session 投影，切回 Agent 会话仍在。

## 功能级差异（相对官方 client，优点对齐后）

| 能力 | 本仓 | 官方 | 策略 |
|---|---|---|---|
| 会话列表 / New / Fork | 有 | 有 | 已对齐（瘦） |
| Chat 事件投影 | 有 | ConversationNode | 已对齐（瘦投影） |
| Trajectory 账本 + inspect | 有 | ui-trajectory | 已对齐（无虚表） |
| 审批 dock + mode | 有 | Permission + ApprovalPanel | 已对齐（瘦） |
| 运行中 inject | 有 | steer/queue | 已对齐（无队列编辑 UI） |
| Trajectory 虚表/搜索 | 无 | 有 | **不吸收** |
| Workspace dock | 无 | ui-workspace | **不吸收** |
| Goals / Plan / Attachments | 无 | 对应 ui-* | 需 host 域；暂不吸收 |
| Jobs / Subagent 导航 | host 有、Web 薄 | ui-jobs / ui-subagent | 后续可选薄面 |

## 刻意不吸收

多层 profile/bundle/patch、巨型 ToolRuntime、符号后门调度、仓库级 verify 矩阵、完整 ConversationNode 引擎 / `__DSH_BOOT__` 动态 client 包 / Trajectory 虚表与工作区 dock。扩展继续用薄 Service + 单测证明。
