# 19-core-services 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解接口 + 注入 + 循环集成。
2. **换实现**：写一个 `UppercaseLlm implements LlmClient`（把回复变成大写），用 `DefaultAgentLoop` 跑一遍，断言回复是大写——证明循环不关心实现细节。
3. **加服务 key**：在 `core.ts` 的 `SERVICE_KEYS` 加一个 `systemPrompt`，注册一个返回提示词的服务，写测试验证 `registry.get('systemPrompt')` 可取。
4. **回答问题**：为什么 `DefaultAgentLoop` 的构造器参数类型是接口而不是具体类？如果它是具体类，换 DeepSeek → mock 要改哪里？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/19-core-services
cd lessons/19-core-services/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
