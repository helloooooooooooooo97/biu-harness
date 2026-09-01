import type { DbRecord } from '@biu/type-file-system'

export type GraphNode = {
  id: string
  title: string
  status: string
  x: number
  y: number
}

export type GraphEdge = {
  id: string
  source: string
  target: string
}

export function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return asIdList(parsed)
    } catch {
      /* plain */
    }
    return value
      .split(/[,，]/)
      .map((id) => id.trim())
      .filter(Boolean)
  }
  return []
}

/** 依赖边：source 先完成，target 才能开工。 */
export function layoutTaskGraph(rows: DbRecord[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const ids = new Set(rows.map((row) => row.id))
  const deps = new Map<string, string[]>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const list = asIdList(row.dependsOn).filter((id) => id !== row.id && ids.has(id))
    deps.set(row.id, list)
    for (const source of list) {
      const key = `${source}->${row.id}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ id: key, source, target: row.id })
    }
  }
  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (id: string): number => {
    const hit = layer.get(id)
    if (hit != null) return hit
    if (visiting.has(id)) return 0
    visiting.add(id)
    const next = 1 + Math.max(0, ...(deps.get(id) ?? []).map(depthOf))
    visiting.delete(id)
    layer.set(id, next)
    return next
  }
  for (const row of rows) depthOf(row.id)
  const buckets = new Map<number, GraphNode[]>()
  for (const row of rows) {
    const col = layer.get(row.id) ?? 1
    const list = buckets.get(col) ?? []
    list.push({
      id: row.id,
      title: String(row.title ?? row.id),
      status: String(row.status ?? ''),
      x: (col - 1) * 240,
      y: list.length * 88,
    })
    buckets.set(col, list)
  }
  return { nodes: [...buckets.values()].flat(), edges }
}
