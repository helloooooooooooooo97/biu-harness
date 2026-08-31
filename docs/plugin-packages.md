# 配置热插拔

主仓 **`host/` / `web/` 只留加载器**：读 `cordis.plugins.json`，按包名动态 import。插件源码在 `packages/`，包名一律 `@biu/<prefix>-<id>`。

`host/index.ts` 只做：建 Context、读 `host` 表、`plugin()`。json 解析在 `@biu/host-plugin-loader`。`hub` 是 `@biu/host-hub`，写在 `host` 表最后一项（它再去挂 `plugins` 表）。

插件包内部源码一律 `src/host/` 与/或 `src/web/`（`type-*` / `public-*` 仍用各自目录，它们不是插件）。

## 三张表

| 键 | 谁加载 | 含义 |
|---|---|---|
| `host` | `host/index.ts` | 内核（`host-http` / `host-sessions` / `host-tools` …），按数组顺序 `await plugin` |
| `web` | `web/main.tsx` ← `virtual:cordis-web-runtime` | 壳（`web-slots` / `web-app-shell` / `web-ui-hub` …） |
| `plugins` | `@biu/host-hub` + `@biu/web-ui-hub` | 可热插拔能力；json 的 `web` 字段指向 `@biu/cap-*/web` 或 `@biu/core-*/web` |

## `packages/` 前缀

`ls packages` 按字母分成六类：

- **`type-*`**：会被很多包直接 `import` 的契约（纯类型 + 纯函数）。例如 `@biu/type-session`、`@biu/type-agent-loop`、`@biu/type-http`、`@biu/type-slots`。不是插件，不进 json。`currentSessionId` / `runWithSession` 是 ALS 运行时，在 `@biu/host-sessions/scope`。
- **`public-*`**：共享库 / 公共组件，**不属于 Cordis 插件体系**，不要写进 json。例如 `@biu/public-mascot`（吉祥物）、`@biu/public-ui`（侧栏折叠、计数、勾选框、锚点菜单、emoji 面板）。源码不必拆 `./host` / `./web` 入口。
- **`host-*`**：host 内核插件（无浏览器入口）。源码在 `src/host/`。
- **`web-*`**：web 内核插件（壳上的 slots / dock / app-modules / shell 等）。源码在 `src/web/`。
- **`core-*`**：基础能力（File System / Plugin System / Task System），同一目录，**`exports` 必须把 `./host` 与 `./web` 分开**。json 写 `"package": "@biu/core-file-system/host", "web": "@biu/core-file-system/web"`。
- **`cap-*`**：能力插件，同一目录，**`exports` 必须把 `./host` 与 `./web` 分开**（禁止一个入口同时带 Node + React）。json 写 `"package": "@biu/cap-chat/host", "web": "@biu/cap-chat/web"`。

json 里的 `id` 仍用短名 `chat` / `http`。命令行缝是 `host-shell`，应用壳是 `web-app-shell`。
