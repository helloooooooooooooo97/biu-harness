import { relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { SpawnRequest } from './subprocess.ts'

export interface WrappedSpawn extends SpawnRequest {
  argv: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export class SandboxService extends Service {
  constructor(
    ctx: Context,
    private root: string,
  ) {
    super(ctx, 'sandbox')
  }

  wrap(req: SpawnRequest): WrappedSpawn {
    const cwd = resolve(req.cwd ?? this.root)
    if (relative(this.root, cwd).startsWith('..')) throw new Error('cwd outside sandbox')
    const env = { ...process.env, ...req.env, CORDIS_SANDBOX: this.root }
    this.ctx.emit('sandbox/wrap', { argv: req.argv, cwd })
    return { ...req, argv: req.argv, cwd, env }
  }
}

export const name = 'sandbox'
export const inject = ['fs']

export function apply(ctx: Context) {
  new SandboxService(ctx, ctx.fs.root)
}
