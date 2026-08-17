# project/ — 课程主工程 mini-dsh

本目录从第 18 课（monorepo 重构）开始填充内容：第 18 课把 mini-Cordis 内核换装为真实 `@deepseek-ai/cordis`，之后按真实 dsh 的 spine 结构演进（session、system-prompt、tools、agent、agent-loop、scope），每课以增量补丁演进，并按课打 tag：

```bash
git tag lesson-18    # 第 18 课结束后的快照
git tag lesson-19
# ... 依此类推
```

约定：

- `packages/*`：按职责拆分的核心包（session、agent-loop、tools、llm、config 等）。
- `apps/*`：可执行入口（cli、web、server）。
- 每课的 `lessons/NN-slug/code/` 只放该课的增量文件/补丁，配合对应 tag 使用。

> 第 18 课之前本目录保持为空。
