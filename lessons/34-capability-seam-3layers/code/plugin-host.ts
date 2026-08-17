/**
 * MiniContext：一切皆插件的最小宿主（第 34 课实操）。
 * 插件通过 apply 注册服务；卸载时移除它注册的服务。
 */

export interface PluginDef {
  name: string
  apply: (ctx: PluginContext) => void | (() => void)
}

export interface PluginContext {
  provide(key: string, impl: unknown): () => void
  get<T>(key: string): T
}

export class MiniContext {
  private readonly services = new Map<string, unknown>()
  private readonly owned = new Map<string, Set<string>>()
  private readonly plugins = new Map<string, PluginDef>()
  private currentPlugin: string | null = null

  provide(key: string, impl: unknown): () => void {
    if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
    this.services.set(key, impl)
    if (this.currentPlugin) {
      const set = this.owned.get(this.currentPlugin) ?? new Set<string>()
      set.add(key)
      this.owned.set(this.currentPlugin, set)
    }
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
    const previous = this.currentPlugin
    this.currentPlugin = def.name
    const cleanup = def.apply(this) ?? undefined
    this.currentPlugin = previous
    const unload = () => {
      for (const key of this.owned.get(def.name) ?? []) this.services.delete(key)
      this.owned.delete(def.name)
      cleanup?.()
      this.plugins.delete(def.name)
    }
    this.plugins.set(def.name, def)
    return unload
  }
}
