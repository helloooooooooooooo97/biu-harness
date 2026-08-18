/** 动态插件：define/run/stop/undefine + cordis 工具集（第 43 课）。 */

export type ApproveResolver = (question: string) => Promise<boolean>

export interface DynamicDefinition {
  id: string
  name: string
  purpose: string
  host?: string
  client?: string
  running: boolean
}

export class DynamicHost {
  private readonly definitions = new Map<string, DynamicDefinition>()
  private readonly services = new Map<string, unknown>()
  private readonly owned = new Map<string, Set<string>>()
  private nextId = 0

  constructor(private readonly approve: ApproveResolver = async () => false) {}

  define(input: { name: string; purpose: string; host?: string; client?: string }): string {
    if (input.host) new Function('ctx', input.host)
    this.nextId += 1
    const id = `dyn-${this.nextId}`
    this.definitions.set(id, { id, name: input.name, purpose: input.purpose, host: input.host, client: input.client, running: false })
    return id
  }

  async run(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const def = this.definitions.get(id)
    if (!def) return { ok: false, reason: '定义不存在' }
    if (def.client) {
      const allowed = await this.approve(`允许运行动态插件 ${def.name}（含 UI）？`)
      if (!allowed) return { ok: false, reason: '用户拒绝审批' }
    }
    if (def.host) {
      const ctx = {
        provide: (key: string, impl: unknown) => {
          if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
          this.services.set(key, impl)
          const set = this.owned.get(id) ?? new Set<string>()
          set.add(key)
          this.owned.set(id, set)
          return () => this.services.delete(key)
        },
        get: (key: string) => {
          if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
          return this.services.get(key)
        },
      }
      new Function('ctx', def.host)(ctx)
    }
    def.running = true
    return { ok: true }
  }

  stop(id: string): void {
    const def = this.definitions.get(id)
    if (!def) return
    for (const key of this.owned.get(id) ?? []) this.services.delete(key)
    this.owned.delete(id)
    def.running = false
  }

  undefine(id: string): void {
    this.stop(id)
    this.definitions.delete(id)
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
    return this.services.get(key) as T
  }

  inspect(): DynamicDefinition[] {
    return [...this.definitions.values()].map((d) => ({ ...d }))
  }
}

export class CordisToolset {
  constructor(private readonly host: DynamicHost) {}

  async execute(action: string, args: Record<string, unknown>): Promise<string> {
    switch (action) {
      case 'inspect':
        return this.host.inspect().map((d) => `- ${d.id} ${d.name} (${d.running ? 'running' : 'idle'})`).join('\n') || '(无动态插件)'
      case 'define':
        return this.host.define({ name: String(args.name ?? ''), purpose: String(args.purpose ?? ''), host: args.host ? String(args.host) : undefined, client: args.client ? String(args.client) : undefined })
      case 'run': {
        const result = await this.host.run(String(args.id ?? ''))
        return result.ok ? 'ok' : `拒绝: ${result.reason}`
      }
      case 'stop':
        this.host.stop(String(args.id ?? ''))
        return 'stopped'
      case 'undefine':
        this.host.undefine(String(args.id ?? ''))
        return 'undefined'
      default:
        return `未知动作: ${action}`
    }
  }
}
