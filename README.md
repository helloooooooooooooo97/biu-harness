<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Biu" />
</p>

<h1 align="center">Biu</h1>

<p align="center">
  一切即插件的 Agent Harness。<br />
  多 Agent 不靠群聊，靠任务看板协作。
</p>

<p align="center">
  <a href="#理念">理念</a> ·
  <a href="#任务看板上的多-agent">多 Agent</a> ·
  <a href="#harness-的可观测性">可观测性</a> ·
  <a href="#设计">设计</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="docs/plugin-packages.md">插件约定</a>
</p>

---

## 理念

Biu 不是「聊天窗口外挂几个 tool」。它是一套 **Agent Harness**：运行时、能力、界面都是插件；人、调度席、执行席共享同一份任务对象。

**一切即插件。** HTTP、会话、工具、LLM、审批、Agent loop、壳、侧栏、对话、任务、看板——一律 Cordis 插件，靠服务键 `inject`，不绑实现类。主仓 `host/` 和 `web/` 只做加载；清单只有一份 [`cordis.plugins.json`](cordis.plugins.json)。关掉 `tasks`，看板、派工工具、心跳一起消失；壳不知道「任务」这个词，只认识插槽。

**Session 是权威日志。** 每个 Agent 是一条 append-only session。模型输出、tool 调用、审批、派工，都先写成 `session/event`。浏览器只投影，不持能力。

**协作对象是任务，不是另一段 prompt。** 多 Agent 交互发生在任务看板上：创建、指派到某个 session、依赖与阻塞、触发派工、`task_report` 回报。这是 Harness 的工作面，不是演示页。

## 任务看板上的多 Agent

常见产品把「多 Agent」做成一个窗口里轮流说话。Biu 里每个 Agent 是独立 session（可绑工作区、模型、工具集），**任务看板是它们之间的总线**。

```
人 / Live 调度席
        │  建任务 · 指派 session · 设依赖 / 触发器
        ▼
   任务看板  ── task_deliver / 自动触发 ──►  执行席 session（被 wake）
        ▲                                      │
        └──────── task_report（doing / done）───┘
```

- **一张板，两边都能动。** 人在 UI 上建卡、改负责人、看阻塞；Agent 用 `tasks_list` / `tasks_update` / `task_deliver` / `task_report` 做同一件事。看板不是只给人看的仪表盘。
- **执行席是 session，不是角色标签。** 指派 `assigneeSessionId` 就是把卡交给那个对话。对方收到派工消息后干活，用 `task_report` 把进度写回任务（状态、说明、当回合用量）。删掉 session，报告仍在任务上。
- **依赖是图，不是待办列表。** `parentId` / `dependsOn` 派生阻塞链；上游 `done` 可以 `dep:done` 自动触发下游派工。回合结束 `turn:end`、cron / at 同一套 trigger 状态机：`idle → pending → delivered → done`。
- **调度席可以不亲自干。** `live` session 用 `session_wake` / `session_inject` 指挥其他 chat session；任务看板负责「这件事归谁、卡在哪、何时再派」。Live 管现场，看板管工作项——多数产品只有前者或只有一个群聊。

侧栏打开 **Tasks** 就是这块板。对话右侧检查器里也会挂同一份任务视图：一边看轨迹，一边看卡。

## Harness 的可观测性

Harness 要能回答：现在装了什么、Agent 做了什么、工具和路由从哪来、协作卡在哪。Biu 把这些做成运行时表面，而不是事后 grep 日志。

| 你想看见的 | 从哪看 |
|------------|--------|
| 哪个插件在跑、能否热卸 | Settings → Plugins（`web-plugin-tree`，写回 hub） |
| host 暴露了哪些 HTTP | Settings → Routes |
| Cordis 刚刚 dispatch 了什么 | Settings → Events（hub 订阅 `internal/dispatch`，滤掉 stream chunk） |
| 这一回合模型/工具逐步做了什么 | 右侧检查器 **轨迹**（事件投影，不是另存一份聊天记录） |
| token 怎么花的 | 检查器 **用量**；任务上的 report 会固化当回合消耗 |
| 多 Agent 谁在做哪张卡 | 任务看板 + 检查器任务页；对话里 Live 的「本回合派工」表 |
| 工具从哪来、对当前 session 是否有效 | 会话配置 / inspector API（`/api/sessions/:id/inspector`） |

