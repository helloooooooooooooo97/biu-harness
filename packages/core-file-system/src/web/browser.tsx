import { Fragment, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
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
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  RectangleStackIcon,
  Square2StackIcon,
  Squares2X2Icon,
  StarIcon,
  TableCellsIcon,
  ViewColumnsIcon,
} from '@heroicons/react/16/solid'
import type { CollectionActionInfo, CollectionInfo, CollectionSchema, DbRecord, FieldSpec } from '@biu/type-file-system'
import type { CollectionChrome, CollectionViewType, DatabaseUi } from '@biu/type-file-system/ui'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import { BoolBox, ChatCount, RecordEmojiBoard, HeadlessDismiss } from '@biu/public-ui'
import {
  contentFieldKey,
  defaultColumnKeys,
  facetSourceKey,
  flattenFacetColumns,
  fieldEntries,
  flattenTree,
  formatField,
  groupField,
  groupRecords,
  groupableFields,
  hasTreeLinks,
  isRecordLinkField,
  parentFieldKey,
  parseFacetFlatColumnKey,
  patchFacetFlatValue,
  pinLabelColumn,
  readFacetFlatValue,
  resolveFieldType,
  uniqueValues,
  type ViewMode,
} from './fields.ts'
import { DbMenu, DbSearchOption } from '@biu/database-ui'
import { AppDialog, CellSelect, CheckRow, LocalText } from './controls.tsx'
import { DataSidebar } from './data-sidebar.tsx'
import { buildCrumbs, type CrumbTarget } from './sidebar-nav.ts'
import { CrumbTrail } from './crumb-trail.tsx'
import { pickDomAttrs, recordPickKind } from './pick-dom.ts'
import { normalizeRecordEmoji, recordPreviewEmoji, crumbRecordLabel } from './sidebar-preview.ts'
import { recordPreviewMascot, RecordMark } from './record-mark.tsx'
import { COL_WIDTH_MAX, COL_WIDTH_MIN, colWidthStyle, normalizeColumnWidths, normalizeSavedView, normalizePageSize, tableWidthStyle, viewStateKey, type SavedView } from './saved-view.ts'
import { PagerSizeControl } from './pager-size.tsx'
import {
  actionIcon,
  ActionCell,
  BoolCell,
  DefaultCell,
  draftFromRecord,
  fieldActionId,
  FieldGlyph,
  FilePreview,
  ModeGlyph,
  parseFieldValue,
  VIEW_MODES,
  visibleActions,
} from './fsdb-cells.tsx'
import { ensureFsdbStyle } from './fsdb-style.ts'
import { RecordDetail } from './record-detail.tsx'
import { TableGlyph, ViewModeGlyph } from './nav-glyphs.tsx'
import { countFittingViewTabs, splitVisibleViews } from './view-tabs.ts'
import { getDatabaseUi } from './database-ui.ts'
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
  persistViewDisplay,
  pushSavedViews,
  subscribeStarredViews,
  toggleStarredView,
  viewForPath,
  viewsKey,
  withViewDisplay,
} from './view-storage.ts'
import {
  getPageWidth,
  getPageWidthVersion,
  persistPageWidth,
  subscribePageWidth,
} from './page-width.ts'
import { listCollection, readJson } from './db-client.ts'
import { findViewNeighbor, indexOnPage } from './view-adjacent.ts'
import { rememberPreviewTotal, viewTotalKey } from './sidebar-preview.ts'
import { mergeTableViews } from '../catalog-views.ts'
import { showRecordInInspector } from './inspector-db-route.ts'
import { SchemaChips, SchemaFieldEditor, schemaTagTone } from './schema-field.tsx'
import { CellPop, cellUsesPop } from './cell-pop.tsx'
import { CellPopDraft } from './cell-pop-draft.tsx'
import { FieldValuePop } from './field-value-pop.tsx'
import { loadFacets, pullFacets, subscribeFacets } from './facet-catalog.ts'

const EMPTY_VIEWS: CollectionViewType[] = []

type StatResult = { schema?: CollectionSchema }

function isListColumn(key: string) {
  return key !== 'description' && key !== 'notes' && key !== 'content' && key !== 'emoji'
}

function recordsFingerprint(rows: Array<DbRecord & { path?: string }>) {
  return JSON.stringify(rows)
}

const LIST_CACHE_MAX = 8
const listCache = new Map<string, { items: Array<DbRecord & { path?: string }>; total: number; stat: StatResult | null }>()

function rememberListCache(
  path: string,
  snap: { items: Array<DbRecord & { path?: string }>; total: number; stat: StatResult | null },
) {
  if (listCache.has(path)) listCache.delete(path)
  listCache.set(path, snap)
  while (listCache.size > LIST_CACHE_MAX) {
    const first = listCache.keys().next().value
    if (first === undefined) break
    listCache.delete(first)
  }
}

const EMPTY_FILTERS: Record<string, string> = {}
/** 与选区拖选同一阈值：位移超过这个距离只当拖，不当点击。 */
const CELL_POP_DRAG_PX = 6
const CELL_POP_IGNORE =
  '.fsdb-row-check, .fsdb-col-resizer, .tasks-row-tools, .tasks-title-open, .fsdb-action-btn, .fsdb-boolbtn, .fsdb-thumb-btn, .fsdb-thumb, .ant-image, .fsdb-file-tools, .fsdb-ref-chip, .db-datetime, .ant-picker'

