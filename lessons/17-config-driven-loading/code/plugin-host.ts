/** PluginHost：插件加载/卸载（复用第 16 课实现，新增 pluginNames）。 */
import { EffectRegistry, type Disposer } from './effects.ts'
import { StateStore } from './state.ts'

export interface PluginDef {
  name: string
  apply: (ctx: PluginContext) => void | (() => void)
}

export interface PluginContext {
  effect(fn: () => void): Disposer
  provide(key: string, value: unknown): Disposer
  get<T>(key: string): T
  readonly state: StateStore
}

interface LoadedPlugin {
  def: PluginDef
  effects: EffectRegistry
  cleanup?: () => void
}

export class PluginHost {
  readonly state = new StateStore()
  private readonly plugins = new Map<string, LoadedPlugin>()
  private readonly services = new Map<string, unknown>()
  private readonly order: string[] = []

  load(def: PluginDef): void {
    if (this.plugins.has(def.name)) throw new Error(`插件已加载: ${def.name}`)
    const effects = new EffectRegistry()
    const ctx: PluginContext = {
      effect: (fn) => effects.register(fn),
      provide: (key, value) => {
        if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
        this.services.set(key, value)
        return effects.register(() => this.services.delete(key))
      },
      get: <T>(key: string) => {
        if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
        return this.services.get(key) as T
      },
      state: this.state,
    }
    const cleanup = def.apply(ctx) ?? undefined
    this.plugins.set(def.name, { def, effects, cleanup })
    this.order.push(def.name)
  }

  unload(name: string): void {
    const loaded = this.plugins.get(name)
    if (!loaded) return
    loaded.effects.disposeAll()
    loaded.cleanup?.()
    this.plugins.delete(name)
    const index = this.order.indexOf(name)
    if (index >= 0) this.order.splice(index, 1)
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
    return this.services.get(key) as T
  }

  has(key: string): boolean {
    return this.services.has(key)
  }

  pluginNames(): string[] {
    return [...this.order]
  }

  get pluginCount(): number {
    return this.plugins.size
  }
}
