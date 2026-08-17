# 01-harness-what-and-why 作业

## 作业

1. **一句话定义**：用自己的话写 3 句话，分别解释模型、框架、harness 的分工，并各举一个例子。
2. **模型清单**：运行 `code/api-model-list.mjs`，无 key 也能跑（输出内置清单）。如果你有 `DEEPSEEK_API_KEY`，设置后重跑一次，对比 API 返回与内置清单的差异。
3. **观察模板**：读一遍 `code/observation-template.md`，把它的字段抄写/改进成你自己的版本（至少保留：任务、请求内容、回复、工具调用、token、疑问）。
4. **预习记录**：尝试安装 Node.js 22+（若已装，记录版本号 `node -v`）。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/01-harness-what-and-why
cd lessons/01-harness-what-and-why/code && npm test
```

- `api-model-list.mjs` 能打印模型列表（无 key 时也能运行）。
- 作业 1-3 的内容写在你的笔记里（或本课的 `code/observation-template.md` 之外另存一份）。
