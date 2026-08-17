# 24-inbox-and-steering 讲义

## 目标

- 实现 agent 的**收件箱**：两个队列 `next-turn` / `next-step`。
- 实现三种投递：`followup`（开新回合）、`steer`（改写最近一步）、`inject`（注入不唤醒）。
- 理解 claim 语义：turn 边界拿 1 条 next-turn + 全部 next-step；step 边界只拿 next-step。

## 1. 为什么需要收件箱

第 23 课的 `TurnRunner.run(prompt)` 是"直接喂一个输入"。真实 harness 里输入会**并发到来**：用户在 agent 干活时追问、改主意、注入上下文。收件箱让"谁先来谁后到"有序化：

```text
next-turn：普通消息（下一次回合的开场）
next-step：插队消息（正在/即将进行的一步就要用）
```

## 2. 三种投递

```ts
agent.followup('继续')    // 普通追问 → next-turn，唤醒
agent.steer('别用 bash，用 fs')  // 改写/指导 → next-step，唤醒
agent.inject('文件已变更')        // 注入上下文 → next-step，不唤醒
```

| 方法 | 队列 | 唤醒 | 语义 |
| --- | --- | --- | --- |
| `followup` | next-turn | ✅ | 开新回合 |
| `steer` | next-step | ✅ | 影响最近一步 |
| `inject` | next-step | ❌ | 排队等下一个消息才被看到 |

`steer` 与 `inject` 的区别不在队列，在**唤醒**：steer 打断当前工作，inject 只是"备着"。

## 3. claim：谁在什么时候拿走输入

```ts
// turn 边界（准备开一个回合）：
inbox.claimNextTurn()   // → { turnInput: 1 条 next-turn, stepInputs: 全部 next-step }

// step 边界（工具执行完，可能还要转一圈）：
inbox.claimNextStep()   // → 全部 next-step
```

规则：

- turn 开启时：拿 **1 条** next-turn（一次回合只服务一个普通追问）+ **全部** next-step（插队消息都生效）；
- step 之间：只拿 next-step（工具续轮时，steer/inject 可以插进来）。

## 4. 与 dsh 的对照

dsh 的 `Agent` 有 `send(message, target, wakeup)`，`followup`/`steer`/`inject` 是它的三个固定别名；inbox 的增删是 durable 事件（`agent/inbox/spliced`），崩溃恢复后队列可重建。本课用内存队列实现，持久化留到扩展课。

## 小结

- 两个队列：next-turn（回合开场）、next-step（插队）。
- 三种投递：followup 开新回合、steer 打断、inject 备着。
- claim：turn 边界 1+全部，step 边界只拿插队。

## 预习

- 输入被拿走之后，模型看到什么由谁决定？（第 25 课：pre-step 瀑布。）
