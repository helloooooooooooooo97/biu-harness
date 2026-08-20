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
10. **Web：session/event 投影对话** — 浏览器不持能力；线程从 append-only 日志投影 user / assistant / tool 节点。
11. **Web：agents 驱动输入** — 发送走 `/api/sessions/:id/messages`，可取消；WS 收 `session` / `agent` / `approval`。
12. **Web：审批可观察** — hold 待批出现在 rail，允许/拒绝回调 host。

## 刻意不吸收

多层 profile/bundle/patch、巨型 ToolRuntime、符号后门调度、仓库级 verify 矩阵、完整 ConversationNode 引擎 / `__DSH_BOOT__` 动态 client 包。扩展继续用薄 Service + 单测证明。
