# 44-workspace-guard 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **逃逸拒绝**：写测试——`/work/../etc/passwd` 在 read-only 下也被拒（路径规范化）。
3. **写权限**：写测试——workspace-write 允许工作区内写、拒绝工作区外写；read-only 拒绝一切写。
4. **guardFs 集成**：写测试——用 `guardFs` 包一个内存 fs，工作区内写成功、区外抛"越界"。
5. **回答问题**：为什么守卫要放在 seam（Provider 和 Consumer 之间）而不是写死在 Consumer 里？（提示：可替换策略。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/44-workspace-guard
cd lessons/44-workspace-guard/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
