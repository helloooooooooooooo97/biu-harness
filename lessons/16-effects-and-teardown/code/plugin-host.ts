/**
 * PluginHost：插件的加载/卸载/热重载。
 * 热重载 = 快照状态 → 卸载旧树 → 挂新树 →（失败）恢复状态 + 回滚旧树。
 */
import { EffectRegistry, type Disposer } from './effects.ts'
import { StateStore } from './state.ts'

export interface PluginDef {
  name: string
  /** apply 里注册的 effect/provide 都归属该插件；返回值是额外 cleanup。 */
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
  version: number
  effects: EffectRegistry
  cleanup?: () => void
}

export type ReloadResult =
  | { ok: true; version: number }
  | { ok: false; error: unknown }

export class PluginHost {
  readonly state = new StateStore()
  private readonly plugins = new Map<string, LoadedPlugin>()
  private readonly services = new Map<string, unknown>()
  private readonly order: string[] = []
  private versionCounter = 0

  load(def: PluginDef): number {
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
    this.versionCounter += 1
    this.plugins.set(def.name, { def, version: this.versionCounter, effects, cleanup })
    this.order.push(def.name)
    return this.versionCounter
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

  /** 热重载：替换实现，失败回滚到旧树 + 恢复状态。 */
  reload(name: string, next: PluginDef): ReloadResult {
    const previous = this.plugins.get(name)
    if (!previous) throw new Error(`插件未加载: ${name}`)
    const stateSnapshot = this.state.snapshot()
    this.unload(name)
    try {
      const version = this.load(next)
      return { ok: true, version }
    } catch (error) {
      this.unload(name)                     // 清掉新树可能的部分注册
      this.state.restore(stateSnapshot)     // 状态回滚
      this.load(previous.def)               // 恢复旧树
      return { ok: false, error }
    }
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
    return this.services.get(key) as T
  }

  get pluginCount(): number {
    return this.plugins.size
  }
}
