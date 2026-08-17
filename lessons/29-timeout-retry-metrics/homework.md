# 29-timeout-retry-metrics 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解超时/重试/指标。
2. **超时拒绝**：写测试——`withTimeout` 对一个 100ms 才 resolve 的 promise 设 10ms 超时，断言拒绝且错误信息含"超时"。
3. **重试成功**：写测试——函数前 2 次抛错、第 3 次成功，`retry({ attempts: 3 })` 返回成功值。
4. **分类不重试**：写测试——`shouldRetry` 返回 false 时立即抛错，不再尝试。
5. **回答问题**：为什么重试必须"有限次数 + 可分类"？无限重试和盲目重试各会出什么问题？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/29-timeout-retry-metrics
cd lessons/29-timeout-retry-metrics/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
