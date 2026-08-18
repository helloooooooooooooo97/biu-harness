# 46-context-compaction 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **压力检测**：写测试——短消息不超限、长消息超限。
3. **裁剪**：写测试——`pruneToolResult` 保留头尾、中间有裁剪标记。
4. **压缩集成**：写测试——`CompactionRunner.compact` 超限时输出更短的消息、含 summary、发出 `compaction/summary` 事件。
5. **回答问题**：为什么压缩要发出 durable 事件而不是静默丢消息？（提示：重放/审计。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/46-context-compaction
cd lessons/46-context-compaction/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
