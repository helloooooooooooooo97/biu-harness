# 03-read-the-trace 作业

## 作业

1. **解析样例**：运行下面三条命令，理解三种输出格式：

   ```bash
   npx tsx trace-parser.ts sample-session.jsonl --summary
   npx tsx trace-parser.ts sample-session.jsonl --csv
   npx tsx trace-parser.ts sample-session.jsonl --json
   ```

2. **手写日志**：不借助工具，自己写一份 6 行以上的 JSONL 会话日志（至少包含 `turn/start`、`user/message`、`step/start`、`tool/call`、`tool/result`、`turn/end`），存为 `my-session.jsonl`，然后用 parser 解析。
3. **真实日志**：回到第 02 课，用官方 dsh 跑一个任务，找到它导出的会话/轨迹（或你记录的观察模板），把它整理成 JSONL 格式，用 parser 统计 turn/step/tool 数量。
4. **回答**：`assistant/chunk` 和 `assistant/message` 为什么都要记录？（写出你的理解。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/03-read-the-trace
cd lessons/03-read-the-trace/code && npm test
```

- 样例日志解析结果与测试断言一致（1 turn、2 step、2 个 assistant/message、3 个 assistant/chunk、1 次 tool/call + 1 次 tool/result）。
- 你手写的 `my-session.jsonl` 能被 parser 正确解析（无 unparsed 行）。
