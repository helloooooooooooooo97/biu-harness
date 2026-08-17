# deepseek-harness-course

从零手写一个 DeepSeek harness（mini-dsh）：一门 50 课、按阶段推进的实战课程。前 17 课用独立小代码演示核心概念，第 18 课起进入 `project/`（mini-dsh monorepo 主工程），每课以增量补丁演进，并按课打 git tag（`lesson-18` … `lesson-50`）。

## 定位

- 面向想理解 agent harness 内部机制（而不是只会调 API）的开发者。
- 主线：DeepSeek API 接入 → agent loop → 会话日志 → 插件内核 → 工具流水线 → 安全与韧性 → 多 Agent 编排。
- 每课代码可运行：`code/` 下保证 `package.json` + 源码 + 测试的标配；`tools/verify-lesson.mjs` 负责一键验收。

## 学习路径

| 阶段 | 主题 | 课程 |
| --- | --- | --- |
| A | 认知与准备 | 01-04 |
| B | 垂直切片 | 05-08 |
| C | Session 日志 | 09-12 |
| D | 插件内核（mini-Cordis） | 13-17 |
| E | 拆解重构（进入 project/） | 18-21 |
| F | Agent Loop 生命周期 | 22-25 |
| G | 工具流水线 | 26-30 |
| H | LLM 适配器与能力缝 | 31-35 |
| I | 配置组装与入口 | 36-40 |
| J | 安全与韧性 | 41-45 |
| K | 多 Agent 与生态 | 46-50 |

## 周计划（建议 6 周）

| 周次 | 课程 | 里程碑 |
| --- | --- | --- |
| 1 | 01-08 | 跑通官方 dsh + 单文件 agent loop |
| 2 | 09-17 | 会话日志 + mini-Cordis 插件内核 |
| 3 | 18-25 | monorepo 重构 + loop 生命周期 |
| 4 | 26-35 | 工具流水线 + DeepSeek 真实接入 |
| 5 | 36-45 | 配置/入口 + 安全与韧性 |
| 6 | 46-50 | 多 Agent + 结业项目 + 评测复盘 |

## 目录约定

```text
00-start/        课程导论（前置、技术栈、路线图、术语）
lessons/NN-slug/ 每课一个目录：README / lecture / homework / code
project/         课程主工程 mini-dsh（第 18 课起，按课打 tag）
solutions/       参考答案（与 lessons 一一对应）
assets/          素材（diagrams / screenshots）
tools/           生成与验收脚本、mock LLM
tests/e2e/       跨课端到端验收
```

## 快速开始

```bash
# 生成/重建 50 课骨架
node tools/gen-lesson-scaffold.mjs

# 验收某一课（检查文件齐备并运行其测试）
node tools/verify-lesson.mjs lessons/05-vertical-slice-agent
```

完整课表见 [syllabus.md](syllabus.md)，前置自查见 [00-start/prerequisites.md](00-start/prerequisites.md)。
