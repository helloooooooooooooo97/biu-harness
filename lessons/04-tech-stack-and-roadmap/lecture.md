# 04-tech-stack-and-roadmap 讲义

## 目标

- 定下全课技术栈：Node.js 22+、pnpm、TypeScript、tsx、node:test。
- 理解 monorepo（pnpm workspace）为什么是 harness 项目的正确形态。
- 会用 `scaffold.sh` 一键生成 `project/` 骨架。
- 理解 git tag 约定（`lesson-18` … `lesson-53`）。

## 1. 技术栈决策

| 组件 | 选择 | 理由 |
| --- | --- | --- |
| 运行时 | Node.js 22+ | 原生 fetch/SSE、`node --test`、`process.loadEnvFile` |
| 包管理 | pnpm workspace | 第 18 课起的 monorepo 依赖解析 |
| 语言 | TypeScript（strict） | dsh 源码就是 TS + 声明合并 |
| 运行 TS | tsx | 免构建直接跑测试 |
| 测试 | node:test（起步）/ vitest（后期） | 零依赖起步，后期换 vitest 有 dsh 同款快照能力 |
| LLM | DeepSeek API（OpenAI 兼容格式） | 课程主线 |

环境变量约定：

```bash
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
```

## 2. 为什么是 monorepo

课程第 18 课会把单文件切片拆成 dsh 那样的 spine 结构。拆分后你会得到十几个包：

```text
packages/
  core-session       会话日志
  core-agent-loop    agent loop 驱动
  core-tools         工具注册表与执行流水线
  core-system-prompt 系统提示词组装
  llm / llm-deepseek LLM 词汇表与 DeepSeek 适配器
  tool-fs / tool-bash 模型面工具
  approval / guard   审批与守卫
  credentials        凭据
  compaction-basic   上下文压缩
  subagent-inprocess 子代理
  workflow           多 Agent 编排
  telemetry          遥测
  config             配置加载
  preset-minimal     最小产品形态
apps/
  cli / web / server 入口
```

为什么不用一个包装下？因为 dsh 的架构原则是**可替换**：换工具后端、换 LLM 适配器、换持久化实现，都应该只动一个包。包边界就是未来插件边界（第 13 课正式讲插件模型）。

## 3. scaffold.sh

生成骨架（默认 `project/`）：

```bash
bash code/scaffold.sh
bash code/scaffold.sh --dir /tmp/my-mini-dsh   # 指定目录
bash code/scaffold.sh --dry-run                # 只看结构不落盘
```

脚本生成的每个包都有 `package.json` + `src/index.ts` 占位；此时不写实现，只立边界。

## 4. git tag 约定

第 18 课起每完成一课，给主工程打一个 tag，课程增量才有锚点：

```bash
git tag lesson-18
git tag lesson-19
# ... 依此类推到 lesson-53
```

每课 `lessons/NN-slug/code/` 只放该课的增量文件/补丁，配合对应 tag 使用。

## 5. 本课验收路径

```bash
cd lessons/04-tech-stack-and-roadmap/code
bash scaffold.sh --dir /tmp/lesson04-demo
find /tmp/lesson04-demo -maxdepth 2 -type d
```

看到 `packages/*` 和 `apps/*` 即成功。

## 小结

- 技术栈：Node 22+ / pnpm / TS / tsx / node:test。
- monorepo 的包边界 = 未来的插件边界。
- `scaffold.sh` 一键生成 `project/` 骨架；tag 约定保证课程增量可回放。

## 预习

- 第 05 课开始写第一个真实代码：单文件 agent loop。预习 OpenAI 兼容的 `/chat/completions` 请求格式。
