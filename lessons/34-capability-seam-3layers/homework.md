# 34-capability-seam-3layers 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解三角色与插件组装。
2. **换 Provider**：写测试——同一 `llm` definition 注册 `DeepSeekLike` 与 `MockLike` 两个 Provider，Consumer 用 `registry.provide('llm')` 取，断言换 Provider 后行为变化、Consumer 代码不变。
3. **插件组装**：写测试——tools/prompt/loop 三个插件注册进 `MiniContext`，按 key 取用；卸载 loop 插件后 `get('agentLoop')` 抛"缺少服务"。
4. **重名/缺失**：写测试——重复注册同一 key 抛错、取未注册 key 抛错。
5. **回答问题**：为什么"一切皆插件"要求消费者只依赖 Definition？（提示：换 loop 实现要改几个文件？）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/34-capability-seam-3layers
cd lessons/34-capability-seam-3layers/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
