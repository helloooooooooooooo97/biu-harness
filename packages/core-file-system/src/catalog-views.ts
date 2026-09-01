import type { CollectionInfo } from '@biu/type-file-system'
import { normalizeCollectionPath } from './paths.ts'
import { normalizeSavedView, type SavedView } from './web/saved-view.ts'

const ALL_PREFIX = 'builtin-all:'

export type TableRef = {
  path: string
  label?: string
  view?: { title?: string } | null
}

export function builtinCatalogViewId(collectionPath: string) {
  return `builtin:${normalizeCollectionPath(collectionPath)}`
}

const TAG_PREFIX = 'builtin-tag:'

export function isBuiltinCatalogViewId(id: string) {
  return id.startsWith('builtin:') && !id.startsWith(ALL_PREFIX) && !id.startsWith(TAG_PREFIX)
}

export function builtinTagViewId(tagId: string) {
  return `${TAG_PREFIX}${String(tagId ?? '').trim()}`
}

export function isBuiltinTagViewId(id: string) {
  return id.startsWith(TAG_PREFIX)
}

export function tagIdFromViewId(id: string) {
  return isBuiltinTagViewId(id) ? id.slice(TAG_PREFIX.length) : ''
}

export function builtinAllViewId(collectionPath: string) {
  return `${ALL_PREFIX}${normalizeCollectionPath(collectionPath)}`
}

export function isBuiltinAllViewId(id: string) {
  return id.startsWith(ALL_PREFIX)
}

export function isReadOnlyViewId(id: string) {
  return isBuiltinAllViewId(id) || isBuiltinCatalogViewId(id) || isBuiltinTagViewId(id)
}

export function collectionNoun(table: TableRef) {
  const path = normalizeCollectionPath(table.path)
  return (table.view?.title ?? table.label ?? path.replace(/^\//, '')) || '记录'
}

export function builtinAllView(table: TableRef): SavedView {
  const path = normalizeCollectionPath(table.path)
  return normalizeSavedView({
    id: builtinAllViewId(path),
    name: `全部${collectionNoun({ ...table, path })}`,
    mode: 'table',
    sortField: 'title',
    sortDir: 'asc',
    filters: {},
    columns: [],
    groupBy: '',
    tree: true,
    wrap: false,
    truncate: true,
    query: '',
    builtin: true,
  })
}

export function stubBuiltinAllView(id: string): SavedView | null {
  if (!isBuiltinAllViewId(id)) return null
  const path = normalizeCollectionPath(id.slice(ALL_PREFIX.length))
  return builtinAllView({ path, label: path.replace(/^\//, '') })
}

export function builtinCatalogViews(tables: CollectionInfo[]): SavedView[] {
  return tables
    .filter((table) => table.path && table.path !== '/')
    .map((table) => {
      const path = normalizeCollectionPath(table.path)
      return normalizeSavedView({
        id: builtinCatalogViewId(path),
        name: table.view?.title ?? table.label ?? path.replace(/^\//, ''),
        mode: 'table',
        sortField: 'title',
        sortDir: 'asc',
        filters: { tablePath: path },
        columns: [],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
        builtin: true,
      })
    })
}

function userViews(user: SavedView[]): SavedView[] {
  return user.filter((view) => !view.builtin && !isReadOnlyViewId(view.id))
}

export function mergeCatalogViews(tables: CollectionInfo[], user: SavedView[]): SavedView[] {
  const viewsTable = tables.find((table) => normalizeCollectionPath(table.path) === '/views') ?? {
    path: '/views',
    label: '视图',
    view: { title: '视图' },
  }
  return [builtinAllView(viewsTable), ...builtinCatalogViews(tables), ...userViews(user)]
}

export function mergeTableViews(table: TableRef | undefined, user: SavedView[]): SavedView[] {
  const extra = userViews(user)
  if (!table?.path || table.path === '/') return extra
  return [builtinAllView(table), ...extra]
}

export type TagRef = { id: string; label: string }

export function builtinTagView(tag: TagRef): SavedView {
  const id = String(tag.id ?? '').trim()
  return normalizeSavedView({
    id: builtinTagViewId(id),
    name: tag.label || id,
    mode: 'table',
    sortField: 'title',
    sortDir: 'asc',
    filters: { tag: id },
    columns: ['title', 'table'],
    groupBy: '',
    tree: true,
    wrap: false,
    truncate: true,
    query: '',
    builtin: true,
  })
}

export function stubBuiltinTagView(id: string): SavedView | null {
  if (!isBuiltinTagViewId(id)) return null
  const tagId = tagIdFromViewId(id)
  if (!tagId) return null
  return builtinTagView({ id: tagId, label: tagId })
}

export function mergeTagViews(table: TableRef | undefined, tags: TagRef[], user: SavedView[]): SavedView[] {
  const extra = userViews(user)
  const all = table?.path ? builtinAllView(table) : null
  return [...(all ? [all] : []), ...tags.filter((tag) => tag.id).map(builtinTagView), ...extra]
}

/** 标签目录里的一行：打开该标签的收集表，而不是记录详情。 */
export function tagRowOpenTarget(row: { id?: unknown; tablePath?: unknown; sourceId?: unknown }) {
  if (String(row.tablePath ?? '').trim() && String(row.sourceId ?? '').trim()) return null
  const id = String(row.id ?? '').trim()
  if (!id || id.includes('::')) return null
  return { viewId: builtinTagViewId(id) }
}

/** 收集表里的一行：打开原始表里的那条记录。 */
export function stampRowOpenTarget(row: { tablePath?: unknown; sourceId?: unknown }) {
  const collection = normalizeCollectionPath(String(row.tablePath ?? ''))
  const recordId = String(row.sourceId ?? '').trim()
  if (!collection || collection === '/' || !recordId) return null
  return { collection, recordId }
}

/** 路由里已经是 builtin: 时，即使本地还没合并登记表，也能先还原筛选。 */
export function stubBuiltinCatalogView(id: string): SavedView | null {
  if (!isBuiltinCatalogViewId(id)) return null
  const path = normalizeCollectionPath(id.slice('builtin:'.length))
  return normalizeSavedView({
    id: builtinCatalogViewId(path),
    name: path.replace(/^\//, '') || 'views',
    mode: 'table',
    sortField: 'title',
    sortDir: 'asc',
    filters: { tablePath: path },
    columns: [],
    groupBy: '',
    tree: true,
    wrap: false,
    truncate: true,
    query: '',
    builtin: true,
  })
}

export function mergeViewsForPath(
  path: string,
  table: TableRef | undefined,
  tables: CollectionInfo[],
  user: SavedView[],
  tags: TagRef[] = [],
) {
  const normalized = normalizeCollectionPath(path)
  if (normalized === '/views') return mergeCatalogViews(tables, user)
  if (normalized === '/supertags') {
    return mergeTagViews(table ?? { path: '/supertags', label: '标签', view: { title: '标签' } }, tags, user)
  }
  return mergeTableViews(table, user)
}

/** /views 表里的一行：打开时应跳到该视图对应表，而不是看视图记录自己的属性。 */
export function catalogRowOpenTarget(row: { tablePath?: unknown; viewId?: unknown }) {
  const collection = normalizeCollectionPath(String(row.tablePath ?? ''))
  const viewId = String(row.viewId ?? '').trim()
  if (!collection || collection === '/' || !viewId) return null
  return { collection, viewId }
}
