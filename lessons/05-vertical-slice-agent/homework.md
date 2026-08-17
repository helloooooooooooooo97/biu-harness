# 05-vertical-slice-agent 作业

## 作业

1. **跑通 mock**：`MOCK_LLM=1 npm start -- --prompt "你好"`，确认输出内置 mock 回复。
2. **跑通真实**（有 key 时）：`DEEPSEEK_API_KEY=sk-... npm start -- --prompt "用一句话介绍你自己"`，记录 usage（可临时在代码里打印或观察响应）。
3. **多轮会话**：准备一个 `history.json`（例如 `[{"role":"assistant","content":"我叫小明。"}]`），用 `npm start -- --prompt "我叫什么？" --history history.json` 验证第二次提问能看到第一轮内容。
4. **写测试**：为 `AgentV1.run(prompt, history)` 新增一个测试（注入 fetch，断言发送的 body 里 messages 数量正确）。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/05-vertical-slice-agent
cd lessons/05-vertical-slice-agent/code && npm test
```

- mock 与真实两种模式都能运行。
- `--history` 生效且有对应测试。
