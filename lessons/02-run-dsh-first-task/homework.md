# 02-run-dsh-first-task 作业

## 作业

1. **启动**：运行 `code/start.sh`（或直接 `npx @deepseek-ai/dsh web`），打开 `http://127.0.0.1:3080`。
2. **三个任务**：从 `code/tasks/prompts.md` 里选 3 个任务依次执行：
   - 环境探测：查看当前目录；
   - 文件读写：读一个文件并总结；
   - 写脚本：让 agent 写一个小脚本并运行。
3. **轨迹观察**：对每个任务，记录它经历了几个 turn、几个 step、哪些工具调用、prompt/completion token 各多少（用第 01 课的观察模板）。
4. **headless**：用 `--profile headless` 再跑一次「查看当前目录」，对比它与 Web UI 输出的差异。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/02-run-dsh-first-task
```

- Web UI 能正常打开并完成 3 个任务。
- 观察模板至少填写 2 份，包含 turn/step 数量与 token 数据。
- 能回答：一个 step 和一个 turn 的区别是什么？（写在你的笔记里）

turn：用户问了几次
step：