# 22-step-lifecycle 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 step 的事件序列。
2. **无工具 step**：写一个测试——模型直接回答（无 tool_calls），断言事件里**没有** `tool/call` 和 `tool/result`，`toolCalls === 0`。
3. **多工具 step**：写一个测试——模型一次要调用 2 个工具，断言出现 2 对 `tool/call` + `tool/result`，且 `toolCallId` 与 `callId` 一一配对。
4. **回答问题**：为什么"一次模型请求 + 它的工具执行"要绑定成一个 step，而不是请求一个事件、工具一个事件各自独立？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/22-step-lifecycle
cd lessons/22-step-lifecycle/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
