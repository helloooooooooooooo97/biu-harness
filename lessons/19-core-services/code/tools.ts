/** 工具服务接口：注册表的最小契约。 */

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
