# 28-concurrency-scheduler 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解并发上限与顺序保证。
2. **并发上限**：写测试——5 个任务、limit 2，跟踪"同时活跃数"，断言最大值 ≤ 2，且结果按输入顺序返回。
3. **串行保序**：写测试——`runSerial` 下 3 个异步任务，断言完成顺序 = 输入顺序（1 → 2 → 3）。
4. **Barrier**：写测试——3 个任务各自 `arrive`，`wait()` 直到第 3 个 arrive 才 resolve；再验证 `wait()` 之后立即 resolve。
5. **回答问题**：工具批并行时结果要按输入顺序返回，为什么？（提示：模型按 callId 配对结果。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/28-concurrency-scheduler
cd lessons/28-concurrency-scheduler/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
