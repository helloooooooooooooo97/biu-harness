import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'

export interface PluginRow {
  id: string
  name: string
  layer: string
  blurb: string
  inject: string[]
  togglable: boolean
  enabled: boolean
  state: string
}

export interface Snapshot {
  seq?: number
  plugins: PluginRow[]
  pages: Array<{ id: string; title: string; plugin: string }>
  routes: Array<{ method: string; pattern: string }>
  events: Array<{ ts: number; mode: string; name: string; args: unknown[] }>
  tools?: string[]
  services: string[]
  clockIso?: string
}

const empty: Snapshot = { seq: 0, plugins: [], pages: [], routes: [], events: [], services: [] }

export class SnapshotService extends Service {
  private value: Snapshot = empty
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'snapshot')
    void this.boot()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  async setEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/plugins/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    this.replace(await res.json())
  }

  private replace(next: Partial<Snapshot>) {
    if (typeof next.seq === 'number' && typeof this.value.seq === 'number' && next.seq < this.value.seq) return
    this.value = { ...this.value, ...next }
    for (const fn of this.listeners) fn()
  }

  private async boot() {
    try {
      const res = await fetch('/api/snapshot')
      if (res.ok) this.replace(await res.json())
    } catch {
      /* 无 host 时控制台为空 */
    }
    this.connect()
  }

  private connect() {
    try {
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
        if (parsed.type === 'clock') this.replace({ clockIso: (parsed.payload as { iso: string }).iso })
      }
      ws.onclose = () => {
        if (import.meta.env.MODE === 'test') return
        setTimeout(() => this.connect(), 1200)
      }
    } catch {
      /* jsdom 无 WebSocket 实现时跳过 */
    }
  }
}

export function bindSnapshot(source: SnapshotService) {
  return function useSnapshot<S>(sel: (state: Snapshot) => S): S {
    return useSyncExternalStore(source.subscribe, () => sel(source.get()), () => sel(source.get()))
  }
}

export const name = 'snapshot'
export const inject = [] as const

export function apply(ctx: Context) {
  new SnapshotService(ctx)
}