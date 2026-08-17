# 08-mock-llm-replay 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/08-mock-llm-replay
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：mock LLM 支持故障注入：429、超时、畸形 JSON、流中断。验收：同一请求可在正常/故障 fixture 间切换回放。
- 任务：用故障注入验证重试与错误路径。验收：重试逻辑测试覆盖 429 与超时两条路径。

