import { FiberState, Service, type Context, type Fiber, type Plugin } from 'cordis'
import { catalog, type CatalogEntry } from '../catalog.ts'

const STATE: Record<FiberState, string> = {
  [FiberState.PENDING]: 'pending',
  [FiberState.LOADING]: 'loading',
  [FiberState.ACTIVE]: 'active',
  [FiberState.FAILED]: 'failed',
  [FiberState.DISPOSED]: 'disposed',
  [FiberState.UNLOADING]: 'unloading',
}

interface ForkRecord {
  entry: CatalogEntry
  fiber?: Fiber
}

export class HubService extends Service {
  private forks = new Map<string, ForkRecord>()
  private events: Array<{ ts: number; mode: string; name: string; args: unknown[] }> = []

  constructor(ctx: Context) {
    super(ctx, 'hub')

    ctx.on('internal/dispatch', (mode, name, args) => {
      if (name.startsWith('internal/')) return
      this.events.unshift({ ts: Date.now(), mode, name, args: clone(args) })
      this.events.splice(80)
      ctx.http?.broadcast('event', this.events[0])
    })

    ctx.on('internal/status', (fiber) => {
      ctx.http?.broadcast('snapshot', this.snapshot())
      ctx.logger('hub').info(`${fiber.name} → ${STATE[fiber.state]}`)
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
      state: fiber ? STATE[fiber.state] : 'off',
    }))

    return {
      plugins,
      pages: this.ctx.get('pages')?.list() ?? [],
      routes: this.ctx.get('http')?.listRoutes() ?? [],
      events: this.events,
      services: ['http', 'pages', 'hub', 'greet', 'notes'].filter((name) => this.ctx.get(name)),
    }
  }

  async setEnabled(id: string, enabled: boolean) {
    const record = this.forks.get(id)
    if (!record) throw new Error(`unknown plugin: ${id}`)
    if (!record.entry.togglable) throw new Error(`${id} 是核心层，不能卸载`)
    if (enabled) this.mount(id)
    else await this.unmount(id)
    this.ctx.emit('hub/change')
    return this.snapshot()
  }

  private mount(id: string) {
    const record = this.forks.get(id)
    if (!record || (record.fiber && record.fiber.uid !== null)) return
    const plugin = record.entry.plugin as Plugin
    record.fiber = this.ctx.plugin(plugin, record.entry.config)
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
