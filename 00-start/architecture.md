# 架构原则（对照 dsh 真实源码）

本文档提炼自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（v0.1.0-rc.5）的 `docs/architecture.md`、`docs/cordis-primer.md` 与各子系统文档。

## 一切皆插件

dsh 由 Cordis 驱动：**插件贡献服务、类型化事件和可逆 effect 给共享 context**。产品每一部分都是插件，包括：

- model adapter（`ctx.llm`）
- tool registry（`ctx.tools`）
- session log（`ctx.sessions`）
- system prompt 组装（`ctx.systemPrompt`）
- agent 注册表（`ctx.agents`）与 agent loop 驱动（`ctx.agentLoop`，通过 `ctx.agents.setFactory()` 注册，loop 可替换）
- fs / subprocess / shell / terminals / sandbox / code-runtime 等能力缝
- 审批、守卫、遥测、凭据、设置、存储、持久化、压缩、子代理 provider、UI 组件、入口

没有特权核心：扩展 dsh 就是「在旁边挂一个插件」；注册都是 effect，插件卸载时逆序撤销。

## Cordis 内核五件事

1. **插件 = 实现 Service 的对象**：函数形式 `{ inject?, apply(ctx) }` 或 Service 子类。
2. **context = 服务仓库**：服务占用稳定 `ctx.<key>`，别的插件按 key 找服务，不 import 具体实现。
3. **inject 声明依赖**：插件声明所需服务，加载顺序由服务依赖决定，而非手工 boot 排序。
4. **类型化事件**：声明合并扩展事件表，按 `emit` / `waterfall` / `parallel` / `serial` 分发（观察 / 包装 / 扇出 / 有序）。
5. **可逆 effect**：prompt section、tool schema、adapter、provider、listener 都经 `ctx.effect()` / `ctx.on()` 安装，卸载时逆序撤销。

## 热重载（HMR）

- **内核级**：vendored `@cordisjs/plugin-hmr`——监听文件、追踪 Node 模块图、只重载受影响插件；框架级依赖变更回退为 `loader.exit()` 重启。
- **配置级**：`watchUserPatches` 监听 `cordis.patch.yml`，变更时事务性重算 patch 层；失败保留上一个可用树并广播 `hmr/config-update-failed`。
- **客户端级**：`dsh-client-hmr` 订阅 `GET /plugins/events`，插件重建后逐帧 `invalidate → prefetch → registry.delete → drain → refresh`；依赖经 fiber activation epoch 级联重载。
- **动态级**：`cordis_define/run/stop/undefine` 让 agent 在运行中挂载/卸载内存态插件（见下）。

## 分层组装：profile / bundle / patch

- `dsh --profile <name>` 启动 `$DSH_HOME/profiles/<name>` 下的插件树。
- profile 的 `package.json` 声明 `dsh.profile.bundles`（有序 bundle 列表）+ 用户 `cordis.patch.yml`。
- bundle 的 `package.json` 声明 `dsh.bundle.patch` 指向其 `cordis.patch.yml`；`dsh-base` / `dsh-web-app` / `dsh-headless` 是出厂模板。
- 层顺序：每个 bundle 的 patch（按序）→ profile patch → home 级 patch → `--patch` 覆盖；patch 按行 id 整行替换或 insert。
- `--dump-config` 输出实际装载的插件树，任何一行都可被用户 patch 覆盖。

## 事件域划分

- **durable session 事件**：`turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*`、`todo/write`、`request/*`、`compaction/*`——append 到会话日志，重载后仍在。
- **live agent 事件**：`agent/*`（inbox、step、status、request、pre-step、turn-stopping）——观察/拦截在飞工作。
- **capability 事件**：`fs/*`、`tools/*`、`telemetry/*`——给能力缝挂策略和适配器。

## 会话日志 = 唯一事实源

`SessionEventMap` 是合并可扩展的 append-only 事件表；模型历史由 `deriveMessages()` 从日志推导，不单独存储。**模型可见即已记录**：任何进入模型请求的内容必须能从日志重建。persistence 只是把同一份规范日志落盘（JSONL / SQLite seam），fork / resume / transcript / telemetry / 回放都从这条流派生。

## 工具流水线（tools/*）

`tool/call` 入日志 → `tools/pre-execute`（钩子/权限/沙箱）→ 单调 guard（deny/abstain）→ `ctx.approval` → `tools/execute`（超时/重试/指标）→ 工具体 → fs 意图门 → `tools/post-execute` → `finalizeContent` → `tools/result`（冻结的权威结果）→ 注入 `additionalContexts`。

## 能力缝三角色

一个可替换能力 = **Service Definition**（接口声明）+ **Service Provider**（实现）+ **Consumer**（通常是模型面工具）。换 provider 即换整个产品行为：fs / subprocess 共享同一执行世界，指向远程沙箱时 Bash、PTY、LSP 一起迁移。

## 自指 Cordis 工具集（agent 写插件热重载到前端）

`cordis_inspect` / `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine`：

- **host 半**：`node:vm` 沙箱内求值，获得被裁剪的 ctx 面（`ctx.fs`、`ctx.web`、`ctx.bash`…），可注册工具/事件/服务。
- **browser 半**：异步函数体，参数面为 `React / console / styles / host`，无 JSX/TS/module import；通过 `slots` 注册 UI 席位。
- **审批**：有 browser 半的 run 走 `cordis/request-run` 往返，人工在 Web 面板批准后才执行。
- **隔离与回滚**：渲染错误经 `reportRenderFailure` 上报，坏组件被逐出席位；`cordis_stop` 逆序卸载 host 半并撤回 browser 半。
- **生命周期**：内存态、会话作用域，不写文件、不重启保留；要持久化则走正常插件开发流程。

## 新增行为的落点（摘自 dsh 扩展表）

| 目标 | 机制 |
| --- | --- |
| 加模型 provider | 在 `ctx.llm` 注册 adapter |
| 加模型面能力 | 在 `ctx.tools` 注册，schema 自动进 prompt |
| 给某会话不同能力集 | agent preset + `isolate` 隔离域 |
| 加 shell / 终端 / 后台任务 / 人类命令 | `ctx.shell` / `ctx.terminals` / `ctx.jobs` / `ctx.commands` |
| 加文件访问或策略 | `ctx.fs` provider 或 `fs/*` 事件 |
| 拦截请求/工具/turn | `agent/*`、`tools/*` 事件 |
| 加模型面上下文 | `agent.inject()` |
| 加 UI | 注册 ConversationNodeDefinition + keyed renderer，从 `session/event` 渲染 |
| 加持久化会话状态 | 扩展 `SessionEventMap`，从日志渲染与重放 |
| 加子代理 | `ctx.subagent` provider（in-process / ACP / Codex / Claude Code） |

对应课程：13-17 内核；18 换真实 cordis；20 提示词；22-30 loop 与工具；31-35 LLM 与能力缝；36-40 配置与入口；41 Skills；42 UI 即插件；43 动态自指；44-48 安全与韧性；49-53 多 Agent 与生态。
