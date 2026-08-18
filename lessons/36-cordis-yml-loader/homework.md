# 36-cordis-yml-loader 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **js 表达式**：写测试——`evalJs('js: ctx.n + 1', { n: 41 })` 返回 42；非 `js:` 前缀的值原样返回。
3. **include**：写测试——配置 A include 配置 B，装载后 B 的插件也挂上了。
4. **动态 config**：写测试——entry 的 config 里含 `js:` 表达式，装载后插件收到的 config 是求值后的值。
5. **回答问题**：为什么配置里的动态值要用表达式标记（`js:`）而不是直接是字符串？（提示：静态可审计 vs 动态可计算。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/36-cordis-yml-loader
cd lessons/36-cordis-yml-loader/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
