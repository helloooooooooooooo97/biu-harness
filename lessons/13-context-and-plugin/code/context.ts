/**
 * mini-Cordis 内核：Context 提供服务注册、可逆 effect 与插件加载。
 *
 * effect 分两类，归属不同：
 *   - 外部 effect：在插件 apply 之外直接 ctx.effect()/ctx.provide() 注册，
 *     只属于 context 本身，由手动 disposer 或 stop() 清理；
 *   - 插件内 effect：在插件 apply 执行期间注册，记在插件名下，
 *     只随该插件 unload 清理，绝不波及其他插件或外部 effect。
 */

export interface PluginDef {
  name: string
  /** apply 里注册的 effect 全部归属该插件；返回值是额外清理函数。 */
  apply: (ctx: Context) => void | (() => void)
}

export class Context {
  private readonly services = new Map<string, unknown>()
  private readonly effects: Array<() => void> = []
  private readonly pluginEffects = new Map<string, Array<() => void>>()
  private readonly effectOwner = new Map<() => void, string>()
  private readonly plugins = new Map<string, PluginDef>()
  private readonly order: string[] = []
  private readonly unloaders = new Map<string, () => void>()
  private currentPlugin: string | null = null
  private stopped = false

  /** 注册一个可逆 effect；返回手动卸载器。 */
  effect(fn: () => void): () => void {
    if (this.stopped) throw new Error('context 已停止，不能再注册 effect')
    this.effects.push(fn)
    // 在插件 apply 期间注册 → 记入当前插件的账本；否则是外部 effect。
    if (this.currentPlugin) {
      const list = this.pluginEffects.get(this.currentPlugin) ?? []
      list.push(fn)
      this.pluginEffects.set(this.currentPlugin, list)
      this.effectOwner.set(fn, this.currentPlugin)
    }
    return () => this.runEffect(fn)
  }

  private runEffect(fn: () => void): void {
    const index = this.effects.indexOf(fn)
    if (index < 0) return
    this.effects.splice(index, 1)
    const owner = this.effectOwner.get(fn)
    if (owner) {
      const list = this.pluginEffects.get(owner)
      if (list) {
        const i = list.indexOf(fn)
        if (i >= 0) list.splice(i, 1)
      }
      this.effectOwner.delete(fn)
    }
    fn()
  }

  /** 提供服务（ctx.get 按名字取）；返回卸载器（自动注册为 effect）。 */
  provide(name: string, impl: unknown): () => void {
    if (this.services.has(name)) throw new Error(`服务已存在: ${name}`)
    this.services.set(name, impl)
    return this.effect(() => {
      this.services.delete(name)
    })
  }

  get<T = unknown>(name: string): T {
    if (!this.services.has(name)) throw new Error(`缺少服务: ${name}`)
    return this.services.get(name) as T
  }

  has(name: string): boolean {
    return this.services.has(name)
  }

  /** 加载插件；返回卸载器。 */
  plugin(def: PluginDef): () => void {
    if (this.stopped) throw new Error('context 已停止，不能加载插件')
    if (this.plugins.has(def.name)) throw new Error(`插件已加载: ${def.name}`)
    const previous = this.currentPlugin
    this.currentPlugin = def.name
    const cleanup = def.apply(this) ?? undefined
    this.currentPlugin = previous
    const unload = () => {
      // 只清理本插件的 effect（逆序）+ 额外 cleanup；外部 effect 一律不动。
      const list = this.pluginEffects.get(def.name) ?? []
      for (let i = list.length - 1; i >= 0; i -= 1) {
        this.runEffect(list[i])
      }
      this.pluginEffects.delete(def.name)
      cleanup?.()
    }
    this.plugins.set(def.name, def)
    this.order.push(def.name)
    this.unloaders.set(def.name, unload)
    return () => this.unload(def.name)
  }

  /** 卸载指定插件：逆序卸载它及之后加载的（依赖它的）插件。 */
  unload(name: string): void {
    const index = this.order.indexOf(name)
    if (index < 0) return
    for (let i = this.order.length - 1; i >= index; i -= 1) {
      const target = this.order[i]
      const unload = this.unloaders.get(target)
      if (unload) {
        unload()
        this.unloaders.delete(target)
        this.plugins.delete(target)
      }
      this.order.splice(i, 1)
    }
  }

  /** 停止整个 context：先逆序卸载全部插件（各清各的），再清理外部 effect。 */
  stop(): void {
    if (this.stopped) return
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      this.unloaders.get(this.order[i])?.()
    }
    this.order.length = 0
    this.unloaders.clear()
    this.plugins.clear()
    this.pluginEffects.clear()
    // 残余的只有外部 effect（插件内 effect 已随插件卸载清完）。
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fn = this.effects[i]
      this.effects.splice(i, 1)
      fn()
    }
    this.stopped = true
  }

  get pluginCount(): number {
    return this.plugins.size
  }
}
