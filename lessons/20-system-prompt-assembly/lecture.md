# 20-system-prompt-assembly 讲义

## 目标

- 实现系统提示词组装：多个插件各自贡献一个 section，按 `order` 排序拼接。
- 理解顺序约定（-100 身份 / 0 persona / 100+ 工具指引）和 `complete` section。
- 支持动态文本（函数）与 `{{变量}}` 插值。

## 1. 提示词不是一段，是一堆 section

harness 的系统提示词由**多个插件各贡献一段**拼成（第 13 课的 prompt 插件就是这个思想的起点）：

```ts
const prompt = new SystemPromptAssembler()
prompt.section({ name: 'identity', order: -100, text: '你是 mini-dsh。' })
prompt.section({ name: 'persona', order: 0, text: '你是一个严谨的工程师。' })
prompt.section({ name: 'tools', order: 100, text: '- 可用工具：bash、echo' })
prompt.assemble({ agentId: 'a1', variables: {} })
```

顺序由 `order` 决定，**约定俗成**（dsh 同款）：

| order | 谁用 |
| --- | --- |
| `-100` | harness 身份 |
| `0` | persona（人设） |
| `100-199` | 工具指引 |
| `200` | 运行时动态上下文 |

## 2. 动态 section 与变量

`text` 可以是字符串，也可以是**函数**——每次组装时按当时的上下文求值：

```ts
prompt.section({
  name: 'runtime',
  order: 200,
  text: (ctx) => `当前会话: ${ctx.agentId ?? '未知'}`,
})
```

再配合 `render(text, variables)` 做 `{{变量}}` 插值：提示词里写 `{{cwd}}`，组装后填成真实路径。

## 3. complete section：一言堂

dsh 允许某个 section 声明 `complete: true`——组装时**它就是唯一的系统提示词**（其他 section 全部忽略）。用于"完全接管"的场景；多个 complete 同时存在是配置错误，要抛错。

## 4. 与 dsh 的对照

dsh 的 `ctx.systemPrompt` 就是这个类：`PromptSection`（order 约定、complete）、`PromptContext`（动态上下文）、`renderPrompt`（变量插值）；`agent/pre-step` 组装时把所有插件注册的 section 按 order 合并。第 25 课 pre-step 会用上它。

## 小结

- 提示词 = 按 order 排序拼接的 section 集合。
- 静态文本 + 动态函数 + 变量插值，三态齐备。
- `complete` 是"接管"开关，重复即配置错误。

## 预习

- 工具 schema 怎么自动进提示词？（第 26 课：ToolDefinition 注册后加入组装。）
