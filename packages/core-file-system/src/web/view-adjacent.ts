export function neighborIndex(globalIndex: number, delta: -1 | 1, total: number) {
  const next = globalIndex + delta
  if (next < 0 || next >= total) return null
  return next
}

export function pageOfIndex(index: number, pageSize: number) {
  return Math.floor(Math.max(0, index) / Math.max(1, pageSize))
}

export function indexOnPage(id: string, items: Array<{ id: string }>, page: number, pageSize: number) {
  const local = items.findIndex((row) => row.id === id)
  if (local < 0) return null
  return page * pageSize + local
}

export type ViewNeighborQuery = {
  path: string
  query?: string
  sortField?: string
  sortDir?: string
  filters?: Record<string, string>
  columns?: string[]
}

export type ViewNeighborHit = {
  id: string
  page: number
  row?: { id: string }
}

export async function findViewNeighbor(opts: {
  currentId: string
  delta: -1 | 1
  items: Array<{ id: string }>
  page: number
  pageSize: number
  total: number
  query: ViewNeighborQuery
  list: (args: {
    path: string
    limit: number
    offset: number
    query?: string
    sortField?: string
    sortDir?: string
    filters?: Record<string, string>
    columns?: string[]
  }) => Promise<{ items: Array<{ id: string }>; total: number }>
}): Promise<ViewNeighborHit | null> {
  const pageSize = Math.max(1, opts.pageSize)
  let global = indexOnPage(opts.currentId, opts.items, opts.page, pageSize)
  let total = opts.total
  if (global == null) {
    const located = await locateInView(opts.currentId, pageSize, total, opts.query, opts.list)
    if (!located) return null
    global = located.index
    total = located.total
  }
  const next = neighborIndex(global, opts.delta, total)
  if (next == null) return null
  const nextPage = pageOfIndex(next, pageSize)
  if (nextPage === opts.page) {
    const row = opts.items[next - opts.page * pageSize]
    return row ? { id: row.id, page: nextPage, row } : null
  }
  const listed = await opts.list({
    path: opts.query.path,
    limit: pageSize,
    offset: nextPage * pageSize,
    query: opts.query.query,
    sortField: opts.query.sortField,
    sortDir: opts.query.sortDir,
    filters: opts.query.filters,
    columns: opts.query.columns,
  })
  const row = listed.items[next - nextPage * pageSize]
  return row ? { id: row.id, page: nextPage, row } : null
}

async function locateInView(
  id: string,
  pageSize: number,
  knownTotal: number,
  query: ViewNeighborQuery,
  list: Parameters<typeof findViewNeighbor>[0]['list'],
) {
  let total = Math.max(0, knownTotal)
  const cap = total > 0 ? total : pageSize
  for (let offset = 0; offset < cap; offset += pageSize) {
    const listed = await list({
      path: query.path,
      limit: pageSize,
      offset,
      query: query.query,
      sortField: query.sortField,
      sortDir: query.sortDir,
      filters: query.filters,
      columns: query.columns,
    })
    if (listed.total > total) total = listed.total
    const local = listed.items.findIndex((row) => row.id === id)
    if (local >= 0) return { index: offset + local, total: listed.total }
    if (listed.items.length === 0) break
  }
  return null
}
