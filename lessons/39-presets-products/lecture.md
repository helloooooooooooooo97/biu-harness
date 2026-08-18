# 39-presets-products 讲义

## 目标

- 实现 **agent presets**：按会话选择"用哪些工具、什么提示词"。
- 实现 **isolate 隔离域**：不同 realm 的服务互不可见（per-session 能力隔离）。
- 理解"一套代码，多种产品形态"= 组合 presets + 隔离域。

## 1. Agent Presets

```ts
const presets = new PresetRegistry()
presets.register({ name: 'coding', tools: ['bash', 'fs'], prompt: '你是编码助手' })
presets.resolve('coding')   // 该会话的工具集与提示词
```

preset = 一个会话的**能力配方**：哪些工具可见、什么 persona。换产品 = 换 preset。

## 2. Isolate 隔离域

```ts
const isolate = new IsolateRegistry()
isolate.provide('agent-a', 'tools', implA)
isolate.provide('agent-b', 'tools', implB)
isolate.get('agent-a', 'tools')   // 只看到 A 的
```

同一 key 在不同 realm 里是**不同实例**——每个 agent 的能力集互不串线（dsh 的 `isolate` realm）。

## 3. 一套代码多种产品

```text
preset（配方）× isolate（隔离）= 产品形态
```

代码只有一套，产品（web/headless/桌面）通过"装哪些插件 + 每个 agent 用什么 preset"区分。

## 4. 与 dsh 的对照

dsh 的 `ctx.agentPresets`（per-session agent composition）与 service 行的 `isolate` realm 就是这两件事；`permission-presets` 是同一思路在权限上的应用（第 30 课）。

## 小结

- preset = 会话的能力配方；isolate = 按 realm 隔离服务。
- 产品形态 = 组合 + 隔离，代码不复制。

## 预习

- 这些能力怎么暴露成入口？（第 40 课：CLI/Web/JSON-RPC。）
