# 41-skills-and-tools 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **文件系统 provider**：写测试——在临时目录放 `code-style.md`，`FilesystemSkillProvider.list()` 能列出、`load('code-style')` 返回内容。
3. **多 provider 聚合**：写测试——注册两个 provider（各有一个技能），`registry.list()` 返回并集。
4. **skill 工具**：写测试——`skill` 工具的 `list`/`load` 动作走注册表。
5. **回答问题**：技能（知识）和工具（动作）的区别是什么？为什么 agent 要先查技能再动手？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/41-skills-and-tools
cd lessons/41-skills-and-tools/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
