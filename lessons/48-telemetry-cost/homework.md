# 48-telemetry-cost 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **遥测查询**：写测试——记录 step/end 与 tool/result，`query('step/end')` 只返回对应 kind；`export()` 是 JSONL。
3. **meter 累计**：写测试——记录两条 usage，totals 正确累计。
4. **成本**：写测试——按单价计算 1M token 的 cost 符合公式。
5. **回答问题**：为什么成本要基于 durable 事件重算，而不是运行时直接记？（提示：可重放/可审计。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/48-telemetry-cost
cd lessons/48-telemetry-cost/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
