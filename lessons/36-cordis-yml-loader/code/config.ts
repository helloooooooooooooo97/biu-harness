/** 配置解析：entries + include + js: 表达式（第 36 课）。 */

export interface ConfigEntry {
  id: string
  name: string
  enabled?: boolean
  config?: Record<string, unknown>
}

export function parseEntries(text: string): ConfigEntry[] {
  const data = JSON.parse(text) as { entries?: unknown }
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

/** 求值 js: 表达式；非 js: 前缀原样返回。 */
export function evalJs(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('js:')) {
    const expr = value.slice(3).trim()
    const fn = new Function('ctx', `return (${expr})`)
    return fn(ctx)
  }
  if (Array.isArray(value)) return value.map((v) => evalJs(v, ctx))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, evalJs(v, ctx)]))
  }
  return value
}

/** 展开 include（name === 'include' 的 entry 递归解析 config.file）。 */
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
    out.push({
      ...entry,
      config: entry.config ? evalJs(entry.config, vars) as Record<string, unknown> : undefined,
    })
  }
  return out
}
