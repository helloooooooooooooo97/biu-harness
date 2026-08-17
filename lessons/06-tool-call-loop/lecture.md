# 06-tool-call-loop 讲义

## 目标

- 实现完整的工具调用循环：`tool_call` 解析 → 执行 → 回填 → 再次请求。
- 理解 messages 里的三种新形态：`assistant.tool_calls`、`tool.tool_call_id`、`tool` 角色。
- 理解工具执行失败为什么必须"回给模型"，而不是让循环崩溃。

## 1. 循环长什么样

第 05 课的最小循环是"问一次、答一次"。真实 agent 多一步：**模型可以要求调用工具**。循环变成：

```text
user 消息
  ↓
模型回复（可能带 tool_calls）
  ├─ 没有 tool_calls → 输出回复，结束
  └─ 有 tool_calls → 把 assistant 消息（含 tool_calls）放进 messages
        ↓ 逐个执行工具
      把每个结果作为 role: "tool" 的消息回填（带 tool_call_id）
        ↓
      再次请求模型（它会基于工具结果继续）
```

直到模型不再要工具，或超过最大步数。这就是 `AgentV2`：

```ts
export class AgentV2 {
  async run(prompt: string): Promise<RunResult> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    for (let step = 0; step < this.maxSteps; step++) {
      const reply = await this.chatClient.chat(messages)
      if (!reply.toolCalls?.length) {
        messages.push({ role: 'assistant', content: reply.content })
        return { messages, steps: step + 1 }
      }
      messages.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls })
      for (const call of reply.toolCalls) {
        messages.push({ role: 'tool', toolCallId: call.id, content: await this.tools.execute(call) })
      }
    }
    throw new Error(`超过最大 step 数 ${this.maxSteps}`)
  }
}
```

## 2. tool_call 的 wire 格式

API 返回的 assistant 消息里，工具调用长这样（OpenAI 兼容格式）：

```json
{
  "role": "assistant",
  "content": "我来执行。",
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": { "name": "bash", "arguments": "{\"command\":\"ls\"}" }
    }
  ]
}
```

三个要点：

- `arguments` 是 **JSON 字符串**，不是对象——执行前要 `JSON.parse`，解析失败要兜底（回给模型"参数无法解析"）。
- 回填工具结果时，`role: "tool"` 的消息必须带 `tool_call_id`，和请求里的 `id` 配对。
- 工具结果同样只是普通文本内容，模型把它当作"看到了工具输出"继续推理。

## 3. 错误处理：失败也是结果

工具执行失败（命令报错、参数非法、工具不存在）**不能抛异常中断循环**——正确的做法是把错误文本作为 tool 结果回给模型：

```ts
try {
  content = await this.tools.execute(call)
} catch (err) {
  content = `错误: ${err.message}`
}
```

为什么？因为模型需要知道失败才能自我纠正（换参数、换工具、向用户解释）。dsh 里这个语义就是 `tool/result` 的 `isError` 标记——错误和成功都是"结果"，只是标记不同。

## 4. 本课代码结构（OOD）

```text
chat-client.ts     ChatClient：请求/响应、wire 序列化（tool_calls ↔ tool）
tool.ts            Tool 接口 + EchoTool / BashTool 实现
tool-registry.ts   ToolRegistry：注册 / 查询 / 执行
agent-v2.ts        AgentV2：循环（解析 → 执行 → 回填）
cli.ts             入口：装配 registry 和真实 key
```

`ToolRegistry` 是 dsh `ctx.tools` 的雏形：模型只按名字调工具，注册表决定"哪些工具可见、谁执行"。

## 5. 与 dsh 的对照

dsh 的工具调用不是直通：`tool/call` 先入日志，然后 `tools/pre-execute`（权限/沙箱）→ guard → `tools/execute`（超时/重试）→ 工具体 → `tools/post-execute` → `tools/result`。本课是这条流水线的"直通版"；第 27 课会把它拆成完整流水线，第 30 课加审批。

## 小结

- 工具循环 = 解析 → 执行 → 回填 → 再请求，直到模型不再要工具。
- `arguments` 是 JSON 字符串；`tool` 消息靠 `tool_call_id` 配对。
- 工具失败要作为结果回给模型，让模型自己纠错。
- `ToolRegistry` 是工具注册表的雏形，`AgentV2` 是 agent loop 的第二步。

## 预习

- 如果模型一次要调用 3 个工具，是串行执行还是并行？（第 28 课。）
- 工具输出很长时怎么办？（第 43/46 课：结果裁剪与压缩。）
