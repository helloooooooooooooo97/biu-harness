# deepseek-harness-course

从零手写一个 DeepSeek harness（mini-dsh）：一门 53 课、按阶段推进的实战课程。前 17 课用独立小代码演示核心概念（并手写 mini-Cordis 内核），第 18 课起进入 `project/`（基于真实 cordis 的 monorepo 主工程），每课以增量补丁演进，并按课打 git tag（`lesson-18` … `lesson-53`）。

课程大纲依据 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 官方源码逐包核对：**一切皆插件**、类型化事件、可逆 effect 与热重载、能力缝三角色、profile/bundle/patch 分层、自指 Cordis 工具集（agent 写插件并热重载到前端）。

## 定位

- 面向想理解 agent harness 内部机制（而不是只会调 API）的开发者。
- 主线：DeepSeek API 接入 → agent loop → 会话日志 → 插件内核 → 工具流水线 → 应用层插件化（Skills/UI/动态自指）→ 安全与韧性 → 多 Agent 编排。
- 每课代码可运行：`code/` 下保证 `package.json` + 源码 + 测试的标配；`tools/verify-lesson.mjs` 负责一键验收。

## 最终目标

**从零到一写出一个可用的 deepseek harness（mini-dsh）**：能够连接真实 DeepSeek API，具备完整 agent loop、会话日志、工具流水线、配置与入口，并达到可安全上手的程度。课程不是知识清单，而是一条逐步构建路径：

| 里程碑 | 达成时点 | 产物 |
| --- | --- | --- |
| M1 | 第 08 课 | 单文件垂直切片：DeepSeek 调用 + 工具循环 + 流式 + mock 测试 |
| M2 | 第 12 课 | 会话事件日志与重放 |
| M3 | 第 17 课 | mini-Cordis 插件内核（生命周期 + 热重载） |
| M4 | 第 25 课 | 完整 agent loop 生命周期（agent/agent-loop） |
| M5 | 第 30 课 | 工具流水线（并发/重试/审批） |
| M6 | 第 32 课 | DeepSeek 真实适配器 |
| M7 | 第 40 课 | CLI / Web / JSON-RPC / ACP 入口 |
| M8 | 第 43 课 | 应用层插件化：Skills、UI 即插件、动态自指（agent 写组件热重载到前端） |
| M9 | 第 48 课 | 安全与韧性 |
| M10 | 第 53 课 | 结业评测与复盘 |

每个里程碑都可独立运行、独立验收，最终组装成 mini-dsh。

## 架构宣言：一切皆插件

mini-dsh 的运行时是一个 mini-Cordis 内核，**所有能力都是插件**：服务（`ctx.xxx`）、工具、系统提示词 section、事件、UI 组件、子代理，甚至 agent loop 本身和入口，都是运行时注册进来的插件。插件生命周期包含注册 effect、卸载（teardown）与**热重载**——改动插件或配置无需重启进程；更进一步，agent 可以用 `cordis_*` 工具自己写一个双半插件（host 逻辑 + 浏览器组件），经人工审批后热挂载到正在运行的前端。

原则细节与插件边界见 [00-start/architecture.md](00-start/architecture.md)。

## 学习路径

| 阶段 | 主题 | 课程 |
| --- | --- | --- |
| A | 认知与准备 | 01-04 |
| B | 垂直切片 | 05-08 |
| C | Session 日志 | 09-12 |
| D | 插件内核（mini-Cordis） | 13-17 |
| E | 拆解重构（换装真实 cordis，进入 project/） | 18-21 |
| F | Agent Loop 生命周期 | 22-25 |
| G | 工具流水线 | 26-30 |
| H | LLM 适配器与能力缝 | 31-35 |
| I | 配置组装与入口 | 36-40 |
| J | 应用层插件化（Skills / UI / 动态自指） | 41-43 |
| K | 安全与韧性 | 44-48 |
| L | 多 Agent 与生态 | 49-53 |

## 周计划（建议 7 周）

| 周次 | 课程 | 里程碑 |
| --- | --- | --- |
| 1 | 01-08 | 跑通官方 dsh + 单文件 agent loop |
| 2 | 09-17 | 会话日志 + mini-Cordis 插件内核 |
| 3 | 18-25 | monorepo 重构（真实 cordis）+ loop 生命周期 |
| 4 | 26-35 | 工具流水线 + DeepSeek 真实接入 |
| 5 | 36-43 | 配置/入口 + Skills + UI 即插件 + 动态自指 |
| 6 | 44-48 | 安全与韧性 |
| 7 | 49-53 | 多 Agent + 结业项目 + 评测复盘 |

## 目录约定

```text
00-start/        课程导论（前置、技术栈、路线图、术语、架构）
lessons/NN-slug/ 每课一个目录：README / lecture / homework / code
project/         课程主工程 mini-dsh（第 18 课起，按课打 tag）
solutions/       参考答案（与 lessons 一一对应）
assets/          素材（diagrams / screenshots）
tools/           生成与验收脚本、mock LLM
tests/e2e/       跨课端到端验收
```

## 快速开始

```bash
# 生成/重建 53 课骨架
node tools/gen-lesson-scaffold.mjs

# 验收某一课（检查文件齐备并运行其测试）
node tools/verify-lesson.mjs lessons/05-vertical-slice-agent
```

完整课表见 [syllabus.md](syllabus.md)，前置自查见 [00-start/prerequisites.md](00-start/prerequisites.md)，架构原理见 [00-start/architecture.md](00-start/architecture.md)。
