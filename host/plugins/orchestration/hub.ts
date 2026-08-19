import { Service, type Context, type Fiber, type Plugin } from 'cordis'
import { catalog, type CatalogEntry } from '../../catalog.ts'

const STATE = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

interface ForkRecord {
  entry: CatalogEntry
  fiber?: Fiber
}

export class HubService extends Service {
  private forks = new Map<string, ForkRecord>()
  private events: Array<{ ts: number; mode: string; name: string; args: unknown[] }> = []
  private seq = 0

  constructor(ctx: Context) {
    super(ctx, 'hub')
    ctx.on('internal/dispatch', (mode, name, args) => {
      if (name.startsWith('internal/')) return
      this.events.unshift({ ts: Date.now(), mode, name, args: clone(args) })
      this.events.splice(80)
      ctx.http?.broadcast('event', this.events[0])
    })
    ctx.on('internal/status', () => {
      ctx.http?.broadcast('snapshot', this.snapshot())
    })
    ctx.on('hub/change', () => {
      ctx.http?.broadcast('snapshot', this.snapshot())
    })
    ctx.on('pages/update', () => {
      ctx.http?.broadcast('snapshot', this.snapshot())
    })
    for (const entry of catalog) {
      this.forks.set(entry.id, { entry })
      if (entry.enabled) this.mount(entry.id)
    }
  }

  snapshot() {
    const plugins = [...this.forks.values()].map(({ entry, fiber }) => ({
      id: entry.id,
      name: entry.name,
      layer: entry.layer,
      blurb: entry.blurb,
      inject: entry.inject ?? [],
      togglable: entry.togglable,
      enabled: Boolean(fiber && fiber.uid !== null),
      state: fiber ? STATE[fiber.state] ?? String(fiber.state) : 'off',
    }))
    return {
      seq: ++this.seq,
      plugins,
      pages: this.ctx.pages?.list() ?? [],
      routes: this.ctx.http?.listRoutes() ?? [],
      events: this.events,
      services: ['http', 'pages', 'hub', 'greet', 'notes', 'chat'].filter((name) => Boolean(this.ctx.get(name))),
    }
  }

  async setEnabled(id: string, enabled: boolean) {
    const record = this.forks.get(id)
    if (!record) throw new Error(`unknown plugin: ${id}`)
    if (!record.entry.togglable) throw new Error(`${id} 是核心层，不能卸载`)
    if (enabled) await this.mount(id)
    else await this.unmount(id)
    this.ctx.emit('hub/change')
    return this.snapshot()
  }

  private async mount(id: string) {
    const record = this.forks.get(id)
    if (!record || (record.fiber && record.fiber.uid !== null)) return
    record.fiber = this.ctx.plugin(record.entry.plugin as Plugin, record.entry.config)
    await record.fiber
  }

  private async unmount(id: string) {
    const record = this.forks.get(id)
    if (!record?.fiber) return
    await record.fiber.dispose()
    record.fiber = undefined
  }
}

function clone(value: unknown): unknown[] {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'function' ? '[fn]' : item)))
  } catch {
    return ['[unserializable]']
  }
}

export const name = 'hub'
export const inject = ['http', 'pages']

export function apply(ctx: Context) {
  new HubService(ctx)
}



