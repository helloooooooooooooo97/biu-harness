# 47-steering-receipts 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **生命周期**：写测试——steer 后回执为 accepted；`claimNextStep` 后变为 claimed；`discard` 后变为 discarded。
3. **查询**：写测试——`get(messageId)` 返回最新状态；未知 id 返回 undefined。
4. **inject 回执**：写测试——inject 也返回回执（target=next-step）。
5. **回答问题**：为什么回执要区分 claimed 和 discarded？（提示：生效 vs 被取消。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/47-steering-receipts
cd lessons/47-steering-receipts/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
