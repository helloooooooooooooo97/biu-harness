# 11-event-vocabulary 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解 7 个用例分别验证什么（词汇表完整性、模式合法性、on/emit、disposer、声明合并）。
2. **加自己的事件**：仿照 `plugin-hook.ts`，新建 `plugin-render.ts`，用声明合并给 `SessionEventMap` 加一个 `render/commit: { node: string; version: number }`，并写一个测试：`bus.on('render/commit', ...)` + `bus.emit('render/commit', {...})` 正常收发。
3. **模式补充**：在 `plugin-render.ts` 里导出 `renderMode: EventMode`（自选一个模式），说明你为什么选它。
4. **回答问题**：为什么 `EVENT_MODES` 不能是 `Record<EventKind, EventMode>` 而必须是 `Partial`？（提示：声明合并后 `EventKind` 会变。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/11-event-vocabulary
cd lessons/11-event-vocabulary/code && npm test
```

- 原有 7 个测试通过，你新增的 `render/commit` 事件测试也通过。
- `npx tsc --noEmit` 无错误（声明合并的编译期收益被验证）。
