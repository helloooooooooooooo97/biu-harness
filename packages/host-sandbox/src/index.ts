import { relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import type { SpawnRequest } from '@biu/host-subprocess'

export interface WrappedSpawn extends SpawnRequest {
  argv: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

export class SandboxService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sandbox')
  }

  private root() {
    return this.ctx.fs.effectiveRoot()
  }

  wrap(req: SpawnRequest): WrappedSpawn {
    const root = this.root()
    const cwd = resolve(req.cwd ?? root)
    if (relative(root, cwd).startsWith('..')) throw new Error('cwd outside sandbox')
    const env = { ...process.env, ...req.env, CORDIS_SANDBOX: root }
    this.ctx.emit('sandbox/wrap', { argv: req.argv, cwd })
    return { ...req, argv: req.argv, cwd, env }
  }
}

export const name = 'sandbox'
export const inject = ['fs']

export function apply(ctx: Context) {
  new SandboxService(ctx)
}
