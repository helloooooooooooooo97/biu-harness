# 14-services-and-inject 作业

## 作业

1. **跑测试**：`cd code && npm test`，确认依赖链、缺失依赖、循环依赖三条路径都被覆盖。
2. **加一层服务**：在 `service.test.ts` 里新增测试——`logger`（无依赖）→ `session`（依赖 logger）→ `agent`（依赖 session），断言 `resolveOrder` 返回顺序里 logger 在 session 前、session 在 agent 前。
3. **写环测试**：构造 `a → b → c → a` 的三节点环，断言报错信息包含三个名字。
4. **回答问题**：为什么"依赖驱动加载顺序"比"手工按固定顺序 new"更健壮？至少从新增服务、可替换性两个角度说。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/14-services-and-inject
cd lessons/14-services-and-inject/code && npm test
```

- 原有 8 个测试 + 你新增的 2 个测试全过。
- `npx tsc --noEmit` 无错误。
