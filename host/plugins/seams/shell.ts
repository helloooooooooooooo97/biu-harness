import type { Context } from 'cordis'
import '../../types.ts'

export const name = 'shell'
export const inject = ['subprocess', 'tools']

export function apply(ctx: Context) {
  ctx.tools.register({
    name: 'bash',
    description: '在沙箱工作区执行命令（/bin/sh -c）',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    execute: async (args, signal) => {
      const result = await ctx.subprocess.run({ argv: ['/bin/sh', '-c', String(args.command)], timeoutMs: 15_000 }, signal)
      return { code: result.code, stdout: result.stdout, stderr: result.stderr }
    },
  })
}
