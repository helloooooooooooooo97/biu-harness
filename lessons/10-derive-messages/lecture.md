# 10-derive-messages 讲义

## 目标

- 回答第 03 课留下的问题：**只给一份会话日志，怎么重建模型下一次请求的 messages？**
- 实现纯函数投影：`derive(events) → messages`，同一日志永远得到同一结果。
- 理解哪些事件"模型可见"、哪些只是过程记录。

## 1. 问题

第 09 课确定了：会话日志是唯一事实源，模型历史**不单独存储**。但模型只认 messages 数组——所以每次请求前都要执行一次投影：

```text
events（append-only 日志）  →  deriveMessages()  →  messages（模型请求）
```

这个函数必须是**纯函数**：只读日志、无副作用、同一输入必得同一输出。只有这样才能保证回放、fork、测试、崩溃恢复全部一致。

## 2. 投影规则

逐事件扫描日志，按表映射：

| 事件 | 是否进 messages | 怎么映射 |
| --- | --- | --- |
| `user/message` | ✅ | `{ role: 'user', content }` |
| `assistant/message` | ✅ | `{ role: 'assistant', content, toolCalls? }`（文本合并、tool-call 块转成 toolCalls） |
| `tool/result` | ✅ | `{ role: 'tool', toolCallId, content }`（与 assistant 的 tool_calls 配对） |
| `assistant/chunk` | ❌ | 过程视图，message 已合并 |
| `turn/*`、`step/*` | ❌ | 坐标信息，不进模型 |
| `todo/write`、`request/*`、`compaction/*` | ❌ | 非模型可见状态 |
| `unparsed` | ❌ | 坏行，跳过 |

核心原则：**日志里的内容分两种——模型可见的（进 derive）和仅用于回放/审计的（不进）**。第 03 课学的 chunk/message 区别在这里落地：chunk 永远不参与推导。

## 3. 工具调用的配对

一个 step 里工具调用的推导顺序很关键：

```text
assistant/message（含 tool-call 块）  →  { role: 'assistant', toolCalls: [call_1] }
tool/result（callId = call_1）        →  { role: 'tool', toolCallId: 'call_1', content }
```

`toolCallId` 是配对的钥匙。第 06 课的循环写入日志时，就是这么配对的；第 10 课只是把它读回来。

## 4. OOD 实现

```text
session.ts             SessionLog：append 事件（自动 seq）+ 只读事件流
derive-messages.ts     MessageDeriver：derive(events, { afterSeq? }) → messages
```

```ts
const deriver = new MessageDeriver()
const messages = deriver.derive(sessionLog.all)
```

`afterSeq` 选项支持"从某条日志之后开始推导"——这是 fork / resume / seed 裁剪的雏形（第 12 课正式讲）。

## 5. 与 dsh 的对照

dsh 的 `session` 包里就有同名 `deriveMessages()`：模型历史从日志推导、不单独存储，并且有一条运行时 invariant 断言"**模型可见即已记录**"——凡是进了模型请求的内容，必然能从日志重建。本课的 `MessageDeriver` 就是它的最小实现。

## 小结

- 历史 = 日志的投影，不单独存储；投影必须是纯函数。
- 只有 user/assistant message 和 tool result 进模型；chunk、turn/step 坐标、UI 状态都不进。
- 工具结果靠 `toolCallId` 与 assistant 的 `tool_calls` 配对。
- `afterSeq` 是 fork/resume 的种子。

## 预习

- 日志里可能有 `compaction/*` 事件（上下文被压缩过），derive 时模型看到的是压缩摘要。怎么保证一致性？（第 43/46 课。）
- "日志重建的 messages" 和 "第 06 课循环里实时维护的 messages" 会不会不一致？（第 21 课：durable 与 live 的划分。）
