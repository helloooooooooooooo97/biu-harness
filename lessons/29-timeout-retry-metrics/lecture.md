# 29-timeout-retry-metrics 讲义

## 目标

- 实现**超时**：`withTimeout`（限时，超时拒绝）。
- 实现**重试**：`retry`（有限次数 + 退避 + 可分类是否重试）。
- 实现**指标**：`Metrics`（计数/求和，供第 45/48 课遥测用）。

## 1. 超时：不能无限等

```ts
const reply = await withTimeout(llm.chat(messages), 30_000)
```

超时 = 给异步操作一个期限：**超时就拒绝，不继续等**。它是第 22 课 step 取消的最小形态（完整取消是第 42 课）。

## 2. 重试：失败不一定是终点

```ts
const reply = await retry(() => llm.chat(messages), {
  attempts: 3,
  backoffMs: 200,
  shouldRetry: (err) => !(err.message.includes('HTTP 400')),   // 400 不重试
})
```

三个设计点：

- **有限次数**：attempts 决定最多试几次，不能无限重试；
- **退避**：每次失败等 backoffMs 再试（指数退避是扩展）；
- **可分类**：`shouldRetry` 决定"这个错误值不值得重试"——网络错误重试，参数错误不重试。

## 3. 指标：为遥测记账

```ts
const metrics = new Metrics()
metrics.inc('attempts')
metrics.add('duration_ms', 120)
metrics.snapshot()   // { attempts: 1, duration_ms: 120 }
```

第 29 课只记账；第 45/48 课会把它们接进 telemetry 与成本统计。

## 4. 与 dsh 的对照

dsh 的 `tools/execute` around-dispatch 就是超时/重试/指标的落点（第 27 课流水线）；`llm-retry` 按 provider 路由做重试策略。本课是这三个能力的独立教学版。

## 小结

- 超时：设期限，超时拒绝；
- 重试：有限次数 + 退避 + 按错误类型分类；
- 指标：计数/求和，供遥测消费。

## 预习

- 工具调用前要问谁？（第 30 课：审批与权限。）
