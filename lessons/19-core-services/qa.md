好，把第 19 课的五个接口逐个拆开：**契约是什么、每个方法为什么这么定、为什么"最小"本身就是设计原则**。

## 1. LlmClient —— LLM 的最小对话面

```ts
interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
```

- **为什么只有一个 `chat`**：循环对 LLM 的最小需求就是"给我一组消息，还我一个回复"。流式（第 07 课）是额外能力，留给 `StreamingLlmClient` 扩展；**最小契约只保证能对话**。
- **为什么 `messages` 是数组**：对话是历史累积的（第 10 课 derive 出来的就是它），一次请求必须带上完整上下文，而不是"上一轮回复 + 新问题"这种状态化接口。
- **为什么回复是 `{ content, toolCalls }` 而不是 string**：模型可能"要调用工具"（第 06 课）。如果只返回 string，循环就不知道要不要继续——`toolCalls` 是"要不要再转一圈"的信号。
- **为什么没有 `apiKey`/`baseUrl`**：那是**实现细节**（ChatClient 构造器里配），不是契约。不同 provider 配置方式不同，接口只定义"做什么"，不定义"怎么配置"——否则接口就被某个具体实现绑架了。
- **为什么没有 `usage`/token**：token 记账是 telemetry（第 45/48 课）的事，对话本身不需要它。**接口只留对话必需面**。

## 2. SessionService —— 会话的最小管理面

```ts
interface SessionHandle {
  readonly id: string
  append(kind: string, data: Record<string, unknown>): SessionEvent
  events(): readonly SessionEvent[]
}
interface SessionService {
  create(id?: string): SessionHandle
  get(id: string): SessionHandle | undefined
  list(): string[]
}
```

- **为什么拆成"服务 + 句柄"两层**：循环可能同时处理多个会话（main、fork、子代理），需要一个**注册表**（按 id 找/建会话）+ 每个会话的**操作句柄**。这正是 dsh `ctx.sessions` 的形态。
- **`append(kind, data)`**：事件流的最小写入。`seq` 由实现分配（第 09 课的单调递增）——契约只管"能追加事件"，不管怎么编号。
- **`events()` 返回只读数组**：供 derive（第 10 课）和 UI 消费。契约不暴露内部可变数组，防止外部篡改日志。
- **`create(id?)` 可选 id**：调用方可以指定（如 `main`），也可以让实现自增——给调用方选择权。
- **`get` 返回 `undefined`**：明确表达"可能不存在"，由调用方决定 create 还是报错——而不是抛异常强制调用方 try/catch。
- **为什么没有 snapshot/replay/持久化**：那是第 12 课的扩展，不是"循环能对话"所需的最小面。**契约按当前消费者真正需要的定，不为未来预测买单。**

## 3. ToolRegistryService —— 工具的最小注册面

```ts
interface ToolDefinition {
  name: string
  description: string
  execute(args: Record<string, unknown>): Promise<string>
}
interface ToolRegistryService {
  register(tool: ToolDefinition): () => void
  execute(name: string, args: Record<string, unknown>): Promise<string>
  list(): string[]
}
```

- **`ToolDefinition` 为什么只有三个字段**：`name` 是寻址（模型按名字调用）、`description` 是给模型看的（第 20 课把它拼进系统提示词）、`execute` 是执行。**参数 schema 呢？** 那是第 26 课的事——最小契约不管参数校验，模型给什么就执行什么。
- **`register` 返回 disposer**：工具注册是可逆的（第 16 课原则），插件卸载时工具自动消失。
- **`execute(name, args)` 按名字寻址**：和 `LlmClient` 一样，契约不含"怎么执行"——bash 用子进程、fs 用文件 API，都是实现。
- **`list()` 为什么必须**：第 20 课组装系统提示词时要知道"有哪些可用工具"——这是唯一被 prompt 消费的方法。

## 4. AgentRegistryService —— agent 的最小生命周期面

```ts
interface Agent {
  readonly id: string
  send(input: string): void
  cancel(): void
}
interface AgentRegistryService {
  create(id?: string): Agent
  get(id: string): Agent | undefined
  dispose(id: string): void
}
```

- **`send` 返回 `void` 而不是 Promise**：这是最值得讲的设计。投递（入队/唤醒）和执行**解耦**——`send` 只负责"把输入交给 agent"，结果通过事件观察（第 21 课的 live 事件、第 24 课的 inbox）。如果返回 Promise，调用方就得等整个回合，UI 就卡死了。
- **`cancel`**：外部（用户点停止、编排器）能中止在飞工作——这是 harness 的标配能力（第 42 课深化）。
- **`create/get/dispose`**：生命周期三件套；`get` 不存在返回 `undefined`，和 SessionService 一致。
- **为什么没有 `status`**：状态是**瞬时过程**（第 21 课明确归为 live 事件 `agent/status`），不该是接口里的持久字段。

## 5. AgentLoopDriver —— 循环的最小驱动面

```ts
interface AgentLoopDeps { llm: LlmClient; sessions: SessionService; tools: ToolRegistryService }
interface AgentLoopDriver {
  run(input: string): Promise<{ reply: string; events: number }>
}
```

- **为什么 deps 只有三个**：第 19 课的最小循环只需要"对话 + 日志 + 工具"。system-prompt 第 20 课加、inbox/steering 第 24 课加——**接口按需生长**，一次只加当前真正需要的。
- **`run(input) → { reply, events }`**：`reply` 是结果，`events` 是"写了几条日志"——后者的存在是为了**可验证**（测试 2 断言事件数）。
- **为什么是 `run` 而不是 `step/turn`**：第 19 课还不讲生命周期，最小契约就是"给我输入，给我结果"；第 22-23 课会在它内部长出 step/turn。

## 为什么"最小"本身就是设计原则

1. **接口是双刃剑**：每加一个方法 = 所有实现者都要实现 + 所有调用方都要遵守。接口越大，实现成本越高、可实现的 mock 越难写（测试 4 专门验证"接口够小够可实现"）。
2. **按消费者定，不按预测定**（YAGNI）：接口只反映"当前 loop 真正调用什么"。流式、schema、快照、inbox 都是后续课按真实需求加——提前设计往往设计错。
3. **实现细节不进接口**：配置（apiKey）、持久化、参数校验、token 记账全是实现或扩展，放进契约就绑死了所有 provider。
4. **可替换性是目的**：接口小 → 实现容易写 → 换实现零成本 → 第 08 课"mock 与真实平起平坐"的承诺兑现。

一句话：**每个接口都是"消费者（循环）此刻真正需要的面"，多一个方法都是负债，少一个方法循环就转不起来——这就是最小契约的定义方式。** 之后每一课往接口上加东西（schema、流式、inbox），都是在"最小面"上按真实需求生长，而不是一开始就设计一个庞然大物。