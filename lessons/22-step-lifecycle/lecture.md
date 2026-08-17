# 22-step-lifecycle 讲义

## 目标

- 实现一个 **step**：一次模型请求 + 它触发的工具执行，并把全过程写成 durable 事件。
- 理解 step 是循环的**原子单位**：重放、取消、统计都拿它当坐标。
- 为第 23 课 turn（step 的容器）提供零件。

## 1. Step 是什么

```text
step/start
  ├─ 模型请求（llm.chat）
  ├─ 模型要工具？→ tool/call → 执行 → tool/result
  └─ step/end
```

一个 step = **一次决策 + 它的行动**。第 06 课的工具循环，每一轮请求就是第 22 课的一个 step——本课给它正式的生命周期事件。

## 2. StepRunner

```ts
const step = new StepRunner({ llm, session, tools }, turn, stepNumber)
const result = await step.run(messages)
```

`run` 做的事情（按序写 durable 事件）：

| 动作 | durable 事件 |
| --- | --- |
| step 开始 | `step/start` |
| 模型回复 | `assistant/message` |
| 模型要工具 | `tool/call`（原样参数） |
| 工具执行完 | `tool/result`（配对 callId） |
| step 结束 | `step/end` |

返回 `{ messages, toolCalls, finalContent }`——`toolCalls > 0` 告诉上层"还要不要再转一圈"。

## 3. 为什么 step 是原子单位

- **重放**：第 12 课的 golden 就是"一个 step 一条命"；
- **取消**：取消粒度是 step（第 42 课），不是 token；
- **统计**：token、耗时、失败率都按 step 记账（第 45 课）。

## 4. 与 dsh 的对照

dsh 的 turn 流程里，`step/start → derive → agent/request → llm/stream → tool/call* → tool/result → step/end` 就是本课 StepRunner 的完整版；第 27 课会把"直接执行工具"换成完整流水线（pre/guards/execute/post）。

## 小结

- step = 一次模型请求 + 它的工具执行，是循环的原子。
- 全过程落 durable 事件：start / assistant / tool/call / tool/result / end。
- `toolCalls > 0` = "还要继续"的信号。

## 预习

- 多个 step 怎么组成一次完整回答？（第 23 课：turn。）
