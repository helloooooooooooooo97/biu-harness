# 04-tech-stack-and-roadmap 作业

## 作业

1. **环境确认**：`node -v` 确认 Node 22+；`pnpm -v` 确认 pnpm 已安装（没有则 `npm i -g pnpm`）；写一个 `hello.ts` 用 `npx tsx hello.ts` 跑通。
2. **生成骨架**：在 `code/` 目录运行 `npm start -- --dir /tmp/mini-dsh-demo`，然后用 `find /tmp/mini-dsh-demo -maxdepth 2 -type d` 检查结构；再跑一次 `--dry-run` 对比。
3. **空目录保护**：故意在一个已有文件的目录上运行 scaffold（如 `npm start -- --dir .`），确认它拒绝覆盖。
4. **回答问题**：为什么 `llm`（词汇表）和 `llm-deepseek`（适配器）要分成两个包？写出你的理解（50 字以上）。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/04-tech-stack-and-roadmap
cd lessons/04-tech-stack-and-roadmap/code && npm test
```

- 骨架生成成功且包含 `packages/core-session`、`packages/llm-deepseek`、`apps/cli`。
- 非空目录被拒绝（测试已覆盖）。
