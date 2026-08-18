# project/ — 课程主工程 mini-dsh

本目录从第 18 课（monorepo 重构）开始填充内容：第 18 课把 mini-Cordis 内核换装为真实 `@deepseek-ai/cordis`，之后按真实 dsh 的 spine 结构演进（session、system-prompt、tools、agent、agent-loop、scope），每课以增量补丁演进，并按课打 tag：

```bash
git tag lesson-18    # 第 18 课结束后的快照
git tag lesson-19
# ... 依此类推
```

约定：

- `packages/*`：按职责拆分的核心包（session、agent-loop、tools、llm、config 等）。
- `apps/*`：可执行入口（cli、web、server）。
- 每课的 `lessons/NN-slug/code/` 只放该课的增量文件/补丁，配合对应 tag 使用。

> 第 18 课之前本目录保持为空。

## 当前状态（第 53 课）

- `packages/llm`：LLM 词汇表与 `LlmClient` 接口（19）
- `packages/llm-deepseek`：`ChatClient` 真实传输 + `MockLlm` 录放（05/08/19）
- `packages/core-session`：`SessionLog`（durable 守卫）+ `MessageDeriver`（09/10/21）
- `packages/core-tools`：`ToolRegistryService` + `MemoryTools` / Echo / Bash（06/19）
- `packages/core-system-prompt`：`SystemPromptAssembler`（20）
- `packages/core-agent-loop`：`StepRunner` / `TurnRunner` / `Inbox` / `Agent` / `PreStepBus`（22-25）
- `packages/core-tools`（26-27）：`defineTool` schema + `ToolPipeline`（pre/guards/approval/execute/post/finalize/result）
- `packages/core-scheduler`：`mapLimit` / `runSerial` / `Barrier`（28）
- `packages/approval`：`ApprovalGate` + 权限预设 read-only/workspace-write/full（30）
- `packages/llm`（31）：统一词汇表 + `AdapterRegistry` + `assemble`
- `packages/llm-deepseek`（32）：`DeepSeekAdapter`（reasoning/流式）
- `packages/core-errors`：错误分类 + 分类重试（33）
- `packages/core-capability`：能力缝三角色 + `MiniContext`（34）
- `packages/fs` / `packages/subprocess`：本地与远程 Provider 可切换（35）
- `packages/config`：entries/include/`js:` 表达式 + 插件树装载（36）
- `packages/profiles`：bundle → profile → patch 分层（37）
- `packages/credentials`：环境分层 + 凭据 + 脱敏（38）
- `packages/presets`：agent presets + isolate 隔离域（39）
- `packages/entrypoints`：headless + JSON-RPC 入口（40）
- `packages/skills`：技能注册表 + 文件系统 provider + skill 工具（41）
- `packages/ui-slots`：keyed renderer + 客户端 HMR（42）
- `packages/dynamic`：动态插件 define/run/stop/undefine（43）
- `packages/guard`：工作区边界 + 读写权限（44）
- `packages/cancellation`：取消令牌 + 进程树清理（45）
- `packages/compaction`：压力检测 + 裁剪 + 摘要（46）
- `packages/receipts`：消息回执状态机（47）
- `packages/telemetry`：遥测 + token 记账 + 成本（48）
- `packages/subagent`：子代理能力缝（inprocess/ACP）（49）
- `packages/workflow`：DAG 编排 + 工作区锁（50）
- `packages/publish`：插件清单/打包/发布（51）
- `packages/benchmark`：同任务多跑统计（53）
- `apps/cli`：装配以上全部，离线 mock 跑完整回合
- `apps/cli/plugins/`：**插件目录**——每个插件一个 `.ts` 文件，导出 `plugin`；
  加载器扫文件动态 `import()`，`install(name)` 的本质就是 import 这个文件
- `config.yaml` / `config.json`：声明插件树（id + name + enabled + config）

## 运行

```bash
pnpm install
pnpm -r test
pnpm --filter @mini-dsh/cli start "帮我 echo hi"          # headless（默认插件树）
pnpm --filter @mini-dsh/cli start -- --config config.yaml "帮我 echo hi"  # 从 YAML 配置装载
pnpm --filter @mini-dsh/cli start -- --watch config.yaml  # 双热更新：改配置或改插件文件都即热重载
pnpm --filter @mini-dsh/cli start -- --rpc               # JSON-RPC（stdin 行协议）
pnpm --filter @mini-dsh/cli start -- --benchmark "任务" 5 # 稳定性压测
```

CLI 是**串起来的整体**：配置驱动加载（JSON/YAML，`@mini-dsh/config`）→ cordis 插件树
（`apps/cli/plugins/` 目录扫描 + 动态 import）→ 带遥测/取消/守卫/压缩的 loop → Skills →
headless + JSON-RPC 入口 → 子代理/workflow → benchmark。

## 插件安装与热更新（dsh 对齐）

一切皆插件，插件即目录：

```text
apps/cli/plugins/
  registry/tools.ts              # 注册类：provide 空容器（register→disposer 契约）
  registry/skills.ts
  contributors/tool-echo.ts      # 贡献类：inject 注册表 + apply 返回 disposer
  contributors/preset-coding.ts
  infrastructure/session.ts      # 基础设施：提供普通服务
  infrastructure/llm-mock.ts
  orchestration/agent-loop.ts    # 编排/入口：组合下层服务
  orchestration/rpc.ts
  my-new-plugin.ts               # 加一个文件 = 加一个可安装插件
```

插件按四类分文件夹，一个文件 = 一个插件：

- `registry/`：注册类——提供 `register() → disposer` 容器的服务；
- `contributors/`：贡献类——`inject` 注册表 + apply 返回 disposer；
- `infrastructure/`：基础设施——提供普通服务（会话/遥测/取消/守卫/模型等）；
- `orchestration/`：编排/入口——组合下层服务的 agent loop、headless、RPC、workflow。

加载器递归扫描，分组只影响组织，不影响插件名；插件名 = 文件名（去掉 `.ts`）。

- `CordisPluginManager.install(name)`：无注册表命中时经 resolver 动态 `import()` 插件目录；
- `remove(id)` / `reload(id)`：fiber.dispose() 逆序撤销 effect；
- `reloadPlugin(name)`：带 `?t=` 破 import 缓存重新加载单个插件并重挂（改代码即热更新）；
- `applyConfig(entries)`：配置 diff（改名/禁用/删除 → 卸载，新增 → 挂载）；
- `--watch`：同时轮询配置文件和插件目录 mtime，改哪一个就热更新哪一个。

全程基于真实 `@deepseek-ai/cordis` 4.0.1，离线 mock LLM 可测。

## 课程 tag

`lesson-18` … `lesson-25`：对应各课完成后的 project 状态。
