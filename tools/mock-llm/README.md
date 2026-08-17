# tools/mock-llm

可复用的录放 mock LLM 服务：

- 录制：真实 DeepSeek 请求 → 存为 fixtures（JSONL）。
- 回放：测试时按请求摘要命中 fixtures，返回录制响应。

> TODO：第 8 课实现，之后所有课程测试都基于它，保证离线可跑。
