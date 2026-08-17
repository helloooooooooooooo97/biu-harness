# 31-llm-adapter-seam 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解词汇表、注册表、组装。
2. **写一个 adapter**：实现 `MockAdapter implements LlmAdapter`（`stream` 依次 yield text → finish），注册进 registry，用 `registry.get('mock')` 消费。
3. **组装工具调用**：写测试——text chunks + tool-call delta 分片，用 `assemble(chunks)` 得到带 `tool-call` block 的 Message。
4. **重名保护**：写测试——同一 provider 注册两次抛错。
5. **回答问题**：为什么 loop 不能直接操作供应商的消息格式，而要经过统一词汇表？（提示：换供应商改几个文件？）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/31-llm-adapter-seam
cd lessons/31-llm-adapter-seam/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
