# 20-system-prompt-assembly 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解排序、去重、动态文本、complete、插值。
2. **加工具指引**：注册两个 section（persona order 0、tools order 100），断言组装后 tools 在 persona 之后。
3. **动态上下文**：写一个测试——`text` 用函数返回 `agentId`，组装时传入 `{ agentId: 'a1' }`，断言输出含 `a1`。
4. **complete 接管**：写测试——一个普通 section + 一个 `complete: true` section，断言组装结果**只有** complete 的内容；再注册两个 complete，断言抛错。
5. **回答问题**：为什么顺序用 `order` 数字约定而不是"注册顺序"？（提示：插件加载顺序和展示顺序解耦。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/20-system-prompt-assembly
cd lessons/20-system-prompt-assembly/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
