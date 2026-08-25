<p align="center">
  <img src="public/favicon.svg" width="88" height="88" alt="Biu" />
</p>

<h1 align="center">Biu</h1>

<p align="center">
  可热插拔的本地 Agent 工作台：host 跑能力，web 只投影界面。
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=222" />
  <img alt="Cordis" src="https://img.shields.io/badge/Cordis-plugin-111111" />
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#它做什么">它做什么</a> ·
  <a href="#架构">架构</a> ·
  <a href="#仓库结构">仓库结构</a> ·
  <a href="#命令">命令</a> ·
  <a href="docs/plugin-packages.md">插件约定</a>
</p>

---

## 它做什么

Biu 是一套 **Cordis 插件工作区**：Node host 负责会话、工具、Agent loop 和 HTTP/WS；浏览器壳只订阅 snapshot，用插槽拼出界面。主仓 **`host/`** 和 **`web/`** 只留加载器，具体能力都在 `packages/`，用 `cordis.plugins.json` 开关。

- **一切皆插件** — 依赖服务键（`inject`），不绑死实现类
- **会话是权威日志** — append-only session；对话从 `session/event` 投影，浏览器不持模型能力
- **热插拔能力** — 改 json、开关插件，host hub 与 web ui-hub 成对装卸
- **工具与审批** — tools 管线 + hold/auto；敏感调用进 composer dock
- **可替换 Agent loop** — factory 可换，agents 句柄不变
- **MCP / Terminal / LSP** — 可编排的宿主面，不是写死在壳里
- **VS Code 式壳** — Activity Bar 只内置 Agent；Dashboard / Tasks / Channels 由 cap 插件自己注册

## 快速开始

需要较新的 Node.js（建议 20+）和 npm。

```bash
git clone https://github.com/helloooooooooooooo97/BIU.git
cd BIU
git checkout hmr-dev   # 当前开发分支
make                   # 安装依赖并同时启动 host + Vite
```

启动后：

| 服务 | 地址 |
|------|------|
| UI | http://127.0.0.1:5173 |
| API / WS | http://127.0.0.1:3141 |

端口被占用时：

```bash
make stop      # 释放 3141 / 5173
make restart   # 停干净再启
```

也可以拆开跑：

```bash
npm install
npm run dev:host   # tsx host/index.ts
npm run dev:web    # Vite :5173，/api 和 /ws 代理到 host
```

## 架构

```
浏览器  web/main.tsx          host/index.ts  Node
        │  virtual web 表              │  host 表
        ▼                              ▼
   @biu/web-* 壳                  @biu/host-* 内核
        │                              │
        │         cordis.plugins.json  │
        └──────── plugins 表 ──────────┘
              @biu/cap-*  （./host + ./web 分入口）
```

| 表 | 谁加载 | 内容 |
|----|--------|------|
| `host` | `host/index.ts` | HTTP、sessions、tools、llm、hub … |
| `web` | `web/main.tsx` | slots、app-shell、ui-hub … |
| `plugins` | `@biu/host-hub` + `@biu/web-ui-hub` | 可热插拔能力；`web` 指向 `@biu/cap-*/web` |

壳不认识具体 cap 插件。json 的 `id` 用短名（`chat`、`http`）；包名一律 `@biu/<prefix>-<id>`。

完整约定：[docs/plugin-packages.md](docs/plugin-packages.md)

## 仓库结构

```
BIU
├── host/                 # host 加载器
├── web/                  # 前端加载器（main.tsx / 样式）
├── packages/
│   ├── type-*            # 共享契约（不是插件，不进 json）
│   ├── host-*            # host 内核  → src/host/（含 host-plugin-loader）
│   ├── web-*             # web 内核   → src/web/
│   └── cap-*             # 能力插件   → src/host + src/web
├── cordis.plugins.json   # 唯一插件清单
├── public/               # 静态资源
└── scripts/
    └── link-cordis-plugins.mjs   # postinstall 把包链到 node_modules
```

## 命令

| 命令 | 作用 |
|------|------|
| `make` / `make dev` | 安装依赖并同时起 host + web |
| `make host` / `make web` | 只起一侧 |
| `make stop` | 杀掉占用 3141 / 5173 的进程 |
| `make restart` | 先 stop 再 dev |
| `npm test` | Vitest |
| `npx tsc --noEmit` | 类型检查 |

环境变量（host）：

| 变量 | 默认 | 含义 |
|------|------|------|
| `PORT` | `3141` | HTTP / WS 端口 |
| `HTTP_HOST` | `127.0.0.1` | 监听地址 |

## 写一个能力插件

1. 在 `packages/` 建 `cap-<id>`，`exports` **分开** `./host` 和 `./web`（禁止一个入口同时带 Node + React）。
2. 在 `cordis.plugins.json` 的 `plugins` 表登记：

```json
{
  "id": "clock",
  "package": "@biu/cap-clock/host",
  "web": "@biu/cap-clock/web",
  "togglable": true,
  "enabled": true
}
```

3. 重启 host / Vite。侧栏关掉插件时，ui-hub 会卸掉对应卡片。

`type-*` 只给别人 `import`，不要写进 json。`web-mascot` 是共享 UI 库，也不进表。

## 许可

本仓库暂未声明开源许可证，默认保留版权。使用或分发前请先与维护者确认。
