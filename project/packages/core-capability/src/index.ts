/** 能力缝三角色 + 一切皆插件最小宿主（第 34 课）。 */

export interface ServiceDefinition<K extends string = string> {
  key: K
  description: string
}

export interface ServiceProvider {
  definition: ServiceDefinition
  create(): unknown
}

export class CapabilityRegistry {
  private readonly providers = new Map<string, ServiceProvider>()
  private readonly instances = new Map<string, unknown>()

  register(provider: ServiceProvider): () => void {
    const key = provider.definition.key
    if (this.providers.has(key)) throw new Error(`能力已存在: ${key}`)
    this.providers.set(key, provider)
    return () => {
      this.providers.delete(key)
      this.instances.delete(key)
    }
  }

  provide(key: string): unknown {
    const cached = this.instances.get(key)
    if (cached !== undefined) return cached
    const provider = this.providers.get(key)
    if (!provider) throw new Error(`缺少能力: ${key}`)
    const instance = provider.create()
    this.instances.set(key, instance)
    return instance
  }
}

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
