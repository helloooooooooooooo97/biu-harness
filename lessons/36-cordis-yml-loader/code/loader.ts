/** ConfigLoader：配置 → 插件树（第 36 课）。 */
import { expandIncludes, parseEntries, type ConfigEntry } from './config.ts'
import { PluginHost, type PluginDef } from './host.ts'

export interface LoaderOptions {
  registry: Map<string, PluginDef>
  files?: Map<string, string>
  vars?: Record<string, unknown>
}

export class ConfigLoader {
  private readonly host = new PluginHost()
  private readonly registry: Map<string, PluginDef>
  private readonly files: Map<string, string>
  private readonly vars: Record<string, unknown>

  constructor(options: LoaderOptions) {
    this.registry = options.registry
    this.files = options.files ?? new Map()
    this.vars = options.vars ?? {}
  }

  get plugins(): PluginHost {
    return this.host
  }

  load(text: string): void {
    const entries = expandIncludes(parseEntries(text), this.files, this.vars)
    this.mount(entries)
  }

  private mount(entries: ConfigEntry[]): void {
    for (const entry of entries) {
      if (entry.enabled === false) continue
      const def = this.registry.get(entry.name)
      if (!def) throw new Error(`未知插件: ${entry.name}`)
      this.host.plugin(def)
    }
  }
}
