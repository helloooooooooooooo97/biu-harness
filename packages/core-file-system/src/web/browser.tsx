import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowsPointingOutIcon,
  ArrowsUpDownIcon,
  AdjustmentsHorizontalIcon,
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  FunnelIcon,
  HashtagIcon,
  LinkIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PlayIcon,
  PhotoIcon,
  PlusIcon,
  RectangleStackIcon,
  Square2StackIcon,
  Squares2X2Icon,
  StopIcon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import type { CollectionActionInfo, CollectionInfo, CollectionSchema, DbRecord, FieldSpec, FieldType } from '@biu/type-file-system'
import { asAttachment, asHttpHref, asImageSrc } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import {
  asStringList,
  asTime,
  contentFieldKey,
  defaultColumnKeys,
  pinLabelColumn,
  fieldEntries,
  flattenTree,
  formatField,
  groupField,
  groupRecords,
  groupableFields,
  matchActionWhen,
  parentFieldKey,
  resolveFieldType,
  uniqueValues,
  type ViewMode,
} from './fields'
import { AppDialog, CellSelect, CheckRow, LocalText, TokenMultiSelect } from './controls.tsx'
import { DataSidebar } from './data-sidebar.tsx'
import { normalizeSavedView, normalizePageSize, PAGE_SIZES, viewStateKey, type SavedView } from './saved-view.ts'
import {
  activeViewStorageKey,
  loadActiveViewId,
  loadViews,
  viewsKey,
} from './view-storage.ts'

type ListResult = { items: Array<DbRecord & { path?: string }>; total?: number; offset?: number; limit?: number }
type StatResult = { schema?: CollectionSchema }

function actionIcon(id: string) {
  const cls = 'size-[14px]'
  if (id === 'start' || id === 'play' || id === 'run' || id === 'open') return <PlayIcon aria-hidden className={cls} />
  if (id === 'stop' || id === 'close' || id === 'pause') return <StopIcon aria-hidden className={cls} />
  if (id === 'uninstall' || id === 'delete' || id === 'remove') return <TrashIcon aria-hidden className={cls} />
  if (id === 'edit' || id === 'rename') return <PencilSquareIcon aria-hidden className={cls} />
  if (id === 'refresh') return <ArrowPathIcon aria-hidden className={cls} />
  return null
}

function ModeGlyph({ id }: { id: ViewMode }) {
  const cls = 'size-[14px]'
  if (id === 'queue') return <ListBulletIcon aria-hidden className={cls} />
  if (id === 'table') return <TableCellsIcon aria-hidden className={cls} />
  if (id === 'cards') return <Squares2X2Icon aria-hidden className={cls} />
  return <ViewColumnsIcon aria-hidden className={cls} />
}

const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'queue', label: '列表' },
  { id: 'table', label: '表格' },
  { id: 'cards', label: '卡片' },
  { id: 'board', label: '看板' },
]

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body
}

function recordsFingerprint(rows: Array<DbRecord & { path?: string }>) {
  return rows.map((row) => `${row.id}:${String(row.updatedAt ?? '')}`).join('|')
}

function draftFromRecord(schema: CollectionSchema, row: DbRecord, bodyKey: string | undefined, detailBody: unknown) {
  const next: Record<string, string> = {}
  for (const [key, field] of Object.entries(schema.fields)) {
    const value = key === bodyKey ? detailBody : row[key]
    const kind = resolveFieldType(field)
    if (kind === 'multi-select') next[key] = asStringList(value).join(', ')
    else if (kind === 'boolean') next[key] = value === true || value === 'true' ? 'true' : 'false'
    else if (kind === 'url') next[key] = asHttpHref(value)
    else if (kind === 'image') next[key] = asImageSrc(value)
    else if (kind === 'attachment') next[key] = asAttachment(value)?.href ?? ''
    else if (kind === 'file') {
      if (value == null || value === '') next[key] = ''
      else if (typeof value === 'string') next[key] = value
      else next[key] = JSON.stringify(value, null, 2)
    }
    else if (value == null) next[key] = ''
    else next[key] = String(value)
  }
  return next
}

function viewForPath(collectionPath: string): SavedView | null {
  const listed = loadViews(collectionPath)
  const view = listed.find((item) => item.id === loadActiveViewId(collectionPath, listed)) ?? listed[0]
  return view ? normalizeSavedView(view) : null
}

function isListColumn(key: string) {
  return key !== 'description' && key !== 'notes' && key !== 'content'
}

