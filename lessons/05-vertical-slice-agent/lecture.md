# 05-vertical-slice-agent 讲义

## 目标

- 写出 harness 的最小内核：**输入 → 模型请求 → 回复** 的单文件循环。
- 理解 OpenAI 兼容的 `/chat/completions` 请求格式。
- 会用注入 `fetch` 的方式离线测试（这是本课程所有网络代码的测试模式）。

## 1. 最小循环

一个 agent 的最简形态就是三行伪代码：

```text
messages = [user prompt]
reply = POST /chat/completions { model, messages }
输出 reply
```

这就是本课的 `agent-v1.mjs`。它小到没有状态、没有工具、没有日志——但它是第 06-08 课（工具循环、流式、mock）和第 22-25 课（真正的 turn/step 生命周期）的种子。

## 2. 请求格式

DeepSeek 提供 OpenAI 兼容接口，`POST {base}/chat/completions`：

```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

响应里的关键字段：

- `choices[0].message.content`：模型回复文本；
- `choices[0].message.tool_calls`：工具调用（第 06 课用）；
- `usage`：token 统计（第 03 课的轨迹字段从这里来）。

> 注意：`messages` 里的角色只有 `system` / `user` / `assistant`；工具结果要放进 `role: "tool"` 的消息（第 06 课）。

## 3. 错误处理

真实调用必须处理三类失败：

| 情况 | 处理 |
| --- | --- |
| 缺少 API Key | 启动时明确报错并给出修复指引 |
| HTTP 4xx/5xx | 抛出带状态码的错误，信息里包含响应片段 |
| 网络/超时 | 冒泡给调用方，由上层决定重试（第 29 课正式实现重试策略） |

本课只做前两件；重试和超时是第 29 课的内容，不提前堆复杂度。

## 4. 离线测试：注入 fetch

网络代码不能依赖真实 API 跑测试。本课程的统一做法是**依赖注入**：

```js
runAgent({ prompt: '你好', fetchImpl: fakeFetch })
```

`fetchImpl` 默认是全局 `fetch`；测试传一个假实现，返回预先录好的响应。第 08 课会把它升级成完整的 mock LLM 录放服务。

## 5. 用法

```bash
# 真实调用
DEEPSEEK_API_KEY=sk-... node agent-v1.mjs --prompt "你好"

# 无 key 的 mock 演示
MOCK_LLM=1 node agent-v1.mjs --prompt "你好"

# 测试
npm test
```

## 6. 与 dsh 的对照

dsh 里这一层分得更细：`packages/llm` 定义消息词汇表（`Message` / `ContentBlock`），`llm-deepseek` 是适配器，`agent-loop` 负责循环。本课把三者压进一个文件，是为了先看见"整体"；第 18 课拆包时，你已经有完整的切片可以拆。

## 小结

- 最小循环 = 组装 messages → 请求 → 拿回 reply。
- 错误处理要"提前失败、信息明确"。
- 测试网络代码用注入 fetch，这是后续所有课程的测试模式。

## 预习

- 想一想：如果模型回复里带 `tool_calls`，循环该怎么继续？（第 06 课。）
