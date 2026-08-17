# 18-monorepo-refactor 讲义

## 目标

- 把第 05-08 课的**垂直切片**拆进 pnpm workspace——包边界 = 职责边界。
- 理解依赖方向：实现依赖接口，接口不依赖实现。
- 落地"换装真实 cordis"：workspace 依赖 `@deepseek-ai/cordis`，mini 内核退役。

## 1. 为什么要拆

第 05-08 课的 agent 是"单文件全家桶"：ChatClient、AgentV1/V2、ToolRegistry 挤在一起。它能跑，但：

- 换工具后端要动 agent 文件；
- 换模型供应商要动整个包；
- 没法单独测试、单独发布。

第 18 课按职责拆成包（依赖方向单向）：

```text
apps/cli ──→ core-agent-loop ──→ llm（接口） ←── llm-deepseek（实现）
                  │
                  ├──→ core-tools
                  └──→ core-session
```

规则：**core-agent-loop 只依赖接口（llm 的契约、tools 的注册表、session 的日志），不依赖任何实现**。换 DeepSeek → 别的供应商，只换 `llm-deepseek` 一个包。

## 2. 换装真实 cordis

第 13-17 课的 mini-Cordis 是**教学内核**：让你理解 ctx/effect/插件/配置加载。从第 18 课起它退役，workspace 直接依赖真实 `@deepseek-ai/cordis`：

```bash
pnpm add @deepseek-ai/cordis
```

换装后，第 13 课的概念一一映射：

| mini 版本 | 真实 cordis |
| --- | --- |
| `Context` | `Context`（同构，功能更全） |
| `ctx.provide/get` | `ctx.provide` / 服务注入 |
| `PluginHost` | Loader 管理的插件树 |
| 配置驱动（第 17 课） | cordis.yml + include/loader |

**业务代码一行不改**——因为第 05-08 课写的都是"面向接口的代码"（ChatClient 实现 LlmClient、AgentV2 依赖注入），接口没变。

## 3. 本课代码

`MiniDshWorkspace.scaffold(dir)`：生成 workspace 骨架（6 个包 + cli），`llm-deepseek` 声明 `@deepseek-ai/cordis` 依赖；`REFACTOR_MAP` 给出"哪个课的文件搬进哪个包"的清单；`RefactorChecker` 检查搬移是否完成。

真正的搬移是**作业**：把第 05/06 课的类手动放进对应包，并让 `pnpm -r build` 通过。

## 4. 与 dsh 的对照

dsh 的 `packages/` 就是这个布局的完整版：`llm/llm`（接口）、`llm/llm-deepseek`（实现）、`core/tools`、`core/session`、`core/agent-loop`、`apps/cli`。第 19 课会逐个定义这些包的服务接口。

## 小结

- 拆包 = 按职责切分 + 依赖方向单向（实现依赖接口）。
- mini 内核在第 18 课退役，真实 cordis 接管——概念一一对应。
- 重构不是重写：面向接口的代码搬个家就行。

## 预习

- 每个包暴露什么接口？（第 19 课：core-services。）
