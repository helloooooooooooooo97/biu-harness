# 45-cancellation 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **取消令牌**：写测试——`cancel('原因')` 后 signal.aborted 为 true、cause 是'原因'。
3. **abortable**：写测试——挂起中的 promise 被取消时以 AbortError 拒绝。
4. **进程树**：写测试——`ProcessTracker` 记录 pid，`killAll()` 对每个已跟踪进程调用 kill。
5. **回答问题**：为什么取消要带 cause 而不只是"停一下"？（提示：审计与降级。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/45-cancellation
cd lessons/45-cancellation/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
