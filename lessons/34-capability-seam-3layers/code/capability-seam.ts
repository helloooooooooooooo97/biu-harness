/**
 * 能力缝三角色：Definition / Provider / Consumer（第 34 课）。
 */

export interface ServiceDefinition<K extends string = string> {
  key: K
  description: string
}

export interface ServiceProvider {
  definition: ServiceDefinition
  create(): unknown
}

/** 按 key 注册 Provider、懒创建实例。 */
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

  definition(key: string): ServiceDefinition | undefined {
    return this.providers.get(key)?.definition
  }

  list(): string[] {
    return [...this.providers.keys()]
  }
}
