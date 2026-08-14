import { Service, type Context } from 'cordis'

export interface PluginInfo {
  id: string
  name: string
  layer: string
  blurb: string
  inject: string[]
  togglable: boolean
  enabled: boolean
  state: string
}

export interface PageInfo {
  id: string
  title: string
  subtitle: string
  plugin: string
  kind: string
}

export interface Snapshot {
  plugins: PluginInfo[]
  pages: PageInfo[]
  routes: Array<{ method: string; pattern: string }>
  events: Array<{ ts: number; mode: string; name: string; args: unknown[] }>
  services: string[]
  clockIso?: string
}

const empty: Snapshot = {
  plugins: [],
  pages: [],
  routes: [],
  events: [],
  services: [],
}

export class SnapshotService extends Service {
  private value: Snapshot = empty
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'snapshot')
    void this.boot()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot() {
    return this.value
  }

  get() {
    return this.value
  }

  async setEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/plugins/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    this.replace(await res.json())
  }

  private replace(next: Partial<Snapshot>) {
    this.value = { ...this.value, ...next }
    for (const listener of this.listeners) listener()
  }

  private async boot() {
    const res = await fetch('/api/snapshot')
    this.replace(await res.json())
    this.connect()
  }

  private connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws`)
    ws.onmessage = (message) => {
      const parsed = JSON.parse(message.data) as { type: string; payload: unknown }
      if (parsed.type === 'snapshot') this.replace(parsed.payload as Snapshot)
      if (parsed.type === 'event') {
        this.replace({
          events: [parsed.payload as Snapshot['events'][number], ...this.value.events].slice(0, 80),
        })
      }
      if (parsed.type === 'clock') {
        this.replace({ clockIso: (parsed.payload as { iso: string }).iso })
      }
    }
    ws.onclose = () => setTimeout(() => this.connect(), 1200)
  }
}

export const name = 'snapshot'
export const inject = [] as const

export function apply(ctx: Context) {
  new SnapshotService(ctx)
}
