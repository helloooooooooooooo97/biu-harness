# 23-turn-lifecycle 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 turn 的事件序列。
2. **三步 turn**：写一个测试——FakeLlm 依次返回"要工具 → 要工具 → 直接回答"，断言 `steps === 3`、事件里出现 3 个 `step/start`、`turn/end` 的 reason 是 `completed`。
3. **空输入**：写测试——`run('')` 返回 `steps: 0`，事件只有 `turn/start` + `turn/end`。
4. **maxSteps 护栏**：写测试——模型永远要工具时 `run` 抛"超过最大 step 数"。
5. **回答问题**：为什么 `turn/start` 要在 claim 输入之前打开？空输入时记录"一次尝试"有什么价值？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/23-turn-lifecycle
cd lessons/23-turn-lifecycle/code && npm test
```

- 原有测试 + 你新增的 3 个测试全过；`npx tsc --noEmit` 无错误。
