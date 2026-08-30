import type { CollectionInfo, CollectionSpec, DbRecord } from '@biu/type-file-system'
import type { SavedView } from '../web/saved-view.ts'
import { normalizeCollectionPath } from '../paths.ts'

export type StoredView = Partial<SavedView> & Pick<SavedView, 'id' | 'name'>

export class SavedViewsStore {
  private byPath = new Map<string, StoredView[]>()

  replace(collectionPath: string, views: StoredView[]) {
    const path = normalizeCollectionPath(collectionPath)
    this.byPath.set(path, views.map((view) => ({ ...view, id: String(view.id), name: String(view.name || view.id) })))
  }

  rows(tables: CollectionInfo[]): DbRecord[] {
    const labels = new Map(tables.map((item) => [item.path, item.view?.title ?? item.label]))
    const out: DbRecord[] = []
    for (const [path, views] of this.byPath) {
      for (const view of views) {
        out.push(asRecord(path, labels.get(path) ?? path, view))
      }
    }
    return out.sort((a, b) => String(a.table).localeCompare(String(b.table)) || String(a.title).localeCompare(String(b.title)))
  }

  write(id: string, patch: Record<string, unknown>): DbRecord {
    for (const [path, views] of this.byPath) {
      const idx = views.findIndex((view) => rowId(path, view.id) === id)
      if (idx < 0) continue
      const cur = views[idx]!
      const next: StoredView = {
        ...cur,
        ...(typeof patch.title === 'string' ? { name: patch.title } : {}),
        ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
        ...(typeof patch.mode === 'string' &&
        (patch.mode === 'queue' || patch.mode === 'table' || patch.mode === 'cards' || patch.mode === 'board')
          ? { mode: patch.mode }
          : {}),
        ...(typeof patch.sortField === 'string' ? { sortField: patch.sortField } : {}),
        ...(patch.sortDir === 'asc' || patch.sortDir === 'desc' ? { sortDir: patch.sortDir } : {}),
        ...(typeof patch.query === 'string' ? { query: patch.query } : {}),
        ...(typeof patch.groupBy === 'string' ? { groupBy: patch.groupBy } : {}),
      }
      views[idx] = next
      return asRecord(path, path, next)
    }
    throw new Error(`unknown view: ${id}`)
  }
}

function rowId(path: string, viewId: string) {
  return `${path.replace(/^\//, '')}::${viewId}`
}

function asRecord(path: string, tableName: string, view: StoredView): DbRecord {
  const filters = view.filters && typeof view.filters === 'object' ? view.filters : {}
  return {
    id: rowId(path, view.id),
    title: view.name,
    table: tableName,
    tablePath: path,
    viewId: view.id,
    mode: view.mode ?? 'table',
    sortField: view.sortField ?? 'id',
    sortDir: view.sortDir === 'desc' ? 'desc' : 'asc',
    query: view.query ?? '',
    groupBy: view.groupBy ?? '',
    tree: view.tree !== false,
    wrap: Boolean(view.wrap),
    truncate: view.truncate !== false,
    pageSize: Number(view.pageSize) || 50,
    columns: Array.isArray(view.columns) ? view.columns.map(String) : [],
    filters: JSON.stringify(filters),
  }
}

export function viewsCollection(store: SavedViewsStore, tables: () => CollectionInfo[]): CollectionSpec {
  const list = () => store.rows(tables())
  return {
    id: 'views',
    path: '/views',
    label: '视图',
    view: {
      moduleId: 'views-db',
      route: '/db-views',
      title: '视图',
      inspector: true,
      blurb: '各表已保存的视图：来源表、排序、筛选、列与呈现方式。',
      order: 17,
      icon: 'eye',
    },
    records: { update: true, create: false, delete: false },
    schema: {
      labelField: 'title',
      columns: ['title', 'table', 'mode', 'sortField', 'sortDir', 'query', 'groupBy', 'pageSize'],
      fields: {
        title: { type: 'string', label: '视图', writable: true },
        table: { type: 'string', label: '来源表' },
        tablePath: { type: 'string', label: '表路径' },
        viewId: { type: 'string', label: '视图 ID' },
        mode: { type: 'select', label: '呈现', writable: true, enum: ['queue', 'table', 'cards', 'board'] },
        sortField: { type: 'string', label: '排序字段', writable: true },
        sortDir: { type: 'select', label: '升降序', writable: true, enum: ['asc', 'desc'] },
        query: { type: 'string', label: '搜索', writable: true },
        groupBy: { type: 'string', label: '分组', writable: true },
        tree: { type: 'boolean', label: '树形' },
        wrap: { type: 'boolean', label: '换行' },
        truncate: { type: 'boolean', label: '截断' },
        pageSize: { type: 'number', label: '每页' },
        columns: { type: 'multi-select', label: '列' },
        filters: { type: 'string', label: '筛选' },
      },
    },
    list,
    get: (id) => list().find((row) => row.id === id) ?? null,
    update: (id, patch) => store.write(id, patch),
  }
}
