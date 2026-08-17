# 16-effects-and-teardown 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 EffectRegistry / PluginHost / StateStore 三个文件的用例。
2. **热重载换实现**：写一个测试——`greeting` 插件 v1 提供 `'hello'`，`reload` 换成 v2 提供 `'hi'`，断言 `get('greeting')` 变为 `'hi'` 且 `version` 递增。
3. **失败回滚**：写一个测试——reload 的新插件 `apply` 里先 `state.set` 再抛错，断言 `reload` 返回 `{ ok: false }`、`get('greeting')` 还是旧值、state 也恢复原样。
4. **回答问题**：为什么"状态与 effect 分离"是热重载的前提？如果状态放在插件闭包里，reload 会发生什么？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/16-effects-and-teardown
cd lessons/16-effects-and-teardown/code && npm test
```

- 原有测试 + 你新增的 reload/rollback 测试全过；`npx tsc --noEmit` 无错误。
