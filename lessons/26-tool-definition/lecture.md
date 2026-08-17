# 26-tool-definition 讲义

## 目标

- 把第 06 课的 `Tool` 升级成 **`defineTool`**：name / description / parameters schema / output / render。
- 参数校验（必填、类型）交给框架，而不是每个工具自己写 if。
- 理解 schema 会自动进入系统提示词（第 20 课组装）。

## 1. 为什么工具要有 schema

第 06 课的工具是"名字 + 执行函数"，参数对不对全看模型自觉。真实 harness 需要**声明式契约**：

```ts
const readFileTool = defineTool({
  name: 'read_file',
  description: '读取文件内容',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', required: true, description: '绝对路径' },
      limit: { type: 'number', description: '最多读取的行数' },
    },
  },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => `文件内容：${String(value)}`,
  },
  async execute(args) {
    return readFile(args.path, 'utf8')   // args 已经被校验过
  },
})
```

schema 干三件事：

- **给模型看**：进入系统提示词（第 20 课），模型知道参数长什么样；
- **给框架校验**：执行前检查必填/类型，不合法直接报错，工具内部不用再写 if；
- **给 UI 渲染**：output.render 把结果变成人看的文本/卡片。

## 2. 本课代码

`defineTool(def)`：校验 name/description 后原样返回（注册时借用）。

`ToolRegistry`：

- `register(def)` → 可逆注册；
- `execute(name, args)` → **校验参数 → 执行 → 渲染输出**，返回 `{ value, text }`；
- `listSchemas()` → 供第 20 课组装系统提示词。

## 3. 与 dsh 的对照

dsh 的 `defineTool` 更完整：`parameters` 用统一 schema DSL、`output.schema` 有 lossless JSON 校验、`presentCall/presentResult` 提供 UI 卡片（generic/terminal/diff）。本课是它的核心子集：**schema 驱动校验 + 渲染**。

## 小结

- 工具契约 = name + description + parameters + output + execute。
- 参数校验与结果渲染交给框架，工具只写业务。
- schema 同时服务模型（提示词）、框架（校验）、UI（渲染）。

## 预习

- 工具执行前还有哪些关卡？（第 27 课：执行流水线。）
