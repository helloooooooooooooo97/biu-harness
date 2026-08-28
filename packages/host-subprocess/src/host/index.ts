import { spawn } from 'node:child_process'
import { Service, type Context } from 'cordis'
export { posixShellArgv, posixShellBin, hostShellKind, describeHostRuntime } from './posix-shell.ts'

export interface SpawnRequest {
  argv: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  stdin?: string
  timeoutMs?: number
}

export interface SpawnResult {
  code: number | null
  stdout: string
  stderr: string
}

export class SubprocessService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'subprocess')
  }

  run(req: SpawnRequest, signal?: AbortSignal): Promise<SpawnResult> {
    const wrapped = this.ctx.sandbox.wrap(req)
    return new Promise((resolve, reject) => {
      const child = spawn(wrapped.argv[0]!, wrapped.argv.slice(1), {
        cwd: wrapped.cwd,
        env: wrapped.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
      const timer = wrapped.timeoutMs
        ? setTimeout(() => {
            child.kill('SIGTERM')
          }, wrapped.timeoutMs)
        : undefined
      const onAbort = () => child.kill('SIGTERM')
      signal?.addEventListener('abort', onAbort)
      if (wrapped.stdin) child.stdin?.end(wrapped.stdin)
      else child.stdin?.end()
      child.on('error', (error) => {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      })
      child.on('close', (code) => {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve({ code, stdout, stderr })
      })
    })
  }
}

export const name = 'subprocess'
export const inject = ['sandbox']

export function apply(ctx: Context) {
  new SubprocessService(ctx)
}
