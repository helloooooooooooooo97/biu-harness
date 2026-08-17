/** ToolRegistry：注册 / 查询 / 执行工具。 */
import type { Tool } from './tool.ts'

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>()

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) throw new Error(`工具已存在: ${tool.name}`)
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  list(): Tool[] {
    return [...this.tools.values()]
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`未知工具: ${name}`)
    return tool.execute(args)
  }
}
