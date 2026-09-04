import { Service, type Context } from 'cordis'
import type { ToolRequest } from '@biu/host-tools'

const DEFAULT_HOLD_TIMEOUT_MS = 60_000

export class ApprovalsService extends Service {
  mode: 'auto' | 'hold' = 'auto'
  holdTimeoutMs = DEFAULT_HOLD_TIMEOUT_MS
  private notify: ((payload: { id: string; name: string; args: Record<string, unknown> }) => void) | undefined
  private pending = new Map<
    string,
    { req: ToolRequest; resolve: (allow: boolean) => void; timer?: ReturnType<typeof setTimeout> }
  >()

  constructor(ctx: Context) {
    super(ctx, 'approvals')
    ctx.tools.guard(async (req) => {
      if (!needsApproval(req.name, this.mode)) return req
      const id = crypto.randomUUID()
      const allow = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (!this.pending.has(id)) return
          this.pending.delete(id)
          resolve(false)
        }, this.holdTimeoutMs)
        this.pending.set(id, { req, resolve, timer })
        this.notify?.({ id, name: req.name, args: req.args })
      })
      return allow ? req : { ...req, deny: `denied: ${req.name}` }
    })
  }

  setNotify(notify: (payload: { id: string; name: string; args: Record<string, unknown> }) => void) {
    this.notify = notify
  }

  list() {
    return [...this.pending.entries()].map(([id, item]) => ({ id, name: item.req.name, args: item.req.args }))
  }

  decide(id: string, allow: boolean) {
    const item = this.pending.get(id)
    if (!item) throw new Error(`unknown approval: ${id}`)
    this.pending.delete(id)
    if (item.timer) clearTimeout(item.timer)
    item.resolve(allow)
    return { ok: true }
  }
}

function needsApproval(name: string, mode: 'auto' | 'hold') {
  if (name === 'db_delete') return true
  if (mode === 'auto') return false
  return sensitive(name)
}

function sensitive(name: string) {
  return /^(fs_write|str_replace_editor|bash|job_start|terminal_write|lsp_start|subagent_spawn|mcp_add_stdio)$/.test(name)
}

export const name = 'approvals'
export const inject = ['tools']

export function apply(ctx: Context) {
  const approvals = new ApprovalsService(ctx)
  ctx.inject(['http'], (inner) => {
    approvals.setNotify((payload) => inner.http.broadcast('approval', payload))
    inner.http.route('GET', '/api/approvals', (route) => {
      route.send(200, { mode: approvals.mode, pending: approvals.list() })
    })
    inner.http.route('POST', '/api/approvals/mode', async (route) => {
      const payload = (await route.json()) as { mode?: 'auto' | 'hold' }
      if (payload.mode === 'auto' || payload.mode === 'hold') approvals.mode = payload.mode
      route.send(200, { mode: approvals.mode })
    })
    inner.http.route('POST', '/api/approvals/:id', async (route) => {
      const payload = (await route.json()) as { allow?: boolean }
      try {
        route.send(200, approvals.decide(route.params.id, Boolean(payload.allow)))
      } catch (error) {
        route.send(400, { error: String(error) })
      }
    })
  })
}
