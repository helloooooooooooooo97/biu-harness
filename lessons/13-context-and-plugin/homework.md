# 13-context-and-plugin 作业

## 作业

1. **跑测试**：`cd code && npm test`，重点理解 `plugin 加载后 apply 生效，卸载时清理` 和 `stop 逆序卸载` 两个用例的顺序断言。
2. **写自己的插件**：在 `plugins.ts` 里新增 `clockPlugin`（提供 `clock` 服务：`now(): string`），把它加进 `createMiniApp`，写一个测试验证 `ctx.get('clock').now()` 返回字符串。
3. **验证卸载**：写一个测试——加载 `clockPlugin` 后 `ctx.unload('clock')`，再 `ctx.get('clock')` 抛"缺少服务"。
4. **回答问题**：为什么卸载插件要"逆序"（依赖它的插件先卸）？如果顺序反了会出什么问题？（50 字以上）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/13-context-and-plugin
cd lessons/13-context-and-plugin/code && npm test
```

- 原有 11 个测试 + 你新增的 clock 测试全过。
- `npx tsc --noEmit` 无错误。
