# 39-presets-products 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **preset 解析**：写测试——注册 `coding`（tools: bash/fs）与默认 preset，`resolve('coding')` 返回其工具集，`resolve('不存在')` 落到默认。
3. **隔离域**：写测试——两个 realm 各 provide 自己的 `tools`，互相取不到（`get('agent-a','tools')` 与 `get('agent-b','tools')` 是不同实例），全局 fallback 可取。
4. **产品切换**：写测试——同一套注册表，给 agent-a 用 `coding` preset、agent-b 用默认 preset，断言两者的工具集不同。
5. **回答问题**：isolate 为什么能防止"一个 agent 的能力泄漏给另一个"？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/39-presets-products
cd lessons/39-presets-products/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
