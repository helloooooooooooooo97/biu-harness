# 42-ui-as-plugin 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **注册/渲染**：写测试——注册 `clock` renderer，`render('clock')` 返回其输出；未注册的 key 抛错。
3. **HMR 替换**：写测试——`reload('clock', v2)` 后 `render('clock')` 返回 v2 输出。
4. **事件驱动**：写测试——`ConversationNodeAssembler` 根据 `tool/result` 事件渲染 `tool` 节点数据。
5. **回答问题**：为什么 UI 要"从事件渲染"而不是"组件自己记状态"？（提示：重放一致性。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/42-ui-as-plugin
cd lessons/42-ui-as-plugin/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
