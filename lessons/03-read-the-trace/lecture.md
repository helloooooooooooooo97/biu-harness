# 03-read-the-trace 讲义

## 目标

- 把 Web UI 的轨迹页和底层 session 日志对应起来。
- 认识最小事件词汇表：`turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*`。
- 会用 `trace-parser.mjs` 把 JSONL 日志变成统计和表格。

## 1. 轨迹页背后的东西

Web UI 里的轨迹不是"另一份记录"——它只是**渲染一份 append-only 会话日志**。每个动作都是一行事件：

```jsonl
{"seq":1,"time":"...","kind":"turn/start","data":{"turn":1}}
{"seq":2,"time":"...","kind":"user/message","data":{"turn":1,"content":"列出当前目录的文件"}}
{"seq":3,"time":"...","kind":"step/start","data":{"turn":1,"step":1}}
{"seq":4,"time":"...","kind":"assistant/chunk","data":{"turn":1,"step":1,"chunk":{"type":"text","text":"我来查看当前目录。"}}}
{"seq":5,"time":"...","kind":"assistant/chunk","data":{"turn":1,"step":1,"chunk":{"type":"text","text":"请稍等。"}}}
{"seq":6,"time":"...","kind":"assistant/message","data":{"turn":1,"step":1,"message":{"content":[{"type":"text","text":"我来查看当前目录。请稍等。"},{"type":"tool-call","id":"call_1","name":"bash","arguments":"{\"command\":\"ls\"}"}]},"usage":{"prompt_tokens":120,"completion_tokens":18,"total_tokens":138}}}
{"seq":7,"time":"...","kind":"tool/call","data":{"turn":1,"step":1,"callId":"call_1","name":"bash","arguments":"{\"command\":\"ls\"}"}}
{"seq":8,"time":"...","kind":"tool/result","data":{"turn":1,"step":1,"callId":"call_1","message":{"content":[{"type":"text","text":"README.md"}]}}}
{"seq":9,"time":"...","kind":"step/end","data":{"turn":1,"step":1}}
{"seq":10,"time":"...","kind":"step/start","data":{"turn":1,"step":2}}
{"seq":11,"time":"...","kind":"assistant/chunk","data":{"turn":1,"step":2,"chunk":{"type":"text","text":"目录里有 README.md。"}}}
{"seq":12,"time":"...","kind":"assistant/message","data":{"turn":1,"step":2,"message":{"content":[{"type":"text","text":"目录里有 README.md。"}]},"usage":{"prompt_tokens":138,"completion_tokens":25,"total_tokens":163}}}
{"seq":13,"time":"...","kind":"step/end","data":{"turn":1,"step":2}}
{"seq":14,"time":"...","kind":"turn/end","data":{"turn":1,"reason":"completed"}}
```

> 这是 dsh 的真实设计：**模型可见即已记录**（model-visible means logged）。任何进入模型请求的内容都能从日志重建——这也是第 09-12 课要亲手实现的。

## 1.5 chunk 与 message：为什么两者都记

注意上面 step 1：模型流式吐了两段文本（`assistant/chunk`），随后 `assistant/message` 把这两段**合并成完整的 content blocks**（文本块 + 工具调用块）。它们不是重复记录，而是同一 step 的两种投影：

| 事件 | 保真什么 | 谁消费 |
| --- | --- | --- |
| `assistant/chunk` | 过程：原始流式片段，token 级 | UI 打字机、回放、中断审计 |
| `assistant/message` | 结果：组装后的完整消息 + usage | `deriveMessages()` 重建上下文（第 10 课） |

规则：**一个 step = 一次模型请求 + 它的工具执行**。所以 step 1 的 message 是「文本 + tool-call」，工具执行完后，loop 发起第二次请求——那是 step 2，而不是在 step 1 里再记一条消息。第 22-23 课会亲手实现这套 turn/step 生命周期。

## 2. 最小事件词汇表

| 事件 | 含义 | 记了什么 |
| --- | --- | --- |
| `turn/start` / `turn/end` | 回合边界 | 回合号、结束原因（completed/aborted/...） |
| `step/start` / `step/end` | 步骤边界 | turn/step 坐标 |
| `user/message` | 用户输入（或注入上下文） | 内容、来源（user/plugin/model/tool） |
| `assistant/chunk` | 流式原始块 | 每个 token 片段，保证回放保真 |
| `assistant/message` | 组装好的助手消息 | 完整消息 + usage（token 统计） |
| `tool/call` | 模型请求调用工具 | callId、工具名、原始参数 JSON 字符串 |
| `tool/result` | 工具执行结果 | callId、模型面结果、isError |

两个关键点：

- `tool/call` 记录的是模型**原样输出**的参数 JSON 字符串（不做解析），保证"模型看到了什么"永远可回放。
- `assistant/chunk` 和 `assistant/message` 同时存在：前者保真、后者供上下文推导使用。

## 3. trace-parser.ts

用法：

```bash
npx tsx trace-parser.ts sample-session.jsonl --summary # 汇总统计
npx tsx trace-parser.ts sample-session.jsonl --csv     # 拍平为表格
npx tsx trace-parser.ts sample-session.jsonl --json    # 原始行（含 line 号）
```

`--summary` 输出：turn 数、step 数、工具调用/结果数、assistant 消息数、token 合计。

实现是 OOD 的 `TraceParser` 类：`parse()` 负责逐行解析，`summarize()` / `rows()` / `toCsv()` / `toJson()` 是同一份事件的四种投影——和日志"一份数据、多种消费视图"的思想一致。

## 4. 从轨迹反推发生了什么

拿到一份日志，按这个顺序读：

1. 数 turn——用户问了几轮；
2. 在 turn 内数 step——模型"想了几轮"；
3. 找 `tool/call`——模型实际动手做了什么；
4. 看 `tool/result` 是否 `isError`——哪一步失败了；
5. 看 usage——每轮花了多少 token。

第 05-08 课你将亲手写出产生这些事件的循环；第 09-12 课把它升级成真正的 session 日志。

## 小结

- 轨迹 = 渲染后的 append-only 会话日志。
- 事件词汇表的最小集：turn、step、user/assistant message、assistant chunk、tool call/result。
- 解析日志是理解 harness 的基础功：先会读，再会写。

## 预习

- 想想 `deriveMessages()`：如果只给你这份日志，怎么重建模型下一次请求的 messages 数组？（第 10 课揭晓。）
