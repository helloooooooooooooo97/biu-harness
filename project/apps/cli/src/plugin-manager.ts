/**
 * CordisPluginManager：dsh 式插件安装与热更新。
 *
 * - install(name, def)：注册插件并挂载（fiber 激活）；
 * - remove(id)：fiber.dispose() 卸载，服务随之消失；
 * - applyConfig(entries)：配置 diff → 卸载改名/禁用/删除的，挂载新增/启用的（HMR）；
 * - watchConfig(read)：轮询配置文件，变更即 applyConfig（配置热更新）。
 */
import { Context, type Fiber, type Plugin } from '@deepseek-ai/cordis'
import { parseEntries, type ConfigEntry } from '@mini-dsh/config'

export type PluginResolver = (name: string, bust?: boolean) => Promise<Plugin<unknown> | undefined>

export class CordisPluginManager {
  private readonly registry: Map<string, Plugin<unknown>>
  private readonly fibers = new Map<string, Fiber>()
  private readonly entries = new Map<string, ConfigEntry>()
  private readonly resolver?: PluginResolver

  constructor(
    readonly ctx: Context,
    registry?: Map<string, Plugin<unknown>>,
    resolver?: PluginResolver,
  ) {
    this.registry = registry ?? new Map()
    this.resolver = resolver
  }

  // 定义
  /** 注册一个插件定义（安装的第一步：让配置能引用它）。 */
  register(name: string, def: Plugin<unknown>): void {
    this.registry.set(name, def)
  }

  /** 吸收一次插件目录扫描（boot 时用）。 */
  adoptRegistry(all: Map<string, Plugin<unknown>>): void {
    for (const [key, def] of all) this.registry.set(key, def)
  }

  /** 挂载一个配置条目为 cordis fiber（不等待激活）。 */
  mount(entry: ConfigEntry): Fiber {
    if (entry.enabled === false) throw new Error(`已禁用: ${entry.id}`)
    const def = this.registry.get(entry.name)
    if (!def) throw new Error(`未知插件: ${entry.name}`)
    const fiber = this.ctx.plugin(def)
    this.fibers.set(entry.id, fiber)
    this.entries.set(entry.id, entry)
    return fiber
  }

  /** 卸载：fiber.dispose() 逆序撤销该插件的所有 effect/服务。 */
  async unmount(id: string): Promise<void> {
    const fiber = this.fibers.get(id)
    if (fiber) await fiber.dispose()
    this.fibers.delete(id)
    this.entries.delete(id)
  }

  /** 热更新：按配置 diff 卸载/挂载（改名或禁用会先卸再装）。 */
  async applyConfig(entries: ConfigEntry[]): Promise<void> {
    const next = new Map(entries.map((e) => [e.id, e]))
    for (const [id, entry] of [...this.entries]) {
      const n = next.get(id)
      if (!n || n.name !== entry.name || n.enabled === false) await this.unmount(id)
    }
    for (const entry of entries) {
      if (entry.enabled === false) continue
      const current = this.entries.get(entry.id)
      if (!current || current.name !== entry.name) this.mount(entry)
    }
    await this.ready()
  }

  /** 安装：无 def 时经 resolver 动态 import() 插件模块，然后挂载 + 等激活。 */
  async install(name: string, def?: Plugin<unknown>, id = name): Promise<void> {
    if (def) this.registry.set(name, def)
    else if (!this.registry.has(name)) {
      if (!this.resolver) throw new Error(`无插件解析器，无法安装: ${name}`)
      const resolved = await this.resolver(name)
      if (!resolved) throw new Error(`未知插件: ${name}`)
      this.registry.set(name, resolved)
    }
    this.mount({ id, name })
    await this.ready()
  }

  /** 卸载指定 id。 */
  async remove(id: string): Promise<void> {
    await this.unmount(id)
  }

  /** 重载：卸掉再挂同一条目（热替换实现 = 换配置名 + applyConfig）。 */
  async reload(id: string): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry) throw new Error(`未安装: ${id}`)
    await this.unmount(id)
    this.mount(entry)
    await this.ready()
  }

  /** 插件热更新：破缓存重新 import 该插件，重挂所有引用它的条目。 */
  async reloadPlugin(name: string, next?: Plugin<unknown>): Promise<void> {
    const def = next ?? await this.resolver?.(name, true)
    if (!def) throw new Error(`未知插件: ${name}`)
    this.registry.set(name, def)
    const affected = [...this.entries.values()].filter((e) => e.name === name)
    for (const entry of affected) {
      await this.unmount(entry.id)
      this.mount(entry)
    }
    await this.ready()
  }

  /** inject 所需服务是否都已出现（未出现则保持 PENDING，不阻塞 ready）。 */
  private injectReady(fiber: Fiber): boolean {
    return Object.keys(fiber.inject ?? {}).every((name) => this.ctx.get(name) !== undefined)
  }

  /** 等「依赖已齐」的 fiber 全部 ACTIVE；依赖不齐的允许继续 PENDING。 */
  async ready(): Promise<void> {
    for (let i = 0; i < 64; i++) {
      await Promise.all([...this.fibers.values()].map((fiber) => fiber.await()))
      const waiting = [...this.fibers.values()].some((fiber) => {
        if (fiber.inertia) return true
        // 0 = FiberState.PENDING（const enum，运行时无导出）
        return fiber.state === 0 && this.injectReady(fiber)
      })
      if (!waiting) return
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }

  /** 当前已装载的插件名（按配置顺序）。 */
  pluginNames(): string[] {
    return [...this.entries.values()].map((e) => e.name)
  }

  /** 配置热更新：轮询 read()，文本变化即 applyConfig。返回停止函数。 */
  watchConfig(read: () => string, intervalMs = 800): () => void {
    let last = read()
    const timer = setInterval(() => {
      let next: string
      try {
        next = read()
      } catch {
        return
      }
      if (next === last) return
      last = next
      this.applyConfig(parseEntries(next)).catch((err: unknown) => {
        console.error(`配置热更新失败（保留旧树）: ${err instanceof Error ? err.message : String(err)}`)
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }

  /** 插件目录热更新：轮询 mtime，文件变化即 reloadPlugin 对应插件。返回停止函数。 */
  watchPlugins(read: () => Array<{ name: string; mtimeMs: number }>, intervalMs = 800): () => void {
    let last = read()
    const timer = setInterval(() => {
      let next: Array<{ name: string; mtimeMs: number }>
      try {
        next = read()
      } catch {
        return
      }
      const changed = next.filter((f) => {
        const prev = last.find((p) => p.name === f.name)
        return !prev || prev.mtimeMs !== f.mtimeMs
      })
      if (changed.length === 0 && next.length === last.length) return
      last = next
      for (const f of changed) {
        this.reloadPlugin(f.name).catch((err: unknown) => {
          console.error(`插件热更新失败（保留旧实例）: ${err instanceof Error ? err.message : String(err)}`)
        })
      }
    }, intervalMs)
    return () => clearInterval(timer)
  }
}
