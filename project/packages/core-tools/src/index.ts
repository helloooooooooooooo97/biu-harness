/** core-tools：工具注册表与示例实现（第 06/19 课）。 */

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
    if (this.tools.has(tool.name)) throw new Error(`工具已存在: ${tool.name}`)
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

export class EchoTool implements ToolDefinition {
  readonly name = 'echo'
  readonly description = '把输入的文本原样返回'
  async execute(args: Record<string, unknown>): Promise<string> {
    return String(args.text ?? '')
  }
}

export class BashTool implements ToolDefinition {
  readonly name = 'bash'
  readonly description = '在本地 shell 中执行命令并返回输出'
  async execute(args: Record<string, unknown>): Promise<string> {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const { stdout, stderr } = await execFileAsync('bash', ['-c', String(args.command ?? '')], {
      timeout: 10_000,
    })
    return `${stdout}${stderr}`.trim() || '(无输出)'
  }
}

export * from './define-tool.ts'
export * from './pipeline.ts'
