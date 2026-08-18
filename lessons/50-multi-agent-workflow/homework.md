# 50-multi-agent-workflow 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **拓扑执行**：写测试——`plan → (code, docs) → test`，断言执行顺序满足依赖（code/docs 都在 test 前，code 与 docs 可并行）。
3. **并行分支**：写测试——两个无依赖任务总耗时接近"慢的那个"（并行）。
4. **锁**：写测试——同一路径第二次 acquire 返回 false，release 后可再 acquire。
5. **回答问题**：为什么"文档任务"和"编码任务"可以并行，而"测试任务"必须等编码？（提示：依赖。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/50-multi-agent-workflow
cd lessons/50-multi-agent-workflow/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
