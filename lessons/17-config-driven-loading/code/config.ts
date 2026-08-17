/**
 * 配置解析与校验：{ entries: [{ id, name, enabled?, config? }] }。
 */

export interface ConfigEntry {
  id: string
  name: string
  enabled?: boolean
  config?: Record<string, unknown>
}

export function parseConfig(text: string): ConfigEntry[] {
  const data = JSON.parse(text) as { entries?: unknown }
  if (!Array.isArray(data.entries)) {
    throw new Error('配置必须是 { "entries": [...] }')
  }
  const seen = new Set<string>()
  return data.entries.map((raw) => {
    const entry = raw as Partial<ConfigEntry>
    if (!entry.id || !entry.name) {
      throw new Error(`配置项必须含 id 与 name: ${JSON.stringify(entry)}`)
    }
    if (seen.has(entry.id)) throw new Error(`重复的配置项 id: ${entry.id}`)
    seen.add(entry.id)
    return { id: entry.id, name: entry.name, enabled: entry.enabled, config: entry.config }
  })
}
