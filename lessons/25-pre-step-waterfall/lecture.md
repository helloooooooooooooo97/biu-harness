# 25-pre-step-waterfall 讲义

## 目标

- 实现 `agent/pre-step` 瀑布：**决定模型这一步看到什么**。
- 用第 15 课的 waterfall 语义：改写（next 委托）或拒绝（短路）。
- 理解 pre-step 是权限、上下文注入、输入规范化的统一落点。

## 1. 问题：模型看到什么由谁决定

第 23 课里 `TurnRunner` 直接把 prompt 喂给模型。真实 harness 需要**入口拦截**：

- 权限：危险输入直接拒绝；
- 注入：把系统上下文（第 20 课组装的提示词）拼进这一步；
- 规范化：改写用户消息。

第 25 课把它做成一个瀑布事件 `agent/pre-step`：

```text
输入（claimed batch）
  → agent/pre-step
       ├─ 监听器改写 → next(改写后) → enter
       └─ 监听器拒绝 → 短路 return → reject（不开 step）
```

## 2. 两个决策

```ts
type PreStepDecision =
  | { kind: 'enter'; messages: UserMessage[] }   // 开 step，用这份消息
  | { kind: 'reject' }                            // 不开 step
```

- **enter**：改写后的消息批次被写入 `user/message`，step 开始（第 22 课）；
- **reject**：不开 step，回合以 0 step 结束（日志仍记录这次尝试，第 23 课的空回合语义）。

## 3. 瀑布语义（第 15 课兑现）

```ts
const pre = new PreStepBus()
pre.on((decision, payload, next) => {
  next({ kind: 'enter', messages: [...decision.messages, systemMessage] })  // 委托
})
pre.on((_decision, _payload) => {
  return { kind: 'reject' }   // 短路：后面的人不用问了
})
```

监听器形如 `(decision, payload, next)`：

- 调 `next(新决策)` → 值传给下一个监听器（**改写**）；
- 不调 next、直接 `return 决策` → **短路**，返回值为最终结果（**拒绝**）。

## 4. 与 dsh 的对照

dsh 的 `agent/pre-step` 是真实 waterfall：监听器可以改写 claimed batch 或 reject；`agent/request`、`llm/stream` 紧随其后。本课的 `PreStepBus` 是它的最小实现——第 27 课的工具流水线会复用同样的瀑布模式（`tools/pre-execute`）。

## 小结

- pre-step = 入口拦截瀑布：enter（改写）或 reject（拒绝）。
- 改写用 next 委托，拒绝用短路 return。
- 第 23 课 turn + 第 25 课 pre-step 合起来 = dsh turn flow 的"claim → 拦截 → step"。

## 预习

- 工具调用前也要拦截/审批？（第 27 课 tools/pre-execute 瀑布 + 第 30 课审批。）
