# 07-streaming-and-stop 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/07-streaming-and-stop
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：用 AbortController 实现 SSE 中途取消，取消后断开连接并释放资源。验收：取消后服务端收到中断，无悬挂连接。
- 任务：处理流式 tool_call 参数分片（增量 JSON 拼接）。验收：分片任意顺序到达都能拼出完整参数并执行。
- 任务：流式消费加 backpressure，慢消费者不丢事件。验收：消费者暂停时事件积压不溢出，恢复后继续。

