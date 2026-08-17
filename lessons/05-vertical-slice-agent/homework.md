# 05-vertical-slice-agent 作业

## 作业

1. **跑通 mock**：`MOCK_LLM=1 node agent-v1.mjs --prompt "你好"`，确认输出内置 mock 回复。
2. **跑通真实**（有 key 时）：`DEEPSEEK_API_KEY=sk-... node agent-v1.mjs --prompt "用一句话介绍你自己"`，记录 usage（可临时在代码里打印或观察响应）。
3. **加功能**：给 `agent-v1.mjs` 增加 `--history` 参数：接受一个 JSON 文件路径，把里面的历史消息拼在 user prompt 之前（实现多轮会话）。验收：第二次提问时模型能看到第一轮内容。
4. **写测试**：为 `--history` 新增一个测试（注入 fetch，断言发送的 body 里 messages 数量正确）。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/05-vertical-slice-agent
cd lessons/05-vertical-slice-agent/code && npm test
```

- mock 与真实两种模式都能运行。
- `--history` 生效且有对应测试。
