import type { CollectionInfo, CollectionSpec, DbRecord } from '@biu/type-file-system'
import { normalizeSchemaValue, recordBuiltinValues, REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { builtinAllView, isReadOnlyViewId } from '../catalog-views.ts'
import type { SavedView } from '../web/saved-view.ts'
import { isViewModeId } from '../web/fields.ts'
import { normalizeCollectionPath } from '../paths.ts'

export type StoredView = Partial<SavedView> & Pick<SavedView, 'id' | 'name'>

export class SavedViewsStore {
  private byPath = new Map<string, StoredView[]>()

  replace(collectionPath: string, views: StoredView[]) {
    const path = normalizeCollectionPath(collectionPath)
    this.byPath.set(
      path,
      views
        .filter((view) => !view.builtin && !isReadOnlyViewId(String(view.id)))
        .map((view) => ({ ...view, id: String(view.id), name: String(view.name || view.id) })),
    )
  }

  rows(tables: CollectionInfo[]): DbRecord[] {
    const labels = new Map(tables.map((item) => [normalizeCollectionPath(item.path), item.view?.title ?? item.label]))
    const out: DbRecord[] = []
    const seen = new Set<string>()
    const emit = (path: string, tableName: string, view: StoredView) => {
      const rec = asRecord(path, tableName, view)
      if (seen.has(rec.id)) return
      seen.add(rec.id)
      out.push(rec)
    }
    for (const table of tables) {
      const path = normalizeCollectionPath(table.path)
      if (!path || path === '/') continue
      const label = String(labels.get(path) ?? table.label ?? path)
      const all = builtinAllView({ path, label, view: table.view })
      emit(path, label, all)
      for (const view of this.byPath.get(path) ?? []) {
        if (view.builtin || isReadOnlyViewId(view.id)) continue
        emit(path, label, view)
      }
    }
    for (const [path, views] of this.byPath) {
      if (tables.some((table) => normalizeCollectionPath(table.path) === path)) continue
      for (const view of views) {
        if (view.builtin || isReadOnlyViewId(view.id)) continue
        emit(path, labels.get(path) ?? path, view)
      }
    }
    return out.sort((a, b) => String(a.table).localeCompare(String(b.table)) || String(a.title).localeCompare(String(b.title)))
  }

  create(fields: Record<string, unknown>, tables: CollectionInfo[]): DbRecord {
    const tablePath = tablePathOf(fields)
    if (!tablePath || tablePath === '/' || tablePath === '/views') throw new Error('tablePath required')
    if (!tables.some((item) => normalizeCollectionPath(item.path) === tablePath)) {
      throw new Error(`unknown collection: ${tablePath}`)
    }
    const table = tables.find((item) => normalizeCollectionPath(item.path) === tablePath)
    const label = table?.view?.title ?? table?.label ?? tablePath
    const id = String(fields.viewId ?? '').trim() || `${Date.now()}`
    if (isReadOnlyViewId(id)) throw new Error('builtin view is read-only')
    const views = this.byPath.get(tablePath) ?? []
    if (views.some((view) => view.id === id)) throw new Error(`view exists: ${id}`)
    const name = uniqueViewName(String(fields.title ?? fields.name ?? '新视图').trim() || '新视图', views)
    const view: StoredView = {
      id,
      name,
      mode: typeof fields.mode === 'string' && isViewModeId(fields.mode) ? fields.mode : 'table',
      sortField: typeof fields.sortField === 'string' && fields.sortField.trim() ? fields.sortField : 'id',
      sortDir: fields.sortDir === 'desc' ? 'desc' : 'asc',
      query: typeof fields.query === 'string' ? fields.query : '',
      groupBy: typeof fields.groupBy === 'string' ? fields.groupBy : '',
      columns: Array.isArray(fields.columns) ? fields.columns.map((item) => String(item)) : [],
      filters: asFilters(fields.filters),
      tree: fields.tree !== false,
      wrap: Boolean(fields.wrap),
      truncate: fields.truncate !== false,
      pageSize: Number(fields.pageSize) || 50,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.byPath.set(tablePath, [...views, view])
    return asRecord(tablePath, label, view)
  }

  remove(id: string): boolean {
    if (isReadOnlyViewId(viewIdOfRow(id))) throw new Error('builtin view is read-only')
    for (const [path, views] of this.byPath) {
      const next = views.filter((view) => rowId(path, view.id) !== id)
      if (next.length === views.length) continue
      this.byPath.set(path, next)
      return true
    }
    throw new Error(`unknown view: ${id}`)
  }

  write(id: string, patch: Record<string, unknown>): DbRecord {
    if (isReadOnlyViewId(viewIdOfRow(id))) throw new Error('builtin view is read-only')
    for (const [path, views] of this.byPath) {
      const idx = views.findIndex((view) => rowId(path, view.id) === id)
      if (idx < 0) continue
      const cur = views[idx]!
      if (cur.builtin || isReadOnlyViewId(cur.id)) throw new Error('builtin view is read-only')
      const next: StoredView = {
        ...cur,
        ...(typeof patch.title === 'string' ? { name: patch.title } : {}),
        ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
        ...(typeof patch.mode === 'string' && isViewModeId(patch.mode) ? { mode: patch.mode } : {}),
        ...(typeof patch.sortField === 'string' ? { sortField: patch.sortField } : {}),
        ...(patch.sortDir === 'asc' || patch.sortDir === 'desc' ? { sortDir: patch.sortDir } : {}),
        ...(typeof patch.query === 'string' ? { query: patch.query } : {}),
        ...(typeof patch.groupBy === 'string' ? { groupBy: patch.groupBy } : {}),
        ...('filters' in patch ? { filters: asFilters(patch.filters) } : {}),
        ...(Array.isArray(patch.columns) ? { columns: patch.columns.map((item) => String(item)) } : {}),
        ...(typeof patch.pageSize === 'number' ? { pageSize: patch.pageSize } : {}),
        ...(typeof patch.tree === 'boolean' ? { tree: patch.tree } : {}),
        ...(typeof patch.wrap === 'boolean' ? { wrap: patch.wrap } : {}),
        ...(typeof patch.truncate === 'boolean' ? { truncate: patch.truncate } : {}),
        ...('emoji' in patch ? { emoji: String(patch.emoji ?? '') } : {}),
        ...('schema' in patch ? { schema: normalizeSchemaValue(patch.schema) } : {}),
        updatedAt: Date.now(),
        createdAt: Number((cur as { createdAt?: number }).createdAt) || Date.now(),
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

function viewIdOfRow(id: string) {
  const cut = id.indexOf('::')
  return cut >= 0 ? id.slice(cut + 2) : id
}

function tablePathOf(fields: Record<string, unknown>) {
  const raw = fields.tablePath ?? (typeof fields.table === 'string' && String(fields.table).startsWith('/') ? fields.table : '')
  return normalizeCollectionPath(String(raw ?? ''))
}

function uniqueViewName(base: string, views: StoredView[]) {
  const names = new Set(views.map((view) => view.name))
  if (!names.has(base)) return base
  let n = 2
  while (names.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

function asFilters(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, string> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = String(item)
    return out
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return asFilters(JSON.parse(value))
    } catch {
      return {}
    }
  }
  return {}
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
    ...recordBuiltinValues(view as Record<string, unknown>),
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
      blurb: '各表已保存的视图。新建用 db_create，records 里写 tablePath 和 mode（table / board / cards / queue），检查器会切到该表该视图。',
      order: 17,
      icon: 'eye',
    },
    records: { update: true, create: true, delete: true },
    schema: {
      labelField: 'title',
      columns: ['title', 'table', 'mode', 'sortField', 'sortDir', 'query', 'groupBy', 'pageSize'],
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string', label: '视图', writable: true },
        table: { type: 'string', label: '来源表' },
        tablePath: { type: 'string', label: '表路径', writable: true },
        viewId: { type: 'string', label: '视图 ID' },
        mode: { type: 'select', label: '呈现', writable: true, enum: ['queue', 'table', 'cards', 'board'] },
        sortField: { type: 'string', label: '排序字段', writable: true },
        sortDir: { type: 'select', label: '升降序', writable: true, enum: ['asc', 'desc'] },
        query: { type: 'string', label: '搜索', writable: true },
        groupBy: { type: 'string', label: '分组', writable: true },
        tree: { type: 'boolean', label: '树形' },
        wrap: { type: 'boolean', label: '换行' },
        truncate: { type: 'boolean', label: '截断' },
        pageSize: { type: 'number', label: '每页', writable: true },
        columns: { type: 'multi-select', label: '列', writable: true },
        filters: { type: 'string', label: '筛选', writable: true },
      },
    },
    list,
    get: (id) => list().find((row) => row.id === id) ?? null,
    update: (id, patch) => store.write(id, patch),
    create: (rows) => rows.map((fields) => store.create(fields, tables())),
    remove: async (query) => {
      const ids = query.ids ?? []
      for (const id of ids) store.remove(id)
      return ids
    },
  }
}
