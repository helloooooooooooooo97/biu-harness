# 37-profiles-bundles-patches 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **用户覆盖**：写测试——bundle 提供 `tools`（config.limit=5），profile patch 把 limit 改成 10，断言最终 entries 里 limit=10。
3. **insert**：写测试——patch 用 insert 加一个 `logger` entry，断言出现在末尾。
4. **缺 bundle / 缺目标**：写测试——profile 引用不存在的 bundle 抛错；patch 替换不存在的 id 抛错。
5. **回答问题**：为什么 patch 是"整行替换"而不是 deep-merge？（提示：可预测性与 restate。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/37-profiles-bundles-patches
cd lessons/37-profiles-bundles-patches/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
