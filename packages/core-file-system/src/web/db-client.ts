import type { CollectionSchema, DbRecord } from '@biu/type-file-system'

export async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body
}

export type ListPage = {
  items: Array<DbRecord & { path?: string }>
  total: number
  schema?: CollectionSchema
}

const listInflight = new Map<string, Promise<ListPage>>()

export async function listCollection(opts: {
  path: string
  limit: number
  offset?: number
  query?: string
  sortField?: string
  sortDir?: string
  filters?: Record<string, string>
}): Promise<ListPage> {
  const params = new URLSearchParams({
    path: opts.path,
    limit: String(Math.max(1, opts.limit)),
    offset: String(Math.max(0, opts.offset ?? 0)),
    q: opts.query ?? '',
    sort: opts.sortField || 'id',
    dir: opts.sortDir === 'desc' ? 'desc' : 'asc',
    filter: JSON.stringify(opts.filters ?? {}),
  })
  const key = params.toString()
  const pending = listInflight.get(key)
  if (pending) return pending
  const request = readJson<ListPage & { items?: DbRecord[]; total?: number; schema?: CollectionSchema }>(
    `/api/db/list?${params}`,
  )
    .then((body) => {
      const items = Array.isArray(body.items) ? body.items : []
      return {
        items,
        total: typeof body.total === 'number' ? body.total : items.length,
        schema: body.schema,
      } satisfies ListPage
    })
    .finally(() => {
      listInflight.delete(key)
    })
  listInflight.set(key, request)
  return request
}
