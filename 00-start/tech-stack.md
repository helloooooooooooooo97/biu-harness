# 技术栈与环境搭建

> TODO：逐步验证后填充具体版本与安装命令。

- 运行时：Node.js（>= 20，需要原生 fetch 与 SSE 解析）
- 包管理：pnpm（第 18 课起使用 workspace）
- 语言：TypeScript（`tsx` 直接运行 + `tsc` 类型检查）
- 测试：node:test（零依赖优先，避免课程环境漂移）
- LLM：DeepSeek API（兼容 OpenAI 消息格式）

## 环境变量

```bash
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
```

## 验收命令

```bash
node tools/verify-lesson.mjs lessons/NN-slug
```
