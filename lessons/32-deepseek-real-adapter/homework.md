# 32-deepseek-real-adapter 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 reasoning/文本/tool_calls 的映射。
2. **真实跑通**（有 key）：`DEEPSEEK_API_KEY=sk-... node demo.mjs "1+1=?"`（或写个小脚本用 `stream` + `assemble`），观察 `finish_reason` 与回复。
3. **thinking 模型**：把 `model` 配成 `deepseek-reasoner`，跑一个需要推理的问题，断言 `assemble` 结果里出现 `reasoning` block。
4. **tool_calls 分片**：写测试——两条 `tool-call-delta` 分片（一条带 name、一条只带 arguments 增量），`assemble` 后 arguments 完整拼接。
5. **回答问题**：为什么 `reasoning_content` 要单独成块而不是并进 text？（提示：展示与计费的区别。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/32-deepseek-real-adapter
cd lessons/32-deepseek-real-adapter/code && npm test
```

- 原有测试 + 你新增的 1 个测试全过；`npx tsc --noEmit` 无错误。
