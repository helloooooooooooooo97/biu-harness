# 17-config-driven-loading 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解配置解析、装载、回滚三条路径。
2. **写配置**：写一份只启用 `tools` + `prompt` 的配置 JSON，用 `loader.applyConfig` 装载，断言 `pluginCount === 2` 且两个服务都可取。
3. **热重载切换**：写测试——配置 A（tools）热重载成配置 B（logger）后，`tools` 服务消失、`logger` 服务出现。
4. **坏配置回滚**：写测试——配置里出现未知插件名 `ghost`，断言 `applyConfig` 抛错且上一个稳定树仍然可用（`pluginCount` 不变）。
5. **回答问题**：为什么热重载失败要"保留上一个稳定树"而不是"停在半棵坏树"？至少从可靠性角度说。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/17-config-driven-loading
cd lessons/17-config-driven-loading/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
