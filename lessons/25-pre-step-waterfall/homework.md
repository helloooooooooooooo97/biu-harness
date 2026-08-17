# 25-pre-step-waterfall 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 enter/reject 与短路。
2. **改写监听器**：写测试——监听器把消息内容加前缀 `[系统] `，断言最终决策的 messages 被改写。
3. **权限拒绝**：写测试——第一个监听器检测到内容含 `危险` 就 `return { kind: 'reject' }`，断言第二个监听器**没有执行**、决策是 reject。
4. **链式改写**：写测试——两个监听器都调 next 各加一段文本，断言最终 enter 的消息是两者叠加。
5. **回答问题**：为什么 pre-step 用 waterfall 而不是直接调用一个"入口函数"？（提示：谁有权改输入、谁能拒绝，应该是可插拔的。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/25-pre-step-waterfall
cd lessons/25-pre-step-waterfall/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
