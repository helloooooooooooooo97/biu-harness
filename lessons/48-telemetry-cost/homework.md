# 48-telemetry-cost 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/48-telemetry-cost
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：每会话/每日成本上限与超预算熔断。验收：预算耗尽时 agent 停止并返回原因。
- 任务：指标导出（OpenTelemetry / Prometheus）与结构化日志。验收：外部可抓取 token/耗时/成本指标。

