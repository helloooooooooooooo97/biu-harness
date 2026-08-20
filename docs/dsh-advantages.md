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
13. **Web 壳对标 dsh 观感** — 最左 **VS Code 式 Activity Bar**（纯图标切换 Agent / Workspace…）；Agent 下再挂 Side Bar（Sessions）+ Chat / Trajectory；演示插件进 Settings modal。
14. **Web：可恢复会话列表 + 真 New Session / Fork** — `GET /api/sessions` 列出会话；Agent 侧栏切换 `load`；Fork 走 `POST /api/sessions/:id/fork`。
15. **Web：Trajectory 事件账本** — Chat/Trajectory 可切换；`projectTrajectory` 从日志投影结构化行（**跳过** `assistant/chunk`，对齐 dsh：chunk 只服务 Chat 流式，message 为权威）；点击行打开事件详情；`assistant/message` 详情用 `deriveMessages(seq 前缀)` 投影本步 request；工具行可 `inspectCall`；`usage` 写入事件并显示。客户端 `compactSessionEvents` / ingest 合并连续 chunk，避免轨道与重渲染被 delta 淹没。
16. **Web：Chat Markdown** — 用户/助手气泡用 `react-markdown` + `remark-gfm` 渲染。
17. **Web：审批 mode + 重水合** — `auto`/`hold` 可切换；启动与 `load` 时 `GET /api/approvals` 恢复 pending，不只依赖 WS。
18. **Web：运行中 Steer/inject** — agent 忙时输入仍可用，`kind: 'inject'` 入队，不搬完整 QueueDock。
19. **Web：React Router（单向）** — `/` · `/s/:id` · `/s/:id/trajectory` · `/workspace`；URL → `applyRoute`；跳转只用 `Link`/`navigate`，无双向 bridge。**单壳常驻**：路由变化不卸载 `AppShell`；Agent/Workspace 与 Chat/Trajectory 用保活叠层（`visibility`，避免 `display:none` 丢掉大 Markdown 布局）；slot props / `renderSlot` 稳定 + Chat/Markdown `memo`，避免切换时重解析。
20. **Web：Activity Bar 模块切换** — Agent 仅为其中一个视图；切到 Workspace 等其它页不卸载 session 投影，切回 Agent 会话仍在；Settings 挂在 Activity Bar 底部。
21. **Web：Session 绑定本地项目文件夹** — Agent Chat 右侧 Project 面板 `Open folder`（File System Access API）；文件夹名写入 session.project，句柄按 sessionId 存 IndexedDB；可浏览/编辑/保存文本文件。
22. **Agent mode（Standard / Minimal）** — Settings 可选；`minimal` 对齐 dsh：模型侧只暴露 `bash` + `str_replace_editor`（view/create/str_replace/insert）；模式写入 `.cordis/chat-config.json`，`tools.schemas()` / `names()` / `invoke` 统一过滤。
23. **Session 绑定 host 工作区（对齐 dsh）** — Project 点 Open folder 弹出系统选目录对话框并自动绑定；该 Session 的 bash / str_replace_editor 直接以该目录为 cwd。

## 功能级差异（相对官方 client，优点对齐后）

| 能力 | 本仓 | 官方 | 策略 |
|---|---|---|---|
| 会话列表 / New / Fork | 有 | 有 | 已对齐（瘦） |
| Chat 事件投影 | 有 | ConversationNode | 已对齐（瘦投影） |
| Trajectory 账本 + inspect | 有 | ui-trajectory | 已对齐（无虚表） |
| 审批 dock + mode | 有 | Permission + QueuePanel | 已对齐（瘦） |
| 运行中 inject | 有 | steer/queue | 已对齐（无队列编辑 UI） |
| Agent Minimal 双工具 | 有 | minimal preset | 已对齐（瘦：工具过滤 + editor，无 profile 叠层） |
| Session 绑定项目可读 | 有（host 绝对路径 cwd） | workspace cwd | 已对齐（瘦：路径绑定，工具直读写） |
| Trajectory 虚表/搜索 | 无 | 有 | **不吸收** |
| Workspace dock | 无 | ui-workspace | **不吸收** |
| Goals / Plan / Attachments | 无 | 对应 ui-* | 需 host 域；暂不吸收 |
| Jobs / Subagent 导航 | host 有、Web 薄 | ui-jobs / ui-subagent | 后续可选薄面 |

## 刻意不吸收

多层 profile/bundle/patch、巨型 ToolRuntime、符号后门调度、仓库级 verify 矩阵、完整 ConversationNode 引擎 / `__DSH_BOOT__` 动态 client 包 / Trajectory 虚表与工作区 dock。扩展继续用薄 Service + 单测证明。
