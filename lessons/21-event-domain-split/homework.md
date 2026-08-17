# 21-event-domain-split 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解域映射、日志守卫、bus 分发。
2. **写守卫测试**：写一个测试——把 `agent/pre-step` 当 durable 写进 `SessionLog`，断言抛错且日志长度不变。
3. **live 分发测试**：写测试——`bus.emit('agent/status', 'running')` 后监听器收到值，且**没有**任何日志被写入（可断言一个 SessionLog 的长度仍为 0）。
4. **回答问题**：为什么 `agent/status` 不值得进日志，而 `tool/result` 必须进？（提示：重放后谁还有意义。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/21-event-domain-split
cd lessons/21-event-domain-split/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
