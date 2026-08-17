# 06-tool-call-loop 作业

## 作业

1. **跑通 mock**：`MOCK_LLM=1 npm start -- --prompt "你好"`，确认单步结束（mock 不产生 tool_calls）。
2. **跑通真实工具循环**（有 key 时）：`DEEPSEEK_API_KEY=sk-... npm start -- --prompt "运行 ls -la 并总结输出"`。验收：轨迹里出现 bash 工具调用、模型基于工具输出总结，最终回答不是凭空编造。
3. **新增工具**：实现一个 `FileLengthTool`（`parameters: { path: { type: 'string', required: true } }`，用 `node:fs` 读文件返回行数），注册进 `cli.ts`，并用注入 fetch 的测试覆盖它被调用的场景。
4. **写测试**：补一个"工具执行失败返回错误文本而不是抛异常"的测试（注册一个抛错的假工具）。
5. **回答问题**：工具执行失败为什么应该作为 `tool` 结果回给模型，而不是直接中断循环？（50 字以上）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/06-tool-call-loop
cd lessons/06-tool-call-loop/code && npm test
```

- 测试覆盖：正常工具循环、失败兜底、未知工具、单步结束、wire 格式、maxSteps 超限。
