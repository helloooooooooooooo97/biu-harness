import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { ToolRequest } from '../registry/tools.ts'

export class ApprovalsService extends Service {
  mode: 'auto' | 'hold' = 'auto'
  private pending = new Map<string, { req: ToolRequest; resolve: (allow: boolean) => void }>()

  constructor(ctx: Context) {
    super(ctx, 'approvals')
    ctx.tools.guard(async (req) => {
      if (this.mode === 'auto') return req
      if (this.mode === 'hold' && !sensitive(req.name)) return req
      const id = crypto.randomUUID()
      const allow = await new Promise<boolean>((resolve) => {
        this.pending.set(id, { req, resolve })
        this.ctx.http?.broadcast('approval', { id, name: req.name, args: req.args })
      })
      return allow ? req : { ...req, deny: `denied: ${req.name}` }
    })
  }

  list() {
    return [...this.pending.entries()].map(([id, item]) => ({ id, name: item.req.name, args: item.req.args }))
  }

  decide(id: string, allow: boolean) {
    const item = this.pending.get(id)
    if (!item) throw new Error(`unknown approval: ${id}`)
    this.pending.delete(id)
    item.resolve(allow)
    return { ok: true }
  }
}

function sensitive(name: string) {
  return /^(fs_write|bash|job_start|terminal_write|lsp_start|subagent_spawn)$/.test(name)
}

export const name = 'approvals'
export const inject = ['tools', 'http']

export function apply(ctx: Context) {
  const approvals = new ApprovalsService(ctx)
  ctx.http.route('GET', '/api/approvals', (route) => {
    route.send(200, { mode: approvals.mode, pending: approvals.list() })
  })
  ctx.http.route('POST', '/api/approvals/mode', async (route) => {
    const payload = (await route.json()) as { mode?: 'auto' | 'hold' }
    if (payload.mode === 'auto' || payload.mode === 'hold') approvals.mode = payload.mode
    route.send(200, { mode: approvals.mode })
  })
  ctx.http.route('POST', '/api/approvals/:id', async (route) => {
    const payload = (await route.json()) as { allow?: boolean }
    try {
      route.send(200, approvals.decide(route.params.id, Boolean(payload.allow)))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
}
