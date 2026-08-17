# 18-monorepo-refactor 作业

## 作业

1. **生成骨架**：运行 `npm start -- --dir /tmp/mini-dsh`（或 `npx tsx workspace.ts`），检查 `packages/` 下 6 个包和 `apps/cli`。
2. **执行搬移**：按 `REFACTOR_MAP` 把第 05/06 课的源码搬进对应包（chat-client → llm-deepseek、agent-v1 → core-agent-loop、tool/tool-registry → core-tools）。搬完运行 `npm start -- check`（`RefactorChecker`）确认没有缺失。
3. **换真实 cordis**：在 workspace 根目录 `pnpm install && pnpm add @deepseek-ai/cordis -w`，确认 `llm-deepseek` 的依赖里出现 `@deepseek-ai/cordis`。
4. **跑构建**：`pnpm -r build`，修到全部包通过 `tsc --noEmit`。
5. **回答问题**：为什么 `core-agent-loop` 只能依赖接口（llm/tools/session），不能 import `llm-deepseek`？（提示：换供应商要改几个包？）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/18-monorepo-refactor
cd lessons/18-monorepo-refactor/code && npm test
```

- workspace 测试通过；`REFACTOR_MAP` 每个目标路径唯一且落在 `packages/` 下。
