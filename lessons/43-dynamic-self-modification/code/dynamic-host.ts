/** 动态插件宿主：define/run/stop/undefine（第 43 课，教学版）。 */

export interface DynamicDefinition {
  id: string
  name: string
  purpose: string
  host?: string
  client?: string
  running: boolean
}

export type ApproveResolver = (question: string) => Promise<boolean>

interface MiniCtx {
  provide(key: string, impl: unknown): () => void
  get<T>(key: string): T
}

export class DynamicHost {
  private readonly definitions = new Map<string, DynamicDefinition>()
  private readonly services = new Map<string, unknown>()
  private readonly owned = new Map<string, Set<string>>()
  private nextId = 0

  constructor(private readonly approve: ApproveResolver = async () => false) {}

  /** 记录定义并做语法检查（不执行）。 */
  define(input: { name: string; purpose: string; host?: string; client?: string }): string {
    if (input.host) new Function('ctx', input.host)   // 语法检查，执行会抛
    this.nextId += 1
    const id = `dyn-${this.nextId}`
    this.definitions.set(id, { id, name: input.name, purpose: input.purpose, host: input.host, client: input.client, running: false })
    return id
  }

  /** 执行 host 半；带 browser 半需审批。 */
  async run(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const def = this.definitions.get(id)
    if (!def) return { ok: false, reason: '定义不存在' }
    if (def.client) {
      const allowed = await this.approve(`允许运行动态插件 ${def.name}（含 UI）？`)
      if (!allowed) return { ok: false, reason: '用户拒绝审批' }
    }
    if (def.host) {
      const ctx: MiniCtx = {
        provide: (key, impl) => {
          if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
          this.services.set(key, impl)
          const set = this.owned.get(id) ?? new Set<string>()
          set.add(key)
          this.owned.set(id, set)
          return () => this.services.delete(key)
        },
        get: (key) => {
          if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
          return this.services.get(key) as never
        },
      }
      const fn = new Function('ctx', def.host)
      fn(ctx)
    }
    def.running = true
    return { ok: true }
  }

  /** 停止：清掉该定义注册的服务。 */
  stop(id: string): void {
    const def = this.definitions.get(id)
    if (!def) return
    for (const key of this.owned.get(id) ?? []) this.services.delete(key)
    this.owned.delete(id)
    def.running = false
  }

  /** 忘记定义（先 stop）。 */
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
