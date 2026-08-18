# 49-subagent-provider 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **inprocess**：写测试——`InProcessProvider` spawn 一个任务，`result` 解析为 mock llm 的回复。
3. **注册表**：写测试——注册两个 provider，`get('acp')` 返回对应实例；换 provider spawn 行为不同。
4. **句柄**：写测试——spawn 返回 `{ id, result }`，id 唯一且 result 可 await。
5. **回答问题**：为什么子代理要 Provider 化而不是直接 new 一个 loop？（提示：换执行世界。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/49-subagent-provider
cd lessons/49-subagent-provider/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
