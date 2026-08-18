# 43-dynamic-self-modification 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **host 半执行**：写测试——define+run 一个 host 代码（`ctx.provide('greeting', 'hi')`），断言 `get('greeting')` 可用；stop 后消失。
3. **browser 半审批**：写测试——带 client 代码的 run 必须经审批：resolver 拒绝 → run 返回拒绝；允许 → 返回 ok 且 client 被记录。
4. **undefine**：写测试——undefine 后 `inspect()` 不再包含该定义，且已运行的服务被清掉。
5. **回答问题**：为什么 browser 半要人工审批而 host 半不需要？（提示：改 UI 影响面 vs 注册服务。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/43-dynamic-self-modification
cd lessons/43-dynamic-self-modification/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
