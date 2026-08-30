import { buildAppPath, type AppRoute } from '@biu/web-session-view'

const DATABASE = { moduleId: 'database', path: '/database' } as const

export function databaseViewPath(collection: string, viewId?: string): string {
  return buildAppPath({
    kind: 'collection-view',
    ...DATABASE,
    collection,
    viewId,
  })
}

export function databaseRecordPath(collection: string, recordId: string): string {
  return buildAppPath({
    kind: 'record',
    ...DATABASE,
    collection,
    recordId,
  } satisfies AppRoute)
}
