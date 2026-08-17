# 08-mock-llm-replay 讲义

## 目标

- 把"假回复"从测试小工具升级成**可复用的录放 mock LLM 服务**。
- 理解接缝：`LlmClient` 接口让真实适配器与 mock 适配器可互换。
- 用 fixture 离线跑通完整的工具循环。

## 1. 为什么需要 mock LLM

第 05-07 课里，测试用的是手写的假 fetch；真实调试又要连 API。问题：

- 测试依赖手写假响应，换课程就重写；
- 真实 API 有成本、有延迟、不可重复；
- 故障注入（429、超时、断流）很难在真实服务上稳定复现。

答案是**录放（record & replay）**：把真实响应录成 fixture 文件，测试时按请求命中并重放。

## 2. 接缝：LlmClient

第 06 课讨论过 Definition / Provider 分离。这里正式落地：

```ts
export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
```

两个实现：

```text
ChatClient（真实 DeepSeek）  implements LlmClient
MockLlm（fixture 录放）      implements LlmClient
```

`AgentV2` 不再自己 new 客户端，而是**构造器注入**：

```ts
new AgentV2({ client: new MockLlm(store) })   // 测试/离线
new AgentV2({ client: new ChatClient() })     // 生产
```

这和第 05 课注入 `fetchImpl` 是同一件事的升级：**注入点从"传输层"上移到了"适配器层"**。

## 3. Fixture 格式

fixture 是一行一个场景的 JSONL，key 是命中依据（本课用最后一条 user 消息）：

```jsonl
{"key":"帮我 echo hi","content":"我来执行。","toolCalls":[{"id":"mock-call-1","name":"echo","arguments":"{\"text\":\"hi\"}"}]}
{"key":"帮我 echo hi","content":"已执行 echo，结果是 hi。","toolCalls":[]}
```

同一个 key 可以有多条：按顺序消费——第一次命中返回工具调用，第二次返回最终回答。这样**整个工具循环都能离线跑通**。

## 4. OOD 结构

```text
types.ts         ChatMessage / ToolCall / AssistantReply
llm.ts           LlmClient 接口（Definition）
chat-client.ts   ChatClient：真实实现（Provider：DeepSeek）
mock-llm.ts      FixtureStore + MockLlm：录放实现（Provider：fixtures）
tool.ts / tool-registry.ts  工具
agent-v2.ts      AgentV2：只依赖 LlmClient（Consumer）
cli.ts           入口：按环境选 Provider
```

## 5. 与 dsh 的对照

dsh 的 `llm-replay` 就是干这个的正式包（还有 `llm-pi-ai`、`llm-deepseek` 等 provider 挂在同一个 `ctx.llm` 注册表下）。第 31-32 课会把它升级成"注册表"形态；故障注入（429/超时/畸形 JSON）作为扩展课时。

## 小结

- mock 不是测试里的 if 分支，而是**第二个 Provider 实现**。
- 接缝（LlmClient）+ 注入 = 测试离线、生产在线、互不干扰。
- fixture 按 key 命中、同 key 按序消费，可以复现完整多步循环。

## 预习

- 如果 fixture 没命中，应该报错还是静默降级？（本课抛错：失败要响亮。）
- 记录真实响应成 fixture 的"录制器"应该长什么样？（扩展课时。）
