# 08-mock-llm-replay 作业

## 作业

1. **离线工具循环**：跑 `npm test`，确认 `agent-v2.test.ts` 里"mock 工具循环"用例通过（fixture 先给工具调用、再给最终回答）。
2. **跑真实并录制**（有 key 时）：运行 `npm start -- --prompt "帮我 echo hi"`，观察真实输出；然后把真实响应手工录成你自己的 fixture（新增一行到 `fixtures/tool-call.jsonl` 或新文件）。
3. **未命中行为**：写一个测试——`MockLlm` 遇到没录过的 key 时抛出"mock 未命中"，且 `AgentV2.run` 会把这个错误抛给调用方（不吞掉）。
4. **故障注入（扩展）**：给 `MockLlm` 加一个 `failure?: 'http-429' | 'timeout' | 'malformed'` 的 fixture 字段，未命中/命中断言走对应错误路径。
5. **回答问题**：为什么 mock 要作为独立的 `LlmClient` 实现，而不是在 `ChatClient` 里加一个 `if (MOCK_LLM)`？（50 字以上）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/08-mock-llm-replay
cd lessons/08-mock-llm-replay/code && npm test
```

- 测试覆盖：fixture 加载、按 key 命中、同 key 按序消费、未命中报错、完整离线工具循环。
