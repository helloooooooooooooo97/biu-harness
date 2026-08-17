# 19-core-services 讲义

## 目标

- 定义 harness 的五个核心服务接口：`llm` / `sessions` / `tools` / `agents` / `agentLoop`。
- 用 `DefaultAgentLoop` 证明"**循环只依赖接口**"：换实现不动循环。
- 理解服务 key（`ctx.llm`、`ctx.sessions`…）是插件的寻址方式。

## 1. 五个核心服务

第 18 课拆了包，第 19 课给每个包定**接口**（Definition），实现留到后续课：

| 服务 key | 接口 | 职责 |
| --- | --- | --- |
| `ctx.llm` | `LlmClient` | `chat(messages) → AssistantReply` |
| `ctx.sessions` | `SessionService` | 创建/获取会话，append 事件 |
| `ctx.tools` | `ToolRegistryService` | 注册/执行工具 |
| `ctx.agents` | `AgentRegistryService` | 创建/获取/销毁 agent |
| `ctx.agentLoop` | `AgentLoopDriver` | 驱动一个回合（消费上面四个） |

```ts
export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
```

接口就是"能力的最小契约"——实现方（DeepSeek/mock/内存工具）只要满足签名就能被挂上去。

## 2. 依赖方向：循环只认接口

`DefaultAgentLoop` 的构造器注入的是**接口**，不是具体类：

```ts
new DefaultAgentLoop({
  llm: new FakeDeepSeek(),       // 任意 LlmClient 实现
  sessions: new MemorySessions(),
  tools: new MemoryTools(),
})
```

所以：

- 换模型供应商 → 换 `llm` 实现，循环一行不改；
- 换工具后端 → 换 `tools` 实现，循环一行不改；
- 测试 → 全部换 mock，循环代码就是生产代码（第 08 课接缝思想的完整版）。

## 3. ServiceRegistry：按 key 寻址

```ts
const registry = new ServiceRegistry()
registry.provide('llm', new FakeDeepSeek())
registry.get<LlmClient>('llm')   // 插件按 key 拿服务，不 import 实现
```

这就是 `ctx.llm` 的雏形：**服务按 key 注册、按 key 读取，类型由接口把关**。

## 4. 与 dsh 的对照

dsh spine 的六个包（session/system-prompt/tools/agent/agent-loop/llm）对应这里的五个接口；真实实现分别落在 `llm-deepseek`、`session-*`、`tool-*` 等包里。第 31-35 课会给 `llm` 和工具做完整的"能力缝"（Definition/Provider/Consumer）。

## 小结

- 五个核心服务 = 接口 + key，循环只依赖接口。
- 换实现 = 换 Provider，业务代码不动。
- `ServiceRegistry` 是 `ctx` 服务仓库的最小形态。

## 预习

- 系统提示词从哪来？（第 20 课：system-prompt 服务。）
