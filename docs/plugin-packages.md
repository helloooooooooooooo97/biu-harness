# 配置热插拔

主仓 **`host/` / `web/` 只留加载器**：读 `cordis.plugins.json`，按包名动态 import。插件源码在 `packages/`，包名一律 `@biu/<prefix>-<id>`。

`host/index.ts` 只做：建 Context、读 `host` 表、`plugin()`。`hub` 是 `@biu/host-hub`，写在 `host` 表最后一项（它再去挂 `plugins` 表）。

插件包内部源码一律 `src/host/` 与/或 `src/web/`（`type-*` 仍用 `src/`，它们不是插件）。

## 三张表

| 键 | 谁加载 | 含义 |
|---|---|---|
| `host` | `host/index.ts` | 内核（`host-http` / `host-sessions` / `host-tools` …），按数组顺序 `await plugin` |
| `web` | `web/main.tsx` ← `virtual:cordis-web-runtime` | 壳（`web-slots` / `web-app-shell` / `web-ui-hub` …） |
| `plugins` | `@biu/host-hub` + `@biu/web-ui-hub` | 可热插拔能力；json 的 `ui` 字段指向 `@biu/cap-*/web` |

## `packages/` 前缀

`ls packages` 按字母分成四类：

- **`type-*`**：会被很多包直接 `import` 的契约（纯类型 + 纯函数）。例如 `@biu/type-session`、`@biu/type-agent-loop`、`@biu/type-http`、`@biu/type-slots`。不是插件，不进 json。`currentSessionId` / `runWithSession` 是 ALS 运行时，在 `@biu/host-sessions/scope`。
- **`host-*`**：host 内核插件（无浏览器入口）。源码在 `src/host/`。
- **`web-*`**：web 内核插件；`web-mascot` 是共享库，不必进 json。源码在 `src/web/`。
- **`cap-*`**：能力插件，同一目录，**`exports` 必须把 `./host` 与 `./web` 分开**（禁止一个入口同时带 Node + React）。json 写 `"package": "@biu/cap-chat/host", "ui": "@biu/cap-chat/web"`。

json 里的 `id` 仍用短名 `chat` / `http`。命令行缝是 `host-shell`，应用壳是 `web-app-shell`。
