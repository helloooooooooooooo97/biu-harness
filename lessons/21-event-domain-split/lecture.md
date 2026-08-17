# 21-event-domain-split 讲义

## 目标

- 把事件分成两个域：**durable（进日志、能重放）** 与 **live（只观察在飞工作）**。
- 用守卫保证：live 事件**写不进**会话日志。
- 理解"模型可见即已记录"为什么只约束 durable。

## 1. 为什么要分域

第 09-12 课建立了"日志是唯一事实源"。但**不是所有事件都该进日志**：

| | durable（进日志） | live（只分发） |
| --- | --- | --- |
| 例子 | `turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` | `agent/pre-step`、`agent/status`、`agent/request` |
| 能重放吗 | ✅ 能（日志里） | ❌ 不能（只在那一刻有效） |
| 进模型上下文吗 | ✅ 第 10 课 derive 用 | ❌ 从不 |
| 语义 | 已发生的事实 | 正在发生的过程 |

`agent/status`（"agent 正在跑"）这类事件**不值得重放**——它描述的是瞬间状态，重放它没有意义；而 `tool/result` 是事实，必须进日志，否则模型记忆就丢了。

## 2. 域是守卫，不是注释

```ts
const log = new SessionLog()
log.append('user/message', { content: 'hi' })     // ✅ durable，允许
log.append('agent/pre-step', { messages: [] })    // ❌ live，抛错！
```

`SessionLog.append` 用 `domainOf(kind)` 校验：**live 事件写进日志就是 bug**，必须编译/运行期拦住。这保证"日志里只有 durable"，derive 才敢假设日志内容都可重放。

## 3. live 事件走 EventBus

```ts
const bus = new EventBus()
bus.on('agent/status', (status) => ui.update(status))
bus.emit('agent/status', 'running')   // 只通知，不落盘
```

两个域各走各的通道：

```text
durable → SessionLog.append（落盘、可重放、可推导）
live    → EventBus.emit（观察、拦截、UI，不持久化）
```

## 4. 与 dsh 的对照

dsh 的架构文档明确三分：**session 事件**（durable，`turn/*`、`step/*`…）、**agent 事件**（live，`agent/*`）、**capability 事件**（`fs/*`、`tools/*`、`telemetry/*`）。第 22-25 课实现 loop 时会看到：turn/step 边界写日志，`agent/pre-step` 只 live 拦截。

## 小结

- durable 记事实（重放/推导），live 观察过程（拦截/UI）。
- `SessionLog` 用域守卫拒绝 live 事件——分域是强制约束，不是口头约定。
- 模型可见即已记录，但只对 durable 成立。

## 预习

- 一次模型请求发生在哪个事件里？（第 22 课：step = 请求 + 工具执行。）
