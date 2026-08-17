# 12-replay-and-snapshots 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/12-replay-and-snapshots
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：session 落盘抽象（JSONL/SQLite，对应 ctx.sessionPersistence seam）。验收：kill -9 后重启进程能从日志恢复 session 继续。
- 任务：checkpoint/resume：从日志重建上下文并继续新 step。验收：恢复后的 derive-messages 与崩溃前一致。
- 任务：golden 更新流程：变更需显式命令更新并留 diff。验收：提供 update-golden 命令并纳入 CI。

