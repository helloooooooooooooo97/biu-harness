/** Agent presets 与 isolate 隔离域（第 39 课）。 */

export interface AgentPreset {
  name: string
  tools: string[]
  prompt?: string
}

export class PresetRegistry {
  private readonly presets = new Map<string, AgentPreset>()

  constructor(private readonly fallback: AgentPreset) {}

  register(preset: AgentPreset): () => void {
    if (this.presets.has(preset.name)) throw new Error(`preset 已存在: ${preset.name}`)
    this.presets.set(preset.name, preset)
    return () => this.presets.delete(preset.name)
  }

  resolve(name?: string): AgentPreset {
    if (name && this.presets.has(name)) return this.presets.get(name)!
    return this.fallback
  }
}

export class IsolateRegistry {
  private readonly realms = new Map<string, Map<string, unknown>>()
  private readonly global = new Map<string, unknown>()

  provide(realm: string, key: string, impl: unknown): () => void {
    const map = this.realms.get(realm) ?? new Map<string, unknown>()
    map.set(key, impl)
    this.realms.set(realm, map)
    return () => map.delete(key)
  }

  provideGlobal(key: string, impl: unknown): () => void {
    this.global.set(key, impl)
    return () => this.global.delete(key)
  }

  get<T>(realm: string, key: string): T {
    const scoped = this.realms.get(realm)?.get(key)
    if (scoped !== undefined) return scoped as T
    if (this.global.has(key)) return this.global.get(key) as T
    throw new Error(`realm ${realm} 缺少服务: ${key}`)
  }
}
