# 09-session-event-log 讲义

## 目标

- 实现 append-only 会话事件流：`SessionLog`。
- 理解三条硬约束：**只能追加、seq 单调、数据必须可 JSON 序列化**。
- 掌握快照与重放：日志即事实源，UI/统计/上下文都从它派生。

## 1. 为什么是 append-only

会话是"发生过的事实序列"。事实不能被改写——用户当时说了什么、模型当时回了什么，都必须原样保留。三条约束各防一类 bug：

| 约束 | 防什么 |
| --- | --- |
| 只能 append，不能删改 | 防止"篡改历史"导致重放不一致 |
| seq 单调递增 | 提供全局顺序，回放/同步/分页都靠它 |
| 数据必须可 JSON 序列化 | 保证能落盘、能跨进程传输、能持久化 |

第 10 课会证明这套约束的价值：`deriveMessages` 能从日志**唯一确定**地重建模型上下文。

## 2. 事件词汇表（第 03 课复习）

```text
turn/start · turn/end         回合边界
step/start · step/end         步骤边界
user/message                  用户输入/注入上下文
assistant/chunk · assistant/message  流式过程 + 组装结果
tool/call · tool/result       工具调用与结果
```

第 11 课会把这张表变成**类型化的合并扩展事件表**（对应 dsh 的 `SessionEventMap`）。

## 3. OOD 实现

```text
events.ts   EventKind 常量表 + SessionEvent 类型 + isJsonValue 校验
session.ts  SessionLog：append（校验 + 冻结 + seq/time）+ snapshot/replay
```

```ts
const log = new SessionLog()
log.append('user/message', { role: 'user', content: '你好' })
log.append('assistant/message', { message: { role: 'assistant', content: '你好！' } })

const snapshot = log.snapshot()        // 序列化成 JSON 字符串
const restored = SessionLog.replay(snapshot)  // 还原成事件数组
```

`append` 做三件事：校验数据可序列化 → `structuredClone` 后冻结 → 分配 `seq`/`time` 并追加。返回的事件是冻结的，改它会直接抛错。

## 4. isJsonValue 校验

只接受 JSON 能表达的值：

```ts
isJsonValue(null)        // true
isJsonValue('hi')        // true
isJsonValue({ a: [1] })  // true
isJsonValue(undefined)   // false
isJsonValue(() => {})    // false
isJsonValue(new Date())  // false
```

拒绝函数、`undefined`、`Date`/`Map`/`Set`、`NaN`、`bigint`——因为它们无法无损落盘。

## 5. 与 dsh 的对照

dsh 的 `ctx.sessions` 就是这个日志的完整版：`SessionEventMap` 合并扩展、持久化 seam（JSONL/SQLite，第 12 课）、checkpoint 策略。它的设计原则和本课一致：**会话日志是唯一事实源，模型历史从它推导，UI 从它渲染，持久化只是把同一份日志落盘**。

## 小结

- append-only + 单调 seq + JSON 可序列化，是会话日志的三条底线。
- `SessionLog` 提供追加、快照、重放，事件一经写入即冻结。
- 日志在前，派生在后：先有事实，再有上下文（第 10 课）和 UI（第 12 课）。

## 预习

- 快照之后怎么"接着写"？重放和继续的关系是什么？（第 12 课。）
- 事件类型怎么让 TypeScript 编译器帮你检查"事件名和负载匹配"？（第 11 课：声明合并。）
