# 29-timeout-retry-metrics 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/29-timeout-retry-metrics
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：实现令牌桶限流与 429/配额处理、指数退避。验收：配额耗尽时请求被平滑限流而非立即失败。
- 任务：超时/重试策略按错误类型分级（可重试/不可重试）。验收：不可重试错误不进入退避循环。

