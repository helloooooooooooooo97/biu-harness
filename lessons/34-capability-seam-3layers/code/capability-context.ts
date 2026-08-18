/**
 * CapabilityContext：插件宿主与能力缝的一体化实现（第 34 课合并版）。
 *
 * 拆开看的两个类各管一半：
 *   CapabilityRegistry —— 能力层：key ↔ Provider，懒创建 + 可替换；
 *   MiniContext        —— 组装层：插件装载服务、可整体卸载。
 * 本类把两者合二为一：插件 apply 里可以 mount 能力缝（定义 + create），
 * 卸载插件时按归属清掉它 mount/provide 的一切；消费者 get(key) 无感。
 */

export interface ServiceDefinition<K extends string = string> {
  key: K
  description: string
}

export interface ServiceProvider {
  definition: ServiceDefinition
  create(): unknown
}

export interface PluginDef {
  name: string
  apply: (ctx: CapabilityContext) => void | (() => void)
}

export class CapabilityContext {
  private readonly providers = new Map<string, ServiceProvider>()
  private readonly instances = new Map<string, unknown>()
  private readonly direct = new Map<string, unknown>()
  private readonly ownedProviders = new Map<string, Set<string>>()
  private readonly ownedDirect = new Map<string, Set<string>>()
  private readonly plugins = new Map<string, PluginDef>()
  private currentPlugin: string | null = null

  /** 以能力缝形式挂载：懒创建 + 缓存 + 可替换。 */
  mount(provider: ServiceProvider): () => void {
    const key = provider.definition.key
    if (this.providers.has(key) || this.direct.has(key)) throw new Error(`能力已存在: ${key}`)
    this.providers.set(key, provider)
    if (this.currentPlugin) {
      const set = this.ownedProviders.get(this.currentPlugin) ?? new Set<string>()
      set.add(key)
      this.ownedProviders.set(this.currentPlugin, set)
    }
    return () => {
      this.providers.delete(key)
      this.instances.delete(key)
    }
  }

  /** 直接挂实例（简单服务，不经过 create）。 */
  provide(key: string, impl: unknown): () => void {
    if (this.providers.has(key) || this.direct.has(key)) throw new Error(`能力已存在: ${key}`)
    this.direct.set(key, impl)
    if (this.currentPlugin) {
      const set = this.ownedDirect.get(this.currentPlugin) ?? new Set<string>()
      set.add(key)
      this.ownedDirect.set(this.currentPlugin, set)
    }
    return () => this.direct.delete(key)
  }

  get<T>(key: string): T {
    if (this.direct.has(key)) return this.direct.get(key) as T
    if (this.providers.has(key)) {
      let instance = this.instances.get(key)
      if (instance === undefined) {
        instance = this.providers.get(key)!.create()
        this.instances.set(key, instance)
      }
      return instance as T
    }
    throw new Error(`缺少能力: ${key}`)
  }

  has(key: string): boolean {
    return this.providers.has(key) || this.direct.has(key)
  }

  /** 加载插件：apply 里 mount/provide 的能力记入该插件归属。 */
  plugin(def: PluginDef): () => void {
    if (this.plugins.has(def.name)) throw new Error(`插件已加载: ${def.name}`)
    const previous = this.currentPlugin
    this.currentPlugin = def.name
    const cleanup = def.apply(this) ?? undefined
    this.currentPlugin = previous
    const unload = () => {
      for (const key of this.ownedProviders.get(def.name) ?? []) {
        this.providers.delete(key)
        this.instances.delete(key)
      }
      for (const key of this.ownedDirect.get(def.name) ?? []) this.direct.delete(key)
      this.ownedProviders.delete(def.name)
      this.ownedDirect.delete(def.name)
      cleanup?.()
      this.plugins.delete(def.name)
    }
    this.plugins.set(def.name, def)
    return unload
  }
}
