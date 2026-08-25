# 配置热插拔

主仓 **`host/` / `src/` 只留加载器**：读 `cordis.plugins.json`，按包名动态 import。插件源码在 `packages/`。

## 三张表

| 键 | 谁加载 | 含义 |
|---|---|---|
| `host` | `host/index.ts` | 内核（http / sessions / tools …），按数组顺序 `await plugin` |
| `web` | `src/main.tsx` ← `virtual:cordis-web-runtime` | 壳（slots / shell / ui-hub …） |
| `plugins` | host `hub` + web `ui-hub` | 可热插拔能力；`ui` 字段成对卸前端 |

例外：`hub` 本身仍在 `host/plugins/registry/hub.ts`，因为它要 `resolveCatalog()` 去挂 `plugins`。

## 包

- `@hmr/host-runtime/*`：原 `host/plugins`（含 chat / clock / logger … 子路径导出）
- `@hmr/web-runtime/*`：原 `src/plugins`（含 chat-ui / clock-ui）
- `@hmr/dashboard-*` / `greeter-*` / `tasks-*` / `channel-*`：独立能力包

加插件：在 `packages/<dir>` 放包，只改 `cordis.plugins.json`。
