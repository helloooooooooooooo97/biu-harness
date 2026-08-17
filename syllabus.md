# 53 课总表

## 大纲依据（v5）

本版大纲依据 dsh 官方源码 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（v0.1.0-rc.5）逐包核对后修订：

- **Cordis 驱动，一切皆插件**：model adapter、tool registry、session log、agent loop 本身都是插件，全部可替换于配置。
- **类型化事件 + 声明合并**是插件间契约（`emit` / `waterfall` / `parallel` / `serial` + `@mode`）。
- **可逆 effect + HMR**：vendored `@cordisjs/plugin-hmr`；配置热重载走 `watchUserPatches`；客户端有独立 HMR。
- **能力缝三角色**：Service Definition / Service Provider / Consumer（fs、subprocess、shell、sandbox、llm、credentials…）。
- **profile / bundle / patch 分层**：`dsh.profile` / `dsh.bundle` / `cordis.patch.yml` / `--patch`。
- **自指 Cordis 工具集**：`cordis_inspect/define/run/stop/undefine`——agent 写双半插件（host vm 半 + browser React 半）→ 人工审批 → 热挂载到前端。
- **会话日志是唯一事实源**："model-visible means logged"。

## 贯穿原则

1. **一切皆插件**：服务、工具、提示词 section、事件、UI、子代理、入口都是运行时注册的插件（第 13 课立原则与边界，第 14-17 课实现内核，第 41-43 课落地到具体应用域）。
2. **可逆生命周期**：插件可注册 effect、可卸载、可热重载；改动插件或配置不重启进程（第 16-17 课实现，第 36-37 课配置化落地）。
3. **类型化事件即契约**：事件通过声明合并扩展，dispatch mode 是公开契约（第 11、15 课）。
4. **能力缝三角色**：新增能力 = 定义接口 + 提供实现 + 消费方，三者解耦（第 34 课）。
5. **日志即事实源**：模型看到的任何内容必须能从日志重建（第 9-12 课）。

## 与真实 dsh 的关系

课程先手写 mini-Cordis（13-17）理解内核机制，**第 18 课换装真实 `@deepseek-ai/cordis`**；此后 `project/` 按真实 dsh 的 spine 结构演进（session、system-prompt、tools、agent、agent-loop、scope），并以 bundle/profile 分层组装。mini 内核只存在于教学阶段，最终产品就是「基于 cordis 的 mini-dsh」。

## 课表

