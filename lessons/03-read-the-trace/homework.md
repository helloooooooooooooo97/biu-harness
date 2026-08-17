# 03-read-the-trace 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/03-read-the-trace
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：为会话日志引入 trace_id / correlation id，跨组件事件可串联。验收：两个组件日志用同一 trace_id 关联，写出串联 demo。
- 任务：把轨迹转成结构化 JSON 行，可用 grep/jq 分析。验收：sample-session.jsonl 用 jq 能过滤出全部 tool_call 事件。

