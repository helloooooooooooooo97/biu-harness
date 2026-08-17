# 23-turn-lifecycle 讲义

## 目标

- 实现 **turn**：step 的容器——从用户输入到"不再欠任何 step"的完整回合。
- 理解 `turn/start` 在 claim 之前打开、空回合也要记录。
- 用第 22 课的 `StepRunner` 组装出多 step turn。

## 1. Turn 是什么

```text
turn/start
  ├─ step 1（模型要工具）
  ├─ step 2（模型还要工具）
  └─ step 3（最终回答，没有工具）
turn/end（reason: completed）
```

一个 turn = **一次用户输入到最终回答**；step 是它的原子零件。第 03 课轨迹里的"turn"现在变成正式代码。

## 2. TurnRunner

```ts
const turn = new TurnRunner({ llm, session, tools })
const result = await turn.run('帮我查文件')
// { turn: 1, steps: 3, reply: '...' }
```

`run` 的流程：

1. `turn/start`（在 claim 输入**之前**打开——即使回合花费 0 个 step 也要记录这次尝试）；
2. 写入 `user/message`；
3. 循环：用 `StepRunner` 跑一步；`toolCalls > 0` 就带着新 messages 再跑一步，直到模型不再要工具；
4. `turn/end`（reason: completed）。

## 3. 结束条件：nothing owed

turn 何时关闭？

- 模型最终回答没有工具调用 → 不再欠 step → 关闭；
- 空输入 → 0 个 step 直接关闭（`turn/start` + `turn/end` 两条事件记录"尝试过"）；
- 超过 maxSteps → 抛错（死循环护栏，第 06 课同款思想）。

## 4. 与 dsh 的对照

dsh 的 turn flow：`turn/start → claim → pre-step → step* → agent/turn-stopping → turn/end`。本课的 TurnRunner 是它的教学版：claim 简化为单个 prompt，pre-step 留到第 25 课，取消留到第 42 课。

## 小结

- turn = step 的容器，结束条件是"不再欠任何 step"。
- `turn/start` 先开、空回合也记录。
- `toolCalls > 0` 是继续的信号，maxSteps 是护栏。

## 预习

- 输入怎么排队、怎么插队？（第 24 课：inbox。）
