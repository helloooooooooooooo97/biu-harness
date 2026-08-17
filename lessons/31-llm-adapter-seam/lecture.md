# 31-llm-adapter-seam 讲义

## 目标

- 定义 LLM 的**统一词汇表**：`Message` / `ContentBlock` / `StreamChunk`。
- 定义**适配器接缝**：`LlmAdapter`（provider + stream），任何模型供应商实现它就能接入。
- 实现 `AdapterRegistry`：按 provider 名注册/取用，换模型 = 换 adapter。

## 1. 词汇表：模型无关的中间语言

第 06 课的工具循环直接操作 API 的 `{ role, content, tool_calls }`。第 31 课把它升级成**模型无关的词汇表**：

```ts
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }        // thinking 内容（DeepSeek）
  | { type: 'tool-call'; id; name; arguments }
  | { type: 'tool-result'; toolCallId; content }

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: ContentBlock[]
}
```

为什么需要它？因为不同供应商的消息形状不同（DeepSeek 有 `reasoning_content`、OpenAI 的 `tool_calls` 结构不同……）。**词汇表把"供应商方言"翻译成"统一语言"**，loop 只认词汇表。

## 2. 适配器接缝

```ts
interface LlmAdapter {
  provider: string
  stream(messages: Message[], opts?): AsyncGenerator<StreamChunk>
}
```

`StreamChunk` 是流式增量：text / reasoning / tool-call-delta / finish。任何实现（DeepSeek、mock、replay）只要满足这个签名就能挂进注册表。

## 3. AdapterRegistry：按名寻址

```ts
registry.register(deepseekAdapter)
registry.get('deepseek')   // 换模型 = 换 provider 字符串
```

这正是 `ctx.llm` 的雏形（第 32 课注册 DeepSeek，第 08 课的 mock 也能注册进去）。

## 4. 与 dsh 的对照

dsh 的 `packages/llm` 就是这个词汇表：`ContentBlockMap` 合并可扩展（text/reasoning/image/tool-call/tool-result），`llm-deepseek`、`llm-replay` 实现同一个 adapter 契约。第 34 课会把它放进"能力缝三角色"里看。

## 小结

- 词汇表 = 模型无关的中间语言（Message/ContentBlock/StreamChunk）。
- LlmAdapter = 接缝，任何供应商实现它就能接入。
- AdapterRegistry = 按名寻址，换模型只换 provider。

## 预习

- 真实 DeepSeek 怎么实现这个 adapter？（第 32 课。）
