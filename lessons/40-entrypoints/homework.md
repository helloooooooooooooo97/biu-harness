# 40-entrypoints 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **headless**：写测试——`HeadlessRunner.run('hi')` 返回最终回答（注入 mock llm）。
3. **JSON-RPC 成功**：写测试——`handleLine('{"id":1,"method":"run","params":{"prompt":"hi"}}')` 返回带 `result` 的响应。
4. **JSON-RPC 错误**：写测试——未知方法返回 `error` 且带同一 `id`；非法 JSON 返回解析错误。
5. **回答问题**：为什么入口要共享同一个 loop 而不是各自实现一遍？（提示：行为一致 + 可测试。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/40-entrypoints
cd lessons/40-entrypoints/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
