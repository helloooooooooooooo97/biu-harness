# 10-derive-messages 作业

## 作业

1. **跑通样例**：`npm test`，确认样例日志（`sample-session.jsonl`）derive 出 4 条消息：user → assistant（含 bash 工具调用）→ tool（call_1）→ assistant。
2. **手写多步日志**：用 `SessionLog` 造一个 2 step 的会话（step 1 调 1 个工具，step 2 直接回答），derive 后断言：tool 消息紧跟在含 tool_calls 的 assistant 消息之后，顺序正确。
3. **实现 afterSeq**：写一个测试：`derive(events, { afterSeq: 8 })` 只返回 seq > 8 的模型可见事件（样例里应只剩 step 2 的 assistant/message）。
4. **回答问题**：为什么 `derive` 必须是纯函数？如果派生结果依赖"当前内存状态"，会破坏什么？（50 字以上）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/10-derive-messages
cd lessons/10-derive-messages/code && npm test
```

- 测试覆盖：样例推导、幂等性、跳过 chunk/坐标事件、afterSeq 裁剪、SessionLog 增量化推导。
