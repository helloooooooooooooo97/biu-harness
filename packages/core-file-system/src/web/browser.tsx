import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowsPointingOutIcon,
  ArrowsUpDownIcon,
  AdjustmentsHorizontalIcon,
  Bars3BottomLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  FunnelIcon,
  HashtagIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  RectangleStackIcon,
  Square2StackIcon,
  Squares2X2Icon,
  StarIcon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon,
} from '@heroicons/react/16/solid'
import type { CollectionActionInfo, CollectionInfo, CollectionSchema, DbRecord, FieldSpec } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import {
  contentFieldKey,
  defaultColumnKeys,
  pinLabelColumn,
  fieldEntries,
  flattenTree,
  formatField,
  groupField,
  groupRecords,
  groupableFields,
  parentFieldKey,
  resolveFieldType,
  uniqueValues,
  type ViewMode,
} from './fields.ts'
import { AppDialog, CellSelect, CheckRow, LocalText } from './controls.tsx'
import { DataSidebar } from './data-sidebar.tsx'
import { buildCrumbs, type CrumbTarget } from './sidebar-nav.ts'
import { CrumbTrail } from './crumb-trail.tsx'
import { pickDomAttrs, recordPickKind } from './pick-dom.ts'
import { recordPreviewEmoji, crumbRecordLabel } from './sidebar-preview.ts'
import { normalizeSavedView, normalizePageSize, PAGE_SIZES, viewStateKey, type SavedView } from './saved-view.ts'
import {
  actionIcon,
  BoolCell,
  DefaultCell,
  draftFromRecord,
  FieldEditor,
  FieldGlyph,
  FilePreview,
  ModeGlyph,
  parseFieldValue,
  VIEW_MODES,
  visibleActions,
  boolOn,
} from './fsdb-cells.tsx'
import { ensureFsdbStyle } from './fsdb-style.ts'
import { RecordDetail } from './record-detail.tsx'
import {
  activeViewStorageKey,
  getStarredViews,
  getStarredViewsVersion,
  isViewStarred,
  loadActiveViewId,
  loadViews,
  rememberRecords,
  rememberViews,
  persistStarredViews,
  pushSavedViews,
  subscribeStarredViews,
  toggleStarredView,
  viewForPath,
  viewsKey,
} from './view-storage.ts'
import { listCollection, readJson } from './db-client.ts'
import { rememberPreviewTotal, viewTotalKey } from './sidebar-preview.ts'
import { mergeCatalogViews, mergeTableViews, stubBuiltinCatalogView, builtinCatalogViewId } from '../catalog-views.ts'
import { VIEWS_COLLECTION_PATH } from './database-path.ts'

type StatResult = { schema?: CollectionSchema }

function isListColumn(key: string) {
  return key !== 'description' && key !== 'notes' && key !== 'content' && key !== 'emoji'
}

function recordsFingerprint(rows: Array<DbRecord & { path?: string }>) {
  return JSON.stringify(rows)
}

