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
{"seq":4,"time":"...","kind":"assistant/chunk","data":{"turn":1,"step":1,"chunk":{"type":"text","text":"我来查看。"}}}
{"seq":5,"time":"...","kind":"tool/call","data":{"turn":1,"step":1,"name":"bash","arguments":"{\"command\":\"ls\"}"}}
{"seq":6,"time":"...","kind":"tool/result","data":{"turn":1,"step":1,"message":{"content":[{"type":"text","text":"README.md"}]}}}
{"seq":7,"time":"...","kind":"assistant/message","data":{"turn":1,"step":1,"message":{"content":[{"type":"text","text":"目录里有 README.md。"}]}}}
{"seq":8,"time":"...","kind":"step/end","data":{"turn":1,"step":1}}
{"seq":9,"time":"...","kind":"turn/end","data":{"turn":1,"reason":"completed"}}
```

> 这是 dsh 的真实设计：**模型可见即已记录**（model-visible means logged）。任何进入模型请求的内容都能从日志重建——这也是第 09-12 课要亲手实现的。

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

## 3. trace-parser.mjs

用法：

```bash
node trace-parser.mjs sample-session.jsonl --summary   # 汇总统计
node trace-parser.mjs sample-session.jsonl --csv       # 拍平为表格
node trace-parser.mjs sample-session.jsonl --json      # 原始行（含 line 号）
```

`--summary` 输出：turn 数、step 数、工具调用/结果数、assistant 消息数、token 合计。

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
