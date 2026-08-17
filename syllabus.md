# 50 课总表

| # | 课程 | 阶段 | 交付物 |
| --- | --- | --- | --- |
| 01 | harness-what-and-why | A | 模型 API 清单脚本 + 观察模板 |
| 02 | run-dsh-first-task | A | 首次任务运行脚本 + prompt 集 |
| 03 | read-the-trace | A | 轨迹解析器 + 示例会话日志 |
| 04 | tech-stack-and-roadmap | A | monorepo 骨架初始化脚本 |
| 05 | vertical-slice-agent | B | 单文件 agent loop v1 + 测试 |
| 06 | tool-call-loop | B | 工具调用循环 v2 + 测试 |
| 07 | streaming-and-stop | B | 流式输出 v3 + 测试 |
| 08 | mock-llm-replay | B | mock LLM + 录放 fixtures |
| 09 | session-event-log | C | append-only 会话事件流 |
| 10 | derive-messages | C | 从日志重建模型上下文 |
| 11 | event-vocabulary | C | 事件类型设计 |
| 12 | replay-and-snapshots | C | 重放 + golden transcript 测试 |
| 13 | context-and-plugin | D | Context 与插件模型 |
| 14 | services-and-inject | D | 服务注册与依赖注入 |
| 15 | event-dispatch-modes | D | 事件四模式分发 |
| 16 | effects-and-teardown | D | effect 与可逆注册 |
| 17 | config-driven-loading | D | 配置驱动插件加载 |
| 18 | monorepo-refactor | E | pnpm workspace + 包骨架 |
| 19 | core-services | E | 核心服务接口定义 |
| 20 | system-prompt-assembly | E | 系统提示词 section 组装 |
| 21 | event-domain-split | E | durable/live 事件域划分 |
| 22 | step-lifecycle | F | Step 生命周期 |
| 23 | turn-lifecycle | F | Turn 生命周期 |
| 24 | inbox-and-steering | F | 收件箱与 steering |
| 25 | pre-step-waterfall | F | 请求拦截瀑布 |
| 26 | tool-definition | G | ToolDefinition + JSON schema |
| 27 | execution-pipeline | G | 工具执行流水线 |
| 28 | concurrency-scheduler | G | 并行调度器 |
| 29 | timeout-retry-metrics | G | 超时/重试/指标 |
| 30 | approval-and-permission | G | 审批与权限 |
| 31 | llm-adapter-seam | H | LLM 适配器接缝 |
| 32 | deepseek-real-adapter | H | DeepSeek 真实接入 |
| 33 | error-classification | H | 错误分类与重试 |
| 34 | capability-seam-3layers | H | 三层能力缝 |
| 35 | fs-subprocess-swap | H | 本地/远程后端切换 |
| 36 | cordis-yml-loader | I | cordis.yml 与插件树加载 |
| 37 | profiles-bundles-patches | I | 配置分层覆盖 |
| 38 | credentials-and-env | I | 凭据与环境变量 |
| 39 | presets-products | I | 一套代码多种产品形态 |
| 40 | entrypoints | I | CLI / Web / JSON-RPC 入口 |
| 41 | workspace-guard | J | 工作区边界守卫 |
| 42 | cancellation | J | 取消与进程树清理 |
| 43 | context-compaction | J | 上下文压缩 |
| 44 | steering-receipts | J | steering 语义与回执 |
| 45 | telemetry-cost | J | 遥测与 token 统计 |
| 46 | subagent-provider | K | 子代理 provider |
| 47 | multi-agent-workflow | K | 多 Agent 编排 |
| 48 | publish-plugin | K | 插件发布 |
| 49 | capstone | K | 结业项目（三选一） |
| 50 | benchmark-and-review | K | 与官方 dsh 对比评测与复盘 |

阶段 → 课程 → 代码 tag 对照见 [00-start/roadmap.md](00-start/roadmap.md)。
