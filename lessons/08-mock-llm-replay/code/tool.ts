/** Tool 接口与示例实现。 */
export interface Tool {
  name: string
  description: string
  parameters: Record<string, { type: string; required?: boolean; description?: string }>
  execute(args: Record<string, unknown>): Promise<string>
}

export class EchoTool implements Tool {
  readonly name = 'echo'
  readonly description = '把输入的文本原样返回'
  readonly parameters = { text: { type: 'string', required: true } }

  async execute(args: Record<string, unknown>): Promise<string> {
    return String(args.text ?? '')
  }
}

export class BashTool implements Tool {
  readonly name = 'bash'
  readonly description = '在本地 shell 中执行命令并返回输出'
  readonly parameters = { command: { type: 'string', required: true, description: '要执行的 shell 命令' } }

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
