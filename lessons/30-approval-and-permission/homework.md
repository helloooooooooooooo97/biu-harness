# 30-approval-and-permission 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 fail-closed 与三档策略。
2. **预设矩阵**：写测试——遍历 read-only / workspace-write / full × read/write/exec，断言每种组合的 verdict 符合讲义表格。
3. **审批拒绝**：写测试——`decide('workspace-write', exec, gate)` 且 gate 的 resolver 返回 false → 返回 false（exec 被拦）。
4. **接入流水线**：把 `decide` 接到第 27 课 `ToolPipeline.setApproval`，写测试——read-only 下 exec 工具被拒、read 工具放行。
5. **回答问题**：为什么没有 resolver 时 `ask` 必须返回 false（fail-closed）而不是 true？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/30-approval-and-permission
cd lessons/30-approval-and-permission/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