export function CollectionBrowser({
  moduleId,
  collectionPath,
  recordsPath,
  title,
  blurb,
  chrome,
  tables = [],
  onOpenTable,
  lockedFilters = {},
  routeRecordId = null,
  routeViewId,
  expandedViewKey,
  onExpandedViewKeyChange,
  onOpenView,
  onOpenRecord,
  onCloseRecord,
  onCrumbTarget,
  embed = false,
}: {
  moduleId?: string
  collectionPath: string
  /** 列表数据源；表级 hub 时为 /views，侧栏仍跟 collectionPath。 */
  recordsPath?: string
  title: string
  blurb: string
  chrome?: CollectionChrome
  tables?: CollectionInfo[]
  onOpenTable?: (path: string, viewId?: string, opts?: { catalog?: boolean }) => void
  lockedFilters?: Record<string, string>
  routeRecordId?: string | null
  routeViewId?: string
  expandedViewKey?: string | null
  onExpandedViewKeyChange?: (key: string | null) => void
  onOpenView?: (viewId: string) => void
  onOpenRecord?: (recordId: string, viewId?: string | null, collection?: string) => void
  onCloseRecord?: () => void
  onCrumbTarget?: (target: CrumbTarget) => void
  /** 检查器内页：只有中间舞台，不写侧栏开关/视图存储。 */
  embed?: boolean
}) {
  ensureFsdbStyle()
  const dataPath = recordsPath ?? collectionPath
  const tableHub = dataPath === VIEWS_COLLECTION_PATH && collectionPath !== VIEWS_COLLECTION_PATH
  const hubView = tableHub ? stubBuiltinCatalogView(builtinCatalogViewId(collectionPath)) : null
  const [stat, setStat] = useState<StatResult | null>(null)
  const [items, setItems] = useState<Array<DbRecord & { path?: string }>>([])
  const [error, setError] = useState('')
  const [openDetailId, setOpenDetailId] = useState<string | null>(routeRecordId)
  const [detailRow, setDetailRow] = useState<DbRecord | null>(null)
  const [detailBody, setDetailBody] = useState<unknown>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const initialView = hubView ?? viewForPath(collectionPath, routeViewId)
  const [query, setQuery] = useState(initialView?.query ?? '')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(() => normalizePageSize(initialView?.pageSize))
  const [total, setTotal] = useState(0)
  const [fetchQuery, setFetchQuery] = useState(initialView?.query ?? '')
  const [mode, setMode] = useState<ViewMode>(initialView?.mode ?? 'table')
  const [sortField, setSortField] = useState(initialView?.sortField ?? 'id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialView?.sortDir ?? 'asc')
  const [filters, setFilters] = useState<Record<string, string>>(initialView?.filters ?? {})
  const [columnKeys, setColumnKeys] = useState<string[]>(initialView?.columns ?? [])
  const tablePathsKey = tables.map((table) => `${table.path}\t${table.view?.title ?? table.label ?? ''}`).join('\n')
  const [views, setViews] = useState<SavedView[]>(() => loadViews(collectionPath))
  const [activeViewId, setActiveViewId] = useState<string | null>(tableHub ? null : (initialView?.id ?? null))
  const catalogLocks = useMemo(() => {
    const current = views.find((view) => view.id === activeViewId)
    if (!current?.builtin) return lockedFilters
    return { ...current.filters, ...lockedFilters }
  }, [activeViewId, lockedFilters, views])
  const queryFilters = useMemo(() => ({ ...filters, ...catalogLocks }), [catalogLocks, filters])
  const lockedFilterKeys = Object.keys(catalogLocks)
  const lockedSource = catalogLocks.tablePath ?? ''
  useEffect(() => {
    if (!lockedSource) return
    setMode('table')
  }, [lockedSource])
  const detailId = openDetailId
  const setDetailId = (id: string | null, row?: DbRecord | null) => {
    flushSync(() => {
      setOpenDetailId(id)
      if (id && row) setDetailRow(row)
      if (!id) setDetailRow(null)
    })
    if (id) onOpenRecord?.(id, activeViewId, dataPath)
    else onCloseRecord?.()
  }
  const [hydrated, setHydrated] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(() => {
    try {
      return localStorage.getItem('cordis.sidebar.collapsed') !== '1'
    } catch {
      return true
    }
  })
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return localStorage.getItem('cordis.inspector.open') === '1'
    } catch {
      return false
    }
  })
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)
  const [wrapCells, setWrapCells] = useState(!!initialView?.wrap)
  const [truncateCells, setTruncateCells] = useState(initialView?.truncate !== false)
  const [groupBy, setGroupBy] = useState(initialView?.groupBy ?? '')
  const [showTree, setShowTree] = useState(initialView?.tree !== false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number>(0)
  const quietUntil = useRef(0)
  const reloadGen = useRef(0)
  const hydratePath = useRef('')
  const viewsRef = useRef<SavedView[]>([])
  const hydratedDetail = useRef('')
  const [dlg, setDlg] = useState<
    | { kind: 'rename'; view: SavedView }
    | { kind: 'delete'; view: SavedView }
    | { kind: 'action'; row: DbRecord; action: CollectionActionInfo }
    | { kind: 'delete-record'; row: DbRecord }
    | null
  >(null)
  const [dlgError, setDlgError] = useState('')
  const [crumbOpen, setCrumbOpen] = useState<string | null>(null)
  const crumbRef = useRef<HTMLElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const configRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const pageSizeRef = useRef<HTMLDivElement>(null)
  const pageSizeMenuRef = useRef<HTMLDivElement>(null)
  const [pageSizeMenuPos, setPageSizeMenuPos] = useState<{ right: number; bottom: number } | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchExpanded = searchOpen || query.length > 0

  function toggleViewsOpen() {
    if (typeof document !== 'undefined' && document.getElementById('shell-module-sidebar')) {
      window.dispatchEvent(new Event('biu:toggle-shell-sidebar'))
      return
    }
    setViewsOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(`fsdb.viewsOpen:${moduleId || collectionPath}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    if (embed) return
    function onWidth(event: Event) {
      const n = (event as CustomEvent<number>).detail
      if (typeof n !== 'number' || !Number.isFinite(n)) return
      setViewsOpen(n > 0)
    }
    window.addEventListener('biu:shell-sidebar-width', onWidth)
    const aside = document.getElementById('shell-module-sidebar')?.closest('[data-testid="module-sidebar"]')
    if (aside instanceof HTMLElement) {
      setViewsOpen(!aside.classList.contains('hidden') && aside.getAttribute('aria-hidden') !== 'true')
    }
    return () => window.removeEventListener('biu:shell-sidebar-width', onWidth)
  }, [embed])

  useEffect(() => {
    if (embed) return
    function onToggle(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id
      if (!id || (moduleId && id !== moduleId)) return
      toggleViewsOpen()
    }
    window.addEventListener('biu:toggle-module-sidebar', onToggle)
    return () => window.removeEventListener('biu:toggle-module-sidebar', onToggle)
  }, [collectionPath, embed, moduleId])

  useEffect(() => {
    if (embed) return
    const sync = (open: boolean) => setInspectorOpen(open)
    const onOpen = () => sync(true)
    const onClose = () => sync(false)
    const onToggle = () => setInspectorOpen((prev) => !prev)
    window.addEventListener('biu:inspector-open', onOpen)
    window.addEventListener('biu:inspector-close', onClose)
    window.addEventListener('biu:inspector-toggle', onToggle)
    return () => {
      window.removeEventListener('biu:inspector-open', onOpen)
      window.removeEventListener('biu:inspector-close', onClose)
      window.removeEventListener('biu:inspector-toggle', onToggle)
    }
  }, [embed])

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!searchRef.current?.contains(target) && !query) setSearchOpen(false)
      if (
        crumbRef.current?.contains(target) ||
        (target instanceof Element && target.closest('[data-fsdb-crumb-menu]')) ||
        viewRef.current?.contains(target) ||
        modeRef.current?.contains(target) ||
        sortRef.current?.contains(target) ||
        columnRef.current?.contains(target) ||
        filterRef.current?.contains(target) ||
        configRef.current?.contains(target) ||
        groupRef.current?.contains(target) ||
        pageSizeRef.current?.contains(target) ||
        pageSizeMenuRef.current?.contains(target)
      ) {
        return
      }
      setCrumbOpen(null)
      setViewMenuOpen(false)
      setModeMenuOpen(false)
      setSortMenuOpen(false)
      setColumnMenuOpen(false)
      setFilterOpen(false)
      setConfigOpen(false)
      setGroupOpen(false)
      setPageSizeOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [query])

  useLayoutEffect(() => {
    if (!pageSizeOpen) {
      setPageSizeMenuPos(null)
      return
    }
    const box = pageSizeRef.current?.getBoundingClientRect()
    if (!box) return
    setPageSizeMenuPos({
      right: Math.max(8, window.innerWidth - box.right),
      bottom: Math.max(8, window.innerHeight - box.top + 6),
    })
  }, [pageSizeOpen])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function toggleMenu(which: 'view' | 'mode' | 'sort' | 'columns' | 'filter' | 'config' | 'group' | 'pageSize') {
    setViewMenuOpen(which === 'view' && !viewMenuOpen)
    setModeMenuOpen(which === 'mode' && !modeMenuOpen)
    setSortMenuOpen(which === 'sort' && !sortMenuOpen)
    setColumnMenuOpen(which === 'columns' && !columnMenuOpen)
    setFilterOpen(which === 'filter' && !filterOpen)
    setConfigOpen(which === 'config' && !configOpen)
    setGroupOpen(which === 'group' && !groupOpen)
    setPageSizeOpen(which === 'pageSize' && !pageSizeOpen)
  }

  const reload = useCallback(async () => {
    if (Date.now() < quietUntil.current) return true
    const gen = ++reloadGen.current
    try {
      const [nextStat, listed] = await Promise.all([
        readJson<StatResult>(`/api/db/stat?path=${encodeURIComponent(dataPath)}`),
        listCollection({
          path: dataPath,
          limit: pageSize,
          offset: page * pageSize,
          query: fetchQuery,
          sortField,
          sortDir,
          filters: queryFilters,
        }),
      ])
      if (gen !== reloadGen.current) return true
      setStat((prev) => (prev?.schema && JSON.stringify(prev.schema) === JSON.stringify(nextStat.schema) ? prev : nextStat))
      setItems((prev) => (recordsFingerprint(prev) === recordsFingerprint(listed.items) ? prev : listed.items))
      setTotal(listed.total)
      if (activeViewId) {
        rememberPreviewTotal(
          viewTotalKey(collectionPath, {
            id: activeViewId,
            sortField,
            sortDir,
            filters: queryFilters,
            query: fetchQuery,
          }),
          listed.total,
        )
      }
      setError('')
      return true
    } catch (err) {
      if (gen !== reloadGen.current) return false
      setError(String(err))
      return false
    }
  }, [activeViewId, collectionPath, dataPath, fetchQuery, queryFilters, page, pageSize, sortDir, sortField])
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const detailIdRef = useRef<string | null>(null)
  detailIdRef.current = detailId

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFetchQuery((prev) => (prev === query ? prev : query))
    }, 280)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    setPage((prev) => (prev === 0 ? prev : 0))
  }, [fetchQuery, queryFilters, sortField, sortDir, pageSize, collectionPath, dataPath])

  async function refreshNow() {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    const ok = await reload()
    const wait = Math.max(0, 480 - (Date.now() - started))
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait))
    setRefreshing(false)
    if (!ok) return
    setNotice('刷新成功')
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 1800)
  }

  useLayoutEffect(() => {
    setHydrated(false)
    hydratePath.current = ''
    setCollapsed({})
    hydratedDetail.current = ''
    setItems([])
    setStat(null)
    setError('')
    setPage(0)
    const stored = tableHub ? hubView : viewForPath(collectionPath, routeViewId)
    const user = loadViews(collectionPath)
    const listed =
      collectionPath === VIEWS_COLLECTION_PATH
        ? mergeCatalogViews(tables, user)
        : mergeTableViews(
            tables.find((table) => table.path === collectionPath) ?? { path: collectionPath, label: title },
            user,
          )
    rememberViews(collectionPath, listed)
    if (tableHub && hubView) {
      setViews(listed)
      setActiveViewId(null)
      setMode(hubView.mode)
      setSortField(hubView.sortField)
      setSortDir(hubView.sortDir)
      setFilters(hubView.filters)
      setColumnKeys(hubView.columns)
      setGroupBy(hubView.groupBy ?? '')
      setShowTree(hubView.tree !== false)
      setWrapCells(!!hubView.wrap)
      setTruncateCells(hubView.truncate !== false)
      setQuery(hubView.query ?? '')
      setFetchQuery(hubView.query ?? '')
    } else if (stored || listed[0]) {
      const next = (routeViewId && listed.find((item) => item.id === routeViewId)) || stored || listed[0]
      setViews(listed)
      if (next) {
        setActiveViewId(next.id)
        setMode(next.mode)
        setSortField(next.sortField)
        setSortDir(next.sortDir)
        setFilters(next.filters)
        setColumnKeys(next.columns)
        setGroupBy(next.groupBy ?? '')
        setShowTree(next.tree !== false)
        setWrapCells(!!next.wrap)
        setTruncateCells(next.truncate !== false)
        setQuery(next.query ?? '')
      }
    } else {
      setViews([])
      setActiveViewId(null)
      setQuery('')
      setFilters({})
    }
  }, [collectionPath, dataPath, tablePathsKey, tableHub])

  useEffect(() => {
    let debounce = 0
    const onChange = () => {
      if (detailIdRef.current) return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void reloadRef.current(), 120)
    }
    window.addEventListener('fsdb:change', onChange)
    const timer = embed
      ? 0
      : window.setInterval(() => {
          if (detailIdRef.current) return
          void reloadRef.current()
        }, 20000)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(timer)
      window.removeEventListener('fsdb:change', onChange)
    }
  }, [collectionPath, dataPath, embed])

  useEffect(() => {
    void reload()
  }, [reload])

  useLayoutEffect(() => {
    setOpenDetailId(routeRecordId)
    if (!routeRecordId) setDetailRow(null)
  }, [routeRecordId])

  useEffect(() => {
    if (!detailId) {
      setDetailRow(null)
      return
    }
    const hit = items.find((row) => row.id === detailId)
    if (hit) {
      setDetailRow(hit)
      return
    }
    if (detailRow?.id === detailId) return
    let cancelled = false
    void readJson<{ value?: DbRecord }>(`/api/db/read?path=${encodeURIComponent(`${dataPath}/${detailId}`)}`)
      .then((data) => {
        const row = data.value
        if (cancelled || !row?.id) return
        setDetailRow(row)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [collectionPath, dataPath, detailId, detailRow?.id, items])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const schema = stat?.schema
  const canCreate = Boolean(schema?.records?.create)
  const canDelete = Boolean(schema?.records?.delete)
  const bodyKey = contentFieldKey(schema)
  const entries = useMemo(() => fieldEntries(schema), [schema])
  const allColumns = useMemo(
    () => entries.filter((item) => isListColumn(item.key) && item.key !== bodyKey && resolveFieldType(item.field) !== 'file'),
    [bodyKey, entries],
  )
  const allColumnKeys = useMemo(() => allColumns.map((item) => item.key), [allColumns])
  const schemaDefaultKeys = useMemo(() => defaultColumnKeys(schema, allColumnKeys), [schema, allColumnKeys])
  const columns = useMemo(() => {
    const selected = allColumns.filter((item) => columnKeys.includes(item.key))
    const base = selected.length ? selected : allColumns.filter((item) => schemaDefaultKeys.includes(item.key))
    const order = pinLabelColumn(
      schema,
      base.map((item) => item.key),
    )
    return order.map((key) => base.find((item) => item.key === key) ?? allColumns.find((item) => item.key === key)).filter(Boolean) as typeof allColumns
  }, [allColumns, columnKeys, schema, schemaDefaultKeys])
  const propColumns = useMemo(
    () => columns.filter((item) => item.key !== schema?.labelField),
    [columns, schema?.labelField],
  )
  const groupFields = useMemo(() => groupableFields(schema), [schema])
  const activeGroup = groupField(schema, groupBy)
  const grouping = Boolean(activeGroup)
  const columnCustom =
    columnKeys.length > 0 &&
    (columnKeys.length !== schemaDefaultKeys.length || columnKeys.some((key, index) => key !== schemaDefaultKeys[index]))
  const filterFields = useMemo(
    () =>
      entries.filter(
        (item) =>
          item.key !== bodyKey &&
          resolveFieldType(item.field) !== 'file' &&
          !lockedFilterKeys.includes(item.key),
      ),
    [bodyKey, entries, lockedFilterKeys],
  )
  const sortFields = useMemo(
    () => filterFields.filter((item) => item.field.sortable !== false),
    [filterFields],
  )

  useEffect(() => {
    if (!schemaDefaultKeys.length) return
    setColumnKeys((prev) => {
      if (!prev.length) return schemaDefaultKeys
      const allowed = new Set(allColumnKeys)
      const kept = pinLabelColumn(schema, prev.filter((key) => allowed.has(key)))
      if (!kept.length) return schemaDefaultKeys
      if (kept.length === prev.length && kept.every((key, index) => key === prev[index])) return prev
      return kept
    })
  }, [allColumnKeys, schema, schemaDefaultKeys])

  useEffect(() => {
    if (!schema || sortFields.some((item) => item.key === sortField)) return
    const fallback = sortFields.find((item) => item.kind === 'datetime') ?? sortFields[0]
    if (fallback) {
      setSortField(fallback.key)
      setSortDir(fallback.kind === 'datetime' ? 'desc' : 'asc')
    }
  }, [schema, sortField, sortFields])

  const visible = items

  const grouped = useMemo(() => {
    const buckets = groupRecords(visible, schema, groupBy)
    if (!grouping || mode === 'board') return buckets
    return buckets.filter((item) => item.rows.length)
  }, [groupBy, grouping, mode, schema, visible])
  const parentKey = useMemo(() => parentFieldKey(schema, items), [items, schema])
  const flattenRows = useCallback(
    (rows: DbRecord[]) => {
      if (!parentKey || !showTree) return rows.map((row) => ({ row, depth: 0, hasKids: false, kidCount: 0 }))
      return flattenTree(rows, parentKey, collapsed)
    },
    [collapsed, parentKey, showTree],
  )

  const selected =
    (detailId &&
      (items.find((item) => item.id === detailId) ?? (detailRow?.id === detailId ? detailRow : null))) ||
    null
  useEffect(() => {
    const rows = items.map((row) => ({
      id: row.id,
      label: crumbRecordLabel(row, schema?.labelField),
      emoji: recordPreviewEmoji(row),
    }))
    if (selected && !rows.some((row) => row.id === selected.id)) {
      rows.push({
        id: selected.id,
        label: crumbRecordLabel(selected, schema?.labelField),
        emoji: recordPreviewEmoji(selected),
      })
    }
    rememberRecords(collectionPath, rows)
    window.dispatchEvent(new Event('fsdb:crumb-labels'))
  }, [collectionPath, items, schema?.labelField, selected])
  const filterActive = Object.values(filters).some(Boolean)
  const activeView = views.find((view) => view.id === activeViewId)
  useSyncExternalStore(subscribeStarredViews, getStarredViewsVersion, () => 0)
  const viewStarred = Boolean(activeViewId && isViewStarred(getStarredViews(), collectionPath, activeViewId))

  useEffect(() => {
    hydratedDetail.current = ''
    if (!detailId || !schema) {
      setDraft({})
      return
    }
  }, [detailId, schema])

  useEffect(() => {
    if (!detailId || !schema) return
    const row = items.find((item) => item.id === detailId)
    if (!row || hydratedDetail.current === detailId) return
    setDraft(draftFromRecord(schema, row, bodyKey, detailBody))
    hydratedDetail.current = detailId
  }, [bodyKey, detailBody, detailId, items, schema])

  useEffect(() => {
    if (!bodyKey || !detailId || !schema) return
    const formatted = draftFromRecord(schema, { id: detailId }, bodyKey, detailBody)[bodyKey] ?? ''
    setDraft((prev) => (prev[bodyKey] === formatted ? prev : { ...prev, [bodyKey]: formatted }))
  }, [bodyKey, detailBody, detailId, schema])

  useEffect(() => {
    if (!detailId) {
      setDetailBody(null)
      return
    }
    let cancelled = false
    void readJson<{ value?: unknown }>(`/api/db/content?path=${encodeURIComponent(`${dataPath}/${detailId}`)}`)
      .then((data) => {
        if (!cancelled) setDetailBody(data.value ?? null)
      })
      .catch(() => {
        if (!cancelled) setDetailBody(null)
      })
    return () => {
      cancelled = true
    }
  }, [collectionPath, dataPath, detailId])

  useEffect(() => {
    if (embed || !detailId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, embed])

  useEffect(() => {
    if (dlg?.kind !== 'rename') return
    setDlgError('')
  }, [dlg])

  function persistViews(next: SavedView[]) {
    const listed =
      collectionPath === VIEWS_COLLECTION_PATH
        ? mergeCatalogViews(tables, next)
        : mergeTableViews(
            tables.find((table) => table.path === collectionPath) ?? { path: collectionPath, label: title },
            next,
          )
    const stored = listed.filter((view) => !view.builtin)
    viewsRef.current = listed
    setViews(listed)
    rememberViews(collectionPath, listed)
    if (!embed) {
      localStorage.setItem(viewsKey(collectionPath), JSON.stringify(stored))
      pushSavedViews(collectionPath, stored)
    }
    window.dispatchEvent(new Event('fsdb:change'))
    window.dispatchEvent(new Event('fsdb:crumb-labels'))
  }

  function rememberActiveView(id: string) {
    setActiveViewId(id)
    if (embed) return
    try {
      localStorage.setItem(activeViewStorageKey(collectionPath), id)
    } catch {
      /* ignore */
    }
  }

  function applyView(view: SavedView) {
    const next = normalizeSavedView(view)
    const nextColumns = pinLabelColumn(
      schema,
      next.columns.length ? next.columns.filter((key) => allColumnKeys.includes(key)) : schemaDefaultKeys,
    )
    const nextQuery = next.query ?? ''
    const nextPageSize = normalizePageSize(next.pageSize)
    const nextGroup = next.groupBy ?? ''
    if (
      next.id === activeViewId &&
      mode === next.mode &&
      sortField === next.sortField &&
      sortDir === next.sortDir &&
      groupBy === nextGroup &&
      showTree === (next.tree !== false) &&
      wrapCells === !!next.wrap &&
      truncateCells === (next.truncate !== false) &&
      query === nextQuery &&
      pageSize === nextPageSize &&
      JSON.stringify(filters) === JSON.stringify(next.filters) &&
      JSON.stringify(columnKeys) === JSON.stringify(nextColumns)
    ) {
      return
    }
    rememberActiveView(next.id)
    setMode(next.mode)
    setSortField(next.sortField)
    setSortDir(next.sortDir)
    setFilters(next.filters)
    setColumnKeys(nextColumns)
    setGroupBy(nextGroup)
    setShowTree(next.tree !== false)
    setWrapCells(!!next.wrap)
    setTruncateCells(next.truncate !== false)
    setQuery(nextQuery)
    setFetchQuery(nextQuery)
    setPageSize(nextPageSize)
    setPage(0)
    setViewMenuOpen(false)
  }

  function selectView(view: SavedView) {
    applyView(view)
    onOpenView?.(view.id)
  }

  useEffect(() => {
    if (!routeViewId) return
    const view = viewsRef.current.find((item) => item.id === routeViewId)
    if (view) applyView(view)
  }, [collectionPath, routeViewId])

  function commitView(view: SavedView) {
    persistViews([...views, view])
    selectView(view)
  }

  function uniqueViewName(base: string) {
    const names = new Set(views.map((item) => item.name))
    if (!names.has(base)) return base
    let n = 2
    while (names.has(`${base} ${n}`)) n += 1
    return `${base} ${n}`
  }

  function addEmptyView() {
    commitView({
      id: `${Date.now()}`,
      name: uniqueViewName('新视图'),
      mode: 'table',
      sortField: allColumns[0]?.key ?? 'id',
      sortDir: 'asc',
      filters: {},
      columns: [...schemaDefaultKeys],
      groupBy: '',
      tree: true,
      wrap: false,
      truncate: true,
      query: '',
    })
  }

  function copyView(source?: SavedView) {
    commitView(
      source
        ? { ...source, id: `${Date.now()}`, name: uniqueViewName(`${source.name} 副本`), builtin: false }
        : {
            id: `${Date.now()}`,
            name: uniqueViewName(`${activeView?.name ?? title} 副本`),
            mode,
            sortField,
            sortDir,
            filters: { ...queryFilters },
            columns: columnKeys,
            groupBy,
            tree: showTree,
            wrap: wrapCells,
            truncate: truncateCells,
            query,
          },
    )
  }

  function patchActiveView(patch: Partial<SavedView>) {
    if (!activeViewId) return
    const current = views.find((view) => view.id === activeViewId)
    if (current?.builtin) return
    persistViews(views.map((view) => (view.id === activeViewId ? { ...view, ...patch } : view)))
  }

  function renameView(view: SavedView) {
    setViewMenuOpen(false)
    setDlg({ kind: 'rename', view })
  }

  function deleteView(view: SavedView) {
    setViewMenuOpen(false)
    setDlg({ kind: 'delete', view })
  }

  function applyRename(name?: string) {
    if (!dlg || dlg.kind !== 'rename') return
    if (dlg.view.builtin) {
      setDlg(null)
      return
    }
    const next = (name ?? '').trim()
    if (!next) {
      setDlgError('请填写名称')
      return
    }
    if (views.some((item) => item.id !== dlg.view.id && item.name === next)) {
      setDlgError('已有同名视图')
      return
    }
    persistViews(views.map((item) => (item.id === dlg.view.id ? { ...item, name: next } : item)))
    setDlg(null)
  }

  function applyDeleteView() {
    if (!dlg || dlg.kind !== 'delete') return
    if (dlg.view.builtin) {
      setDlg(null)
      return
    }
    const removedId = dlg.view.id
    const remaining = views.filter((item) => item.id !== removedId)
    setDlg(null)
    persistViews(remaining)
    if (activeViewId === removedId) {
      const next = viewsRef.current[0]
      if (next) selectView(next)
    }
  }

  function setVisibleColumns(next: string[]) {
    const pinned = pinLabelColumn(schema, next)
    if (!pinned.length) return
    setColumnKeys(pinned)
    if (!activeViewId) return
    if (views.find((view) => view.id === activeViewId)?.builtin) return
    persistViews(views.map((view) => (view.id === activeViewId ? { ...view, columns: pinned } : view)))
  }

  function toggleColumn(key: string) {
    if (key === schema?.labelField) return
    const next = columnKeys.includes(key) ? columnKeys.filter((item) => item !== key) : [...columnKeys, key]
    setVisibleColumns(next.length ? next : columnKeys)
  }

  function setWrap(next: boolean) {
    setWrapCells(next)
    patchActiveView({ wrap: next })
  }

  function setTruncate(next: boolean) {
    setTruncateCells(next)
    patchActiveView({ truncate: next })
  }

  function setGroupKey(next: string) {
    setGroupBy(next)
    patchActiveView({ groupBy: next })
  }

  function setTree(next: boolean) {
    setShowTree(next)
    patchActiveView({ tree: next })
  }

  async function runAction(row: DbRecord, action: CollectionActionInfo) {
    if (action.confirm) {
      setDlg({ kind: 'action', row, action })
      return
    }
    await executeAction(row, action)
  }

  async function executeAction(row: DbRecord, action: CollectionActionInfo) {
    const key = `${action.id}:${row.id}`
    setBusyKey(key)
    try {
      await readJson('/api/db/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${dataPath}/${row.id}`, action: action.id }),
      })
      quietUntil.current = 0
      await reload()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusyKey(null)
    }
  }

  async function writePatch(row: DbRecord, content: Record<string, unknown>) {
    try {
      const keys = Object.keys(content)
      quietUntil.current = Date.now() + 800
      if (bodyKey && keys.length === 1 && keys[0] === bodyKey) {
        const data = await readJson<{ value?: unknown }>('/api/db/content', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: `${dataPath}/${row.id}`, value: content[bodyKey] }),
        })
        setDetailBody(data.value ?? content[bodyKey])
        return
      }
      const data = await readJson<{ value?: DbRecord }>('/api/db/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${dataPath}/${row.id}`, content }),
      })
      const next = data.value
      if (next) {
        setItems((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)))
        return
      }
      quietUntil.current = 0
      await reload()
    } catch (err) {
      quietUntil.current = 0
      setError(String(err))
    }
  }

  async function createRecord() {
    if (!canCreate) return
    try {
      const data = await readJson<{ value?: DbRecord }>('/api/db/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: dataPath, content: {} }),
      })
      quietUntil.current = 0
      await reload()
      const id = data.value?.id
      if (id) {
        setOpenDetailId(id)
        if (data.value) setDetailRow(data.value)
        onOpenRecord?.(id, activeViewId, dataPath)
      }
    } catch (err) {
      setError(String(err))
    }
  }

  async function executeDeleteRecord(row: DbRecord) {
    try {
      await readJson('/api/db/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${dataPath}/${row.id}` }),
      })
      onCloseRecord?.()
      quietUntil.current = 0
      await reload()
    } catch (err) {
      setError(String(err))
    }
  }

  async function writeOne(row: DbRecord, key: string, field: FieldSpec, raw: string) {
    await writePatch(row, { [key]: parseFieldValue(field, raw) })
  }

  const labelOf = (row: DbRecord) => crumbRecordLabel(row, schema?.labelField)
  const crumbs = useMemo(
    () =>
      buildCrumbs({
        collection: collectionPath,
        collectionLabel: title,
        tables: tables.map((table) => ({
          path: table.path,
          label: table.view?.title ?? table.label,
          icon: table.view?.icon,
        })),
        viewId: tableHub ? undefined : routeViewId ?? activeViewId ?? undefined,
        viewName: activeView?.name,
        views: views.map((view) => ({ id: view.id, name: view.name, mode: view.mode })),
        recordId: selected?.id,
        recordLabel: selected ? crumbRecordLabel(selected, schema?.labelField) : undefined,
        records: items.map((row) => ({
          id: row.id,
          label: crumbRecordLabel(row, schema?.labelField),
          emoji: recordPreviewEmoji(row),
        })),
      }),
    [activeView?.name, activeViewId, collectionPath, items, routeViewId, schema?.labelField, selected, tables, tableHub, title, views],
  )
  const currentTable = tables.find((item) => item.path === collectionPath)
  const recordKind = recordPickKind(currentTable?.view?.moduleId)
  const recordPick = (row: DbRecord) => pickDomAttrs(recordKind, row.id, labelOf(row))

  function renderCell(row: DbRecord, key: string, field: FieldSpec) {
    const Custom = chrome?.cells?.[key]
    const fallback = formatField(field, row[key])
    if (Custom) return <Custom field={key} spec={field} value={row[key]} record={row} fallback={fallback} />
    if (resolveFieldType(field) === 'select' && field.writable && field.enum?.length) {
      return (
        <CellSelect
          value={String(row[key] ?? '')}
          options={field.enum.map((item) => ({ value: item, label: item }))}
          onSelect={(next) => void writeOne(row, key, field, next)}
        />
      )
    }
    if (resolveFieldType(field) === 'boolean') {
      return (
        <BoolCell
          on={boolOn(row[key])}
          writable={field.writable}
          onToggle={
            field.writable
              ? () => void writeOne(row, key, field, boolOn(row[key]) ? 'false' : 'true')
              : undefined
          }
        />
      )
    }
    return <DefaultCell field={field} value={row[key]} />
  }

  function RecordTitle({
    row,
    openDetail = true,
    depth = 0,
    hasKids = false,
    kidCount = 0,
  }: {
    row: DbRecord
    openDetail?: boolean
    depth?: number
    hasKids?: boolean
    kidCount?: number
  }) {
    const key = schema?.labelField
    const field = key && schema ? schema.fields[key] : undefined
    const body = chrome?.Title ? (
      <chrome.Title record={row} label={labelOf(row)} />
    ) : key && field ? (
      renderCell(row, key, field)
    ) : (
      <>{labelOf(row)}</>
    )
    const tree = openDetail && parentKey && showTree
    if (!openDetail && !tree) return body
    return (
      <div className="tasks-title-cell" style={tree ? { paddingLeft: depth * 16 } : undefined}>
        {tree ? (
          hasKids ? (
            <button
              type="button"
              className="tasks-tree-toggle"
              aria-label={collapsed[row.id] ? '展开子记录' : '收起子记录'}
              onClick={(event) => {
                event.stopPropagation()
                setCollapsed((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
              }}
            >
              {collapsed[row.id] ? (
                <ChevronRightIcon aria-hidden className="size-[14px]" />
              ) : (
                <ChevronDownIcon aria-hidden className="size-[14px]" />
              )}
            </button>
          ) : (
            <span className="tasks-tree-toggle is-empty" aria-hidden />
          )
        ) : null}
        <span className="fsdb-title-text">{body}</span>
        {openDetail ? (
          <span className="tasks-title-aside">
            {tree && kidCount > 0 ? (
              <span className="sidebar-chat-count tasks-tree-count" title={`${kidCount} 项`}>
                <span className="sidebar-chat-count-num">{kidCount}</span>
              </span>
            ) : null}
            <button
              type="button"
              className="tasks-title-open"
              data-testid="record-title-open"
              data-biu-action="open"
              aria-label="查看详情"
              title="查看详情"
              onClick={(event) => {
                event.stopPropagation()
                setDetailId(row.id, row)
              }}
            >
              <ArrowsPointingOutIcon aria-hidden className="size-[14px]" />
            </button>
          </span>
        ) : null}
      </div>
    )
  }

  function RecordActions({ row, place }: { row: DbRecord; place: 'row' | 'detail' }) {
    const actions = visibleActions(schema, row, place)
    if (!actions.length) return null
    const Action = chrome?.Action
    return (
      <div className="tasks-row-actions" data-biu-ignore onClick={(event) => event.stopPropagation()}>
        {actions.map((action) => {
          const busy = Boolean(busyKey?.endsWith(`:${row.id}`))
          const run = () => void runAction(row, action)
          if (Action) {
            return <Action key={action.id} action={action} record={row} busy={busy} run={run} />
          }
          const glyph = actionIcon(action.id)
          return (
            <button
              key={action.id}
              type="button"
              className={`tasks-icon-btn${action.tone === 'danger' ? ' is-danger' : ''}`}
              title={action.label}
              aria-label={`${action.label} ${labelOf(row)}`}
              disabled={busy}
              onClick={run}
            >
              {glyph ?? action.label}
            </button>
          )
        })}
      </div>
    )
  }

  function RecordProperties({ row, omit }: { row: DbRecord; omit?: string }) {
    const hide = omit ?? activeGroup?.key
    const cols = hide ? propColumns.filter((item) => item.key !== hide) : propColumns
    if (!cols.length) return null
    return (
      <div className="fsdb-proplist">
        {cols.map((col) => (
          <span key={col.key} className="fsdb-propchip">
            <span className="fsdb-propchip-v">{renderCell(row, col.key, col.field)}</span>
          </span>
        ))}
      </div>
    )
  }

  function GroupHead({ groupKey, label, count }: { groupKey: string; label: string; count: number }) {
    const folded = Boolean(collapsedGroups[groupKey])
    return (
      <header className="tasks-queue-ghead">
        <button
          type="button"
          className="tasks-group-fold"
          aria-expanded={!folded}
          aria-label={folded ? '展开分组' : '收起分组'}
          title={folded ? '展开分组' : '收起分组'}
          onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
        >
          <span className="sidebar-rail-icon sidebar-group-fold" aria-hidden>
            <span className="sidebar-group-fold-face">
              {activeGroup ? <FieldGlyph kind={resolveFieldType(activeGroup.field)} /> : <Squares2X2Icon aria-hidden className="size-[14px]" />}
            </span>
            <span className="sidebar-group-fold-chevron">
              {folded ? (
                <ChevronRightIcon className="size-4 shrink-0 opacity-80" />
              ) : (
                <ChevronDownIcon className="size-4 shrink-0 opacity-80" />
              )}
            </span>
          </span>
        </button>
        <span className="tasks-queue-glabel">{label}</span>
        <span className="tasks-queue-count">{count}</span>
      </header>
    )
  }

  function QueueRow({ row }: { row: DbRecord }) {
    return (
      <li className={`tasks-queue-item${row.id === detailId ? ' is-active' : ''}`} {...recordPick(row)}>
        <div className="tasks-queue-item-body">
          <button type="button" className="tasks-queue-item-main" data-biu-action="open" onClick={() => setDetailId(row.id, row)}>
            <span className="tasks-queue-item-title">
              <RecordTitle row={row} openDetail={false} />
            </span>
          </button>
          <RecordProperties row={row} />
          <RecordActions row={row} place="row" />
        </div>
      </li>
    )
  }

  function MiniCard({ row }: { row: DbRecord }) {
    return (
      <div className={`tasks-minicard${row.id === detailId ? ' is-active' : ''}`} {...recordPick(row)}>
        <div className="tasks-minicard-title">
          <button type="button" className="tasks-minicard-open" data-biu-action="open" onClick={() => setDetailId(row.id, row)}>
            <span className="tasks-minicard-titletext">
              <RecordTitle row={row} openDetail={false} />
            </span>
          </button>
          <RecordActions row={row} place="row" />
        </div>
        <div className="tasks-minicard-foot">
          <RecordProperties row={row} />
        </div>
      </div>
    )
  }

  function TableBodyRows({ rows, keyPrefix = '' }: { rows: DbRecord[]; keyPrefix?: string }) {
    const listed = flattenRows(rows)
    const span = Math.max(columns.length, 1) + (schema?.actions?.length ? 1 : 0)
    if (!listed.length) {
      return (
        <tr>
          <td colSpan={span} className="fsdb-empty">
            {error ? '加载失败' : '暂无记录'}
          </td>
        </tr>
      )
    }
    return (
      <>
        {listed.map(({ row, depth, hasKids, kidCount }) => (
          <tr key={`${keyPrefix}${row.id}`} className={row.id === detailId ? 'is-active' : undefined} {...recordPick(row)}>
            {columns.map((col) => (
              <td key={col.key}>
                {col.key === schema?.labelField ? (
                  <RecordTitle row={row} depth={depth} hasKids={hasKids} kidCount={kidCount} />
                ) : (
                  <span className="fsdb-cell">{renderCell(row, col.key, col.field)}</span>
                )}
              </td>
            ))}
            {schema?.actions?.length ? (
              <td>
                <RecordActions row={row} place="row" />
              </td>
            ) : null}
          </tr>
        ))}
      </>
    )
  }

  function cycleSort(field: string) {
    if (sortField !== field) {
      setSortField(field)
      setSortDir('asc')
      return
    }
    setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
  }

  viewsRef.current = views

  useEffect(() => {
    if (!schema || !collectionPath) {
      hydratePath.current = ''
      return
    }
    const hydrateKey = `${collectionPath}\0${dataPath}`
    if (hydratePath.current === hydrateKey) return
    hydratePath.current = hydrateKey
    if (tableHub) {
      setHydrated(true)
      return
    }
    persistViews(loadViews(collectionPath))
    const listed = viewsRef.current
    const view =
      listed.find((item) => item.id === routeViewId) ??
      listed.find((item) => item.id === loadActiveViewId(collectionPath, listed)) ??
      listed[0]
    if (view) applyView(view)
    setHydrated(true)
  }, [allColumnKeys, collectionPath, dataPath, schema, schemaDefaultKeys, tableHub])

  useEffect(() => {
    if (!hydrated || !activeViewId) return
    const id = window.setTimeout(() => {
      if (hydratePath.current !== `${collectionPath}\0${dataPath}`) return
      const current = viewsRef.current.find((view) => view.id === activeViewId)
      if (!current || current.builtin || tableHub) return
      const next = normalizeSavedView({
        ...current,
        mode,
        sortField,
        sortDir,
        filters,
        columns: pinLabelColumn(schema, columnKeys),
        groupBy,
        tree: showTree,
        wrap: wrapCells,
        truncate: truncateCells,
        query,
        pageSize,
      })
      if (viewStateKey(current) === viewStateKey(next)) return
      persistViews(viewsRef.current.map((view) => (view.id === activeViewId ? next : view)))
    }, 400)
    return () => window.clearTimeout(id)
  }, [
    activeViewId,
    collectionPath,
    columnKeys,
    filters,
    groupBy,
    hydrated,
    mode,
    query,
    pageSize,
    schema,
    showTree,
    sortDir,
    sortField,
    truncateCells,
    wrapCells,
  ])

  return (
    <div
      className={`fsdb-page tasks-root${embed ? ' inspector-database-page' : ''}`}
      data-testid={embed ? 'inspector-database' : undefined}
    >
      {!embed ? (
        <DataSidebar
          tables={tables}
          collectionPath={collectionPath}
          title={title}
          views={views}
          activeViewId={activeViewId}
          onOpenTable={onOpenTable}
          onApplyView={(view) => {
            selectView(view)
            setDetailId(null)
          }}
          onRenameView={renameView}
          onDeleteView={deleteView}
          onAddView={addEmptyView}
          onCopyView={copyView}
          onOpenRecord={(path, view, recordId, row) => {
            if (path === collectionPath) {
              flushSync(() => {
                setOpenDetailId(recordId)
                if (row) setDetailRow(row)
              })
            }
            onOpenRecord?.(recordId, view.id, path)
          }}
          expandedViewKey={expandedViewKey}
          onExpandedViewKeyChange={onExpandedViewKeyChange}
          onCollapse={toggleViewsOpen}
        />
      ) : null}
      <div className="fsdb-right">
        {embed ? null : (
        <header className="chat-view-header" data-biu-ignore>
          <div className="chat-view-header-left">
            {!viewsOpen ? (
              <button
                type="button"
                className="chat-view-header-expand"
                title="展开左侧边栏"
                aria-label="展开左侧边栏"
                data-testid="header-sidebar-expand"
                onClick={() => window.dispatchEvent(new Event('biu:expand-shell-sidebar'))}
              >
                <ChevronDoubleRightIcon aria-hidden className="size-4" />
              </button>
            ) : null}
            <CrumbTrail
              crumbs={crumbs}
              openId={crumbOpen}
              onOpenId={setCrumbOpen}
              canCreateView
              canCreateRecord={canCreate && !tableHub}
              onCreate={(kind) => {
                if (kind === 'record') void createRecord()
                else addEmptyView()
              }}
              onPick={(target) => {
                if (target.kind === 'collection') {
                  onOpenTable?.(target.collection, undefined, { catalog: true })
                  setCrumbOpen(null)
                  return
                }
                if (target.kind === 'view' && target.collection === collectionPath) {
                  const view = views.find((item) => item.id === target.viewId)
                  if (view) selectView(view)
                  setCrumbOpen(null)
                  return
                }
                onCrumbTarget?.(target)
                setCrumbOpen(null)
              }}
              navRef={crumbRef}
            />
          </div>
          <div className="chat-view-header-right">
            {selected ? <RecordActions row={selected} place="detail" /> : null}
            {activeViewId && !selected ? (
              <button
                type="button"
                className={`chat-view-header-expand${viewStarred ? ' is-active' : ''}`}
                title={viewStarred ? '取消收藏视图' : '收藏视图'}
                aria-label={viewStarred ? '取消收藏视图' : '收藏视图'}
                aria-pressed={viewStarred}
                onClick={() => persistStarredViews(toggleStarredView(getStarredViews(), collectionPath, activeViewId))}
              >
                <StarIcon aria-hidden className={`size-4${viewStarred ? ' text-[#f5b700]' : ''}`} />
              </button>
            ) : null}
            <button
              type="button"
              className={`chat-view-header-expand${inspectorOpen ? ' is-active' : ''}`}
              title={inspectorOpen ? '收起检查器' : '打开检查器'}
              aria-label={inspectorOpen ? '收起检查器' : '打开检查器'}
              aria-pressed={inspectorOpen}
              data-testid="fsdb-inspector-toggle"
              onClick={() => window.dispatchEvent(new Event('biu:inspector-toggle'))}
            >
              {inspectorOpen ? (
                <ChevronDoubleRightIcon aria-hidden className="size-4" />
              ) : (
                <ChevronDoubleLeftIcon aria-hidden className="size-4" />
              )}
            </button>
          </div>
        </header>
        )}
        <div className="fsdb-right-body">
        {!detailId ? (
        <div className="tasks-main fsdb-main">
        <div className="tasks-toolbar" data-biu-ignore>
          <div className="tasks-toolbar-left">
            <div className="tasks-viewdd-wrap" ref={viewRef}>
              <button
                type="button"
                className={`tasks-viewdd-btn${viewMenuOpen ? ' is-active' : ''}`}
                aria-label="切换视图"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                onClick={() => toggleMenu('view')}
              >
                <Squares2X2Icon aria-hidden className="size-[14px]" />
                <span className="tasks-viewdd-name">{tableHub ? title : (activeView?.name ?? '未保存')}</span>
              </button>
              {viewMenuOpen ? (
                <div className="tasks-viewdd-menu" role="menu">
                  <div className="tasks-viewdd-head">视图</div>
                  {views.length === 0 ? <div className="tasks-viewdd-empty">还没有已保存的视图</div> : null}
                  {views.map((view) => (
                    <div key={view.id} className={`tasks-viewdd-item${view.id === activeViewId ? ' is-active' : ''}`}>
                      <button type="button" className="tasks-viewdd-item-main" onClick={() => selectView(view)}>
                        <span className="tasks-viewdd-item-name">{view.name}</span>
                        {view.id === activeViewId ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-viewdd-check" /> : null}
                      </button>
                      {view.builtin ? null : (
                      <span className="tasks-viewdd-item-actions">
                        <button type="button" className="tasks-viewdd-act" title="重命名" onClick={() => renameView(view)}>
                          <PencilSquareIcon aria-hidden className="size-[14px]" />
                        </button>
                        <button type="button" className="tasks-viewdd-act is-danger" title="删除" onClick={() => deleteView(view)}>
                          <TrashIcon aria-hidden className="size-[14px]" />
                        </button>
                      </span>
                      )}
                    </div>
                  ))}
                  <div className="tasks-viewdd-foot">
                    <button type="button" className="tasks-viewdd-saveas" onClick={addEmptyView}>
                      <PlusIcon aria-hidden className="size-[14px]" />
                      添加视图
                    </button>
                    <button type="button" className="tasks-viewdd-saveas" onClick={() => copyView()}>
                      <Square2StackIcon aria-hidden className="size-[14px]" />
                      拷贝视图
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {lockedSource ? (
              <span className="fsdb-locked-filter" title="按当前数据类型筛选，不可更改">
                {tables.find((item) => item.path === lockedSource)?.view?.title ??
                  tables.find((item) => item.path === lockedSource)?.label ??
                  lockedSource}
              </span>
            ) : null}
          </div>
          <div className="tasks-toolbar-right">
            <div className={`tasks-search-wrap${searchExpanded ? ' is-open' : ''}`} ref={searchRef}>
              <button
                type="button"
                className="tasks-sort-btn"
                aria-label="搜索"
                aria-expanded={searchExpanded}
                title="搜索"
                onClick={() => setSearchOpen((open) => (searchExpanded && !query ? false : true))}
              >
                <MagnifyingGlassIcon aria-hidden className="size-[14px]" />
              </button>
              {searchExpanded ? (
                <input
                  ref={searchInputRef}
                  className="tasks-search"
                  value={query}
                  placeholder="搜索"
                  aria-label="搜索"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Escape') return
                    if (!query) setSearchOpen(false)
                    else e.currentTarget.blur()
                  }}
                />
              ) : null}
            </div>
            <div className="tasks-sort-wrap" ref={modeRef}>
              <button
                type="button"
                className={`tasks-sort-btn${modeMenuOpen ? ' is-active' : ''}`}
                aria-label="查看模式"
                title={`模式：${VIEW_MODES.find((item) => item.id === mode)?.label}`}
                onClick={() => toggleMenu('mode')}
              >
                <ModeGlyph id={mode} />
              </button>
              {modeMenuOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">查看模式</div>
                  {VIEW_MODES.map((opt) => (
                    <CheckRow
                      key={opt.id}
                      icon={<ModeGlyph id={opt.id} />}
                      label={opt.label}
                      on={mode === opt.id}
                      onToggle={() => {
                        setMode(opt.id)
                        patchActiveView({ mode: opt.id })
                        setModeMenuOpen(false)
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tasks-sort-wrap" ref={sortRef}>
              <button
                type="button"
                className={`tasks-sort-btn${sortMenuOpen ? ' is-active' : ''}`}
                aria-label="排序"
                title="排序"
                onClick={() => toggleMenu('sort')}
              >
                <ArrowsUpDownIcon aria-hidden className="size-[14px]" />
              </button>
              {sortMenuOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">排序依据</div>
                  {sortFields.map((item) => {
                    const current = sortField === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`fsdb-checkrow${current ? ' is-on' : ''}`}
                        onClick={() => cycleSort(item.key)}
                      >
                        <span className="fsdb-checkrow-label">
                          <span className="fsdb-checkrow-icon">
                            <FieldGlyph kind={item.kind} />
                          </span>
                          {item.field.label ?? item.key}
                        </span>
                        {current ? (
                          sortDir === 'asc' ? (
                            <ArrowUpIcon aria-hidden className="size-[14px]" />
                          ) : (
                            <ArrowDownIcon aria-hidden className="size-[14px]" />
                          )
                        ) : (
                          <span className="fsdb-checkrow-gap" aria-hidden />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
            <div className="tasks-sort-wrap" ref={groupRef}>
              <button
                type="button"
                className={`tasks-sort-btn${groupOpen || grouping ? ' is-active' : ''}`}
                aria-label="分组"
                title={activeGroup ? `分组：${activeGroup.field.label ?? activeGroup.key}` : '分组'}
                onClick={() => toggleMenu('group')}
              >
                <RectangleStackIcon aria-hidden className="size-[14px]" />
              </button>
              {groupOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">分组依据</div>
                  <CheckRow
                    icon={<Bars3BottomLeftIcon aria-hidden className="size-[14px]" />}
                    label="不分组"
                    on={!groupBy}
                    onToggle={() => {
                      setGroupKey('')
                      setGroupOpen(false)
                    }}
                  />
                  {groupFields.length ? (
                    groupFields.map((item) => (
                      <CheckRow
                        key={item.key}
                        icon={<FieldGlyph kind={item.kind} />}
                        label={item.field.label ?? item.key}
                        on={groupBy === item.key}
                        onToggle={() => {
                          setGroupKey(item.key)
                          setGroupOpen(false)
                        }}
                      />
                    ))
                  ) : (
                    <div className="tasks-viewdd-empty">没有单选或多选字段</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="tasks-sort-wrap" ref={columnRef}>
              <button
                type="button"
                className={`tasks-sort-btn${columnMenuOpen ? ' is-active' : ''}${columnCustom ? ' is-custom' : ''}`}
                aria-label="可见列"
                title="可见列"
                onClick={() => toggleMenu('columns')}
              >
                <EyeIcon aria-hidden className="size-[14px]" />
                {columnCustom ? <span className="tasks-sort-dot" aria-hidden /> : null}
              </button>
              {columnMenuOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">可见列</div>
                  {allColumns.map((item) => {
                    const on = columns.some((col) => col.key === item.key)
                    return (
                      <CheckRow
                        key={item.key}
                        icon={<FieldGlyph kind={item.kind} />}
                        label={item.field.label ?? item.key}
                        on={on}
                        locked={item.key === schema?.labelField}
                        onToggle={() => toggleColumn(item.key)}
                      />
                    )
                  })}
                </div>
              ) : null}
            </div>
            {activeView?.builtin ? null : (
            <div className="tasks-filter-btn-wrap" ref={filterRef}>
              <button
                type="button"
                className={`tasks-refresh tasks-rbar-btn${filterOpen || filterActive ? ' is-active' : ''}`}
                aria-label="筛选"
                title="筛选"
                onClick={() => toggleMenu('filter')}
              >
                <FunnelIcon aria-hidden className="size-[14px]" />
                {filterActive ? <span className="tasks-filter-dot" aria-hidden /> : null}
              </button>
              {filterOpen ? (
                <div className="tasks-filter-menu" role="menu">
                  {filterFields.map((item) => {
                    const options =
                      item.kind === 'datetime'
                        ? [
                            { value: '1h', label: '最近 1 小时' },
                            { value: '24h', label: '最近 1 天' },
                            { value: '7d', label: '最近 7 天' },
                            { value: '30d', label: '最近 30 天' },
                          ]
                        : item.kind === 'boolean'
                          ? [
                              { value: 'true', label: '是' },
                              { value: 'false', label: '否' },
                            ]
                          : uniqueValues(items, item.key, item.field).map((option) => ({ value: option, label: option }))
                    return (
                      <div key={item.key} className="fsdb-filter-row">
                        <span className="fsdb-filter-row-key">
                          <FieldGlyph kind={item.kind} />
                          {item.field.label ?? item.key}
                        </span>
                        <CellSelect
                          value={filters[item.key] ?? ''}
                          placeholder="全部"
                          variant="cell"
                          options={[{ value: '', label: '全部' }, ...options]}
                          onSelect={(next) => setFilters((prev) => ({ ...prev, [item.key]: next }))}
                        />
                      </div>
                    )
                  })}
                  {filterActive ? (
                    <button type="button" className="tasks-filter-clear" onClick={() => setFilters({})}>
                      清除筛选
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            )}
            {mode === 'table' ? (
            <div className="tasks-filter-btn-wrap" ref={configRef}>
              <button
                type="button"
                className={`tasks-refresh tasks-rbar-btn${configOpen || wrapCells || !truncateCells || (Boolean(parentKey) && !showTree) ? ' is-active' : ''}`}
                aria-label="表格配置"
                title="表格配置"
                onClick={() => toggleMenu('config')}
              >
                <AdjustmentsHorizontalIcon aria-hidden className="size-[14px]" />
                {wrapCells || !truncateCells || (Boolean(parentKey) && !showTree) ? (
                  <span className="tasks-filter-dot" aria-hidden />
                ) : null}
              </button>
              {configOpen ? (
                <div className="tasks-filter-menu" role="menu">
                  <div className="tasks-sort-head">表格显示</div>
                  <CheckRow
                    icon={<Bars3BottomLeftIcon aria-hidden className="size-[14px]" />}
                    label="单元格换行"
                    on={wrapCells}
                    onToggle={() => setWrap(!wrapCells)}
                  />
                  <CheckRow
                    icon={<EllipsisHorizontalIcon aria-hidden className="size-[14px]" />}
                    label="文本缩略"
                    on={truncateCells}
                    onToggle={() => setTruncate(!truncateCells)}
                  />
                  {parentKey ? (
                    <CheckRow
                      icon={<ChevronRightIcon aria-hidden className="size-[14px]" />}
                      label="树形展示"
                      on={showTree}
                      onToggle={() => setTree(!showTree)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}
            <div className="fsdb-refresh-wrap">
              <button
                type="button"
                className={`tasks-refresh${refreshing ? ' is-spinning' : ''}`}
                aria-label="刷新"
                title="刷新"
                disabled={refreshing}
                onClick={() => void refreshNow()}
              >
                <ArrowPathIcon aria-hidden className={`size-[14px]${refreshing ? ' fsdb-spin' : ''}`} />
              </button>
              {notice ? (
                <span className="fsdb-refresh-toast" role="status">
                  <CheckCircleIcon aria-hidden className="size-[14px]" />
                  {notice}
                </span>
              ) : null}
            </div>
            {canCreate ? (
              <button
                type="button"
                className="fsdb-create-btn"
                aria-label="新建记录"
                title="新建"
                onClick={() => void createRecord()}
              >
                <PlusIcon aria-hidden className="size-[14px]" />
                新建
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="tasks-error">{error}</p> : null}

        <div className="fsdb-workspace">
          <div className="fsdb-stage">
            {mode === 'table' ? (
              <div className="tasks-table-wrap">
                <table className={`tasks-table${wrapCells ? ' is-wrap' : ''}${truncateCells ? ' is-truncate' : ''}`}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>
                    <span className="tasks-th">
                      <FieldGlyph kind={col.kind} />
                      {col.field.label ?? col.key}
                    </span>
                  </th>
                ))}
                      {schema?.actions?.length ? <th>操作</th> : null}
              </tr>
            </thead>
            <tbody>
                    {grouping ? (
                      grouped.length ? (
                        grouped.map((group) => (
                          <Fragment key={group.key || 'unset'}>
                            <tr className="fsdb-group-row">
                              <td colSpan={Math.max(columns.length, 1) + (schema?.actions?.length ? 1 : 0)}>
                                <GroupHead groupKey={group.key || 'unset'} label={group.label} count={group.rows.length} />
                              </td>
                            </tr>
                            {collapsedGroups[group.key || 'unset'] ? null : (
                            <TableBodyRows rows={group.rows} keyPrefix={`${group.key}:`} />
                            )}
                          </Fragment>
                        ))
                      ) : (
                        <TableBodyRows rows={[]} />
                      )
                    ) : (
                      <TableBodyRows rows={visible} />
                    )}
            </tbody>
          </table>
        </div>
            ) : null}

            {mode === 'cards' ? (
              grouping ? (
                <div className="fsdb-cards-stack">
                  {grouped.length ? (
                    grouped.map((group) => (
                      <section key={group.key || 'unset'} className="tasks-queue-group">
                        <GroupHead groupKey={group.key || 'unset'} label={group.label} count={group.rows.length} />
                        {collapsedGroups[group.key || 'unset'] ? null : (
                        <div className="fsdb-cards">
                          {group.rows.map((row) => (
                            <MiniCard key={row.id} row={row} />
                          ))}
                        </div>
                        )}
                      </section>
                    ))
                  ) : (
                    <p className="fsdb-empty">{error ? '加载失败' : '暂无记录'}</p>
                  )}
                </div>
              ) : (
                <div className="fsdb-cards">
                  {visible.length ? (
                    visible.map((row) => <MiniCard key={row.id} row={row} />)
                  ) : (
                    <p className="fsdb-empty">{error ? '加载失败' : '暂无记录'}</p>
                  )}
                </div>
              )
            ) : null}

            {mode === 'queue' ? (
              <div className="tasks-queue">
                {visible.length ? (
                  grouping ? (
                    grouped.map((group) => (
                      <section key={group.key || 'unset'} className="tasks-queue-group">
                        <GroupHead groupKey={group.key || 'unset'} label={group.label} count={group.rows.length} />
                        {collapsedGroups[group.key || 'unset'] ? null : (
                        <ul className="tasks-queue-list">
                          {group.rows.map((row) => (
                            <QueueRow key={row.id} row={row} />
                          ))}
                        </ul>
                        )}
                      </section>
                    ))
                  ) : (
                    <ul className="tasks-queue-list">
                      {visible.map((row) => (
                        <QueueRow key={row.id} row={row} />
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="fsdb-empty">{error ? '加载失败' : '暂无记录'}</p>
                )}
              </div>
            ) : null}

            {mode === 'board' ? (
              <div className="tasks-board" style={{ gridTemplateColumns: `repeat(${Math.max(grouped.length, 1)}, minmax(240px, 1fr))` }}>
                {grouped.map((group) => (
                  <div key={group.key || 'all'} className="tasks-board-col">
                    <div className="tasks-board-colhead">
                      {activeGroup ? <FieldGlyph kind={resolveFieldType(activeGroup.field)} /> : null}
                      <span className="tasks-board-coltitle">{group.label}</span>
                      <span className="tasks-board-count">{group.rows.length}</span>
                    </div>
                    <div className="tasks-board-list">
                      {group.rows.map((row) => (
                        <MiniCard key={row.id} row={row} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="fsdb-pager" data-biu-ignore>
            <span className="fsdb-pager-meta" title={total ? `共 ${total} 条` : '暂无记录'}>
              <HashtagIcon aria-hidden className="size-[14px]" />
              <span>{total}</span>
            </span>
            <div className="fsdb-pager-nav">
              <div className="fsdb-pager-size" ref={pageSizeRef}>
                <button
                  type="button"
                  className={`tasks-icon-btn fsdb-pager-size-btn${pageSizeOpen ? ' is-active' : ''}`}
                  aria-label={`每页 ${pageSize} 条`}
                  aria-haspopup="menu"
                  aria-expanded={pageSizeOpen}
                  title={`每页 ${pageSize} 条`}
                  onClick={() => toggleMenu('pageSize')}
                >
                  <Bars3BottomLeftIcon aria-hidden className="size-[14px]" />
                  <span>{pageSize}</span>
                </button>
                {pageSizeOpen && pageSizeMenuPos
                  ? createPortal(
                      <div
                        ref={pageSizeMenuRef}
                        className="fsdb-pager-size-menu"
                        role="menu"
                        style={{ right: pageSizeMenuPos.right, bottom: pageSizeMenuPos.bottom }}
                      >
                        {PAGE_SIZES.map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`fsdb-pager-size-option${size === pageSize ? ' is-active' : ''}`}
                            role="menuitem"
                            onClick={() => {
                              setPageSize(normalizePageSize(size))
                              setPageSizeOpen(false)
                            }}
                          >
                            {size}
                            {size === pageSize ? <CheckIcon aria-hidden className="size-[14px]" /> : null}
                          </button>
                        ))}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
              <button
                type="button"
                className="tasks-icon-btn"
                aria-label="上一页"
                disabled={page <= 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeftIcon aria-hidden className="size-[14px]" />
              </button>
              <button
                type="button"
                className="tasks-icon-btn"
                aria-label="下一页"
                disabled={(page + 1) * pageSize >= total}
                onClick={() => setPage((prev) => prev + 1)}
              >
                <ChevronRightIcon aria-hidden className="size-[14px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
        ) : selected && schema ? (
        <RecordDetail
          selected={selected}
          schema={schema}
          chrome={chrome}
          draft={draft}
          items={items}
          detailBody={detailBody}
          labelOf={labelOf}
          renderCell={renderCell}
          setDraft={setDraft}
          writeOne={writeOne}
          writePatch={writePatch}
          onDelete={canDelete && selected ? () => setDlg({ kind: 'delete-record', row: selected }) : undefined}
        />
      ) : null}
        </div>
      </div>
      {dlg?.kind === 'rename' ? (
        <AppDialog
          key={dlg.view.id}
          title="重命名视图"
          confirm="保存"
          onCancel={() => setDlg(null)}
          onConfirm={applyRename}
          input={{ defaultValue: dlg.view.name, placeholder: '视图名称', maxLength: 80 }}
          error={dlgError}
          onClearError={() => setDlgError('')}
        />
      ) : null}
      {dlg?.kind === 'delete' ? (
        <AppDialog
          title="删除视图"
          confirm="删除"
          danger
          onCancel={() => setDlg(null)}
          onConfirm={applyDeleteView}
          body={<p>确定删除视图「{dlg.view.name}」？删除后不可恢复。</p>}
        />
      ) : null}
      {dlg?.kind === 'delete-record' ? (
        <AppDialog
          title="删除记录"
          confirm="删除"
          danger
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            const { row } = dlg
            setDlg(null)
            void executeDeleteRecord(row)
          }}
          body={<p>确定删除「{labelOf(dlg.row)}」？删除后不可恢复。</p>}
        />
      ) : null}
      {dlg?.kind === 'action' ? (
        <AppDialog
          title={dlg.action.label}
          confirm={dlg.action.label}
          danger={dlg.action.tone === 'danger'}
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            const { row, action } = dlg
            setDlg(null)
            void executeAction(row, action)
          }}
          body={<p>{dlg.action.confirm}</p>}
        />
      ) : null}
    </div>
  )
}
