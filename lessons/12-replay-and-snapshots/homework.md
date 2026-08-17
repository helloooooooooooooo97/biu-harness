# 12-replay-and-snapshots 作业

## 作业

1. **跑测试**：`cd code && npm test`，确认两个 golden（tool-loop、multi-step）都通过，理解 `篡改日志后 golden 校验失败` 的含义。
2. **写自己的 golden**：在 `fixtures/golden/` 下新建 `review-task.jsonl`（一个 turn：2 次工具调用 + 最终回答）和对应的 `review-task.messages.json`，在测试里用 `loadGolden` + `verifyGolden` 验证通过。
3. **验证完整性**：把 `review-task.jsonl` 里某条事件的 `seq` 改成重复值，写一个测试断言 `assertContiguous` 抛错。
4. **回答问题**：为什么快照/重放必须"无损"？如果 `replay` 悄悄丢掉某条事件，会破坏哪些下游（至少举两个）？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/12-replay-and-snapshots
cd lessons/12-replay-and-snapshots/code && npm test
```

- 原有 7 个测试 + 你新增的 golden 测试全过。
- `npx tsc --noEmit` 无错误。
