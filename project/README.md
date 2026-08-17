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

## 当前状态（第 25 课）

- `packages/llm`：LLM 词汇表与 `LlmClient` 接口（19）
- `packages/llm-deepseek`：`ChatClient` 真实传输 + `MockLlm` 录放（05/08/19）
- `packages/core-session`：`SessionLog`（durable 守卫）+ `MessageDeriver`（09/10/21）
- `packages/core-tools`：`ToolRegistryService` + `MemoryTools` / Echo / Bash（06/19）
- `packages/core-system-prompt`：`SystemPromptAssembler`（20）
- `packages/core-agent-loop`：`StepRunner` / `TurnRunner` / `Inbox` / `Agent` / `PreStepBus`（22-25）
- `packages/core-tools`（26-27）：`defineTool` schema + `ToolPipeline`（pre/guards/approval/execute/post/finalize/result）
- `packages/core-scheduler`：`mapLimit` / `runSerial` / `Barrier`（28）
- `packages/approval`：`ApprovalGate` + 权限预设 read-only/workspace-write/full（30）
- `apps/cli`：装配以上全部，离线 mock 跑完整回合

## 运行

```bash
pnpm install
pnpm -r test
pnpm --filter @mini-dsh/cli start "帮我 echo hi"
```

> 说明：`@deepseek-ai/cordis` 真实框架在 36-40 课（配置/入口）阶段接入；当前跑在 mini 内核 + mock LLM 上，全程离线可测。

## 课程 tag

`lesson-18` … `lesson-25`：对应各课完成后的 project 状态。
