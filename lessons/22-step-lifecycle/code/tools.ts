/** 工具最小接口 + 内存实现。 */

export interface ToolDefinition {
  name: string
  description: string
  execute(args: Record<string, unknown>): Promise<string>
}

export interface ToolRegistryService {
  register(tool: ToolDefinition): () => void
  execute(name: string, args: Record<string, unknown>): Promise<string>
  list(): string[]
}

export class MemoryTools implements ToolRegistryService {
  private readonly tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): () => void {
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`未知工具: ${name}`)
    return tool.execute(args)
  }

  list(): string[] {
    return [...this.tools.keys()]
  }
}
