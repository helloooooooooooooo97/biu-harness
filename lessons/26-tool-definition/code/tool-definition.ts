/**
 * defineTool：schema 驱动的工具契约（校验 + 渲染）。
 */

export type JsonSchema = Record<string, unknown>

export interface ParameterProperty {
  type: string
  required?: boolean
  description?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ParameterProperty>
  }
  output?: {
    schema: JsonSchema
    render?: (args: Record<string, unknown>, value: unknown) => string
  }
  execute(args: Record<string, unknown>): Promise<unknown>
}

/** 定义工具：校验必填字段后返回（注册时借用，勿改）。 */
export function defineTool(def: ToolDefinition): ToolDefinition {
  if (!def.name || !def.description) throw new Error('工具必须含 name 与 description')
  return def
}

export interface ExecResult {
  value: unknown
  text: string
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>()

  register(def: ToolDefinition): () => void {
    if (this.tools.has(def.name)) throw new Error(`工具已存在: ${def.name}`)
    this.tools.set(def.name, def)
    return () => this.tools.delete(def.name)
  }

  /** 校验参数 → 执行 → 渲染输出。 */
  async execute(name: string, args: Record<string, unknown>): Promise<ExecResult> {
    const def = this.tools.get(name)
    if (!def) throw new Error(`未知工具: ${name}`)
    ToolRegistry.validate(def, args)
    const value = await def.execute(args)
    const text = def.output?.render
      ? def.output.render(args, value)
      : JSON.stringify(value)
    return { value, text }
  }

  /** 供系统提示词组装的 schema 列表（第 20 课）。 */
  listSchemas(): Array<{ name: string; description: string; parameters: ToolDefinition['parameters'] }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  /** 基础校验：必填字段存在且类型正确。 */
  static validate(def: ToolDefinition, args: Record<string, unknown>): void {
    for (const [key, prop] of Object.entries(def.parameters.properties)) {
      if (prop.required && args[key] === undefined) {
        throw new Error(`缺少必填参数: ${key}`)
      }
      if (args[key] === undefined) continue
      const ok = prop.type === 'array' ? Array.isArray(args[key]) : typeof args[key] === prop.type
      if (!ok) {
        throw new Error(`参数 ${key} 类型应为 ${prop.type}`)
      }
    }
  }
}