原则就一条：**能进 session 日志的，就不藏在插件私有状态里。** 投影可以换，日志不能丢。插件装卸立刻反映到 snapshot（插件表、路由表、工具名），UI 只订阅，不猜测。

## 设计

```
浏览器                         Node
web/main.tsx                   host/index.ts
  只加载 web 表                   只加载 host 表
        │                              │
        ▼                              ▼
  @biu/web-*  壳                  @biu/host-*  内核
  插槽 / 投影 / 检查器框            会话 / 工具 / loop / HTTP·WS
        │                              │
        └──── cordis.plugins.json ─────┘
                    plugins 表
              @biu/cap-*  （./host 与 ./web 分入口）
```

- **三张表：** `host` 内核不可热卸；`web` 壳；`plugins` 可热插拔能力。json 的 `id` 用短名（`chat`、`http`），包名 `@biu/<prefix>-<id>`。
- **壳只认插槽。** `composer`、`inspector-panels`、`app-modules`、Settings 各栏……能力自己 `place`。Activity Bar 里 Dashboard / Tasks / Channels 都是 cap 自己注册的模块。
- **Agent loop 可替换。** `agents` 句柄不变，factory 可换。
- **审批在管线上。** 敏感 tool 进 hold，UI 在 dock，不写进壳逻辑。

包前缀与入口拆分见 [docs/plugin-packages.md](docs/plugin-packages.md)。

## 快速开始

需要 Node.js 20+ 与 npm。当前开发分支是 `hmr-dev`。

```bash
git clone https://github.com/helloooooooooooooo97/BIU.git
cd BIU
git checkout hmr-dev
make          # npm install + host :3141 + Vite :5173
```

| | |
|--|--|
| UI | http://127.0.0.1:5173 |
| API / WS | http://127.0.0.1:3141 |

未配模型 Key 时发消息只会本地回声。在 **Settings → Models** 填写 DeepSeek / OpenAI / Anthropic，或启动前设置环境变量：

```bash
export DEEPSEEK_API_KEY=...    # 或 OPENAI_API_KEY / ANTHROPIC_API_KEY
export CHAT_MODEL=deepseek-chat  # 可选
```

端口占用：`make stop` 或 `make restart`。拆开跑：`npm run dev:host` 与 `npm run dev:web`。

建议先开一个 **Live** 会话当调度席，再建执行席 chat session；在 Tasks 上看板建卡并指派，或让调度席用工具派工。右侧打开检查器看轨迹和任务。

## 仓库

```
host/   web/          加载器（不要往这里堆能力）
packages/
  type-*              契约，不进 json
  host-*              Node 内核（含 live 派工、plugin-loader）
  web-*               浏览器内核（壳、插槽、snapshot）
  cap-*               可热插拔能力（chat / tasks / dashboard / channels …）
cordis.plugins.json   唯一清单
```

| 命令 | |
|------|--|
| `make` / `make restart` | 安装并同时起两侧 / 先停再起 |
| `make host` / `make web` | 只起一侧 |
| `npm test` | Vitest |
| `npx tsc --noEmit` | 类型检查 |

| 环境变量 | 默认 | |
|----------|------|--|
| `PORT` / `HTTP_HOST` | `3141` / `127.0.0.1` | host 监听 |
| `CORDIS_WORKSPACE` | `.workspace` | 默认工作区根 |
| `DEEPSEEK_API_KEY` 等 | | 模型；也可只在 UI 里存 |

加能力：`packages/cap-<id>`，`exports` 分开 `./host` 与 `./web`，在 json 的 `plugins` 表登记，重启。`type-*` 和 `web-mascot` 不要进表。细节仍看 [插件约定](docs/plugin-packages.md)。

## 许可

本仓库暂未声明开源许可证，默认保留版权。使用或分发前请与维护者确认。
