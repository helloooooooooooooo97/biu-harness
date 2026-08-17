# 26-tool-definition 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 schema 校验与渲染。
2. **写一个带 schema 的工具**：`sum_numbers`（`numbers: array<number>` 必填），用 `defineTool` 定义，测试：缺参数抛错、类型错误抛错、正常执行返回总和。
3. **渲染**：给 `sum_numbers` 配 `output.render`（返回 `总和为 X`），断言 `execute` 返回的 `text` 是渲染后的文本。
4. **listSchemas**：注册两个工具，断言 `listSchemas()` 里包含两者的 name/description/parameters（供系统提示词组装）。
5. **回答问题**：为什么参数校验要在框架里做，而不是每个工具自己 if？（提示：一致性、可替换、模型看到的是同一份契约。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/26-tool-definition
cd lessons/26-tool-definition/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
