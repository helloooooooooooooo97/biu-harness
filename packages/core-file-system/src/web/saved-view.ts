import { isViewModeId, type ViewMode } from './fields.ts'

export type SavedView = {
  id: string
  name: string
  mode: ViewMode
  sortField: string
  sortDir: 'asc' | 'desc'
  filters: Record<string, string>
  columns: string[]
  groupBy?: string
  tree?: boolean
  wrap?: boolean
  truncate?: boolean
  query?: string
  pageSize?: number
  /** 系统内置视图（全部 xx / 目录），不能改筛选、不能删改名。 */
  builtin?: boolean
}

export function normalizeSavedView(view: SavedView): SavedView {
  return {
    ...view,
    mode: isViewModeId(view.mode) ? view.mode : 'table',
    sortField: view.sortField || 'id',
    sortDir: view.sortDir === 'desc' ? 'desc' : 'asc',
    filters: view.filters && typeof view.filters === 'object' ? view.filters : {},
    columns: Array.isArray(view.columns) ? view.columns : [],
    groupBy: view.groupBy ?? '',
    tree: view.tree !== false,
    wrap: !!view.wrap,
    truncate: view.truncate !== false,
    query: view.query ?? '',
    pageSize: normalizePageSize(view.pageSize),
    builtin: Boolean(view.builtin),
  }
}

export const PAGE_SIZES = [20, 50, 100] as const

export function normalizePageSize(value: unknown) {
  const n = Number(value)
  if (PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number])) return n
  return 50
}

export function viewStateKey(
  view: Pick<SavedView, 'mode' | 'sortField' | 'sortDir' | 'filters' | 'columns' | 'groupBy' | 'tree' | 'wrap' | 'truncate' | 'query' | 'pageSize'>,
) {
  return JSON.stringify({
    mode: view.mode,
    sortField: view.sortField,
    sortDir: view.sortDir,
    filters: view.filters,
    columns: view.columns,
    groupBy: view.groupBy ?? '',
    tree: view.tree !== false,
    wrap: !!view.wrap,
    truncate: view.truncate !== false,
    query: view.query ?? '',
    pageSize: normalizePageSize(view.pageSize),
  })
}
