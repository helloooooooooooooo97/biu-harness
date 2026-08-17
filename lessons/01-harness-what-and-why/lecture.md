# 01-harness-what-and-why 讲义

## 目标

- 说清楚「agent harness」是什么，以及它和「模型」「智能体框架」的边界在哪里。
- 认识官方 DeepSeek Harness（dsh）的运行形态：`web` 与 `headless`。
- 建立贯穿全课的第一原则：**一切皆插件**。
- 拿到全课地图：53 课、12 个阶段，知道自己每一步在造什么。

## 1. 模型、框架、harness 的边界

三个词经常混用，但它们的职责完全不同：

| 层 | 负责什么 | 例子 |
| --- | --- | --- |
| 模型 | 把「文本进」变成「文本出」，只懂 token | DeepSeek 的 chat / reasoner 模型 |
| 框架 | 给你写程序的骨架：事件、插件、依赖注入 | Cordis |
| harness | 把模型变成「能干活的东西」：循环、工具、日志、安全、UI | dsh（DeepSeek Harness） |

一句话：**模型回答你，harness 替你干活。** harness 负责把用户的意图变成多轮请求、把模型的工具调用变成真实操作（读文件、跑命令、写代码），并记录这一切。

## 2. dsh 是什么

DeepSeek Harness（`dsh`）是 DeepSeek AI 开源的 agent harness。它由 Cordis 驱动，采用**一切皆插件**的架构：模型适配器、工具注册表、会话日志、甚至 agent loop 本身都是插件，都可以从配置里替换。

两种运行形态：

- `dsh web`：本地 Web UI，能看到轨迹、对话、工具卡片，适合交互使用。
- `dsh --profile headless "任务"`：一次性运行，打印最终答案后退出，适合自动化。

本课程的目标不是「学会用 dsh」，而是**从零到一复现一个 mini-dsh**：第 13-17 课手写一个 mini-Cordis 内核理解机制，第 18 课换装真实 cordis，之后按 dsh 的 spine 结构逐课演进。

## 3. 一切皆插件

dsh 的架构宣言（本课程第 13 课会正式实现它）：

> 没有特权核心。你想扩展 dsh，就在它旁边挂一个插件。

哪些东西是插件？

- 服务：`ctx.sessions`、`ctx.tools`、`ctx.llm`、`ctx.agents`
- 模型适配器：DeepSeek、其他 OpenAI 兼容服务
- 工具：读文件、跑 bash、搜网页
- 系统提示词 section：每个插件贡献一段
- UI 组件：对话节点、轨迹面板
- agent loop 驱动本身：通过 `ctx.agents.setFactory()` 注册
- 入口：CLI、Web、JSON-RPC/ACP

为什么这样做？因为**可替换、可组合、可观测、可热更新**——换模型不动内核，换工具后端不动 loop，改配置不用重启进程。

## 4. 课程地图（53 课 · 12 阶段）

| 阶段 | 主题 | 课程 | 产物 |
| --- | --- | --- | --- |
| A | 认知与准备 | 01-04 | 能跑官方 dsh，读懂轨迹，环境就绪 |
| B | 垂直切片 | 05-08 | 单文件 agent loop：请求→工具→流式→mock |
| C | Session 日志 | 09-12 | append-only 事件流 + 从日志重建上下文 |
| D | 插件内核 | 13-17 | mini-Cordis：ctx/服务/事件/effect/热重载 |
| E | 拆解重构 | 18-21 | pnpm workspace + 换装真实 cordis |
| F | Loop 生命周期 | 22-25 | step/turn/inbox/steering/pre-step |
| G | 工具流水线 | 26-30 | 定义/执行/并发/超时/审批 |
| H | LLM 与能力缝 | 31-35 | 适配器、DeepSeek 真实接入、三角色能力缝 |
| I | 配置与入口 | 36-40 | profile/bundle/patch、CLI/Web/JSON-RPC |
| J | 应用层插件化 | 41-43 | Skills、UI 即插件、动态自指（agent 写插件热重载到前端） |
| K | 安全与韧性 | 44-48 | 守卫、取消、压缩、steering 回执、遥测 |
| L | 多 Agent 与生态 | 49-53 | 子代理、workflow、发布、结业、评测 |

建议每周 7-8 课，7 周完成。

## 5. 本课代码

`code/api-model-list.mjs`：列出 DeepSeek 可用模型的小脚本（有 API key 时走真实接口，无 key 时输出内置清单）。

`code/observation-template.md`：观察模板。从第 02 课开始，每个任务都用它记录「模型看到了什么、工具做了什么、token 花了多少」——这是培养轨迹敏感度的第一步。

## 小结

- harness = 把模型变成能干活的东西，负责循环、工具、日志、安全、UI。
- dsh 由 Cordis 驱动，一切皆插件，连 loop 本身都可替换。
- 本课程 = 从零复现 mini-dsh：先手写内核，再换真实 cordis，最后做应用层与生态。

## 预习

- 安装 Node.js 22+。
- 准备 DeepSeek API Key（`DEEPSEEK_API_KEY`）。
- 跑一遍 `npx @deepseek-ai/dsh web`（第 02 课会详细讲）。
