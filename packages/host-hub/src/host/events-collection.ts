import type { CollectionSpec, DbRecord } from '@biu/type-file-system'

export type HubEventRow = {
  id: string
  ts: number
  mode: string
  name: string
  args: unknown[]
}

type HubLike = {
  listEvents: () => HubEventRow[]
}

function stringifyArgs(args: unknown[]) {
  try {
    return JSON.stringify(args)
  } catch {
    return '[unserializable]'
  }
}

export function eventsCollection(hub: HubLike): CollectionSpec {
  const asRecord = (row: HubEventRow): DbRecord => ({
    id: row.id,
    title: row.name,
    ts: row.ts,
    mode: row.mode,
    name: row.name,
    args: stringifyArgs(row.args),
  })
  const list = () => hub.listEvents().map(asRecord)
  return {
    id: 'events',
    path: '/events',
    label: 'Event',
    view: {
      moduleId: 'events-db',
      route: '/db-events',
      title: 'Event',
      blurb: 'Hub 已缓冲的 internal/dispatch 事件（最多约 80 条），只读。',
      order: 19,
      icon: 'bolt',
    },
    schema: {
      labelField: 'title',
      columns: ['title', 'mode', 'ts', 'args'],
      fields: {
        title: { type: 'string', label: '事件' },
        mode: { type: 'string', label: '模式' },
        name: { type: 'string', label: '名称' },
        ts: { type: 'datetime', label: '时间', sortable: true },
        args: { type: 'string', label: '参数' },
      },
    },
    list,
    get: (id) => list().find((row) => row.id === id) ?? null,
  }
}
