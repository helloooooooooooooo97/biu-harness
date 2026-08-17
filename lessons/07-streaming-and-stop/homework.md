# 07-streaming-and-stop 作业

## 作业

1. **跑通 mock 流式**：`MOCK_LLM=1 npm start -- --prompt "你好"`，确认内容是逐段打印的（而不是一次输出）。
2. **跑通真实流式**（有 key 时）：`DEEPSEEK_API_KEY=sk-... npm start -- --prompt "写一首四行诗"`，观察 `finish_reason` 是 `stop`。
3. **触发 length**：给 `cli.ts` 加一个 `--max-tokens 5` 参数（透传给请求），跑同一个 prompt，观察 `finish_reason` 变成 `length`，回答被截断。
4. **写测试**：新增一个测试——fake fetch 流里 `finish_reason` 是 `length` 时，`AgentV3.run` 返回 `stopReason: 'length'`。
5. **回答问题**：为什么 SSE 解析必须缓冲，而不是"来一个 chunk 就当作一个事件"？（50 字以上）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/07-streaming-and-stop
cd lessons/07-streaming-and-stop/code && npm test
```

- 测试覆盖：SSE 跨分片解析、[DONE] 结束、finish_reason、取消（AbortError）、AgentV3 汇总。
