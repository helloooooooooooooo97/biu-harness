# 07-streaming-and-stop 讲义

## 目标

- 用 SSE 实现流式输出：逐 token 拿到内容，而不是等完整响应。
- 解析 `finish_reason`：`stop` / `tool_calls` / `length`，理解三种结束原因。
- 支持取消：`AbortSignal` 中止请求与流。

## 1. 为什么需要流式

非流式（第 05-06 课）是"等整段生成完再返回"。流式把体验从"等 10 秒"变成"边生成边显示"：

```text
POST /chat/completions { stream: true }
  ↓
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: {"choices":[{"delta":{},"finish_reason":"stop"}}]}
data: [DONE]
```

每行 `data:` 是一次增量：`delta.content` 是这一段新增的文本，`finish_reason` 只在最后一块出现。`[DONE]` 是流的结束标记。

## 2. SSE 解析器

SSE 的格式约束：

- 事件之间用**空行**分隔（`\n\n` 或 `\r\n\r\n`）。
- 每行 `data: <内容>`；一个事件可以有多行 `data:`（中间换行用 `\n` 连接）。
- 网络分片不一定落在事件边界——**必须缓冲**，等完整空行再切事件。

```ts
const parser = new SseParser()
for await (const chunk of reader) {
  for (const ev of parser.push(decoder.decode(chunk, { stream: true }))) {
    // 这里拿到的 ev.data 是完整的一条 data
  }
}
```

## 3. finish_reason 三兄弟

| 原因 | 含义 | 后续动作 |
| --- | --- | --- |
| `stop` | 模型正常回答完 | 结束回合 |
| `tool_calls` | 模型要求调用工具 | 走第 06 课的工具循环（流式 tool_call 是第 07 课扩展） |
| `length` | 达到 max_tokens 被截断 | 提示用户/压缩上下文（第 43 课） |

`finish_reason` 是判断"回合是否真的结束"的依据，不是"流断了没"。

## 4. 取消：AbortSignal

`fetch` 支持 `signal`；用户点停止、超时、进程退出时都应该中止：

```ts
const controller = new AbortController()
// ... 用户点了停止：
controller.abort()
```

`ChatClient.streamChat` 把 signal 传给 fetch；调用方在 `finally` 里释放 reader。扩展课（第 42 课）会做完整的取消与进程树清理。

## 5. OOD 结构

```text
sse-parser.ts     SseParser：字节流 → 完整 SSE 事件（缓冲、容错）
chat-client.ts    ChatClient.streamChat：fetch + reader + 逐事件 yield
agent-v3.ts       AgentV3：消费流、累计 reply、记录 stopReason
cli.ts            入口：边收边打印
```

`streamChat` 返回 `AsyncGenerator`——消费方按自己的节奏取事件，这是 Node 里流式接口的标准形态。

## 6. 与 dsh 的对照

dsh 里 `assistant/chunk` 事件就是逐 chunk 写入日志的（第 03 课），流的每一段增量都会落盘；`assistant/message` 是流结束后的组装结果。本课的"边生成边输出"对应 UI 打字机，第 09 课会把 chunk 写进会话日志。

## 小结

- SSE：空行分事件、`data:` 行、`[DONE]` 结尾；网络分片必须缓冲解析。
- `finish_reason`：stop / tool_calls / length，决定回合怎么收尾。
- `AbortSignal` 贯穿请求，取消要释放 reader。

## 预习

- 流式输出和工具调用怎么结合？（扩展：流式解析 `delta.tool_calls`。）
- 流的每一段都要进日志吗？（第 09 课：是的，chunk 是过程保真。）
