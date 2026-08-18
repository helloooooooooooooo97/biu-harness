/** 配置驱动加载：entries + include + js: 表达式（第 36 课），JSON 与 YAML 双格式。 */
import { parse as parseYaml } from 'yaml'

export interface ConfigEntry {
  id: string
  name: string
  enabled?: boolean
  config?: Record<string, unknown>
}

export interface PluginDef {
  name: string
  apply: (ctx: { provide(key: string, impl: unknown): () => void; get<T>(key: string): T }) => void | (() => void)
}

export function parseEntries(text: string): ConfigEntry[] {
  const data = parseConfigText(text)
  if (!Array.isArray(data.entries)) throw new Error('配置必须是 { "entries": [...] }')
  const seen = new Set<string>()
  return data.entries.map((raw) => {
    const entry = raw as Partial<ConfigEntry>
    if (!entry.id || !entry.name) throw new Error(`配置项必须含 id 与 name: ${JSON.stringify(entry)}`)
    if (seen.has(entry.id)) throw new Error(`重复的配置项 id: ${entry.id}`)
    seen.add(entry.id)
    return { id: entry.id, name: entry.name, enabled: entry.enabled, config: entry.config }
  })
}

/** 先按 JSON 解析，失败再按 YAML 解析（YAML 可手写注释，适合人维护）。 */
function parseConfigText(text: string): { entries?: unknown } {
  try {
    return JSON.parse(text) as { entries?: unknown }
  } catch {
    try {
      return parseYaml(text) as { entries?: unknown }
    } catch {
      throw new Error('配置解析失败：既不是合法 JSON，也不是合法 YAML')
    }
  }
}

export function evalJs(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('js:')) {
    const fn = new Function('ctx', `return (${value.slice(3).trim()})`)
    return fn(ctx)
  }
  if (Array.isArray(value)) return value.map((v) => evalJs(v, ctx))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, evalJs(v, ctx)]))
  }
  return value
}

export function expandIncludes(entries: ConfigEntry[], files: Map<string, string>, vars: Record<string, unknown>): ConfigEntry[] {
  const out: ConfigEntry[] = []
  for (const entry of entries) {
    if (entry.name === 'include') {
      const file = String(entry.config?.file ?? '')
      const text = files.get(file)
      if (text === undefined) throw new Error(`include 文件不存在: ${file}`)
      out.push(...expandIncludes(parseEntries(text), files, vars))
      continue
    }
    out.push({ ...entry, config: entry.config ? evalJs(entry.config, vars) as Record<string, unknown> : undefined })
  }
  return out
}

export class PluginHost {
  private readonly services = new Map<string, unknown>()
  private readonly plugins = new Map<string, PluginDef>()

  provide(key: string, impl: unknown): () => void {
    if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
    this.services.set(key, impl)
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
    const cleanup = def.apply({ provide: (k, v) => this.provide(k, v), get: (k) => this.get(k) }) ?? undefined
    this.plugins.set(def.name, def)
    return () => {
      cleanup?.()
      this.plugins.delete(def.name)
    }
  }

  get pluginCount(): number {
    return this.plugins.size
  }
}

export class ConfigLoader {
  private readonly host = new PluginHost()
  private readonly registry: Map<string, PluginDef>
  private readonly files: Map<string, string>
  private readonly vars: Record<string, unknown>

  constructor(options: { registry: Map<string, PluginDef>; files?: Map<string, string>; vars?: Record<string, unknown> }) {
    this.registry = options.registry
    this.files = options.files ?? new Map()
    this.vars = options.vars ?? {}
  }

  get plugins(): PluginHost {
    return this.host
  }

  load(text: string): void {
    for (const entry of expandIncludes(parseEntries(text), this.files, this.vars)) {
      if (entry.enabled === false) continue
      const def = this.registry.get(entry.name)
      if (!def) throw new Error(`未知插件: ${entry.name}`)
      this.host.plugin(def)
    }
  }
}
