/**
 * ConfigLoader：按配置装载插件树；热重载失败回滚到上一个稳定树。
 */
import { parseConfig, type ConfigEntry } from './config.ts'
import { PluginHost, type PluginDef } from './plugin-host.ts'

export interface LoaderOptions {
  registry: Map<string, PluginDef>
}

export class ConfigLoader {
  private readonly host: PluginHost
  private readonly registry: Map<string, PluginDef>
  private currentEntries: ConfigEntry[] = []

  constructor(options: LoaderOptions) {
    this.host = new PluginHost()
    this.registry = options.registry
  }

  get plugins(): PluginHost {
    return this.host
  }

  /** 从配置文本装载插件树；失败时回滚并抛出原错误。 */
  applyConfig(text: string): void {
    this.replaceTree(parseConfig(text))
  }

  /** 重建整棵插件树：卸载旧树 → 挂新树；失败回滚到 previous。 */
  replaceTree(entries: ConfigEntry[]): void {
    const previous = this.currentEntries
    const stateSnapshot = this.host.state.snapshot()
    this.teardownAll()
    try {
      this.mount(entries)
      this.currentEntries = entries
    } catch (error) {
      this.teardownAll()                       // 清掉半挂的新树
      this.host.state.restore(stateSnapshot)   // 状态回滚
      this.mount(previous)                     // 恢复旧树
      this.currentEntries = previous
      throw error
    }
  }

  private mount(entries: ConfigEntry[]): void {
    for (const entry of entries) {
      if (entry.enabled === false) continue
      const def = this.registry.get(entry.name)
      if (!def) throw new Error(`未知插件: ${entry.name}（配置项 ${entry.id}）`)
      this.host.load(def)
    }
  }

  private teardownAll(): void {
    for (const name of [...this.host.pluginNames()]) {
      this.host.unload(name)
    }
  }
}
