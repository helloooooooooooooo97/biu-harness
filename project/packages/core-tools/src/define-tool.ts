/**
 * defineTool：schema 驱动的工具契约（第 26 课）。
 */

export type JsonSchema = Record<string, unknown>

export interface ParameterProperty {
  type: string
  required?: boolean
  description?: string
}

export interface SchemaToolDefinition {
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

export function defineTool(def: SchemaToolDefinition): SchemaToolDefinition {
  if (!def.name || !def.description) throw new Error('工具必须含 name 与 description')
  return def
}

export interface ExecResult {
  value: unknown
  text: string
}

export class ToolRegistry {
  private readonly tools = new Map<string, SchemaToolDefinition>()

  register(def: SchemaToolDefinition): () => void {
    if (this.tools.has(def.name)) throw new Error(`工具已存在: ${def.name}`)
    this.tools.set(def.name, def)
    return () => this.tools.delete(def.name)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ExecResult> {
    const def = this.tools.get(name)
    if (!def) throw new Error(`未知工具: ${name}`)
    ToolRegistry.validate(def, args)
    const value = await def.execute(args)
    const text = def.output?.render ? def.output.render(args, value) : JSON.stringify(value)
    return { value, text }
  }

  listSchemas(): Array<{ name: string; description: string; parameters: SchemaToolDefinition['parameters'] }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  static validate(def: SchemaToolDefinition, args: Record<string, unknown>): void {
    for (const [key, prop] of Object.entries(def.parameters.properties)) {
      if (prop.required && args[key] === undefined) throw new Error(`缺少必填参数: ${key}`)
      if (args[key] === undefined) continue
      const ok = prop.type === 'array' ? Array.isArray(args[key]) : typeof args[key] === prop.type
      if (!ok) throw new Error(`参数 ${key} 类型应为 ${prop.type}`)
    }
  }
}
