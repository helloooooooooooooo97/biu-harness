# 12-replay-and-snapshots 讲义

## 目标

- 实现日志的**快照/重放**：落盘无损、还原一致。
- 引入 **golden transcript**：用标准会话日志当断言基准。
- 用 `assertContiguous` 校验日志完整性（seq 连续）。

## 1. 快照与重放

第 09/10 课确定了"日志是唯一事实源"。要让事实"活过重启"，就需要两个方向：

```text
快照：SessionLog.snapshot()      → JSON 字符串（落盘/传输）
重放：SessionLog.replay(snapshot) → 事件数组（恢复）
```

快照/重放的硬要求：**无损**。`replay(snapshot())` 必须和原日志逐字节一致——这就是测试 `snapshot/replay 无损往返` 锁住的契约。模型上下文、UI 轨迹、telemetry 全部从这条流派生，任何一字节的漂移都会传染下游。

## 2. 重放引擎：恢复 → 校验 → 推导

```ts
const engine = new ReplayEngine()
const result = engine.replay(log.snapshot())
// result.events   恢复出的事件
// result.messages 推导出的模型消息（第 10 课的 deriver）
```

重放不是简单"还原数组"，而是"还原后能继续干活"：恢复事件 → 校验完整性 → 重新推导上下文。这保证崩溃恢复后，模型看到的世界和崩溃前一致。

## 3. 完整性校验：assertContiguous

```ts
assertContiguous(events)   // 要求 seq === 1, 2, 3, ... n
```

日志只有 append-only + seq 连续，才能被安全重放。缺口（1,2,4）或重复（1,2,2）都意味着"某条事实丢了或被改了"——立即报错而不是带病运行。

## 4. golden transcript：标准会话日志

golden transcript = 一份**标准会话日志 + 它的期望推导结果**，作为回归基准：

```text
fixtures/golden/tool-loop.jsonl       事件日志（JSONL）
fixtures/golden/tool-loop.messages.json  期望推导出的 messages
```

```ts
const { events, expected } = engine.loadGolden(eventsPath, expectedPath)
engine.verifyGolden(events, expected)   // true = 推导结果与基准逐字节一致
```

价值：

- **回归防线**：改 deriver 时，golden 立刻告诉你"答案变了"；
- **可读的基准**：一份 JSONL 就是一次完整会话的"快照台词"；
- **篡改即失败**：任何人改动日志内容，校验立刻红（测试里故意篡改 tool/result 验证了这一点）。

## 5. 与 dsh 的对照

dsh 的持久化是"把同一份规范日志落盘"：`ctx.sessionPersistence` seam（JSONL/SQLite 后端）、checkpoint 策略、`test:snapshot` 体系（录制/刷新/回放三模式）。本课的 `ReplayEngine` + golden 就是这三件事的教学版：**日志落盘、恢复推导、基准断言**。

## 小结

- 快照/重放必须无损；seq 连续是完整性的最低要求。
- 重放 = 恢复 + 校验 + 推导，而不是简单解析。
- golden transcript 把"标准会话"变成可执行断言。

## 预习

- 持久化如果失败（写一半断电），怎么保证不留下半个事件？（第 12 课扩展：checkpoint/resume。）
