import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { SpawnResult } from './subprocess.ts'
import { currentSessionId } from '../core/session-scope.ts'
import { extractImagePathCandidates, ingestSessionImages } from '../core/artifacts.ts'

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
export const inject = ['subprocess', 'tools', 'fs']

export function apply(ctx: Context) {
  const shell = new ShellService(ctx)
  ctx.tools.register({
    name: 'bash',
    description: '在沙箱工作区执行命令（/bin/sh -c）。若命令输出图片路径（png/jpg/…），会自动拷到会话 artifacts 供前端展示。',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    execute: async (args, signal) => {
      const result = await shell.run(String(args.command), signal)
      const base = {
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      }
      const sessionId = currentSessionId()
      if (!sessionId) return base

      const candidates = extractImagePathCandidates(`${result.stdout}\n${result.stderr}`)
      if (candidates.length === 0) return base

      try {
        const artifacts = await ingestSessionImages({
          sessionId,
          candidates,
          workspaceRoot: ctx.fs.effectiveRoot(),
        })
        if (artifacts.length === 0) return base
        return { ...base, artifacts }
      } catch {
        return base
      }
    },
  })
}
