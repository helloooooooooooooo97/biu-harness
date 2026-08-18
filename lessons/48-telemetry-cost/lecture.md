# 48-telemetry-cost 讲义

## 目标

- 实现**遥测**：事件记账、按 kind 查询、导出 JSONL。
- 实现 **token-meter**：累计每步的 usage，供成本计算。
- 实现**成本计算**：token × 模型单价。

## 1. 遥测

```ts
telemetry.record('step/end', { turn, step, durationMs })
telemetry.query('step/end')   // 该类型全部事件
telemetry.export()            // JSONL 字符串
```

遥测是"动作的账本"：谁干了什么、花了多久（第 29 课 Metrics 的升级版）。

## 2. Token 记账

```ts
meter.record({ promptTokens: 100, completionTokens: 50 })
meter.get()   // { prompt: 100, completion: 50, total: 150 }
```

usage 从 `assistant/message` 事件来（第 03 课），meter 负责累计。

## 3. 成本

```ts
const cost = new CostCalculator({ promptPerM: 1, completionPerM: 2 })
cost.cost({ prompt: 1000, completion: 1000 })   // 0.001 + 0.002 = 0.003 元
```

成本 = prompt/百万 × 单价 + completion/百万 × 单价。

## 4. 与 dsh 的对照

dsh 的 `session-telemetry`（otel 导出）+ `token-meter`（重放测 token）就是这个；成本统计在生产里接预算熔断（扩展课时）。

## 小结

- 遥测记"动作"，meter 记"token"，cost 算"钱"。
- 数据源是 durable 事件，可重放可审计。

## 预习

- 让别的 agent 帮你干活？（第 49 课：子代理。）
