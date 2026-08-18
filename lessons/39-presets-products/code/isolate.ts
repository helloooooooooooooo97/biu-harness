/** Isolate 隔离域：realm 内的服务互不可见（第 39 课）。 */

export class IsolateRegistry {
  private readonly realms = new Map<string, Map<string, unknown>>()
  private readonly global = new Map<string, unknown>()

  provide(realm: string, key: string, impl: unknown): () => void {
    const map = this.realms.get(realm) ?? new Map<string, unknown>()
    map.set(key, impl)
    this.realms.set(realm, map)
    return () => map.delete(key)
  }

  get<T>(realm: string, key: string): T {
    const scoped = this.realms.get(realm)?.get(key)
    if (scoped !== undefined) return scoped as T
    if (this.global.has(key)) return this.global.get(key) as T
    throw new Error(`realm ${realm} 缺少服务: ${key}`)
  }

  /** 全局服务：所有 realm 都能 fallback 到。 */
  provideGlobal(key: string, impl: unknown): () => void {
    this.global.set(key, impl)
    return () => this.global.delete(key)
  }
}
