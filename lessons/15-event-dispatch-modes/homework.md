# 15-event-dispatch-modes 作业

## 作业

1. **跑测试**：`cd code && npm test`，确认四模式各自的用例都过。
2. **写一个权限拦截**：注册两个 waterfall 监听器——第一个"管理员通过"返回 `'允许'`（不调 next，短路），断言第二个监听器不会执行；再写一个"普通用户"场景，第二个监听器执行并返回 `'拒绝'`。
3. **parallel 顺序测试**：两个异步监听器（一个有延迟、一个立即返回），断言 `Promise.all` 的结果数组仍按注册顺序排列。
4. **回答问题**：`emit` 和 `serial` 都有"按注册顺序执行"，本质区别是什么？（提示：等待、返回值。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/15-event-dispatch-modes
cd lessons/15-event-dispatch-modes/code && npm test
```

- 原有 7 个测试 + 你新增的 2 个测试全过。
- `npx tsc --noEmit` 无错误。
