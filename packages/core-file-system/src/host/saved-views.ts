import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import type { CollectionInfo, CollectionSpec, DbRecord } from '@biu/type-file-system'
import { normalizeSchemaValue, recordBuiltinValues, REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { builtinAllView, isReadOnlyViewId } from '../catalog-views.ts'
import type { SavedView } from '../web/saved-view.ts'
import { isViewModeId } from '../web/fields.ts'
import { normalizeCollectionPath } from '../paths.ts'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export type StoredView = Partial<SavedView> & Pick<SavedView, 'id' | 'name'>

type ViewRow = { collection: string; payload_json: string }

export class SavedViewsStore {
  private byPath = new Map<string, StoredView[]>()
  private db: DatabaseSync | null = null

  open(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_views (
        collection TEXT NOT NULL,
        view_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (collection, view_id)
      );
    `)
    this.hydrate()
    return this
  }

  private hydrate() {
    if (!this.db) return
    this.byPath.clear()
    const rows = this.db.prepare('SELECT collection, payload_json FROM saved_views').all() as ViewRow[]
    for (const row of rows) {
      const collection = normalizeCollectionPath(row.collection)
      if (!collection || collection === '/' || collection === '/views') continue
      let parsed: StoredView | null = null
      try {
        parsed = JSON.parse(row.payload_json) as StoredView
      } catch {
        continue
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      const id = String(parsed.id ?? '').trim()
      const name = String(parsed.name ?? id).trim()
      if (!id || isReadOnlyViewId(id) || parsed.builtin) continue
      const list = this.byPath.get(collection) ?? []
      list.push({ ...parsed, id, name })
      this.byPath.set(collection, list)
    }
  }

  private persistPath(collectionPath: string) {
    if (!this.db) return
    const path = normalizeCollectionPath(collectionPath)
    const views = this.byPath.get(path) ?? []
    const upsert = this.db.prepare(
      `INSERT INTO saved_views (collection, view_id, payload_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(collection, view_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    )
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('DELETE FROM saved_views WHERE collection = ?').run(path)
      for (const view of views) {
        if (view.builtin || isReadOnlyViewId(String(view.id))) continue
        upsert.run(path, String(view.id), JSON.stringify(view), Date.now())
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  replace(collectionPath: string, views: StoredView[]) {
    const path = normalizeCollectionPath(collectionPath)
    this.byPath.set(
      path,
      views
        .filter((view) => !view.builtin && !isReadOnlyViewId(String(view.id)))
        .map((view) => ({ ...view, id: String(view.id), name: String(view.name || view.id) })),
    )
    this.persistPath(path)
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
    this.persistPath(tablePath)
    return asRecord(tablePath, label, view)
  }

  remove(id: string): boolean {
    if (isReadOnlyViewId(viewIdOfRow(id))) throw new Error('builtin view is read-only')
    for (const [path, views] of this.byPath) {
      const next = views.filter((view) => rowId(path, view.id) !== id)
      if (next.length === views.length) continue
      this.byPath.set(path, next)
      this.persistPath(path)
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
        ...('facet' in patch ? { facet: normalizeSchemaValue(patch.facet) } : {}),
        updatedAt: Date.now(),
        createdAt: Number((cur as { createdAt?: number }).createdAt) || Date.now(),
      }
      views[idx] = next
      this.persistPath(path)
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
      blurb: '各表已保存的视图（筛选/排序/呈现），不是旧的 /api/task-views。列视图 db_list /views。新建 db_create /views records=[{title, tablePath, mode}]，tablePath 如 /tasks，mode 为 table / board / cards / queue（自定义呈现 id 也可以）。改筛选 filters（JSON 字符串）、列 columns、排序 sortField/sortDir、搜索 query、分组 groupBy、每页 pageSize 用 db_update。内置「全部 xx」只读。打开某表某视图：检查器按 tablePath + viewId 跳，不要自己拼过时 URL。',
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
