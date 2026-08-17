# 32-deepseek-real-adapter 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/32-deepseek-real-adapter
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：模型路由：便宜模型做初判/路由，贵模型做终答。验收：同一任务可配置路由策略并观察 token 成本差异。
- 任务：供应商故障切换：主模型 5xx 时自动降级备用模型并记录遥测。验收：故障注入下请求成功且遥测含 fallback 标记。
- 任务：thinking 模式：reasoning block 单独计数与展示。验收：轨迹中 reasoning 与回答 token 分开统计。

