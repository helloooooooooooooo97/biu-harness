# 33-error-classification 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解分类矩阵。
2. **分类矩阵**：写测试——对 401/403/429/超时/fetch failed/400/500/未知错误各断言一个类别。
3. **重试策略**：写测试——`retryClassified` 对 429 重试后成功；对 401 **只调用一次**就抛错。
4. **retryableReason**：写测试——429 返回"可重试（rate-limit）"，401 返回"不可重试（auth）"。
5. **回答问题**：为什么 auth 错误重试是浪费？（提示：缺什么会一直缺？）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/33-error-classification
cd lessons/33-error-classification/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
