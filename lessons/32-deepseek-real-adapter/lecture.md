# 32-deepseek-real-adapter 讲义

## 目标

- 实现 `DeepSeekAdapter`：满足第 31 课的 `LlmAdapter` 接缝。
- 处理 DeepSeek 特有的 `reasoning_content`（thinking）与流式 `tool_calls` 增量。
- 里程碑 **M6**：用真实 DeepSeek 跑通全链路。

## 1. 实现 LlmAdapter

第 31 课定义了接缝，第 32 课填上 DeepSeek 实现：

```ts
class DeepSeekAdapter implements LlmAdapter {
  readonly provider = 'deepseek'
  async *stream(messages, opts) {
    // POST {base}/chat/completions，stream: true，解析 SSE
  }
}
```

loop 只认 `StreamChunk`（第 31 课词汇表），完全不关心 DeepSeek 的 wire 格式。

## 2. DeepSeek 的独有内容

DeepSeek 流式响应的 `delta` 有三个字段：

| wire 字段 | 映射成 |
| --- | --- |
| `delta.content` | `{ type: 'text' }` |
| `delta.reasoning_content` | `{ type: 'reasoning' }`（thinking，第 31 课的 block） |
| `delta.tool_calls[i]` | `{ type: 'tool-call-delta' }`（id/name/arguments 分片） |

`assemble`（第 31 课）会把 reasoning 块、文本、tool-call 增量拼成完整 Message。

## 3. 测试策略

网络不可依赖：用**注入 fetchImpl + 预录 SSE**（第 07 课模式）验证解析；真实 key 留给你自己跑（作业）。

## 4. 与 dsh 的对照

dsh 的 `llm-deepseek` 就是这么实现的，挂在 `ctx.llm` 注册表下；`thinking` 的 reasoning token 单独记账（第 45 课遥测）。

## 小结

- DeepSeek adapter = 满足接缝 + 处理 `reasoning_content` + 流式 tool_calls。
- 解析逻辑靠注入 fetch 离线可测。
- **M6 达成**：真实模型接入完成。

## 预习

- 出错怎么办？（第 33 课：错误分类与重试。）