function toDatetimeLocal(value: unknown) {
  const n = asTime(value)
  if (!n) return ''
  const d = new Date(n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string) {
  if (!value) return ''
  const n = new Date(value).getTime()
  return Number.isFinite(n) ? String(n) : ''
}

function FieldGlyph({ kind }: { kind: FieldType }) {
  const cls = 'size-[14px] shrink-0 opacity-80'
  if (kind === 'boolean') return <ClipboardDocumentListIcon aria-hidden className={cls} />
  if (kind === 'select') return <ListBulletIcon aria-hidden className={cls} />
  if (kind === 'multi-select') return <RectangleStackIcon aria-hidden className={cls} />
  if (kind === 'datetime') return <CalendarDaysIcon aria-hidden className={cls} />
  if (kind === 'bytes') return <CircleStackIcon aria-hidden className={cls} />
  if (kind === 'number') return <HashtagIcon aria-hidden className={cls} />
  if (kind === 'url') return <LinkIcon aria-hidden className={cls} />
  if (kind === 'image') return <PhotoIcon aria-hidden className={cls} />
  if (kind === 'attachment') return <PaperClipIcon aria-hidden className={cls} />
  if (kind === 'file') return <DocumentTextIcon aria-hidden className={cls} />
  return <Bars3BottomLeftIcon aria-hidden className={cls} />
}

function boolOn(value: unknown) {
  return value === true || value === 'true'
}

function BoolCell({
  on,
  writable,
  onToggle,
}: {
  on: boolean
  writable?: boolean
  onToggle?: () => void
}) {
  const mark = (
    <span className={`fsdb-boolbox${on ? ' is-on' : ''}${writable ? '' : ' is-locked'}`}>
      {on ? <CheckIcon aria-hidden className="size-3" /> : null}
    </span>
  )
  if (!writable || !onToggle) {
    return (
      <span className="fsdb-bool" title={on ? '是' : '否'}>
        {mark}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="fsdb-boolbtn"
      aria-pressed={on}
      aria-label={on ? '是' : '否'}
      title={on ? '是，点击改为否' : '否，点击改为是'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {mark}
    </button>
  )
}

function ImageThumb({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        className="fsdb-thumb-btn"
        title="查看大图"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <img className="fsdb-thumb" src={src} alt="" decoding="async" />
      </button>
      {open
        ? createPortal(
            <div
              className="fsdb-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="查看图片"
              onMouseDown={(event) => {
                event.stopPropagation()
                if (event.target === event.currentTarget) setOpen(false)
              }}
            >
              <img src={src} alt="" decoding="async" onClick={(event) => event.stopPropagation()} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function parseFieldValue(field: FieldSpec, raw: string): unknown {
  const kind = resolveFieldType(field)
  if (kind === 'boolean') return raw === 'true'
  if (kind === 'number' || kind === 'datetime' || kind === 'bytes') return raw === '' ? null : Number(raw)
  if (kind === 'multi-select') return asStringList(raw)
  if (kind === 'file') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return raw
      }
    }
    return raw
  }
  return raw
}

function FilePreview({ value, compact = false }: { value: unknown; compact?: boolean }) {
  if (value == null || value === '') return <span className="fsdb-muted">—</span>
  const src = asImageSrc(value)
  if (src) {
    if (compact) return <ImageThumb src={src} />
    return <img className="fsdb-fileview-img" src={src} alt="" decoding="async" />
  }
  const file = asAttachment(value)
  if (file) {
    return (
      <a className="fsdb-file" href={file.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        <PaperClipIcon aria-hidden className="size-[14px] shrink-0" />
        <span className="fsdb-file-name">{file.name}</span>
      </a>
    )
  }
  const href = asHttpHref(value)
  if (href && typeof value !== 'object') {
    return (
      <a className="fsdb-link" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        {href}
      </a>
    )
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, compact ? 0 : 2)
  if (compact) return <span className="fsdb-meta">{text.length > 80 ? `${text.slice(0, 80)}…` : text}</span>
  return <pre className="fsdb-fileview-pre">{text || '—'}</pre>
}

function DefaultCell({ field, value }: { field: FieldSpec; value: unknown }) {
  const kind = resolveFieldType(field)
  if (kind === 'select') {
    const text = String(value ?? '')
    if (!text) return <span className="fsdb-muted">—</span>
    return (
      <span className="fsdb-tag">
        {text}
      </span>
    )
  }
  if (kind === 'multi-select') {
    const tags = asStringList(value)
    if (!tags.length) return <span className="fsdb-muted">—</span>
    return (
      <span className="fsdb-tags">
        {tags.map((tag) => (
          <span key={tag} className="fsdb-tag">
            {tag}
          </span>
        ))}
      </span>
    )
  }
  if (kind === 'url') {
    const href = asHttpHref(value)
    if (!href) return <span className="fsdb-muted">—</span>
    return (
      <a className="fsdb-link" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        {href}
      </a>
    )
  }
  if (kind === 'image') {
    const src = asImageSrc(value)
    if (!src) return <span className="fsdb-muted">—</span>
    return <ImageThumb src={src} />
  }
  if (kind === 'attachment') {
    const file = asAttachment(value)
    if (!file) return <span className="fsdb-muted">—</span>
    return (
      <a className="fsdb-file" href={file.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        <PaperClipIcon aria-hidden className="size-[14px] shrink-0" />
        <span className="fsdb-file-name">{file.name}</span>
      </a>
    )
  }
  if (kind === 'file') return <FilePreview value={value} compact />
  const text = formatField(field, value)
  return <span className={kind === 'datetime' || kind === 'bytes' ? 'fsdb-meta' : undefined}>{text}</span>
}

function FieldEditor({
  fieldKey,
  field,
  value,
  onChange,
  options,
}: {
  fieldKey: string
  field: FieldSpec
  value: string
  onChange: (next: string) => void
  options?: string[]
}) {
  const kind = resolveFieldType(field)
  if (kind === 'select' && field.enum) {
    return (
      <CellSelect
        value={value}
        options={field.enum.map((item) => ({ value: item, label: item }))}
        onSelect={onChange}
      />
    )
  }
  if (kind === 'boolean') {
    return <BoolCell on={value === 'true'} writable onToggle={() => onChange(value === 'true' ? 'false' : 'true')} />
  }
  if (kind === 'datetime') {
    return (
      <LocalText
        className="fsdb-plain-input"
        value={toDatetimeLocal(value)}
        placeholder="YYYY-MM-DDTHH:mm"
        onCommit={(next) => onChange(fromDatetimeLocal(next))}
      />
    )
  }
  if (kind === 'multi-select') {
    return (
      <TokenMultiSelect
        values={asStringList(value)}
        options={[...(field.enum ?? []), ...(options ?? [])].filter((item, index, list) => list.indexOf(item) === index)}
        onChange={(next) => onChange(next.join(', '))}
      />
    )
  }
  if (kind === 'url' || kind === 'image' || kind === 'attachment') {
    return (
      <LocalText
        className="fsdb-plain-input"
        value={value}
        placeholder={kind === 'image' ? 'https://…、/cover.png 或 data:image' : 'https://'}
        onCommit={onChange}
      />
    )
  }
  return <LocalText className="fsdb-plain-input" value={value} title={value} placeholder={fieldKey} onCommit={onChange} />
}

function visibleActions(schema: CollectionSchema | undefined, row: DbRecord, place: 'row' | 'detail') {
  return (schema?.actions ?? []).filter((action) => {
    const places = action.placement ?? ['row', 'detail']
    return places.includes(place) && matchActionWhen(row, action.when)
  })
}

export function CollectionBrowser({
  moduleId,
  collectionPath,
  title,
  blurb,
  chrome,
  tables = [],
  onOpenTable,
}: {
  moduleId?: string
  collectionPath: string
  title: string
  blurb: string
  chrome?: CollectionChrome
  tables?: CollectionInfo[]
  onOpenTable?: (path: string) => void
}) {
  const [stat, setStat] = useState<StatResult | null>(null)
  const [items, setItems] = useState<Array<DbRecord & { path?: string }>>([])
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailBody, setDetailBody] = useState<unknown>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const initialView = viewForPath(collectionPath)
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
  const [views, setViews] = useState<SavedView[]>(() => loadViews(collectionPath))
  const [activeViewId, setActiveViewId] = useState<string | null>(initialView?.id ?? null)
  const [hydrated, setHydrated] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(() => {
    try {
      return localStorage.getItem(`fsdb.viewsOpen:${moduleId || collectionPath}`) !== '0'
    } catch {
      return true
    }
  })
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [wrapCells, setWrapCells] = useState(!!initialView?.wrap)
  const [truncateCells, setTruncateCells] = useState(initialView?.truncate !== false)
  const [groupBy, setGroupBy] = useState(initialView?.groupBy ?? '')
  const [showTree, setShowTree] = useState(initialView?.tree !== false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
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
    | null
  >(null)
  const [dlgError, setDlgError] = useState('')
  const viewRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const configRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchExpanded = searchOpen || query.length > 0

  useEffect(() => {
    function onToggle(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id
      if (!id || (moduleId && id !== moduleId)) return
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
    window.addEventListener('biu:toggle-module-sidebar', onToggle)
    return () => window.removeEventListener('biu:toggle-module-sidebar', onToggle)
  }, [collectionPath, moduleId])

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!searchRef.current?.contains(target) && !query) setSearchOpen(false)
      if (
        viewRef.current?.contains(target) ||
        modeRef.current?.contains(target) ||
        sortRef.current?.contains(target) ||
        columnRef.current?.contains(target) ||
        filterRef.current?.contains(target) ||
        configRef.current?.contains(target) ||
        groupRef.current?.contains(target)
      ) {
        return
      }
      setViewMenuOpen(false)
      setModeMenuOpen(false)
      setSortMenuOpen(false)
      setColumnMenuOpen(false)
      setFilterOpen(false)
      setConfigOpen(false)
      setGroupOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [query])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function toggleMenu(which: 'view' | 'mode' | 'sort' | 'columns' | 'filter' | 'config' | 'group') {
    setViewMenuOpen(which === 'view' && !viewMenuOpen)
    setModeMenuOpen(which === 'mode' && !modeMenuOpen)
    setSortMenuOpen(which === 'sort' && !sortMenuOpen)
    setColumnMenuOpen(which === 'columns' && !columnMenuOpen)
    setFilterOpen(which === 'filter' && !filterOpen)
    setConfigOpen(which === 'config' && !configOpen)
    setGroupOpen(which === 'group' && !groupOpen)
  }

  const reload = useCallback(async () => {
    if (Date.now() < quietUntil.current) return true
    const gen = ++reloadGen.current
    try {
      const params = new URLSearchParams({
        path: collectionPath,
        limit: String(pageSize),
        offset: String(page * pageSize),
        q: fetchQuery,
        sort: sortField,
        dir: sortDir,
        filter: JSON.stringify(filters),
      })
      const [nextStat, listed] = await Promise.all([
        readJson<StatResult>(`/api/db/stat?path=${encodeURIComponent(collectionPath)}`),
        readJson<ListResult>(`/api/db/list?${params}`),
      ])
      if (gen !== reloadGen.current) return true
      setStat((prev) => (prev?.schema && JSON.stringify(prev.schema) === JSON.stringify(nextStat.schema) ? prev : nextStat))
      setItems((prev) => (recordsFingerprint(prev) === recordsFingerprint(listed.items) ? prev : listed.items))
      setTotal(typeof listed.total === 'number' ? listed.total : listed.items.length)
      setError('')
      return true
    } catch (err) {
      if (gen !== reloadGen.current) return false
      setError(String(err))
      return false
    }
  }, [collectionPath, fetchQuery, filters, page, pageSize, sortDir, sortField])
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
  }, [fetchQuery, filters, sortField, sortDir, pageSize, collectionPath])

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
    const stored = viewForPath(collectionPath)
    if (stored) {
      setViews(loadViews(collectionPath))
      setActiveViewId(stored.id)
      setMode(stored.mode)
      setSortField(stored.sortField)
      setSortDir(stored.sortDir)
      setFilters(stored.filters)
      setColumnKeys(stored.columns)
      setGroupBy(stored.groupBy ?? '')
      setShowTree(stored.tree !== false)
      setWrapCells(!!stored.wrap)
      setTruncateCells(stored.truncate !== false)
      setQuery(stored.query ?? '')
    } else {
      setViews([])
      setActiveViewId(null)
      setQuery('')
      setFilters({})
    }
  }, [collectionPath])

  useEffect(() => {
    let debounce = 0
    const onChange = () => {
      if (detailIdRef.current) return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void reloadRef.current(), 120)
    }
    window.addEventListener('fsdb:change', onChange)
    const timer = window.setInterval(() => {
      if (detailIdRef.current) return
      void reloadRef.current()
    }, 20000)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(timer)
      window.removeEventListener('fsdb:change', onChange)
    }
  }, [collectionPath])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const schema = stat?.schema
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
    () => entries.filter((item) => item.key !== bodyKey && resolveFieldType(item.field) !== 'file'),
    [bodyKey, entries],
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
      if (!parentKey || !showTree) return rows.map((row) => ({ row, depth: 0, hasKids: false }))
      return flattenTree(rows, parentKey, collapsed)
    },
    [collapsed, parentKey, showTree],
  )

  const selected = visible.find((item) => item.id === detailId) ?? items.find((item) => item.id === detailId) ?? null
  const filterActive = Object.values(filters).some(Boolean)
  const activeView = views.find((view) => view.id === activeViewId)

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
    void readJson<{ value?: unknown }>(`/api/db/content?path=${encodeURIComponent(`${collectionPath}/${detailId}`)}`)
      .then((data) => {
        if (!cancelled) setDetailBody(data.value ?? null)
      })
      .catch(() => {
        if (!cancelled) setDetailBody(null)
      })
    return () => {
      cancelled = true
    }
  }, [collectionPath, detailId])

  useEffect(() => {
    if (!detailId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId])

  useEffect(() => {
    if (dlg?.kind !== 'rename') return
    setDlgError('')
  }, [dlg])

  function persistViews(next: SavedView[]) {
    viewsRef.current = next
    setViews(next)
    localStorage.setItem(viewsKey(collectionPath), JSON.stringify(next))
  }

  function rememberActiveView(id: string) {
    setActiveViewId(id)
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

  function commitView(view: SavedView) {
    persistViews([...views, view])
    applyView(view)
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
        ? { ...source, id: `${Date.now()}`, name: uniqueViewName(`${source.name} 副本`) }
        : {
            id: `${Date.now()}`,
            name: uniqueViewName(`${activeView?.name ?? title} 副本`),
            mode,
            sortField,
            sortDir,
            filters,
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
    const removedId = dlg.view.id
    const remaining = views.filter((item) => item.id !== removedId)
    setDlg(null)
    if (!remaining.length) {
      const fallback = normalizeSavedView({
        id: `${Date.now()}`,
        name: '默认视图',
        mode: 'table',
        sortField: schemaDefaultKeys[0] ?? 'id',
        sortDir: 'asc',
        filters: {},
        columns: [...schemaDefaultKeys],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
      })
      persistViews([fallback])
      applyView(fallback)
      return
    }
    persistViews(remaining)
    if (activeViewId === removedId) applyView(remaining[0])
  }

  function setVisibleColumns(next: string[]) {
    const pinned = pinLabelColumn(schema, next)
    if (!pinned.length) return
    setColumnKeys(pinned)
    if (!activeViewId) return
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
        body: JSON.stringify({ path: `${collectionPath}/${row.id}`, action: action.id }),
      })
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
          body: JSON.stringify({ path: `${collectionPath}/${row.id}`, value: content[bodyKey] }),
        })
        setDetailBody(data.value ?? content[bodyKey])
        return
      }
      const data = await readJson<{ value?: DbRecord }>('/api/db/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${collectionPath}/${row.id}`, content }),
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

  async function writeOne(row: DbRecord, key: string, field: FieldSpec, raw: string) {
    await writePatch(row, { [key]: parseFieldValue(field, raw) })
  }

  const labelOf = (row: DbRecord) => String(row[schema?.labelField ?? 'id'] ?? row.id)

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
  }: {
    row: DbRecord
    openDetail?: boolean
    depth?: number
    hasKids?: boolean
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
        {tree && hasKids ? (
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
        ) : null}
        <span className="fsdb-title-text">{body}</span>
        {openDetail ? (
          <button
            type="button"
            className="tasks-title-open"
            aria-label="查看详情"
            title="查看详情"
            onClick={(event) => {
              event.stopPropagation()
              setDetailId(row.id)
            }}
          >
            <ArrowsPointingOutIcon aria-hidden className="size-[14px]" />
          </button>
        ) : null}
      </div>
    )
  }

  function RecordActions({ row, place }: { row: DbRecord; place: 'row' | 'detail' }) {
    const actions = visibleActions(schema, row, place)
    if (!actions.length) return null
    const Action = chrome?.Action
    return (
      <div className="tasks-row-actions" onClick={(event) => event.stopPropagation()}>
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
            <FieldGlyph kind={col.kind} />
            <span className="fsdb-propchip-k">{col.field.label ?? col.key}</span>
            <span className="fsdb-propchip-v">{renderCell(row, col.key, col.field)}</span>
          </span>
        ))}
      </div>
    )
  }

  function GroupHead({ label, count }: { label: string; count: number }) {
    return (
      <header className="tasks-queue-ghead">
        {activeGroup ? <FieldGlyph kind={resolveFieldType(activeGroup.field)} /> : null}
        <span className="tasks-queue-glabel">{label}</span>
        <span className="tasks-queue-count">{count}</span>
      </header>
    )
  }

  function QueueRow({ row }: { row: DbRecord }) {
    return (
      <li className={`tasks-queue-item${row.id === detailId ? ' is-active' : ''}`}>
        <div className="tasks-queue-item-body">
          <button type="button" className="tasks-queue-item-main" onClick={() => setDetailId(row.id)}>
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
      <div className={`tasks-minicard${row.id === detailId ? ' is-active' : ''}`}>
        <div className="tasks-minicard-title">
          <button type="button" className="tasks-minicard-open" onClick={() => setDetailId(row.id)}>
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
        {listed.map(({ row, depth, hasKids }) => (
          <tr key={`${keyPrefix}${row.id}`} className={row.id === detailId ? 'is-active' : undefined}>
            {columns.map((col) => (
              <td key={col.key}>
                {col.key === schema?.labelField ? (
                  <RecordTitle row={row} depth={depth} hasKids={hasKids} />
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
    if (hydratePath.current === collectionPath) return
    hydratePath.current = collectionPath
    let next = loadViews(collectionPath)
    if (!next.length) {
      next = [
        normalizeSavedView({
          id: `${Date.now()}`,
          name: '默认视图',
          mode: 'table',
          sortField: schemaDefaultKeys[0] ?? 'id',
          sortDir: 'asc',
          filters: {},
          columns: [...schemaDefaultKeys],
          groupBy: '',
          tree: true,
          wrap: false,
          truncate: true,
          query: '',
        }),
      ]
    }
    persistViews(next)
    const view = next.find((item) => item.id === loadActiveViewId(collectionPath, next)) ?? next[0]
    applyView(view)
    setHydrated(true)
  }, [allColumnKeys, collectionPath, schema, schemaDefaultKeys])

  useEffect(() => {
    if (!hydrated || !activeViewId) return
    const id = window.setTimeout(() => {
      if (hydratePath.current !== collectionPath) return
      const current = viewsRef.current.find((view) => view.id === activeViewId)
      if (!current) return
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
    <div className="fsdb-page tasks-root">
      {viewsOpen ? (
        <DataSidebar
          tables={tables}
          collectionPath={collectionPath}
          title={title}
          views={views}
          activeViewId={activeViewId}
          onOpenTable={onOpenTable}
          onApplyView={applyView}
          onRenameView={renameView}
          onDeleteView={deleteView}
          onAddView={addEmptyView}
          onCopyView={copyView}
        />
      ) : null}
      <div className="tasks-main fsdb-main">
        {!viewsOpen ? (
          <div className="fsdb-collection-head is-inline">
            <div className="fsdb-collection-name">{title}</div>
            {blurb ? <p className="fsdb-footnote">{blurb}</p> : null}
          </div>
        ) : null}
        <div className="tasks-toolbar">
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
                <span className="tasks-viewdd-name">{activeView?.name ?? '未保存'}</span>
                <ChevronDownIcon aria-hidden className="size-[14px]" />
              </button>
              {viewMenuOpen ? (
                <div className="tasks-viewdd-menu" role="menu">
                  <div className="tasks-viewdd-head">视图</div>
                  {views.length === 0 ? <div className="tasks-viewdd-empty">还没有已保存的视图</div> : null}
                  {views.map((view) => (
                    <div key={view.id} className={`tasks-viewdd-item${view.id === activeViewId ? ' is-active' : ''}`}>
                      <button type="button" className="tasks-viewdd-item-main" onClick={() => applyView(view)}>
                        <span className="tasks-viewdd-item-name">{view.name}</span>
                        {view.id === activeViewId ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-viewdd-check" /> : null}
                      </button>
                      <span className="tasks-viewdd-item-actions">
                        <button type="button" className="tasks-viewdd-act" title="重命名" onClick={() => renameView(view)}>
                          <PencilSquareIcon aria-hidden className="size-[14px]" />
                        </button>
                        <button type="button" className="tasks-viewdd-act is-danger" title="删除" onClick={() => deleteView(view)}>
                          <TrashIcon aria-hidden className="size-[14px]" />
                        </button>
                      </span>
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
                    <button
                      key={opt.id}
                      type="button"
                      className={`tasks-sort-item${mode === opt.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setMode(opt.id)
                        patchActiveView({ mode: opt.id })
                        setModeMenuOpen(false)
                      }}
                    >
                      <span className="tasks-sort-item-label">
                        <span className="tasks-mode-item-ico"><ModeGlyph id={opt.id} /></span>
                        {opt.label}
                      </span>
                      {mode === opt.id ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-sort-item-icon is-on" /> : null}
                    </button>
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
                        className={`tasks-sort-item${current ? ' is-active' : ''}`}
                        onClick={() => cycleSort(item.key)}
                      >
                        <span>{item.field.label ?? item.key}</span>
                        {current ? (sortDir === 'asc' ? <ArrowUpIcon className="size-[14px]" /> : <ArrowDownIcon className="size-[14px]" />) : null}
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
                  <button
                    type="button"
                    className={`tasks-sort-item${!groupBy ? ' is-active' : ''}`}
                    onClick={() => {
                      setGroupKey('')
                      setGroupOpen(false)
                    }}
                  >
                    <span className="tasks-sort-item-label">
                      <Bars3BottomLeftIcon aria-hidden className="size-[14px] shrink-0 opacity-80" />
                      不分组
                    </span>
                    {!groupBy ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-sort-item-icon is-on" /> : null}
                  </button>
                  {groupFields.length ? (
                    groupFields.map((item) => {
                      const current = groupBy === item.key
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`tasks-sort-item${current ? ' is-active' : ''}`}
                          onClick={() => {
                            setGroupKey(item.key)
                            setGroupOpen(false)
                          }}
                        >
                          <span className="tasks-sort-item-label">
                            <FieldGlyph kind={item.kind} />
                            {item.field.label ?? item.key}
                          </span>
                          {current ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-sort-item-icon is-on" /> : null}
                        </button>
                      )
                    })
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
                      <div key={item.key} className="tasks-filter-menu-label">
                        <span>{item.field.label ?? item.key}</span>
                        <CellSelect
                          value={filters[item.key] ?? ''}
                          placeholder="全部"
                          variant="field"
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
                                <GroupHead label={group.label} count={group.rows.length} />
                              </td>
                            </tr>
                            <TableBodyRows rows={group.rows} keyPrefix={`${group.key}:`} />
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
                        <GroupHead label={group.label} count={group.rows.length} />
                        <div className="fsdb-cards">
                          {group.rows.map((row) => (
                            <MiniCard key={row.id} row={row} />
                          ))}
                        </div>
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
                        <GroupHead label={group.label} count={group.rows.length} />
                        <ul className="tasks-queue-list">
                          {group.rows.map((row) => (
                            <QueueRow key={row.id} row={row} />
                          ))}
                        </ul>
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
          <div className="fsdb-pager">
            <span className="fsdb-pager-meta">
              {total ? `Count · 共 ${total} 条` : 'Count · 暂无记录'}
            </span>
            <div className="fsdb-pager-nav">
              <label className="fsdb-pager-size">
                <select
                  value={pageSize}
                  aria-label="每页条数"
                  onChange={(event) => setPageSize(normalizePageSize(Number(event.target.value)))}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon aria-hidden className="size-[12px]" />
              </label>
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
      {selected && schema ? (
        <div className="fsdb-modal-backdrop" onClick={() => setDetailId(null)}>
          <div
            className="fsdb-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="记录详情"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="fsdb-detail-head">
              <div className="fsdb-detail-pager">
                <button
                  type="button"
                  className="tasks-icon-btn"
                  title="上一条"
                  aria-label="上一条"
                  disabled={visible.length < 2}
                  onClick={() => {
                    const ids = visible.map((item) => item.id)
                    const idx = ids.indexOf(selected.id)
                    if (idx < 0) return
                    setDetailId(ids[(idx - 1 + ids.length) % ids.length]!)
                  }}
                >
                  <ChevronLeftIcon aria-hidden className="size-[14px]" />
                </button>
                <button
                  type="button"
                  className="tasks-icon-btn"
                  title="下一条"
                  aria-label="下一条"
                  disabled={visible.length < 2}
                  onClick={() => {
                    const ids = visible.map((item) => item.id)
                    const idx = ids.indexOf(selected.id)
                    if (idx < 0) return
                    setDetailId(ids[(idx + 1) % ids.length]!)
                  }}
                >
                  <ChevronRightIcon aria-hidden className="size-[14px]" />
                </button>
              </div>
              <nav className="fsdb-detail-tabs" aria-label="详情分区">
                <button type="button" className="is-active">
                  概况
                </button>
              </nav>
              <div className="fsdb-detail-head-actions">
                <RecordActions row={selected} place="detail" />
                <button type="button" className="tasks-icon-btn" title="关闭 (Esc)" aria-label="关闭" onClick={() => setDetailId(null)}>
                  <XMarkIcon aria-hidden className="size-[14px]" />
                </button>
              </div>
            </header>
            <div className="fsdb-detail-split">
              <div className="fsdb-detail-main">
                {schema.labelField && schema.fields[schema.labelField]?.writable ? (
                  <LocalText
                    as="textarea"
                    className="fsdb-detail-title-input"
                    value={draft[schema.labelField] ?? ''}
                    rows={(draft[schema.labelField] ?? '').length > 48 ? 2 : 1}
                    onCommit={(raw) => {
                      const next = raw.trim()
                      setDraft((prev) => ({ ...prev, [schema.labelField!]: next }))
                      if (next && next !== String(selected[schema.labelField!] ?? '')) {
                        void writeOne(selected, schema.labelField!, schema.fields[schema.labelField!]!, next)
                      }
                    }}
                  />
                ) : (
                  <h2 className="fsdb-detail-title-input">{labelOf(selected)}</h2>
                )}
                <div className="fsdb-detail-aside">
                  <div className="fsdb-prop">
                    <span>
                      <HashtagIcon aria-hidden className="size-[14px]" />
                      ID
                    </span>
                    <span className="fsdb-detail-id" title={selected.id}>
                      {selected.id}
                    </span>
                  </div>
                  {Object.entries(schema.fields).map(([key, field]) => {
                    if (key === 'id' || key === schema.labelField || key === contentFieldKey(schema)) return null
                    const kind = resolveFieldType(field)
                    return (
                      <div key={key} className="fsdb-prop">
                        <span title={field.label ?? key}>
                          <FieldGlyph kind={kind} />
                          {field.label ?? key}
                        </span>
                        <div className="fsdb-prop-val" title={formatField(field, selected[key])}>
                        {field.writable ? (
                          <FieldEditor
                            fieldKey={key}
                            field={field}
                            value={draft[key] ?? ''}
                            options={uniqueValues(items, key, field)}
                            onChange={(next) => {
                              setDraft((prev) => ({ ...prev, [key]: next }))
                              void writeOne(selected, key, field, next)
                            }}
                          />
                        ) : (
                          renderCell(selected, key, field)
                        )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {contentFieldKey(schema) && schema.fields[contentFieldKey(schema)!] ? (() => {
                  const key = contentFieldKey(schema)!
                  const spec = schema.fields[key]!
                  const ContentView = chrome?.Content
                  if (ContentView) {
                    return (
                      <div className="fsdb-fileview">
                        <ContentView
                          record={selected}
                          field={key}
                          spec={spec}
                          value={detailBody}
                          writable={spec.writable}
                          onChange={(next) => void writePatch(selected, { [key]: next })}
                        />
                      </div>
                    )
                  }
                  if (spec.writable) {
                    const saved =
                      typeof detailBody === 'string' || detailBody == null
                        ? String(detailBody ?? '')
                        : JSON.stringify(detailBody, null, 2)
                    return (
                      <LocalText
                        as="textarea"
                        className="fsdb-detail-doc"
                        value={draft[key] ?? saved}
                        rows={12}
                        placeholder="内容：文本，或 JSON 文件"
                        onCommit={(next) => {
                          setDraft((prev) => ({ ...prev, [key]: next }))
                          if (next !== saved) void writeOne(selected, key, spec, next)
                        }}
                      />
                    )
                  }
                  return (
                    <div className="fsdb-fileview">
                      <FilePreview value={detailBody} />
                    </div>
                  )
                })() : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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

if (typeof document !== 'undefined') {
  const id = 'biu-core-file-system-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.fsdb-page{display:flex;min-width:0;min-height:0;flex:1;flex-direction:row;overflow:hidden;background:var(--dsw-bg);color:var(--dsw-label);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif,"Apple Color Emoji","Segoe UI Emoji";font-size:14px;letter-spacing:-.011em}
.fsdb-views{display:flex;width:280px;flex:none;flex-direction:column;min-height:0;overflow:hidden}
.fsdb-nav-chevron{flex:none;display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-label-3);cursor:pointer}
.fsdb-nav-chevron:hover{background:var(--dsw-hover);color:var(--dsw-label)}
.fsdb-collection-head{flex:none;padding:4px 16px 10px;min-width:0}
.fsdb-views .chat-session-row-main{border:0;background:transparent;color:inherit;cursor:pointer}
.fsdb-collection-head.is-inline{padding:0 0 2px}
.fsdb-collection-name{font-size:14px;font-weight:650;color:var(--dsw-label);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-collection-head .fsdb-footnote{margin:4px 0 0;font-size:14px;font-weight:400;line-height:1.45;color:var(--dsw-label-3);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.fsdb-main{display:flex;min-width:0;min-height:0;flex:1;flex-direction:column;gap:10px;padding:12px 14px 14px;overflow:hidden}
.fsdb-page .tasks-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;min-width:0}
.fsdb-page .tasks-toolbar-left{display:flex;align-items:center;gap:6px;flex:none;min-width:0}
.fsdb-page .tasks-toolbar-right{display:flex;align-items:center;gap:2px;flex:none;margin-left:auto}
.fsdb-page .tasks-search-wrap{display:inline-flex;align-items:center;gap:0;flex:none;min-width:0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-label-2)}
.fsdb-page .tasks-search-wrap.is-open{flex:0 1 168px;gap:2px}
.fsdb-page .tasks-search{flex:1;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;outline:none;min-width:0;padding:4px 4px 4px 0}
.fsdb-page .tasks-refresh,.fsdb-page .tasks-sort-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:26px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-label-2);cursor:pointer;font:inherit;font-size:14px;font-weight:600}
.fsdb-page .tasks-refresh:hover,.fsdb-page .tasks-sort-btn:hover{background:var(--dsw-hover)}
.fsdb-page .tasks-refresh:disabled{cursor:default;opacity:1}
.fsdb-refresh-wrap{position:relative;display:inline-flex}
.fsdb-spin{animation:fsdb-spin .7s linear infinite}
@keyframes fsdb-spin{to{transform:rotate(360deg)}}
.fsdb-refresh-toast{position:absolute;top:calc(100% + 8px);right:0;z-index:50;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border-radius:8px;padding:7px 10px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);box-shadow:0 8px 24px rgba(0,0,0,.18);color:var(--dsw-label);font-size:14px;font-weight:600}
.fsdb-refresh-toast svg{color:var(--dsw-ok,#2f7d4c)}
.fsdb-page .tasks-sort-btn.is-active,.fsdb-page .tasks-refresh.is-active{color:var(--dsw-business);background:color-mix(in srgb,var(--dsw-business) 10%,var(--dsw-input))}
.fsdb-page .tasks-sort-btn.is-custom{color:var(--dsw-business)}
.fsdb-page .tasks-sort-dot{position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:var(--dsw-business)}
.fsdb-col-item{display:flex;align-items:center;gap:8px;border-radius:7px;padding:5px 8px;color:var(--dsw-label);font-size:14px;cursor:pointer}
.fsdb-col-item:hover{background:var(--dsw-hover)}
.fsdb-col-item.is-active{color:var(--dsw-business)}
.fsdb-col-item input{margin:0}
.fsdb-page .tasks-viewdd-wrap,.fsdb-page .tasks-sort-wrap,.fsdb-page .tasks-filter-btn-wrap{position:relative;display:inline-flex}
.fsdb-page .tasks-viewdd-btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;padding:5px 9px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;font-weight:650;cursor:pointer}
.fsdb-page .tasks-viewdd-name{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-page .tasks-viewdd-menu,.fsdb-page .tasks-sort-menu,.fsdb-page .tasks-filter-menu{position:absolute;top:calc(100% + 6px);z-index:40;min-width:180px;padding:8px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:4px}
.fsdb-page .tasks-viewdd-menu{left:0;min-width:230px}
.fsdb-page .tasks-sort-menu,.fsdb-page .tasks-filter-menu{right:0}
.fsdb-page .tasks-filter-menu{overflow:visible;min-width:240px}
.fsdb-page .tasks-viewdd-head,.fsdb-page .tasks-sort-head{font-size:14px;font-weight:600;color:var(--dsw-label-3)}
.fsdb-page .tasks-viewdd-item{display:flex;align-items:center}
.fsdb-page .tasks-viewdd-item-main,.fsdb-page .tasks-sort-item,.fsdb-page .tasks-viewdd-saveas{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:0;border-radius:7px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;cursor:pointer;text-align:left}
.fsdb-page .tasks-sort-item.is-active,.fsdb-page .tasks-viewdd-item.is-active .tasks-viewdd-item-main{color:var(--dsw-business);font-weight:650}
.fsdb-page .tasks-viewdd-item-actions{display:none}
.fsdb-page .tasks-viewdd-item:hover .tasks-viewdd-item-actions{display:inline-flex}
.fsdb-page .tasks-viewdd-act{border:0;background:transparent;color:var(--dsw-label-3);cursor:pointer}
.fsdb-page .tasks-viewdd-foot{border-top:1px solid var(--dsw-border);margin-top:4px;padding-top:4px}
.fsdb-page .tasks-filter-menu-label{display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:600;color:var(--dsw-label-3)}
.fsdb-page .tasks-filter{width:100%;border:1px solid var(--dsw-border);border-radius:7px;padding:5px 7px;background:var(--dsw-input);color:var(--dsw-label);font:inherit;font-size:14px}
.fsdb-page .tasks-filter-clear{border:0;border-radius:7px;padding:6px 8px;background:transparent;color:var(--dsw-danger);font:inherit;font-size:14px;cursor:pointer}
.fsdb-page .tasks-filter-dot{position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:var(--dsw-business)}
.fsdb-page .tasks-error{margin:0;color:var(--dsw-danger);font-size:14px}
.fsdb-page .tasks-table-wrap{min-width:0;flex:1;overflow:auto;border:0;border-top:1px solid var(--dsw-border);border-bottom:1px solid var(--dsw-border);border-radius:0;background:var(--dsw-surface)}
.fsdb-page .tasks-table{width:max-content;min-width:100%;border-collapse:collapse;table-layout:auto;font-size:14px;font-weight:400;color:var(--dsw-label);white-space:nowrap}
.fsdb-page .tasks-table th,.fsdb-page .tasks-table td{padding:4px 6px;border-bottom:1px solid color-mix(in srgb,var(--dsw-border) 80%,transparent);text-align:left;vertical-align:middle;color:var(--dsw-label);font-weight:400}
.fsdb-page .tasks-table:not(.is-wrap) td{white-space:nowrap}
.fsdb-cell{display:flex;align-items:center;min-width:0;max-width:100%;min-height:18px}
.fsdb-link{color:inherit;text-underline-offset:2px;overflow-wrap:anywhere}
.fsdb-link:hover{text-decoration:underline}
.fsdb-thumb-link,.fsdb-thumb-btn{display:inline-flex;align-items:center;justify-content:center;line-height:0;border:0;padding:0;background:transparent;cursor:zoom-in;vertical-align:middle}
.fsdb-thumb{display:block;width:96px;height:54px;object-fit:cover;border-radius:6px;background:var(--dsw-hover);flex:none;box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-border) 70%, transparent)}
.fsdb-lightbox{position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(0,0,0,.72);cursor:zoom-out}
.fsdb-lightbox img{max-width:min(92vw,1100px);max-height:88vh;object-fit:contain;border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.45);cursor:default}
.fsdb-file{display:inline-flex;align-items:center;gap:6px;min-width:0;color:inherit;text-underline-offset:2px}
.fsdb-file:hover{text-decoration:underline}
.fsdb-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis}
.fsdb-fileview{min-width:0;flex:1}
.fsdb-fileview-pre{margin:0;padding:10px 12px;border-radius:8px;background:var(--dsw-input);color:var(--dsw-label);font:inherit;font-size:14px;font-family:var(--font-mono);white-space:pre-wrap;overflow:auto;min-height:160px}
.fsdb-fileview-img{display:block;max-width:100%;max-height:420px;object-fit:contain;border-radius:8px;background:var(--dsw-hover)}
.fsdb-page .tasks-title-cell{display:flex;align-items:center;gap:2px;min-width:0}
.fsdb-page .tasks-tree-toggle{width:20px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-label-3);border-radius:4px;cursor:pointer;padding:0}
.fsdb-page .tasks-tree-toggle:hover{background:var(--dsw-hover)}
.fsdb-page .tasks-tree-toggle.is-empty{cursor:default}
.fsdb-page .fsdb-title-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.fsdb-page .tasks-table.is-wrap .fsdb-title-text{white-space:normal}
.fsdb-page .tasks-title-open{flex:none;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--dsw-label-3);border-radius:4px;cursor:pointer;padding:0;opacity:0}
.fsdb-page .tasks-title-cell:hover .tasks-title-open,.fsdb-page .tasks-title-open:focus-visible{opacity:1}
.fsdb-page .tasks-title-open:hover{opacity:1;color:var(--dsw-label);background:var(--dsw-hover)}
.fsdb-page .tasks-table.is-truncate:not(.is-wrap) .fsdb-cell{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-page .tasks-table .fsdb-cell:has(.tasks-assignee-picker),.fsdb-page .tasks-table .fsdb-cell:has(.tasks-cellselect),.fsdb-page .tasks-table .fsdb-cell:has(.fsdb-thumb-btn),.fsdb-page .fsdb-propchip-v:has(.tasks-assignee-picker),.fsdb-page .fsdb-propchip-v:has(.tasks-cellselect){overflow:visible}
.fsdb-page .tasks-table.is-wrap .fsdb-cell{white-space:normal;overflow-wrap:anywhere;word-break:break-word}
.fsdb-page .tasks-table.is-wrap.is-truncate .fsdb-cell{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.fsdb-page .tasks-table th{padding:6px 6px;color:var(--dsw-label-2);font-size:14px;font-weight:600;position:sticky;top:0;background:var(--dsw-surface);z-index:1}
.fsdb-page .tasks-th{display:inline-flex;align-items:center;gap:5px;font-weight:600}
.fsdb-page .tasks-table tr{cursor:default}
.fsdb-page .tasks-table tr:hover td{background:color-mix(in srgb,var(--dsw-hover) 55%,transparent)}
.fsdb-page .tasks-table tr.is-active td{background:color-mix(in srgb,var(--dsw-business) 8%,transparent)}
.fsdb-page .tasks-table tr.fsdb-group-row td{padding:10px 4px 4px;background:transparent;cursor:default}
.fsdb-page .tasks-table tr.fsdb-group-row:hover td{background:transparent}
.fsdb-page .tasks-table tr.fsdb-group-row .tasks-queue-ghead{padding:2px 4px}
.fsdb-page .tasks-minicard{display:flex;flex-direction:column;gap:8px;position:static;width:100%;min-width:0;height:auto;min-height:min-content;margin:0;overflow:visible;text-align:left;border:0;border-radius:8px;padding:10px 11px;background:var(--dsw-surface);color:var(--dsw-label);font:inherit;box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-border) 65%,transparent);transition:box-shadow .12s ease,transform .08s ease}
.fsdb-page .tasks-minicard-open{display:flex;min-width:0;flex:1;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.fsdb-page .tasks-minicard:hover{box-shadow:0 1px 3px rgba(0,0,0,.08),0 0 0 1px color-mix(in srgb,var(--dsw-border) 85%,transparent);transform:translateY(-1px)}
.fsdb-page .tasks-minicard.is-active{background:color-mix(in srgb,var(--dsw-business) 6%,var(--dsw-surface))}
.fsdb-page .tasks-minicard-title{display:flex;align-items:flex-start;gap:6px;font-size:14px;font-weight:620;line-height:1.35}
.fsdb-page .tasks-minicard-titletext{flex:1;min-width:0;overflow-wrap:anywhere;word-break:break-word}
.fsdb-page .tasks-minicard-foot{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px;min-width:0;width:100%;overflow:visible}
.fsdb-page .tasks-minicard-foot > .fsdb-proplist{flex:1;flex-direction:column;flex-wrap:nowrap;width:100%;min-width:0}
.fsdb-page .tasks-row-actions{display:inline-flex;align-items:center;gap:2px;flex:none}
.fsdb-page .tasks-icon-btn{border:0;border-radius:5px;padding:3px;background:transparent;color:var(--dsw-label-3);cursor:pointer;font:inherit;display:inline-flex;align-items:center;justify-content:center}
.fsdb-page .tasks-icon-btn:hover,.fsdb-page .tasks-icon-btn.is-active{background:var(--dsw-hover);color:var(--dsw-label)}
.fsdb-page .tasks-icon-btn.is-danger:hover{background:var(--dsw-danger-soft);color:var(--dsw-danger)}
.fsdb-page .tasks-icon-btn:disabled{opacity:.4;cursor:default}
.fsdb-page .tasks-queue{display:flex;flex-direction:column;gap:18px;overflow:auto;padding:2px 0 12px}
.fsdb-page .tasks-queue-group{display:flex;flex-direction:column;gap:2px}
.fsdb-page .tasks-queue-ghead{display:flex;align-items:center;gap:6px;padding:4px 8px;color:var(--dsw-label-2);font-size:14px;font-weight:650;letter-spacing:.01em}
.fsdb-page .tasks-queue-glabel{font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-page .tasks-queue-count{margin-left:auto;color:var(--dsw-label-3);font-size:14px;font-weight:600;background:var(--dsw-muted-fill);border-radius:8px;padding:1px 7px}
.fsdb-page .tasks-queue-list{display:flex;flex-direction:column;margin:0;padding:0;list-style:none;gap:6px}
.fsdb-page .tasks-queue-item{display:block;min-width:0;width:100%}
.fsdb-page .tasks-queue-item-body{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:10px;min-width:0;width:100%;box-sizing:border-box;border-radius:6px;padding:6px 6px 6px 0}
.fsdb-page .tasks-queue-item-main{display:flex;align-items:center;gap:10px;flex:0 1 auto;max-width:40%;min-width:0;box-sizing:border-box;overflow:hidden;text-align:left;border:0;border-radius:6px;padding:2px 8px;background:transparent;color:var(--dsw-label);font:inherit;cursor:pointer;box-shadow:none}
.fsdb-page .tasks-queue-item:hover .tasks-queue-item-body{background:var(--dsw-hover)}
.fsdb-page .tasks-queue-item.is-active .tasks-queue-item-body{background:color-mix(in srgb,var(--dsw-hover) 85%,transparent)}
.fsdb-page .tasks-queue-item .tasks-row-actions{flex:none;padding:2px}
.fsdb-page .tasks-queue-item-title{flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-page .tasks-queue-item-body > .fsdb-proplist{flex:1 1 0;min-width:0;max-width:none;flex-direction:column;flex-wrap:nowrap;align-items:stretch;row-gap:2px;padding:0;overflow:visible}
.fsdb-page .tasks-queue-item-body .fsdb-propchip{min-height:18px;line-height:18px}
.fsdb-page .tasks-queue-item-body .fsdb-propchip-k,.fsdb-page .tasks-queue-item-body .fsdb-propchip-v{line-height:18px}
.fsdb-page .tasks-board{display:grid;gap:12px;overflow:auto;align-items:start;padding-bottom:8px}
.fsdb-page .tasks-board-col{min-height:180px;background:color-mix(in srgb,var(--dsw-muted-fill) 38%,transparent);border-radius:10px;padding:10px}
.fsdb-page .tasks-board-colhead{display:flex;align-items:center;gap:6px;padding:4px 6px 10px;color:var(--dsw-label-2);font-weight:600;font-size:14px}
.fsdb-page .tasks-board-coltitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-page .tasks-board-count{margin-left:auto;color:var(--dsw-label-3);font-size:14px;font-weight:600;background:var(--dsw-muted-fill);border-radius:8px;padding:1px 6px}
.fsdb-page .tasks-board-list{display:flex;flex-direction:column;gap:8px}
.fsdb-page .fsdb-proplist{display:flex;flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:2px;min-width:0;max-width:100%;overflow:visible;height:auto}
.fsdb-page .fsdb-propchip{display:flex;align-items:center;flex-wrap:nowrap;gap:6px;width:100%;max-width:100%;min-width:0;height:auto;min-height:20px;padding:0;background:transparent;color:var(--dsw-label-2);font-size:14px;font-weight:500;line-height:20px}
.fsdb-page .fsdb-propchip-k{flex:none;color:var(--dsw-label-3);font-weight:600;line-height:20px;margin-inline-end:10px}
.fsdb-page .fsdb-propchip-v{display:inline-flex;align-items:center;min-width:0;overflow:hidden;color:var(--dsw-label);font-weight:600;line-height:20px}
.fsdb-page .fsdb-propchip-v:has(.fsdb-boolbox){overflow:visible;flex:none}
.fsdb-page .fsdb-propchip .fsdb-pill,.fsdb-page .fsdb-propchip .fsdb-tag{padding:0;background:transparent;max-width:none}
.fsdb-workspace{display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;overflow:hidden}
.fsdb-pager{display:flex;align-items:center;gap:4px;flex:none;min-height:32px;padding:2px 4px 0;color:var(--dsw-label-3);font-size:14px;font-weight:400}
.fsdb-pager-meta{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-pager-nav{display:inline-flex;align-items:center;gap:0;flex:none;margin-left:auto}
.fsdb-pager-size{position:relative;display:inline-flex;align-items:center;color:var(--dsw-label-3)}
.fsdb-pager-size select{-webkit-appearance:none;appearance:none;border:0;border-radius:5px;margin:0;padding:2px 18px 2px 6px;background:transparent;color:inherit;font:inherit;font-size:14px;font-weight:400;cursor:pointer}
.fsdb-pager-size select:hover{background:var(--dsw-hover);color:var(--dsw-label)}
.fsdb-pager-size svg{position:absolute;right:4px;pointer-events:none;color:inherit}
.fsdb-pager .tasks-icon-btn{color:var(--dsw-label-3)}
.fsdb-stage{display:flex;min-width:0;min-height:0;flex:1;flex-direction:column;overflow:hidden}
.fsdb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));grid-auto-flow:row;grid-auto-rows:max-content;grid-template-rows:none;gap:10px;align-content:start;align-items:start;justify-items:stretch;overflow:auto;flex:1;min-width:0;min-height:0;position:relative}
.fsdb-cards > .tasks-minicard{position:static;grid-row:auto;grid-column:auto;inset:auto}
.fsdb-cards-stack{display:flex;flex-direction:column;gap:16px;overflow:auto;flex:1;min-width:0;min-height:0;padding:2px 0 12px}
.fsdb-cards-stack .fsdb-cards{overflow:visible;flex:none;min-height:0}
.fsdb-bool{display:inline-flex;align-items:center;flex:none;line-height:0;vertical-align:middle}
.fsdb-boolbtn{border:0;background:transparent;padding:0;cursor:pointer;display:inline-flex;align-items:center;flex:none;line-height:0;vertical-align:middle}
.fsdb-boolbox{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--dsw-border);display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--dsw-bg);box-sizing:border-box}
.fsdb-boolbox.is-on{background:var(--dsw-pick,#2383e2);border-color:transparent;color:var(--dsw-bg)}
.fsdb-boolbox.is-locked{cursor:default;opacity:.9}
.fsdb-boolbox.is-locked.is-on{background:var(--dsw-pick,#2383e2);border-color:transparent;color:var(--dsw-bg)}
.fsdb-boolbtn:hover .fsdb-boolbox:not(.is-on){border-color:var(--dsw-label-2)}
.fsdb-modal-backdrop{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:28px}
.fsdb-detail-modal{width:min(880px,94vw);height:min(720px,88vh);display:flex;flex-direction:column;min-height:0;border-radius:10px;border:1px solid var(--dsw-border);background:var(--dsw-sidebar);box-shadow:var(--dsw-shadow-lv2);overflow:hidden}
.fsdb-detail-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:8px 10px 8px 12px}
.fsdb-detail-pager{display:inline-flex;align-items:center;gap:1px;justify-self:start}
.fsdb-detail-pager .tasks-icon-btn:disabled{opacity:.35;cursor:default}
.fsdb-detail-tabs{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-muted-fill);justify-self:center}
.fsdb-detail-tabs button{border:0;background:transparent;color:var(--dsw-label-3);padding:5px 10px;border-radius:6px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.fsdb-detail-tabs button.is-active{background:var(--dsw-surface);color:var(--dsw-label)}
.fsdb-detail-head-actions{display:inline-flex;align-items:center;gap:2px;justify-self:end}
.fsdb-detail-split{display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto}
.fsdb-detail-main{display:flex;flex-direction:column;gap:8px;padding:20px 22px 24px;min-width:0}
.fsdb-detail-aside{display:flex;flex-direction:column;gap:2px;padding:8px 0 12px}
.fsdb-prop{display:grid;grid-template-columns:108px minmax(0,1fr);align-items:center;gap:8px;min-height:32px;font-size:14px;color:var(--dsw-label-3)}
.fsdb-prop>span:first-child{font-size:14px;font-weight:600;color:var(--dsw-label-3);display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-prop-val{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-label)}
.fsdb-prop-val .fsdb-plain-input,.fsdb-prop-val .fsdb-link,.fsdb-prop-val .fsdb-meta,.fsdb-prop-val .fsdb-file,.fsdb-prop-val .fsdb-file-name,.fsdb-prop-val .fsdb-pill,.fsdb-prop-val .fsdb-tags{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-prop-val .fsdb-plain-input{text-overflow:ellipsis}
.fsdb-prop-val .fsdb-plain-input:focus{text-overflow:clip}
.fsdb-prop-val .fsdb-link{display:block;overflow-wrap:normal}
.fsdb-prop-val .fsdb-tags{display:flex;flex-wrap:nowrap}
.fsdb-detail-title-input{width:100%;margin:0;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;font-weight:700;line-height:1.35;outline:none;padding:0;resize:none}
.fsdb-detail-id{font-size:14px;font-weight:400;color:var(--dsw-label-2);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-detail-doc{width:100%;min-height:180px;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;line-height:1.65;outline:none;resize:none;padding:8px 0 0;margin:0}
.fsdb-fields{display:flex;flex-direction:column;gap:8px}
.fsdb-field{display:flex;flex-direction:column;gap:4px;color:var(--dsw-label-3);font-size:14px}
.fsdb-field em{font-style:normal;color:var(--dsw-label);font-size:14px}
.fsdb-plain-input{width:100%;border:0;border-radius:6px;padding:4px 6px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;outline:none}
.fsdb-plain-input:hover,.fsdb-plain-input:focus{background:var(--dsw-hover)}
.fsdb-cellselect{display:inline-flex;position:relative;min-width:0;max-width:100%;box-sizing:border-box;vertical-align:middle}
.fsdb-cellselect-trigger{display:inline-flex;align-items:center;max-width:110px;height:22px;border:0;border-radius:4px;padding:0 6px;background:rgba(255,255,255,.08);color:var(--dsw-label);font:inherit;font-size:14px;font-weight:500;line-height:22px;cursor:pointer;text-align:left}
.fsdb-cellselect-trigger:hover,.fsdb-cellselect-trigger[data-open]{background:rgba(255,255,255,.12)}
.fsdb-cellselect-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsdb-cellselect-caret{flex:none;opacity:.55;color:var(--dsw-label-2)}
.fsdb-cellselect-trigger.is-empty{max-width:none;color:var(--dsw-label-3);background:var(--dsw-hover);font-weight:500}
.fsdb-cellselect.is-field{display:block;width:100%}
.fsdb-cellselect.is-field .fsdb-cellselect-trigger{display:flex;justify-content:space-between;gap:6px;width:100%;max-width:none;min-height:28px;border:1px solid var(--dsw-border);border-radius:7px;padding:5px 8px;background:var(--dsw-input);color:var(--dsw-label)}
.fsdb-cellselect.is-field .fsdb-cellselect-trigger:hover,.fsdb-cellselect.is-field .fsdb-cellselect-trigger[data-open]{background:var(--dsw-hover);filter:none}
.fsdb-cellselect.is-field .fsdb-cellselect-trigger.is-empty{color:var(--dsw-label-3)}
.fsdb-cellselect-menu{box-sizing:border-box;padding:6px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:4px}
.fsdb-cellselect-search{display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-border);border-radius:8px;padding:4px 8px;color:var(--dsw-label-3);background:var(--dsw-input)}
.fsdb-cellselect-search input{flex:1;min-width:0;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;outline:none}
.fsdb-cellselect-options{display:flex;flex-direction:column;gap:1px;max-height:220px;overflow:auto}
.fsdb-cellselect-option{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:0;border-radius:6px;padding:5px 6px;background:transparent;color:var(--dsw-label);font:inherit;cursor:pointer;text-align:left}
.fsdb-cellselect-option:hover,.fsdb-cellselect-option.is-selected{background:color-mix(in srgb,var(--dsw-business) 12%,transparent)}
.fsdb-cellselect-empty{padding:8px;color:var(--dsw-label-3);font-size:14px}
.fsdb-tokens{position:relative;min-width:0}
.fsdb-tokens-box{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:28px;border-radius:6px;padding:2px 4px;cursor:text}
.fsdb-tokens-box:hover,.fsdb-tokens-box:focus-within{background:var(--dsw-hover)}
.fsdb-token{display:inline-flex;align-items:center;gap:2px;height:22px;border-radius:4px;padding:0 6px;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-label);background:rgba(255,255,255,.08);white-space:nowrap}
.fsdb-token-x{border:0;background:transparent;padding:0;margin:0;color:inherit;opacity:.55;cursor:pointer;display:inline-flex;line-height:0}
.fsdb-tokens-input{flex:1;min-width:64px;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;outline:none;padding:2px 0}
.fsdb-tokens-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:50;max-height:220px;overflow:auto;padding:4px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.fsdb-tokens-option{display:block;width:100%;border:0;border-radius:6px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.fsdb-tokens-option:hover{background:var(--dsw-hover)}
.fsdb-tokens-empty{padding:8px;color:var(--dsw-label-3);font-size:14px}
.fsdb-checkrow{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:0;border-radius:7px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;cursor:pointer;text-align:left}
.fsdb-checkrow:hover,.fsdb-checkrow.is-on{background:var(--dsw-hover)}
.fsdb-checkrow.is-on{color:var(--dsw-business);font-weight:650}
.fsdb-checkrow.is-locked{cursor:default;opacity:.72}
.fsdb-checkrow.is-locked:hover{background:transparent}
.fsdb-checkrow-label{display:inline-flex;align-items:center;gap:6px;min-width:0}
.fsdb-checkrow-icon{display:inline-flex;color:var(--dsw-label-3)}
.fsdb-checkrow.is-on .fsdb-checkrow-icon{color:var(--dsw-business)}
.fsdb-dlg-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
.fsdb-dlg{width:min(360px,calc(100vw - 32px));background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.25);padding:16px;display:flex;flex-direction:column;gap:12px}
.fsdb-dlg-title{font-size:14px;font-weight:700;color:var(--dsw-label)}
.fsdb-dlg-body{display:flex;flex-direction:column;gap:8px}
.fsdb-dlg-body p{margin:0;font-size:14px;line-height:1.6;color:var(--dsw-label-2)}
.fsdb-dlg-input{width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:8px 10px;background:var(--dsw-input);color:var(--dsw-label);font:inherit;font-size:14px;outline:none}
.fsdb-dlg-error{font-size:14px;color:var(--dsw-danger)}
.fsdb-dlg-actions{display:flex;justify-content:flex-end;gap:8px}
.fsdb-dlg-cancel,.fsdb-dlg-ok{border-radius:8px;padding:6px 14px;background:transparent;color:var(--dsw-label-2);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.fsdb-dlg-cancel{border:none}
.fsdb-dlg-cancel:hover{background:var(--dsw-hover)}
.fsdb-dlg-ok{border:1px solid var(--dsw-business);background:var(--dsw-business);color:var(--dsw-bg)}
.fsdb-dlg-ok.is-danger{border-color:var(--dsw-danger);background:var(--dsw-danger);color:var(--dsw-bg)}
.fsdb-dlg-ok:disabled,.fsdb-dlg-cancel:disabled{opacity:.6;cursor:default}
.fsdb-save{border:0;border-radius:8px;padding:8px 10px;background:var(--dsw-business);color:#fff;font:inherit;font-size:14px;cursor:pointer}
.fsdb-empty,.fsdb-muted,.fsdb-meta,.fsdb-footnote{color:var(--dsw-label-2)}
.fsdb-footnote{margin:0;font-size:14px;font-weight:400}
.fsdb-tags{display:inline-flex;gap:4px;flex-wrap:wrap;align-items:center}
.fsdb-tag{display:inline-flex;align-items:center;height:22px;padding:0 6px;border-radius:4px;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-label);background:rgba(255,255,255,.08);white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}
.fsdb-pill{display:inline-flex;align-items:center;gap:4px;height:22px;border-radius:4px;padding:0 6px;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-label);background:rgba(255,255,255,.08)}
.fsdb-pill.is-doing,.fsdb-pill.is-high,.fsdb-pill.is-done,.fsdb-pill.is-todo,.fsdb-pill.is-low{background:rgba(255,255,255,.08);color:var(--dsw-label)}
.fsdb-multi{display:flex;flex-wrap:wrap;gap:6px}
.fsdb-check{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-label);font-size:14px}
@media (max-width:900px){.fsdb-page{flex-direction:column}.fsdb-views{width:100%}}
`
  if (!document.getElementById(id)) document.head.appendChild(style)
}
