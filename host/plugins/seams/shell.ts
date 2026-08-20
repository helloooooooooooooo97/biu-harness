import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { SpawnResult } from './subprocess.ts'

/** Capability seam 定义：换沙箱/远程 shell 只换 runner，不改 tool 名与 loop。 */
export type ShellRunner = (command: string, signal?: AbortSignal) => Promise<SpawnResult>

export class ShellService extends Service {
  private runner: ShellRunner

  constructor(ctx: Context) {
    super(ctx, 'shell')
    this.runner = (command, signal) =>
      ctx.subprocess.run({ argv: ['/bin/sh', '-c', command], timeoutMs: 15_000 }, signal)
  }

  setRunner(runner: ShellRunner) {
    this.runner = runner
  }

  run(command: string, signal?: AbortSignal) {
    return this.runner(command, signal)
  }
}

export const name = 'shell'
export const inject = ['subprocess', 'tools']

export function apply(ctx: Context) {
  const shell = new ShellService(ctx)
  ctx.tools.register({
    name: 'bash',
    description: '在沙箱工作区执行命令（/bin/sh -c）',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    execute: async (args, signal) => {
      const result = await shell.run(String(args.command), signal)
      return { code: result.code, stdout: result.stdout, stderr: result.stderr }
    },
  })
}
