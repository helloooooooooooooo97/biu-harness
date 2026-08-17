# 46-context-compaction 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/46-context-compaction
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：token 记账（ctx.tokenMeter）与工具结果裁剪（tool-result-pruner）、消息预算分配。验收：长会话按预算裁剪后仍能完成任务。
- 任务：摘要质量评估：压缩后重放，任务完成率不下降。验收：同一任务压缩前后完成率对比数据。

