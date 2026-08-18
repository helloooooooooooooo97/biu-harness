# 51-publish-plugin 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **清单校验**：写测试——缺 name/version 抛错；带 dsh.bundle.patch 的合法。
3. **打包**：写测试——pack 后文件集包含 package.json 与入口。
4. **版本冲突**：写测试——发布同 name 更新版本抛错；不同 name 或更旧版本（按语义）允许。
5. **回答问题**：为什么发布要检测版本冲突？（提示：消费者依赖确定性。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/51-publish-plugin
cd lessons/51-publish-plugin/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
