/** 最小插件宿主：provide/get/plugin（复用第 34 课 MiniContext）。 */

export interface PluginDef {
  name: string
  apply: (ctx: { provide(key: string, impl: unknown): () => void; get<T>(key: string): T }) => void | (() => void)
}

export class PluginHost {
  private readonly services = new Map<string, unknown>()
  private readonly plugins = new Map<string, PluginDef>()

  provide(key: string, impl: unknown): () => void {
    if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
    this.services.set(key, impl)
    return () => this.services.delete(key)
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
    return this.services.get(key) as T
  }

  has(key: string): boolean {
    return this.services.has(key)
  }

  plugin(def: PluginDef): () => void {
    if (this.plugins.has(def.name)) throw new Error(`插件已加载: ${def.name}`)
    const cleanup = def.apply({ provide: (k, v) => this.provide(k, v), get: (k) => this.get(k) }) ?? undefined
    this.plugins.set(def.name, def)
    return () => {
      cleanup?.()
      this.plugins.delete(def.name)
    }
  }

  get pluginCount(): number {
    return this.plugins.size
  }
}
