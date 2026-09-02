/** 集合路径：补前导斜杠、去掉尾斜杠。host 与 web 共用。 */
export function normalizeCollectionPath(path: string) {
  const raw = String(path || '/').trim() || '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '') || '/'
}

export type DatabaseReveal = {
  collection: string
  recordId?: string
}

function resultPathOf(result: unknown): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ''
  const path = (result as { path?: unknown }).path
  return typeof path === 'string' ? path : ''
}

/** 工具路径：根目录不算；/<表> 切表，/<表>/<id> 切到该行。 */
export function databaseRevealFromPath(path: string): DatabaseReveal | null {
  const normalized = normalizeCollectionPath(path)
  if (normalized === '/') return null
  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length) return null
  const collection = `/${parts[0]}`
  const recordId = parts[1]
  return recordId ? { collection, recordId } : { collection }
}

/** 删除后记录没了只切表；创建/读取可跟结果 path。 */
export function databaseRevealForTool(opts: {
  path: string
  result?: unknown
  dropRecord?: boolean
}): DatabaseReveal | null {
  if (opts.dropRecord) {
    const fromPath = databaseRevealFromPath(opts.path)
    return fromPath ? { collection: fromPath.collection } : null
  }
  return databaseRevealFromPath(resultPathOf(opts.result) || opts.path)
}