export function CollectionBrowser({
  moduleId,
  collectionPath,
  title,
  blurb,
  chrome,
  tables = [],
  onOpenTable,
  lockedFilters = EMPTY_FILTERS,
  routeRecordId = null,
  routeViewId,
  expandedViewKey,
  onExpandedViewKeyChange,
  onOpenView,
  onOpenRecord,
  onCloseRecord,
  onCrumbTarget,
  embed = false,
  sheet = false,
  onOpenRow,
  resolveViews,
}: {
  moduleId?: string
  collectionPath: string
  title: string
  blurb: string
  chrome?: CollectionChrome
  tables?: CollectionInfo[]
  onOpenTable?: (path: string, viewId?: string) => void
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
  /** 嵌在详情里的收集表：用同一套表组件，但不写视图、不出现视图切换。 */
  sheet?: boolean
  /** 返回 true 则自己处理这一行，不打开本表详情。 */
  onOpenRow?: (row: DbRecord) => boolean
  resolveViews?: (path: string, user: SavedView[]) => SavedView[]
}) {
  ensureFsdbStyle()
  const nested = embed || sheet
  const listedViews = (path: string, user: SavedView[]) => {
    if (resolveViews) return resolveViews(path, user)
    const table = tables.find((item) => item.path === path) ?? {
      path,
      label: path === collectionPath ? title : path.replace(/^\//, ''),
    }
    return mergeTableViews(table, user)
  }
  const dataPath = collectionPath
  const [stat, setStat] = useState<StatResult | null>(null)
  const [items, setItems] = useState<Array<DbRecord & { path?: string }>>([])
  const [error, setError] = useState('')
  const [openDetailId, setOpenDetailId] = useState<string | null>(routeRecordId)
  const [detailRow, setDetailRow] = useState<DbRecord | null>(null)
  const [detailBody, setDetailBody] = useState<unknown>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const initialView = viewForPath(collectionPath, routeViewId)
  const dbUi = getDatabaseUi()
  const extraViews = useSyncExternalStore(
    (fn) => (dbUi ? dbUi.subscribe(fn) : () => undefined),
    () => dbUi?.views(collectionPath) ?? EMPTY_VIEWS,
    () => dbUi?.views(collectionPath) ?? EMPTY_VIEWS,
  )
  const modeChoices = useMemo(
    () => [...VIEW_MODES, ...extraViews.map((view) => ({ id: view.id, label: view.label }))],
    [extraViews],
  )
  const [query, setQuery] = useState(initialView?.query ?? '')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(() => normalizePageSize(initialView?.pageSize))
  const [total, setTotal] = useState(0)
  const [fetchQuery, setFetchQuery] = useState(initialView?.query ?? '')
  const [mode, setMode] = useState<ViewMode>(initialView?.mode ?? 'table')
  const customView = extraViews.find((view) => view.id === mode)
  const [sortField, setSortField] = useState(initialView?.sortField ?? 'id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialView?.sortDir ?? 'asc')
  const [filters, setFilters] = useState<Record<string, string>>(initialView?.filters ?? {})
  const [columnKeys, setColumnKeys] = useState<string[]>(initialView?.columns ?? [])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => normalizeColumnWidths(initialView?.columnWidths))
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const [cellPop, setCellPop] = useState<{ id: string; key: string } | null>(null)
  const cellPickRef = useRef<{ id: string; key: string } | null>(null)
  const cellAnchorRef = useRef<HTMLElement | null>(null)
  const cellPopPtrRef = useRef<{ x: number; y: number; dragged: boolean } | null>(null)
  const [facetCatalog, setFacetCatalog] = useState(() => loadFacets())
  const tablePathsKey = tables
    .map((table) => table.path)
    .slice()
    .sort()
    .join('\n')
  const [views, setViews] = useState<SavedView[]>(() => loadViews(collectionPath))
  const [activeViewId, setActiveViewId] = useState<string | null>(initialView?.id ?? null)
  const catalogLocks = useMemo(() => {
    if (sheet) return lockedFilters
    const current = views.find((view) => view.id === activeViewId)
    if (!current?.builtin) return lockedFilters
    return { ...current.filters, ...lockedFilters }
  }, [activeViewId, lockedFilters, sheet, views])
  const queryFilters = useMemo(() => ({ ...filters, ...catalogLocks }), [catalogLocks, filters])
  const queryFiltersKey = JSON.stringify(queryFilters)
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
  const openRow = (row: DbRecord) => {
    const jump = chrome?.openRow?.(row)
    if (jump && jump.kind === 'table') {
      onOpenTable?.(jump.path, jump.viewId)
      return
    }
    if (jump && jump.kind === 'record') {
      onOpenRecord?.(jump.recordId, activeViewId, jump.collection)
      return
    }
    if (onOpenRow?.(row)) return
    setDetailId(row.id, row)
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
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [wrapCells, setWrapCells] = useState(!!initialView?.wrap)
  const [truncateCells, setTruncateCells] = useState(initialView?.truncate !== false)
  const [groupBy, setGroupBy] = useState(initialView?.groupBy ?? '')
  const [showTree, setShowTree] = useState(initialView?.tree !== false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [pickedIds, setPickedIds] = useState<string[]>([])
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
    | { kind: 'alert'; title: string; body: string }
    | { kind: 'delete-record'; row: DbRecord }
    | { kind: 'delete-records'; ids: string[] }
    | null
  >(null)
  const [dlgError, setDlgError] = useState('')
  const crumbRef = useRef<HTMLElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarRightRef = useRef<HTMLDivElement>(null)
  const viewMeasureRef = useRef<HTMLDivElement>(null)
  const [viewTabFit, setViewTabFit] = useState(99)
  const modeRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const configRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
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
    if (nested) return
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
  }, [nested])

  useEffect(() => {
    if (nested) return
    function onToggle(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id
      if (!id || (moduleId && id !== moduleId)) return
      toggleViewsOpen()
    }
    window.addEventListener('biu:toggle-module-sidebar', onToggle)
    return () => window.removeEventListener('biu:toggle-module-sidebar', onToggle)
  }, [collectionPath, nested, moduleId])

  useEffect(() => {
    if (nested) return
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
  }, [nested])

  useLayoutEffect(() => {
    if (sheet) return
    function measure() {
      const toolbar = toolbarRef.current
      const right = toolbarRightRef.current
      const row = viewMeasureRef.current
      if (!toolbar || !right || !row) return
      const tabs = [...row.querySelectorAll('[data-view-measure]')] as HTMLElement[]
      const available = Math.max(0, toolbar.clientWidth - right.offsetWidth - 12)
      const next = countFittingViewTabs(tabs.map((el) => el.offsetWidth), available, 2)
      setViewTabFit((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (toolbarRef.current) ro.observe(toolbarRef.current)
    if (toolbarRightRef.current) ro.observe(toolbarRightRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sheet, views, searchExpanded])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function toggleMenu(which: 'view' | 'mode' | 'sort' | 'columns' | 'filter' | 'config' | 'group' | 'layout') {
    setViewMenuOpen(which === 'view' && !viewMenuOpen)
    setModeMenuOpen(which === 'mode' && !modeMenuOpen)
    setSortMenuOpen(which === 'sort' && !sortMenuOpen)
    setColumnMenuOpen(which === 'columns' && !columnMenuOpen)
    setFilterOpen(which === 'filter' && !filterOpen)
    setConfigOpen(which === 'config' && !configOpen)
    setGroupOpen(which === 'group' && !groupOpen)
    setLayoutOpen(which === 'layout' && !layoutOpen)
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
      const nextSchema = listed.schema ?? nextStat.schema
      setStat((prev) =>
        prev?.schema && JSON.stringify(prev.schema) === JSON.stringify(nextSchema) ? prev : { ...nextStat, schema: nextSchema },
      )
      setItems((prev) => (recordsFingerprint(prev) === recordsFingerprint(listed.items) ? prev : listed.items))
      setTotal(listed.total)
      rememberListCache(dataPath, { items: listed.items, total: listed.total, stat: { ...nextStat, schema: nextSchema } })
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
  const reloadKey = `${dataPath}\0${page}\0${pageSize}\0${fetchQuery}\0${sortField}\0${sortDir}\0${JSON.stringify(queryFilters)}\0${activeViewId ?? ''}`
  const detailIdRef = useRef<string | null>(null)
  detailIdRef.current = detailId
  const contentGen = useRef(0)
  const pullDetailBody = useCallback(() => {
    const id = detailIdRef.current
    if (!id) {
      setDetailBody(null)
      return
    }
    const gen = ++contentGen.current
    void readJson<{ value?: unknown }>(`/api/db/content?path=${encodeURIComponent(`${dataPath}/${id}`)}`)
      .then((data) => {
        if (gen !== contentGen.current) return
        setDetailBody(data.value ?? null)
      })
      .catch(() => {
        if (gen !== contentGen.current) return
        setDetailBody(null)
      })
  }, [dataPath])
  const steppingView = useRef(false)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFetchQuery((prev) => (prev === query ? prev : query))
    }, 280)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    setPage((prev) => (prev === 0 ? prev : 0))
  }, [fetchQuery, queryFiltersKey, sortField, sortDir, pageSize, collectionPath, dataPath])

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
    const cached = listCache.get(dataPath)
    setItems(cached?.items ?? [])
    setStat(cached?.stat ?? null)
    setTotal(cached?.total ?? 0)
    setError('')
    setPage(0)
    const stored = viewForPath(collectionPath, routeViewId)
    const user = loadViews(collectionPath)
    const listed = listedViews(collectionPath, user)
    rememberViews(collectionPath, listed)
    if (stored || listed[0]) {
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
  }, [collectionPath, dataPath, tablePathsKey])

  useEffect(() => {
    let debounce = 0
    const onChange = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void reloadRef.current()
        if (detailIdRef.current) pullDetailBody()
      }, 120)
    }
    window.addEventListener('fsdb:change', onChange)
    const timer = nested
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
  }, [collectionPath, dataPath, nested, pullDetailBody])

  useEffect(() => {
    void pullFacets()
  }, [collectionPath])

  useEffect(() => subscribeFacets(undefined, () => setFacetCatalog(loadFacets())), [])

  useEffect(() => {
    void reloadRef.current()
  }, [reloadKey])

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
  const subsetLocked = lockedFilterKeys.length > 0
  const canCreate = Boolean(schema?.records?.create) && !subsetLocked
  const canDelete = Boolean(schema?.records?.delete) && !subsetLocked
  useEffect(() => {
    setPickedIds([])
  }, [collectionPath])
  const bodyKey = contentFieldKey(schema)
  const entries = useMemo(() => fieldEntries(schema), [schema])
  const allColumns = useMemo(
    () => [
      ...entries.filter((item) => isListColumn(item.key) && item.key !== bodyKey && resolveFieldType(item.field) !== 'file'),
      ...flattenFacetColumns(facetCatalog),
    ],
    [bodyKey, entries, facetCatalog],
  )
  const allColumnKeys = useMemo(() => allColumns.map((item) => item.key), [allColumns])
  const schemaDefaultKeys = useMemo(() => defaultColumnKeys(schema, allColumnKeys), [schema, allColumnKeys])
  const schemaDefaultSig = schemaDefaultKeys.join('\0')
  const prevSchemaDefaultSig = useRef('')
  const columns = useMemo(() => {
    const selected = allColumns.filter((item) => columnKeys.includes(item.key))
    const base = selected.length ? selected : allColumns.filter((item) => schemaDefaultKeys.includes(item.key))
    const order = pinLabelColumn(
      schema,
      base.map((item) => item.key),
    )
    return order.map((key) => base.find((item) => item.key === key) ?? allColumns.find((item) => item.key === key)).filter(Boolean) as typeof allColumns
  }, [allColumns, columnKeys, schema, schemaDefaultKeys])
  const hasColWidths = Object.keys(columnWidths).length > 0

  function startColResize(event: ReactPointerEvent<HTMLSpanElement>, colKey: string) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const table = handle.closest('table')
    if (!table) return
    const heads = [...table.querySelectorAll('thead th')]
    const startX = event.clientX
    const snapshot: Record<string, number> = {}
    for (let i = 0; i < columns.length; i += 1) {
      const key = columns[i]!.key
      const measured = heads[i]?.getBoundingClientRect().width ?? 120
      snapshot[key] = columnWidths[key] ?? Math.round(measured)
    }
    const origin = snapshot[colKey] ?? COL_WIDTH_MIN
    handle.setPointerCapture(event.pointerId)
    setResizingCol(colKey)
    setColumnWidths(snapshot)
    const onMove = (ev: PointerEvent) => {
      const next = { ...snapshot, [colKey]: Math.round(Math.min(COL_WIDTH_MAX, Math.max(COL_WIDTH_MIN, origin + ev.clientX - startX))) }
      setColumnWidths(next)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setResizingCol(null)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }
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
    const prevDefaults = prevSchemaDefaultSig.current ? prevSchemaDefaultSig.current.split('\0').filter(Boolean) : []
    prevSchemaDefaultSig.current = schemaDefaultSig
    setColumnKeys((prev) => {
      const allowed = new Set(allColumnKeys)
      const grown = prevDefaults.length ? schemaDefaultKeys.filter((key) => !prevDefaults.includes(key)) : []
      const kept = pinLabelColumn(
        schema,
        [...prev.filter((key) => allowed.has(key)), ...grown.filter((key) => allowed.has(key) && !prev.includes(key))],
      )
      if (!prev.length || !kept.length) return schemaDefaultKeys
      if (kept.length === prev.length && kept.every((key, index) => key === prev[index])) return prev
      return kept
    })
  }, [allColumnKeys, schema, schemaDefaultKeys, schemaDefaultSig])

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
    if (!grouping) return buckets
    return buckets.filter((item) => item.rows.length)
  }, [groupBy, grouping, schema, visible])
  const parentKey = useMemo(() => parentFieldKey(schema, items), [items, schema])
  const treeable = useMemo(() => hasTreeLinks(items, parentKey), [items, parentKey])
  const treeOn = treeable && showTree
  const flattenRows = useCallback(
    (rows: DbRecord[]) => {
      if (!parentKey || !treeOn) return rows.map((row) => ({ row, depth: 0, hasKids: false, kidCount: 0 }))
      return flattenTree(rows, parentKey, collapsed)
    },
    [collapsed, parentKey, treeOn],
  )
  const pickableIds = useMemo(() => {
    const rows = grouping ? grouped.flatMap((group) => group.rows) : visible
    return flattenRows(rows).map((item) => item.row.id)
  }, [flattenRows, grouped, grouping, visible])
  const tableColSpan = Math.max(columns.length, 1)

  const selected =
    (detailId &&
      (items.find((item) => item.id === detailId) ?? (detailRow?.id === detailId ? detailRow : null))) ||
    null
  const viewIndex = selected ? indexOnPage(selected.id, items, page, pageSize) : null
  const stepViewRecord = async (delta: -1 | 1) => {
    if (!selected || steppingView.current) return
    steppingView.current = true
    try {
      const hit = await findViewNeighbor({
        currentId: selected.id,
        delta,
        items,
        page,
        pageSize,
        total,
        query: {
          path: dataPath,
          query: fetchQuery,
          sortField,
          sortDir,
          filters: queryFilters,
        },
        list: listCollection,
      })
      if (!hit) return
      if (hit.page !== page) setPage(hit.page)
      setDetailId(hit.id, hit.row ?? null)
    } finally {
      steppingView.current = false
    }
  }
  useEffect(() => {
    const rows = items.map((row) => ({
      id: row.id,
      label: crumbRecordLabel(row, schema?.labelField),
      emoji: recordPreviewEmoji(row),
      mascot: recordPreviewMascot(row),
    }))
    if (selected && !rows.some((row) => row.id === selected.id)) {
      rows.push({
        id: selected.id,
        label: crumbRecordLabel(selected, schema?.labelField),
        emoji: recordPreviewEmoji(selected),
        mascot: recordPreviewMascot(selected),
      })
    }
    rememberRecords(collectionPath, rows)
    window.dispatchEvent(new Event('fsdb:crumb-labels'))
  }, [collectionPath, items, schema?.labelField, selected])
  const filterActive = Object.values(filters).some(Boolean)
  const activeView = views.find((view) => view.id === activeViewId)
  useSyncExternalStore(subscribeStarredViews, getStarredViewsVersion, () => 0)
  useSyncExternalStore(subscribePageWidth, getPageWidthVersion, () => 0)
  const viewStarred = Boolean(activeViewId && isViewStarred(getStarredViews(), collectionPath, activeViewId))
  const pageWidth = getPageWidth()

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
      contentGen.current += 1
      setDetailBody(null)
      return
    }
    pullDetailBody()
  }, [collectionPath, dataPath, detailId, pullDetailBody])

  useEffect(() => {
    if (nested || !detailId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, nested])

  useEffect(() => {
    if (dlg?.kind !== 'rename') return
    setDlgError('')
  }, [dlg])

  function persistViewsFor(path: string, next: SavedView[]) {
    if (sheet) return
    const listed = listedViews(path, next).map((view) => withViewDisplay(path, view))
    const stored = listed.filter((view) => !view.builtin)
    rememberViews(path, listed)
    pushSavedViews(path, stored)
    if (!nested) {
      localStorage.setItem(viewsKey(path), JSON.stringify(stored))
    }
    if (path === collectionPath) {
      viewsRef.current = listed
      setViews(listed)
    }
    window.dispatchEvent(new Event('fsdb:change'))
    window.dispatchEvent(new Event('fsdb:crumb-labels'))
  }

  function persistViews(next: SavedView[]) {
    persistViewsFor(collectionPath, next)
  }

  function rememberActiveView(id: string) {
    setActiveViewId(id)
    if (nested) return
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
      JSON.stringify(columnKeys) === JSON.stringify(nextColumns) &&
      JSON.stringify(columnWidths) === JSON.stringify(normalizeColumnWidths(next.columnWidths))
    ) {
      return
    }
    rememberActiveView(next.id)
    setMode(next.mode)
    setSortField(next.sortField)
    setSortDir(next.sortDir)
    setFilters(next.filters)
    setColumnKeys(nextColumns)
    setColumnWidths(normalizeColumnWidths(next.columnWidths))
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
    const view =
      viewsRef.current.find((item) => item.id === routeViewId) ?? viewForPath(collectionPath, routeViewId)
    if (view) applyView(view)
  }, [collectionPath, routeViewId])

  function commitView(view: SavedView) {
    persistViews([...views, view])
    selectView(view)
  }

  function uniqueViewName(base: string, listed: SavedView[] = views) {
    const names = new Set(listed.map((item) => item.name))
    if (!names.has(base)) return base
    let n = 2
    while (names.has(`${base} ${n}`)) n += 1
    return `${base} ${n}`
  }

  function addEmptyView(path = collectionPath) {
    const target = path || collectionPath
    const listed = target === collectionPath ? views : loadViews(target)
    const view: SavedView = {
      id: `${Date.now()}`,
      name: uniqueViewName('新视图', listed),
      mode: 'table',
      sortField: target === collectionPath ? (allColumns[0]?.key ?? 'id') : 'id',
      sortDir: 'asc',
      filters: { ...catalogLocks },
      columns: target === collectionPath ? [...schemaDefaultKeys] : [],
      groupBy: '',
      tree: true,
      wrap: false,
      truncate: true,
      query: '',
    }
    persistViewsFor(target, [...listed.filter((item) => !item.builtin), view])
    if (target === collectionPath) {
      selectView(view)
      return
    }
    try {
      localStorage.setItem(activeViewStorageKey(target), view.id)
    } catch {
      /* ignore */
    }
    onOpenTable?.(target, view.id)
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
            columnWidths,
          },
    )
  }

  function patchActiveView(patch: Partial<SavedView>) {
    if (!activeViewId) return
    const current = views.find((view) => view.id === activeViewId)
    if (!current) return
    if (current.builtin) {
      persistViewDisplay(collectionPath, current.id, patch)
      persistViews(views)
      return
    }
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
    const current = views.find((view) => view.id === activeViewId)
    if (!current) return
    if (current.builtin) {
      persistViewDisplay(collectionPath, current.id, { columns: pinned })
      persistViews(views)
      return
    }
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
      setDlg({ kind: 'alert', title: `${action.label}失败`, body: String(err) })
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
        window.dispatchEvent(new Event('fsdb:change'))
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
        setDetailRow((prev) => (prev?.id === next.id ? { ...prev, ...next } : prev))
        window.dispatchEvent(new Event('fsdb:change'))
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
      const data = await readJson<{ items?: Array<{ value?: DbRecord }> }>('/api/db/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: dataPath, records: [{}] }),
      })
      quietUntil.current = 0
      await reload()
      const id = data.items?.[0]?.value?.id
      if (id) {
        setOpenDetailId(id)
        if (data.items?.[0]?.value) setDetailRow(data.items[0]!.value)
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
        body: JSON.stringify({ path: dataPath, ids: [row.id] }),
      })
      onCloseRecord?.()
      quietUntil.current = 0
      await reload()
    } catch (err) {
      setError(String(err))
    }
  }

  async function executeDeleteRecords(ids: string[]) {
    try {
      await readJson('/api/db/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: dataPath, ids }),
      })
      if (detailId && ids.includes(detailId)) onCloseRecord?.()
      setPickedIds([])
      quietUntil.current = 0
      await reload()
    } catch (err) {
      setError(String(err))
      quietUntil.current = 0
      await reload()
    }
  }

  function cellFieldWritable(field: FieldSpec) {
    const kind = resolveFieldType(field)
    return Boolean(field.writable) && kind !== 'file' && kind !== 'action'
  }

  function markCellOn(td: HTMLElement, writable: boolean) {
    const table = td.closest('table')
    table?.querySelectorAll('td.is-cell-on').forEach((node) => {
      if (node === td) return
      node.classList.remove('is-cell-on', 'is-cell-ro')
    })
    td.classList.add('is-cell-on')
    td.classList.toggle('is-cell-ro', !writable)
  }

  async function writeOne(row: DbRecord, key: string, field: FieldSpec, raw: string) {
    await writePatch(row, { [key]: parseFieldValue(field, raw) })
  }

  function writeCellValue(row: DbRecord, key: string, field: FieldSpec, next: unknown) {
    const flat = parseFacetFlatColumnKey(key)
    if (flat && schema) {
      const source = facetSourceKey(schema)
      void writePatch(row, { [source]: patchFacetFlatValue(row, key, next, source) })
      return
    }
    void writePatch(row, { [key]: next })
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
        viewId: routeViewId ?? activeViewId ?? undefined,
        viewName: activeView?.name,
        views: views.map((view) => ({ id: view.id, name: view.name, mode: view.mode })),
        recordId: selected?.id,
        recordLabel: selected ? crumbRecordLabel(selected, schema?.labelField) : undefined,
        records: items.map((row) => ({
          id: row.id,
          label: crumbRecordLabel(row, schema?.labelField),
          emoji: recordPreviewEmoji(row),
          mascot: recordPreviewMascot(row),
        })),
      }),
    [activeView?.name, activeViewId, collectionPath, items, routeViewId, schema?.labelField, selected, tables, title, views],
  )
  const currentTable = tables.find((item) => item.path === collectionPath)
  const recordKind = recordPickKind(currentTable?.view?.moduleId || currentTable?.id)
  const recordPick = (row: DbRecord) => pickDomAttrs(recordKind, row.id, labelOf(row))

  function renderCell(row: DbRecord, key: string, field: FieldSpec, surface: 'table' | 'detail' = 'detail') {
    const kind = resolveFieldType(field)
    const flat = parseFacetFlatColumnKey(key)
    if (surface === 'table') {
      if (kind === 'boolean') {
        const raw = flat ? readFacetFlatValue(row, key, facetSourceKey(schema)) : row[key]
        const on = raw === true || raw === 'true'
        if (field.writable) {
          return <BoolCell on={on} writable onToggle={() => writeCellValue(row, key, field, !on)} />
        }
        return <BoolCell on={on} />
      }
      if (kind === 'action') {
        const actionId = fieldActionId(key, field)
        const action = (schema?.actions ?? []).find((item) => item.id === actionId)
        return <ActionCell field={field} fieldKey={key} onRun={action ? () => void runAction(row, action) : undefined} />
      }
      if (kind === 'facet') return <SchemaChips value={row[key]} tags={loadFacets()} />
      if (flat) {
        return (
          <DefaultCell
            field={field}
            fieldKey={key}
            records={items}
            collectionPath={collectionPath}
            value={readFacetFlatValue(row, key, facetSourceKey(schema))}
            onChange={
              field.writable && (kind === 'attachment' || kind === 'datetime')
                ? (next) => writeCellValue(row, key, field, next)
                : undefined
            }
          />
        )
      }
      const Custom = chrome?.cells?.[key]
      if (Custom) return <Custom field={key} spec={field} value={row[key]} record={row} fallback={formatField(field, row[key])} />
      return (
        <DefaultCell
          field={field}
          fieldKey={key}
          records={items}
          collectionPath={collectionPath}
          value={row[key]}
          onChange={
            field.writable && (kind === 'attachment' || kind === 'datetime')
              ? (next) => writeCellValue(row, key, field, next)
              : undefined
          }
        />
      )
    }
    if (flat) {
      const source = facetSourceKey(schema)
      const value = readFacetFlatValue(row, key, source)
      if (field.writable && kind !== 'file') {
        return (
          <FieldValuePop
            record={row}
            fieldKey={key}
            field={field}
            value={value}
            collectionPath={collectionPath}
            options={uniqueValues(
              items.map((item) => ({ ...item, [key]: readFacetFlatValue(item, key, source) })),
              key,
              field,
            )}
            records={items}
            onSubmit={(next) => writeCellValue(row, key, field, next)}
          />
        )
      }
      return <DefaultCell field={field} fieldKey={key} records={items} collectionPath={collectionPath} value={value} />
    }
    if (kind === 'facet') {
      if (field.writable) {
        return (
          <SchemaFieldEditor
            collectionPath={collectionPath}
            record={row}
            value={row[key]}
            writable
            onChange={(next) => void writePatch(row, { [key]: next })}
          />
        )
      }
      return (
        <FieldValuePop
          record={row}
          fieldKey={key}
          field={field}
          value={row[key]}
          collectionPath={collectionPath}
          onSubmit={() => {}}
        />
      )
    }
    if (kind === 'action') {
      const actionId = fieldActionId(key, field)
      const action = (schema?.actions ?? []).find((item) => item.id === actionId)
      return (
        <ActionCell
          field={field}
          fieldKey={key}
          onRun={action ? () => void runAction(row, action) : undefined}
        />
      )
    }
    const Custom = chrome?.cells?.[key]
    const fallback = formatField(field, row[key])
    if (Custom) return <Custom field={key} spec={field} value={row[key]} record={row} fallback={fallback} />
    if (kind !== 'file') {
      return (
        <FieldValuePop
          record={row}
          fieldKey={key}
          field={field}
          value={row[key]}
          collectionPath={collectionPath}
          options={uniqueValues(items, key, field)}
          records={items}
          onSubmit={field.writable ? (next) => writeCellValue(row, key, field, next) : () => {}}
        />
      )
    }
    return <DefaultCell field={field} fieldKey={key} records={items} collectionPath={collectionPath} value={row[key]} />
  }

  function renderCellPop() {
    if (!cellPop || !schema) return null
    const row = items.find((item) => item.id === cellPop.id)
    const col = columns.find((item) => item.key === cellPop.key)
    if (!row || !col) return null
    const key = col.key
    const field = col.field
    const flat = parseFacetFlatColumnKey(key)
    const initial = flat ? readFacetFlatValue(row, key, facetSourceKey(schema)) : row[key]
    const options = flat
      ? uniqueValues(
          items.map((item) => ({ ...item, [key]: readFacetFlatValue(item, key, facetSourceKey(schema)) })),
          key,
          field,
        )
      : uniqueValues(items, key, field)
    return (
      <CellPop
        key={`${cellPop.id}:${cellPop.key}`}
        open
        className={`is-${resolveFieldType(field)}${isRecordLinkField(field, key) ? ' is-record-link' : ''}`}
        anchor={cellAnchorRef.current}
        onClose={() => setCellPop(null)}
      >
        <CellPopDraft
          record={row}
          fieldKey={key}
          field={field}
          initial={initial}
          options={options}
          collectionPath={collectionPath}
          onClose={() => setCellPop(null)}
          onSubmit={(raw) => writeCellValue(row, key, field, raw)}
        />
      </CellPop>
    )
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
    const body =
      key && field?.writable ? (
        renderCell(row, key, field, 'table')
      ) : chrome?.Title ? (
        <chrome.Title record={row} label={labelOf(row)} />
      ) : key && field ? (
        renderCell(row, key, field, 'table')
      ) : (
        <>{labelOf(row)}</>
      )
    const tree = openDetail && treeOn
    const host = (
      <span className="fsdb-title-host" style={tree ? { paddingLeft: depth * 16 } : undefined}>
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
        {openDetail ? (
          <TableRecordIcon row={row} />
        ) : (
          <RecordMark
            record={row}
            tableIcon={currentTable?.view?.icon}
            Icon={chrome?.Icon}
          />
        )}
        <span className="fsdb-title-text">{body}</span>
      </span>
    )
    return (
      <>
        {host}
        <span className="tasks-row-tools-slot">
          <RecordRowTools row={row} />
          <RecordOpenControls row={row} kidCount={tree ? kidCount : 0} />
        </span>
      </>
    )
  }

  function TableRecordIcon({ row }: { row: DbRecord }) {
    const emoji = recordPreviewEmoji(row)
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(emoji)
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    return (
      <span className="fsdb-table-record-icon">
        <button
          type="button"
          className="fsdb-table-emoji-btn"
          title={emoji ? '更换图标' : '设置图标'}
          aria-label={emoji ? `更换 ${labelOf(row)} 的图标` : `设置 ${labelOf(row)} 的图标`}
          onClick={(event) => {
            event.stopPropagation()
            const btn = event.currentTarget
            setOpen((prev) => {
              if (prev) {
                setAnchor(null)
                return false
              }
              setDraft(emoji)
              setAnchor(btn)
              return true
            })
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <RecordMark
            record={row}
            tableIcon={currentTable?.view?.icon}
            Icon={chrome?.Icon}
          />
        </button>
        {open && anchor ? (
          <RecordEmojiBoard
            anchor={anchor}
            draft={draft}
            onDraft={setDraft}
            onPick={(next) => {
              void writePatch(row, { emoji: normalizeRecordEmoji(next) })
              setOpen(false)
              setAnchor(null)
            }}
            onClear={() => {
              void writePatch(row, { emoji: '' })
              setOpen(false)
              setAnchor(null)
            }}
            onClose={() => {
              setOpen(false)
              setAnchor(null)
            }}
          />
        ) : null}
      </span>
    )
  }

  function RecordOpenControls({ row, kidCount = 0 }: { row: DbRecord; kidCount?: number }) {
    return (
      <span className="tasks-title-aside">
        {!nested ? (
          <button
            type="button"
            className="tasks-title-open"
            data-testid="record-title-split"
            aria-label="在右侧打开"
            title="在右侧打开"
            onClick={(event) => {
              event.stopPropagation()
              showRecordInInspector(collectionPath, row.id)
            }}
          >
            <ViewColumnsIcon aria-hidden className="size-[14px]" />
          </button>
        ) : null}
        <span className="tasks-title-zoom">
          {kidCount > 0 ? <ChatCount count={kidCount} className="tasks-tree-count" title={`${kidCount} 项`} /> : null}
          <button
            type="button"
            className="tasks-title-open"
            data-testid="record-title-open"
            data-biu-action="open"
            aria-label="查看详情"
            title="查看详情"
            onClick={(event) => {
              event.stopPropagation()
              openRow(row)
            }}
          >
            <ArrowsPointingOutIcon aria-hidden className="size-[14px]" />
          </button>
        </span>
      </span>
    )
  }

  function RecordRowTools({ row }: { row: DbRecord }) {
    return (
      <span className="tasks-row-tools">
        <RecordActions row={row} place="row" />
      </span>
    )
  }

  function RecordActions({ row, place }: { row: DbRecord; place: 'row' | 'detail' }) {
    const actions = visibleActions(schema, row, place)
    const [moreOpen, setMoreOpen] = useState(false)
    const moreRef = useRef<HTMLButtonElement>(null)
    if (!actions.length) return null
    const Action = chrome?.Action
    const shown = actions.filter((action) => action.id === 'open-split' || action.id === 'open-page')
    const overflow = actions.filter((action) => action.id !== 'open-split' && action.id !== 'open-page')
    const rowShown = actions.filter(
      (action) => Action || actionIcon(action.id) || action.id === 'open-split' || action.id === 'open-page',
    )
    const busy = Boolean(busyKey?.endsWith(`:${row.id}`))
    const renderOne = (action: CollectionActionInfo) => {
      const run = () => void runAction(row, action)
      if (Action) return <Action key={action.id} action={action} record={row} busy={busy} run={run} />
      const glyph = actionIcon(action.id)
      return (
        <button
          key={action.id}
          type="button"
          className={`tasks-icon-btn${action.tone === 'danger' ? ' is-danger' : ''}`}
          title={action.label}
          data-dock-tip={action.label}
          aria-label={`${action.label} ${labelOf(row)}`}
          disabled={busy}
          onClick={run}
        >
          {glyph ?? action.label}
        </button>
      )
    }
    if (place === 'row') {
      if (!rowShown.length) return null
      return (
        <div className="tasks-row-actions" data-biu-ignore onClick={(event) => event.stopPropagation()}>
          {rowShown.map(renderOne)}
        </div>
      )
    }
    return (
      <div className="tasks-row-actions" data-biu-ignore onClick={(event) => event.stopPropagation()}>
        {shown.map(renderOne)}
        {overflow.length ? (
          <>
            <button
              ref={moreRef}
              type="button"
              className="tasks-icon-btn"
              title="更多"
              data-dock-tip="更多"
              aria-label="更多操作"
              aria-expanded={moreOpen}
              disabled={busy}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <EllipsisHorizontalIcon aria-hidden className="size-[14px]" />
            </button>
            {moreOpen ? (
              <DbMenu anchor={moreRef.current} onClose={() => setMoreOpen(false)}>
                {overflow.map((action) => (
                  <DbSearchOption
                    key={action.id}
                    onClick={() => {
                      setMoreOpen(false)
                      void runAction(row, action)
                    }}
                  >
                    {actionIcon(action.id)}
                    {action.label}
                  </DbSearchOption>
                ))}
              </DbMenu>
            ) : null}
          </>
        ) : null}
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

  function togglePicked(ids: string[], on: boolean) {
    setPickedIds((prev) => {
      if (on) {
        const next = new Set(prev)
        for (const id of ids) next.add(id)
        return [...next]
      }
      return prev.filter((id) => !ids.includes(id))
    })
  }

  function RowCheck({ id, ids }: { id?: string; ids?: string[] }) {
    if (!canDelete) return null
    const list = id ? [id] : (ids ?? [])
    const on = list.length > 0 && list.every((item) => pickedIds.includes(item))
    return (
      <button
        type="button"
        className={`fsdb-boolbtn fsdb-row-check${on ? ' is-on' : ''}`}
        aria-pressed={on}
        aria-label={id ? (on ? '取消选择记录' : '选择记录') : on ? '取消全选' : '全选'}
        title={id ? (on ? '取消选择' : '选择') : on ? '取消全选' : '全选'}
        onClick={(event) => {
          event.stopPropagation()
          togglePicked(list, !on)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <BoolBox on={on}>{on ? <CheckIcon aria-hidden className="size-3" /> : null}</BoolBox>
      </button>
    )
  }

  function tableBodyRows(rows: DbRecord[], keyPrefix = '') {
    const listed = flattenRows(rows)
    const span = tableColSpan
    const cellPick = cellPickRef.current
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
            {columns.map((col, index) => (
              <td
                key={col.key}
                style={colWidthStyle(columnWidths[col.key])}
                className={
                  cellPick?.id === row.id && cellPick.key === col.key
                    ? cellFieldWritable(col.field)
                      ? 'is-cell-on'
                      : 'is-cell-on is-cell-ro'
                    : undefined
                }
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  const hit = event.target as HTMLElement | null
                  if (hit?.closest(CELL_POP_IGNORE)) return
                  const td = event.currentTarget
                  cellAnchorRef.current = td
                  cellPickRef.current = { id: row.id, key: col.key }
                  markCellOn(td, cellFieldWritable(col.field))
                  cellPopPtrRef.current = { x: event.clientX, y: event.clientY, dragged: false }
                }}
                onPointerMove={(event) => {
                  const start = cellPopPtrRef.current
                  if (!start || start.dragged) return
                  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < CELL_POP_DRAG_PX) return
                  start.dragged = true
                  setCellPop(null)
                }}
                onClick={(event) => {
                  const hit = event.target as HTMLElement | null
                  if (hit?.closest(CELL_POP_IGNORE)) return
                  const start = cellPopPtrRef.current
                  cellPopPtrRef.current = null
                  if (start?.dragged) return
                  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= CELL_POP_DRAG_PX) return
                  const kind = resolveFieldType(col.field)
                  setCellPop(cellUsesPop(kind, col.field.writable) ? { id: row.id, key: col.key } : null)
                }}
              >
                {index === 0 ? <RowCheck id={row.id} /> : null}
                {col.key === schema?.labelField ? (
                  <RecordTitle row={row} depth={depth} hasKids={hasKids} kidCount={kidCount} />
                ) : (
                  <span className="fsdb-cell">{renderCell(row, col.key, col.field, 'table')}</span>
                )}
              </td>
            ))}
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
    const listedViewsNow = listedViews(collectionPath, loadViews(collectionPath)).map((view) =>
      withViewDisplay(collectionPath, view),
    )
    rememberViews(collectionPath, listedViewsNow)
    viewsRef.current = listedViewsNow
    setViews(listedViewsNow)
    const listed = viewsRef.current
    const view =
      listed.find((item) => item.id === routeViewId) ??
      listed.find((item) => item.id === loadActiveViewId(collectionPath, listed)) ??
      listed[0]
    if (view) applyView(view)
    setHydrated(true)
  }, [allColumnKeys, collectionPath, dataPath, schema, schemaDefaultKeys])

  useEffect(() => {
    if (sheet || !hydrated || !activeViewId) return
    const id = window.setTimeout(() => {
      if (hydratePath.current !== `${collectionPath}\0${dataPath}`) return
      const current = viewsRef.current.find((view) => view.id === activeViewId)
      if (!current) return
      const next = normalizeSavedView({
        ...current,
        mode,
        sortField,
        sortDir,
        filters: current.builtin ? current.filters : filters,
        columns: pinLabelColumn(schema, columnKeys),
        groupBy,
        tree: showTree,
        wrap: wrapCells,
        truncate: truncateCells,
        query,
        pageSize,
        columnWidths,
      })
      if (viewStateKey(current) === viewStateKey(next)) return
      if (current.builtin) {
        persistViewDisplay(collectionPath, current.id, next)
        persistViews(viewsRef.current)
        return
      }
      persistViews(viewsRef.current.map((view) => (view.id === activeViewId ? next : view)))
    }, 400)
    return () => window.clearTimeout(id)
  }, [
    activeViewId,
    collectionPath,
    columnKeys,
    columnWidths,
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
    sheet,
  ])

  return (
    <div
      className={`fsdb-page tasks-root${nested ? ' inspector-database-page' : ''}${sheet ? ' is-sheet' : ''}${!sheet && pageWidth === 'full' ? ' is-full-width' : ''}`}
      data-testid={embed ? 'inspector-database' : sheet ? 'fsdb-collect-sheet' : undefined}
    >
      {!nested ? (
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
          onOpenRecord={(path, view, recordId, row) => {
            if (path === collectionPath) {
              applyView(view)
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
        {nested ? null : (
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
              canCreateView
              canCreateRecord={canCreate}
              onCreate={(kind) => {
                if (kind === 'record') void createRecord()
                else addEmptyView()
              }}
              onPick={(target) => {
                if (target.kind === 'view' && target.collection === collectionPath) {
                  const view = views.find((item) => item.id === target.viewId)
                  if (view) selectView(view)
                  return
                }
                onCrumbTarget?.(target)
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
            <div className="fsdb-layout-wrap" ref={layoutRef}>
              <button
                type="button"
                className={`chat-view-header-expand${layoutOpen ? ' is-active' : ''}`}
                title="配置"
                aria-label="配置"
                aria-haspopup="menu"
                aria-expanded={layoutOpen}
                data-testid="fsdb-layout-toggle"
                onClick={() => toggleMenu('layout')}
              >
                <AdjustmentsHorizontalIcon aria-hidden className="size-4" />
              </button>
              {layoutOpen ? (
                <HeadlessDismiss onDismiss={() => setLayoutOpen(false)} insideRef={layoutRef}>
                <div className="fsdb-layout-menu" role="menu" data-testid="fsdb-layout-menu">
                  <button
                    type="button"
                    role="menuitemradio"
                    className={`fsdb-layout-opt${pageWidth === 'max' ? ' is-active' : ''}`}
                    title="最大宽度"
                    aria-label="最大宽度"
                    aria-checked={pageWidth === 'max'}
                    data-testid="fsdb-layout-max"
                    onClick={() => persistPageWidth('max')}
                  >
                    <ArrowsPointingInIcon aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    className={`fsdb-layout-opt${pageWidth === 'full' ? ' is-active' : ''}`}
                    title="全宽"
                    aria-label="全宽"
                    aria-checked={pageWidth === 'full'}
                    data-testid="fsdb-layout-full"
                    onClick={() => persistPageWidth('full')}
                  >
                    <ArrowsPointingOutIcon aria-hidden className="size-4" />
                  </button>
                </div>
                </HeadlessDismiss>
              ) : null}
            </div>
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
        <div
          key={nested ? 'embed' : `${collectionPath}:${detailId ?? ''}`}
          className="app-pane-in"
        >
        {!detailId ? (
        <div className="tasks-main fsdb-main">
        {sheet ? null : (
        <div className="fsdb-detail-title-row">
          <span className="fsdb-detail-title-icon" aria-hidden>
            <TableGlyph icon={currentTable?.view?.icon} className="size-8" />
          </span>
          <h1 className="fsdb-detail-title">{activeView?.name ?? title}</h1>
        </div>
        )}
        <div className="tasks-toolbar" ref={toolbarRef} data-biu-ignore>
          <div className="tasks-toolbar-left">
            {sheet ? null : (
            <div className="tasks-viewdd-wrap" ref={viewRef}>
              <div className="tasks-viewtabs-measure" ref={viewMeasureRef} aria-hidden>
                {views.map((view) => (
                  <button key={view.id} type="button" className="tasks-viewdd-btn tasks-viewtab" tabIndex={-1} data-view-measure={view.id}>
                    <ViewModeGlyph mode={view.mode} className="size-[14px]" />
                    <span className="tasks-viewdd-name">{view.name}</span>
                  </button>
                ))}
              </div>
              <div className="tasks-viewtabs">
                {(views.length ? splitVisibleViews(views, viewTabFit, activeViewId).shown : []).map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    className={`tasks-viewdd-btn tasks-viewtab${view.id === activeViewId ? ' is-active' : ''}${view.id === activeViewId && viewMenuOpen ? ' is-menu' : ''}`}
                    data-testid="fsdb-view-tab"
                    aria-pressed={view.id === activeViewId}
                    aria-haspopup={view.id === activeViewId ? 'menu' : undefined}
                    aria-expanded={view.id === activeViewId ? viewMenuOpen : undefined}
                    onClick={() => {
                      if (view.id === activeViewId) toggleMenu('view')
                      else selectView(view)
                    }}
                  >
                    <ViewModeGlyph mode={view.mode} className="size-[14px]" />
                    <span className="tasks-viewdd-name">{view.name}</span>
                  </button>
                ))}
                {!views.length ? (
                  <button
                    type="button"
                    className={`tasks-viewdd-btn tasks-viewtab is-active${viewMenuOpen ? ' is-menu' : ''}`}
                    aria-haspopup="menu"
                    aria-expanded={viewMenuOpen}
                    data-testid="fsdb-view-tab"
                    onClick={() => toggleMenu('view')}
                  >
                    <Squares2X2Icon aria-hidden className="size-[14px]" />
                    <span className="tasks-viewdd-name">未保存</span>
                  </button>
                ) : null}
              </div>
              {viewMenuOpen ? (
                <HeadlessDismiss onDismiss={() => setViewMenuOpen(false)} insideRef={viewRef}>
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
                          <TrashGlyph aria-hidden className="size-[14px]" />
                        </button>
                      </span>
                      )}
                    </div>
                  ))}
                  <div className="tasks-viewdd-foot">
                    <button type="button" className="tasks-viewdd-saveas" onClick={() => addEmptyView()}>
                      <PlusIcon aria-hidden className="size-[14px]" />
                      添加视图
                    </button>
                    <button type="button" className="tasks-viewdd-saveas" onClick={() => copyView()}>
                      <Square2StackIcon aria-hidden className="size-[14px]" />
                      拷贝视图
                    </button>
                  </div>
                </div>
                </HeadlessDismiss>
              ) : null}
            </div>
            )}
            {lockedSource ? (
              <span className="fsdb-locked-filter" title="按当前数据类型筛选，不可更改">
                {tables.find((item) => item.path === lockedSource)?.view?.title ??
                  tables.find((item) => item.path === lockedSource)?.label ??
                  lockedSource}
              </span>
            ) : null}
          </div>
          <div className="tasks-toolbar-right" ref={toolbarRightRef}>
            <HeadlessDismiss
              enabled={searchExpanded}
              onDismiss={() => {
                if (!query) setSearchOpen(false)
              }}
              onEscapeKeyDown={(event) => {
                if (query) event.preventDefault()
              }}
            >
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
            </HeadlessDismiss>
            <div className="tasks-sort-wrap" ref={modeRef}>
              <button
                type="button"
                className={`tasks-sort-btn${modeMenuOpen ? ' is-active' : ''}`}
                aria-label="查看模式"
                title={`模式：${modeChoices.find((item) => item.id === mode)?.label ?? mode}`}
                onClick={() => toggleMenu('mode')}
              >
                <ModeGlyph id={mode} extra={extraViews} />
              </button>
              {modeMenuOpen ? (
                <HeadlessDismiss onDismiss={() => setModeMenuOpen(false)} insideRef={modeRef}>
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">查看模式</div>
                  {modeChoices.map((opt) => (
                    <CheckRow
                      key={opt.id}
                      icon={<ModeGlyph id={opt.id} extra={extraViews} />}
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
                </HeadlessDismiss>
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
                <HeadlessDismiss onDismiss={() => setSortMenuOpen(false)} insideRef={sortRef}>
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
                </HeadlessDismiss>
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
                <HeadlessDismiss onDismiss={() => setGroupOpen(false)} insideRef={groupRef}>
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
                </HeadlessDismiss>
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
                <HeadlessDismiss onDismiss={() => setColumnMenuOpen(false)} insideRef={columnRef}>
                <div className="tasks-sort-menu fsdb-col-menu" role="menu">
                  <div className="tasks-sort-head">可见列</div>
                  <div className="fsdb-col-menu-list">
                  {allColumns.map((item) => {
                    const on = columns.some((col) => col.key === item.key)
                    const flat = parseFacetFlatColumnKey(item.key)
                    const packLabel = 'packLabel' in item ? String(item.packLabel ?? '') : ''
                    const tone = flat ? schemaTagTone(flat.packId) : undefined
                    return (
                      <CheckRow
                        key={item.key}
                        icon={<FieldGlyph kind={item.kind} />}
                        label={
                          flat ? (
                            <span style={tone ? { color: tone } : undefined}>
                              {packLabel ? `${packLabel} · ${item.field.label ?? item.key}` : (item.field.label ?? item.key)}
                            </span>
                          ) : (
                            item.field.label ?? item.key
                          )
                        }
                        on={on}
                        locked={item.key === schema?.labelField}
                        onToggle={() => toggleColumn(item.key)}
                      />
                    )
                  })}
                  </div>
                </div>
                </HeadlessDismiss>
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
                <HeadlessDismiss onDismiss={() => setFilterOpen(false)} insideRef={filterRef}>
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
                        : item.kind === 'facet'
                          ? uniqueValues(items, item.key, item.field).map((option) => ({
                              value: option,
                              label: loadFacets().find((tag) => tag.id === option)?.label ?? option,
                            }))
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
                          chips={item.kind === 'select' || item.kind === 'multi-select' || item.kind === 'facet'}
                          options={options}
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
                </HeadlessDismiss>
              ) : null}
            </div>
            )}
            {mode === 'table' ? (
            <div className="tasks-filter-btn-wrap" ref={configRef}>
              <button
                type="button"
                className={`tasks-refresh tasks-rbar-btn${configOpen || wrapCells || !truncateCells || (treeable && !showTree) ? ' is-active' : ''}`}
                aria-label="表格配置"
                title="表格配置"
                onClick={() => toggleMenu('config')}
              >
                <AdjustmentsHorizontalIcon aria-hidden className="size-[14px]" />
                {wrapCells || !truncateCells || (treeable && !showTree) ? (
                  <span className="tasks-filter-dot" aria-hidden />
                ) : null}
              </button>
              {configOpen ? (
                <HeadlessDismiss onDismiss={() => setConfigOpen(false)} insideRef={configRef}>
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
                  {treeable ? (
                    <CheckRow
                      icon={<ChevronRightIcon aria-hidden className="size-[14px]" />}
                      label="树形展示"
                      on={showTree}
                      onToggle={() => setTree(!showTree)}
                    />
                  ) : null}
                </div>
                </HeadlessDismiss>
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
            {canDelete && pickedIds.length ? (
                <button
                  type="button"
                  className="tasks-icon-btn is-danger"
                  data-testid="fsdb-bulk-delete"
                  aria-label="删除选中"
                  title={`删除选中的 ${pickedIds.length} 条`}
                  onClick={() => setDlg({ kind: 'delete-records', ids: pickedIds })}
                >
                  <TrashGlyph aria-hidden className="size-[14px]" />
                </button>
              ) : null}
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
            {customView ? (
              <customView.View path={dataPath} rows={items} schema={schema} onOpen={openRow} />
            ) : null}
            {!customView ? (
              <div className="tasks-table-wrap">
                <table
                  className={`tasks-table${wrapCells ? ' is-wrap' : ''}${truncateCells ? ' is-truncate' : ''}${hasColWidths ? ' is-cols-fixed' : ''}${resizingCol ? ' is-col-resize' : ''}`}
                  style={tableWidthStyle(columnWidths, columns.map((col) => col.key))}
                >
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={colWidthStyle(columnWidths[col.key])} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col, index) => {
                  const flat = parseFacetFlatColumnKey(col.key)
                  const tone = flat ? schemaTagTone(flat.packId) : undefined
                  return (
                  <th key={col.key} style={colWidthStyle(columnWidths[col.key])}>
                    {index === 0 ? <RowCheck ids={pickableIds} /> : null}
                    <span className="tasks-th" style={tone ? { color: tone } : undefined}>
                      <FieldGlyph kind={col.kind} />
                      {col.field.label ?? col.key}
                    </span>
                    <span
                      className={`fsdb-col-resizer${resizingCol === col.key ? ' is-active' : ''}`}
                      data-testid="fsdb-col-resizer"
                      onPointerDown={(event) => startColResize(event, col.key)}
                    />
                  </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
                    {grouping ? (
                      grouped.length ? (
                        grouped.map((group) => (
                          <Fragment key={group.key || 'unset'}>
                            <tr className="fsdb-group-row">
                              <td colSpan={tableColSpan}>
                                <GroupHead groupKey={group.key || 'unset'} label={group.label} count={group.rows.length} />
                              </td>
                            </tr>
                            {collapsedGroups[group.key || 'unset'] ? null : tableBodyRows(group.rows, `${group.key}:`)}
                          </Fragment>
                        ))
                      ) : (
                        tableBodyRows([])
                      )
                    ) : (
                      tableBodyRows(visible)
                    )}
            </tbody>
          </table>
        </div>
            ) : null}
          </div>
          <div className="fsdb-pager" data-biu-ignore>
            <span className="fsdb-pager-meta" title={total ? `共 ${total} 条` : '暂无记录'}>
              <HashtagIcon aria-hidden className="size-[14px]" />
              <span>{total}</span>
            </span>
            <div className="fsdb-pager-nav">
              <PagerSizeControl pageSize={pageSize} onChange={setPageSize} />
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
          detailBody={detailBody}
          labelOf={labelOf}
          renderCell={renderCell}
          setDraft={setDraft}
          writeOne={writeOne}
          writePatch={writePatch}
          tableIcon={currentTable?.view?.icon}
          onOpenRecord={(recordId, collection) => onOpenRecord?.(recordId, activeViewId, collection)}
          onPrev={total > 1 ? () => void stepViewRecord(-1) : undefined}
          onNext={total > 1 ? () => void stepViewRecord(1) : undefined}
          canPrev={viewIndex == null ? total > 1 : viewIndex > 0}
          canNext={viewIndex == null ? total > 1 : viewIndex < total - 1}
        />
      ) : null}
        </div>
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
      {dlg?.kind === 'delete-records' ? (
        <AppDialog
          title="删除记录"
          confirm="删除"
          danger
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            const { ids } = dlg
            setDlg(null)
            void executeDeleteRecords(ids)
          }}
          body={<p>确定删除选中的 {dlg.ids.length} 条记录？删除后不可恢复。</p>}
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
      {dlg?.kind === 'alert' ? (
        <AppDialog
          title={dlg.title}
          confirm="知道了"
          hideCancel
          onCancel={() => setDlg(null)}
          onConfirm={() => setDlg(null)}
          body={<p>{dlg.body}</p>}
        />
      ) : null}
      {renderCellPop()}
    </div>
  )
}