| # | 课程 | 阶段 | 交付物 |
| --- | --- | --- | --- |
| 01 | harness-what-and-why | A | 定位与术语；dsh 运行形态（web/headless）；一切皆插件一览 |
| 02 | run-dsh-first-task | A | `npx @deepseek-ai/dsh web`；第一个任务；轨迹页 |
| 03 | read-the-trace | A | 轨迹/日志解析器 + 示例会话日志 |
| 04 | tech-stack-and-roadmap | A | Node 22+/pnpm/TS 环境 + monorepo 骨架脚本 |
| 05 | vertical-slice-agent | B | agent-v1：最小请求循环 + 测试 |
| 06 | tool-call-loop | B | agent-v2：tool_call 解析/执行/回填 + 测试 |
| 07 | streaming-and-stop | B | agent-v3：SSE 流式 + stop reason + 测试 | 
| 08 | mock-llm-replay | B | mock LLM + 录放 fixtures |
| 09 | session-event-log | C | append-only 事件流（SessionEventMap 起步） |
| 10 | derive-messages | C | 从日志重建模型上下文 |
| 11 | event-vocabulary | C | 类型化事件 + 声明合并 + @mode |
| 12 | replay-and-snapshots | C | 重放 + golden transcript 测试 |
| 13 | context-and-plugin | D | 插件模型 + 一切皆插件原则与边界（对齐真实 cordis） |
| 14 | services-and-inject | D | ctx 服务仓库 + inject 依赖 |
| 15 | event-dispatch-modes | D | emit / waterfall / parallel / serial |
| 16 | effects-and-teardown | D | effect 可逆注册 + 卸载 + 热重载 |
| 17 | config-driven-loading | D | include/loader + !!js 表达式 + 配置热重载 |
| 18 | monorepo-refactor | E | pnpm workspace + 换装真实 @deepseek-ai/cordis |
| 19 | core-services | E | session/tools/llm/agent/agent-loop 接口定义 |
| 20 | system-prompt-assembly | E | PromptSection 顺序约定 + 动态 PromptContext |
| 21 | event-domain-split | E | durable session 事件 vs live agent/* 事件 |
| 22 | step-lifecycle | F | Step：一次模型请求 + 其工具执行 |
| 23 | turn-lifecycle | F | Turn：开启、多 step、关闭 |
| 24 | inbox-and-steering | F | inbox（next-turn/next-step）+ steer/inject |
| 25 | pre-step-waterfall | F | agent/pre-step 改写/拒绝 + agent/request |
| 26 | tool-definition | G | defineTool：schema / output / render / 卡片 |
| 27 | execution-pipeline | G | pre/guards/approval/execute/post/finalize/result |
| 28 | concurrency-scheduler | G | 并行调度 + Code Mode run_code |
| 29 | timeout-retry-metrics | G | 超时/重试/指标 |
| 30 | approval-and-permission | G | ctx.approval + 权限预设 |
| 31 | llm-adapter-seam | H | ctx.llm + Message/ContentBlock/StreamChunk 词汇表 |
| 32 | deepseek-real-adapter | H | llm-deepseek：v4、thinking/reasoning block |
| 33 | error-classification | H | 错误分类 + 重试策略 |
| 34 | capability-seam-3layers | H | 能力缝三角色：Definition/Provider/Consumer |
| 35 | fs-subprocess-swap | H | fs/subprocess/shell/terminals 本地与沙箱后端切换 |
| 36 | cordis-yml-loader | I | include/group、!!js 表达式、插件树加载 |
| 37 | profiles-bundles-patches | I | dsh.profile / dsh.bundle / cordis.patch.yml / --patch |
| 38 | credentials-and-env | I | .env 分层 + .credentials.yaml + settings |
| 39 | presets-products | I | agent presets + isolate 隔离域 + 产品形态 |
| 40 | entrypoints | I | dsh CLI / headless / Web + JSON-RPC / ACP + Python SDK |
| 41 | skills-and-tools | J | ctx.skills + skill-filesystem + tool-skill |
| 42 | ui-as-plugin | J | ConversationNode + keyed renderer + ui-slots + 客户端 HMR |
| 43 | dynamic-self-modification | J | cordis_* 工具集：写双半插件 → 审批 → 热挂载（闭环） |
| 44 | workspace-guard | K | ctx.fs 守卫 + fs/* 事件 |
| 45 | cancellation | K | 取消 + 进程树清理 + AbortSignal |
| 46 | context-compaction | K | compaction-basic + tool-result-pruner + token-meter |
| 47 | steering-receipts | K | steering 语义 + 回执（inbox 投影） |
| 48 | telemetry-cost | K | session-telemetry（otel）+ token 成本 |
| 49 | subagent-provider | L | subagent seam：in-process / ACP / 远程 |
| 50 | multi-agent-workflow | L | workflow + 共享上下文/工作区锁 |
| 51 | publish-plugin | L | dsh plugin add；bundle/profile 发布 |
| 52 | capstone | L | 三选一：编码 agent / 自动化服务 / 自修改 UI |
| 53 | benchmark-and-review | L | 与官方 dsh 同任务对比 + 稳定性压测 |

## 应用层插件化（怎么把 X 变成插件）

| 领域 | 真实机制（dsh 源码） | 课程 |
| --- | --- | --- |
| 服务 | `ctx.provide` + `inject` 声明依赖 | 13-14 |
| 事件 | 声明合并 + emit/waterfall/parallel/serial | 11、15 |
| 提示词 | `PromptSection`（order 约定）+ `PromptContext` | 20 |
| 工具 | `defineTool` 注册进 `ctx.tools`，schema 自动进 prompt | 26-30 |
| agent loop | `ctx.agents.setFactory()` 注册驱动，loop 可替换 | 22-25 |
| LLM | `ctx.llm` 适配器注册表 | 31-32 |
| 后端能力 | 能力缝：fs/subprocess/shell/terminals/sandbox | 34-35、44-45 |
| 审批/守卫/遥测 | 横切服务插件（ctx.approval / fs/* / telemetry） | 30、44、48 |
| 子代理 | `ctx.subagent` provider（inprocess/ACP/…） | 49 |
| 入口 | bundle/profile 组装 + apps（cli/web/ACP） | 36-40 |
| UI 组件 | ConversationNode + keyed renderer + ui-slots | 42 |
| 动态能力 | 自指 cordis 工具集（双半插件 + 审批 + HMR） | 43 |

## 扩展课时（v5）

| 课号 | 扩展主题 | 对应缺口 |
| --- | --- | --- |
| 03 | 结构化日志与 trace 关联 | 可观测性 |
| 07 | 流式深水区：取消/断流/分片/背压 | 流式可靠性 |
| 08 | mock 故障注入 | 测试与 CI |
| 12 | 持久化/崩溃恢复 + golden 流程 | 可靠性、测试 |
| 29 | 限流与配额 | 限流 |
| 32 | 模型路由/降级/thinking 计数 | 模型可靠性 |
| 40 | 打包/部署/配置发现 | 发布部署 |
| 44 | 安全纵深：注入/脱敏/沙箱 | 安全 |
| 46 | 上下文预算与摘要质量 | 上下文管理 |
| 48 | 成本预算与指标导出 | 成本、可观测 |
| 50 | 多 Agent 协议/依赖编排 | 多 Agent 深度 |
| 51 | 插件版本/锁定/发布验证 | 插件生态 |
| 53 | 稳定性压测与真实任务 | 验收 |

阶段 → 课程 → 代码 tag 对照见 [00-start/roadmap.md](00-start/roadmap.md)。
