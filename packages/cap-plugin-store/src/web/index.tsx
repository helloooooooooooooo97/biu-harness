import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Context } from 'cordis'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowsUpDownIcon,
  Bars3BottomLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleStackIcon,
  ClockIcon,
  FunnelIcon,
  HashtagIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  PuzzlePieceIcon,
  TagIcon,
  UserIcon,
  Squares2X2Icon,
  StopIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/16/solid'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import type { SlotProps } from '@biu/type-slots'

export const name = 'plugin-store-ui'
export const inject = ['slots', 'appModules']

type StoreListing = {
  id: string
  name: string
  blurb: string
  tags?: string[]
  author?: string
  authorUrl?: string
  enabled: boolean
  running: boolean
  bytes?: number
  createdAt?: number
  updatedAt?: number
  lastRunAt?: number | null
  hasHost?: boolean
  hasWeb?: boolean
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body
}

type PluginViewMode = 'queue' | 'table' | 'cards'
type PluginSortField = 'status' | 'name' | 'size' | 'created' | 'updated' | 'lastRun'
type PluginSortDir = 'asc' | 'desc'
type PluginViewFilter = { status: '' | PluginGroupKey; kind: '' | 'web' | 'host'; tag: string; time: string }
type PluginViewConfig = { mode: PluginViewMode; filter: PluginViewFilter; sort: { field: PluginSortField; dir: PluginSortDir } }
type PluginSavedView = { id: string; name: string; config: PluginViewConfig }

const PLUGIN_VIEW_MODES: Array<{ id: PluginViewMode; label: string; icon: ReactNode }> = [
  { id: 'queue', label: '列表', icon: <ListBulletIcon aria-hidden className="size-[14px]" /> },
  { id: 'table', label: '表格', icon: <TableCellsIcon aria-hidden className="size-[14px]" /> },
  { id: 'cards', label: '卡片', icon: <Squares2X2Icon aria-hidden className="size-[14px]" /> },
]
const PLUGIN_VIEWS_KEY = 'plugin-store.views.v1'
const STATUS_RANK: Record<PluginGroupKey, number> = { running: 0, open: 1, closed: 2 }

function defaultPluginConfig(): PluginViewConfig {
  return {
    mode: 'table',
    filter: { status: '', kind: '', tag: '', time: '' },
    sort: { field: 'status', dir: 'asc' },
  }
}

function normalizePluginConfig(config: PluginViewConfig | undefined): PluginViewConfig {
  const base = defaultPluginConfig()
  const filter = config?.filter
  const sort = config?.sort
  const mode = config?.mode && PLUGIN_VIEW_MODES.some((m) => m.id === config.mode) ? config.mode : base.mode
  return {
    mode,
    filter: {
      status: filter?.status || '',
      kind: filter?.kind || '',
      tag: filter?.tag || '',
      time: filter?.time || '',
    },
    sort: {
      field: sort?.field && ['status', 'name', 'size', 'created', 'updated', 'lastRun'].includes(sort.field) ? sort.field : base.sort.field,
      dir: sort?.dir === 'desc' ? 'desc' : 'asc',
    },
  }
}

function seedPluginViews(): PluginSavedView[] {
  const base = defaultPluginConfig()
  return [
    { id: 'view-all', name: '全部插件', config: base },
    { id: 'view-running', name: '运行中', config: { ...base, filter: { ...base.filter, status: 'running' } } },
    { id: 'view-closed', name: '已关闭', config: { ...base, filter: { ...base.filter, status: 'closed' } } },
  ]
}

function readPluginViews(): { activeId: string; views: PluginSavedView[] } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PLUGIN_VIEWS_KEY) || 'null') as { activeId?: string; views?: PluginSavedView[] } | null
    if (raw?.views?.length) {
      const views = raw.views
        .filter((v) => v?.id && v?.name && v.config)
        .map((v) => ({ ...v, config: normalizePluginConfig(v.config) }))
      if (views.length) {
        const activeId = views.some((v) => v.id === raw.activeId) ? raw.activeId! : views[0]!.id
        return { activeId, views }
      }
    }
  } catch {
    /* ignore */
  }
  const views = seedPluginViews()
  return { activeId: views[0]!.id, views }
}

function writePluginViews(activeId: string, views: PluginSavedView[]) {
  try {
    window.localStorage.setItem(PLUGIN_VIEWS_KEY, JSON.stringify({ activeId, views }))
  } catch {
    /* ignore */
  }
}

function formatBytes(n: number | undefined) {
  const bytes = n ?? 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(ts: number | undefined | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

function pluginTags(item: StoreListing) {
  return Array.isArray(item.tags) ? item.tags.filter(Boolean) : []
}

function PluginTags({ item }: { item: StoreListing }) {
  const tags = pluginTags(item)
  if (!tags.length) return <span className="pstore-muted">—</span>
  return (
    <span className="pstore-tags">
      {tags.map((tag) => (
        <span key={tag} className="pstore-tag">{tag}</span>
      ))}
    </span>
  )
}

function PluginAuthor({ item }: { item: StoreListing }) {
  const author = item.author?.trim()
  if (!author) return <span className="pstore-muted">—</span>
  const href = item.authorUrl?.trim()
  if (href && /^https?:\/\//i.test(href)) {
    return (
      <a className="pstore-author-link" href={href} target="_blank" rel="noreferrer">
        {author}
      </a>
    )
  }
  return <span>{author}</span>
}

function pluginKindLabel(item: StoreListing) {
  if (item.hasHost && item.hasWeb) return 'Host + Web'
  if (item.hasHost) return 'Host'
  if (item.hasWeb) return 'Web'
  return '—'
}

type PluginGroupKey = 'running' | 'open' | 'closed'
function pluginGroup(item: StoreListing): PluginGroupKey {
  if (item.running) return 'running'
  if (item.enabled) return 'open'
  return 'closed'
}

function PluginStatusPill({ item }: { item: StoreListing }) {
  if (item.running) {
    return (
      <span className="pstore-status-pill is-doing">
        <ArrowPathIcon aria-hidden className="size-[14px]" />
        <span>运行中</span>
      </span>
    )
  }
  if (item.enabled) {
    return (
      <span className="pstore-status-pill is-done">
        <CheckCircleIcon aria-hidden className="size-[14px]" />
        <span>已打开</span>
      </span>
    )
  }
  return (
    <span className="pstore-status-pill is-todo">
      <MinusCircleIcon aria-hidden className="size-[14px]" />
      <span>已关闭</span>
    </span>
  )
}

function PluginRowActions({
  item,
  busy,
  onOpen,
  onClose,
  onUninstall,
}: {
  item: StoreListing
  busy: string | null
  onOpen: (id: string) => void
  onClose: (id: string) => void
  onUninstall: (id: string) => void
}) {
  const disabled = Boolean(busy?.endsWith(`:${item.id}`))
  return (
    <div className="pstore-actions">
      {item.enabled ? (
        <button
          type="button"
          className="pstore-iconbtn"
          data-testid={`plugin-store-close-${item.id}`}
          data-biu-action="close"
          title="关闭"
          aria-label={`关闭 ${item.name}`}
          disabled={disabled}
          onClick={() => onClose(item.id)}
        >
          <StopIcon aria-hidden className="size-[14px]" />
        </button>
      ) : (
        <button
          type="button"
          className="pstore-iconbtn"
          data-testid={`plugin-store-open-${item.id}`}
          data-biu-action="open"
          title="打开"
          aria-label={`打开 ${item.name}`}
          disabled={disabled}
          onClick={() => onOpen(item.id)}
        >
          <PlayIcon aria-hidden className="size-[14px]" />
        </button>
      )}
      <button
        type="button"
        className="pstore-iconbtn is-danger"
        data-testid={`plugin-store-uninstall-${item.id}`}
        title="卸载"
        aria-label={`卸载 ${item.name}`}
        disabled={disabled}
        onClick={() => onUninstall(item.id)}
      >
        <TrashIcon aria-hidden className="size-[14px]" />
      </button>
    </div>
  )
}

function PluginStorePage(props: SlotProps) {
  const compact = Boolean(props.compact)
  const [items, setItems] = useState<StoreListing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await readJson<{ items: StoreListing[] }>('/api/plugin-store')
      setItems(data.items ?? [])
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.hidden) return
      void refresh()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function openPlugin(id: string) {
    setBusy(`on:${id}`)
    try {
      await readJson('/api/plugin-store/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function closePlugin(id: string) {
    setBusy(`off:${id}`)
    try {
      await readJson('/api/plugin-store/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function uninstall(id: string) {
    setBusy(`rm:${id}`)
    setPendingUninstall(null)
    try {
      await readJson('/api/plugin-store/uninstall', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  const pending = items.find((item) => item.id === pendingUninstall) ?? null
  const boot = typeof window === 'undefined' ? { activeId: 'view-all', views: seedPluginViews() } : readPluginViews()
  const [views, setViews] = useState<PluginSavedView[]>(boot.views)
  const [activeViewId, setActiveViewId] = useState(boot.activeId)
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0] ?? null
  const [config, setConfig] = useState<PluginViewConfig>(activeView?.config ?? defaultPluginConfig())
  const mode = config.mode
  const filter = config.filter
  const sort = config.sort
  const [query, setQuery] = useState('')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const [dlg, setDlg] = useState<{ kind: 'saveAs' } | { kind: 'rename'; view: PluginSavedView } | { kind: 'delete'; view: PluginSavedView } | null>(null)
  const [dlgName, setDlgName] = useState('')
  const dlgInputRef = useRef<HTMLInputElement>(null)

  const persistViews = (nextId: string, nextViews: PluginSavedView[]) => {
    setActiveViewId(nextId)
    setViews(nextViews)
    writePluginViews(nextId, nextViews)
  }

  const patchConfig = (patch: Partial<PluginViewConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...patch, filter: patch.filter ? { ...c.filter, ...patch.filter } : c.filter, sort: patch.sort ?? c.sort }
      setViews((prev) => {
        const updated = prev.map((v) => (v.id === activeViewId ? { ...v, config: next } : v))
        writePluginViews(activeViewId, updated)
        return updated
      })
      return next
    })
  }

  useEffect(() => {
    if (!viewMenuOpen && !modeMenuOpen && !sortMenuOpen && !filterOpen) return
    const onDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (
        viewMenuRef.current?.contains(node) ||
        modeMenuRef.current?.contains(node) ||
        sortMenuRef.current?.contains(node) ||
        filterRef.current?.contains(node)
      ) return
      setViewMenuOpen(false)
      setModeMenuOpen(false)
      setSortMenuOpen(false)
      setFilterOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [viewMenuOpen, modeMenuOpen, sortMenuOpen, filterOpen])

  useEffect(() => {
    if (!dlg) return
    const id = window.setTimeout(() => dlgInputRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDlg(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [dlg])

  const switchView = (id: string) => {
    const v = views.find((x) => x.id === id)
    if (!v) return
    setActiveViewId(id)
    setConfig(v.config)
    writePluginViews(id, views)
    setViewMenuOpen(false)
  }

  const cycleSort = (field: PluginSortField) => {
    if (sort.field !== field) patchConfig({ sort: { field, dir: 'asc' } })
    else if (sort.dir === 'asc') patchConfig({ sort: { field, dir: 'desc' } })
    else patchConfig({ sort: { field: 'status', dir: 'asc' } })
  }

  const filterActive = Boolean(filter.status || filter.kind || filter.tag || filter.time)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) for (const tag of pluginTags(item)) set.add(tag)
    return [...set].sort((a, b) => a.localeCompare(b, 'zh'))
  }, [items])
  const sortCustom = sort.field !== 'status' || sort.dir !== 'asc'
  const currentMode = PLUGIN_VIEW_MODES.find((opt) => opt.id === mode) ?? PLUGIN_VIEW_MODES[1]!

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const ageMs = filter.time === '1h' ? 3600e3 : filter.time === '24h' ? 86400e3 : filter.time === '7d' ? 7 * 86400e3 : filter.time === '30d' ? 30 * 86400e3 : 0
    const cutoff = ageMs ? Date.now() - ageMs : 0
    const filtered = items.filter((item) => {
      if (q) {
        const hay = `${item.name} ${item.id} ${item.blurb} ${item.author ?? ''} ${pluginTags(item).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filter.status && pluginGroup(item) !== filter.status) return false
      if (filter.kind === 'web' && !item.hasWeb) return false
      if (filter.kind === 'host' && !item.hasHost) return false
      if (filter.tag && !pluginTags(item).includes(filter.tag)) return false
      if (cutoff) {
        const recent = Math.max(item.createdAt ?? 0, item.updatedAt ?? 0, item.lastRunAt ?? 0)
        if (!recent || recent < cutoff) return false
      }
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let c = 0
      if (sort.field === 'name') c = a.name.localeCompare(b.name, 'zh')
      else if (sort.field === 'size') c = (a.bytes ?? 0) - (b.bytes ?? 0)
      else if (sort.field === 'created') c = (a.createdAt ?? 0) - (b.createdAt ?? 0)
      else if (sort.field === 'updated') c = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
      else if (sort.field === 'lastRun') c = (a.lastRunAt ?? 0) - (b.lastRunAt ?? 0)
      else c = STATUS_RANK[pluginGroup(a)] - STATUS_RANK[pluginGroup(b)]
      return c * dir || a.name.localeCompare(b.name, 'zh')
    })
  }, [items, query, filter, sort])

  const grouped = {
    running: visible.filter((item) => pluginGroup(item) === 'running'),
    open: visible.filter((item) => pluginGroup(item) === 'open'),
    closed: visible.filter((item) => pluginGroup(item) === 'closed'),
  }
  const listGroups: Array<{ key: PluginGroupKey; label: string; icon: ReactNode; tone: string }> = [
    { key: 'running', label: '运行中', icon: <ArrowPathIcon aria-hidden className="size-[14px]" />, tone: 'doing' },
    { key: 'open', label: '已打开', icon: <CheckCircleIcon aria-hidden className="size-[14px]" />, tone: 'done' },
    { key: 'closed', label: '已关闭', icon: <MinusCircleIcon aria-hidden className="size-[14px]" />, tone: 'todo' },
  ]

  const actions = (item: StoreListing) => (
    <PluginRowActions
      item={item}
      busy={busy}
      onOpen={(id) => void openPlugin(id)}
      onClose={(id) => void closePlugin(id)}
      onUninstall={setPendingUninstall}
    />
  )

  const currentModeIcon = currentMode.icon

  const submitDlg = () => {
    if (!dlg) return
    if (dlg.kind === 'delete') {
      const rest = views.filter((x) => x.id !== dlg.view.id)
      if (!rest.length) return
      const next = rest[0]!
      persistViews(activeViewId === dlg.view.id ? next.id : activeViewId, rest)
      if (activeViewId === dlg.view.id) setConfig(next.config)
      setDlg(null)
      return
    }
    const name = dlgName.trim()
    if (!name) return
    if (dlg.kind === 'rename') {
      const next = views.map((v) => (v.id === dlg.view.id ? { ...v, name } : v))
      persistViews(activeViewId, next)
      setDlg(null)
      return
    }
    const id = `view-${Date.now().toString(36)}`
    const created: PluginSavedView = { id, name, config }
    persistViews(id, [...views, created])
    setDlg(null)
  }

  return (
    <div
      className={`tasks-root pstore-root${compact ? ' is-compact' : ''}`}
      data-testid={compact ? 'plugin-store-inspector' : 'plugin-store-page'}
    >
      <div className="tasks-main">
        <div className="tasks-toolbar">
          <div className="tasks-toolbar-left">
            <div className="tasks-viewdd-wrap" ref={viewMenuRef}>
              <button
                type="button"
                className={`tasks-viewdd-btn${viewMenuOpen ? ' is-active' : ''}`}
                aria-label="切换视图"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                onClick={() => setViewMenuOpen((v) => !v)}
              >
                <Squares2X2Icon aria-hidden className="size-[14px]" />
                <span className="tasks-viewdd-name">{activeView?.name ?? '未保存'}</span>
                <ChevronDownIcon aria-hidden className="size-[14px]" />
              </button>
              {viewMenuOpen ? (
                <div className="tasks-viewdd-menu" role="menu">
                  <div className="tasks-viewdd-head">视图</div>
                  {views.map((v) => (
                    <div key={v.id} className={`tasks-viewdd-item${v.id === activeViewId ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className="tasks-viewdd-item-main"
                        role="menuitemradio"
                        aria-checked={v.id === activeViewId}
                        onClick={() => switchView(v.id)}
                      >
                        <span className="tasks-viewdd-item-name">{v.name}</span>
                        {v.id === activeViewId ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-viewdd-check" /> : null}
                      </button>
                      <span className="tasks-viewdd-item-actions">
                        <button type="button" className="tasks-viewdd-act" title="重命名" onClick={() => { setDlgName(v.name); setDlg({ kind: 'rename', view: v }); setViewMenuOpen(false) }}>
                          <PencilSquareIcon aria-hidden className="size-[14px]" />
                        </button>
                        {views.length > 1 ? (
                          <button type="button" className="tasks-viewdd-act is-danger" title="删除" onClick={() => { setDlg({ kind: 'delete', view: v }); setViewMenuOpen(false) }}>
                            <TrashIcon aria-hidden className="size-[14px]" />
                          </button>
                        ) : null}
                      </span>
                    </div>
                  ))}
                  <div className="tasks-viewdd-foot">
                    <button type="button" className="tasks-viewdd-saveas" onClick={() => { setDlgName(activeView ? `${activeView.name} 副本` : ''); setDlg({ kind: 'saveAs' }); setViewMenuOpen(false) }}>
                      <PlusIcon aria-hidden className="size-[14px]" />
                      另存为视图
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="tasks-toolbar-right">
            <label className="tasks-search-wrap">
              <MagnifyingGlassIcon aria-hidden className="size-[14px]" />
              <input
                className="tasks-search"
                value={query}
                placeholder="搜索名称 / ID / 说明 / 作者 / 标签"
                aria-label="搜索插件"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="tasks-sort-wrap" ref={modeMenuRef}>
              <button
                type="button"
                className={`tasks-sort-btn${modeMenuOpen ? ' is-active' : ''}`}
                aria-label="查看模式"
                title={`模式：${currentMode.label}`}
                aria-haspopup="menu"
                aria-expanded={modeMenuOpen}
                onClick={() => setModeMenuOpen((v) => !v)}
              >
                {currentModeIcon}
              </button>
              {modeMenuOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">查看模式</div>
                  {PLUGIN_VIEW_MODES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`tasks-sort-item${mode === opt.id ? ' is-active' : ''}`}
                      role="menuitemradio"
                      aria-checked={mode === opt.id}
                      onClick={() => {
                        patchConfig({ mode: opt.id })
                        setModeMenuOpen(false)
                      }}
                    >
                      <span className="tasks-sort-item-label">
                        <span className="tasks-mode-item-ico">{opt.icon}</span>
                        {opt.label}
                      </span>
                      {mode === opt.id ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-sort-item-icon is-on" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tasks-sort-wrap" ref={sortMenuRef}>
              <button
                type="button"
                className={`tasks-sort-btn${sortMenuOpen ? ' is-active' : ''}${sortCustom ? ' is-custom' : ''}`}
                aria-label="排序"
                title={`排序：${sort.field}${sort.dir === 'asc' ? ' ↑' : ' ↓'}`}
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
                onClick={() => setSortMenuOpen((v) => !v)}
              >
                <ArrowsUpDownIcon aria-hidden className="size-[14px]" />
                {sortCustom ? <span className="tasks-sort-dot" aria-hidden /> : null}
              </button>
              {sortMenuOpen ? (
                <div className="tasks-sort-menu" role="menu">
                  <div className="tasks-sort-head">排序依据</div>
                  {([
                    ['status', '状态'],
                    ['name', '名称'],
                    ['size', '大小'],
                    ['created', '创建时间'],
                    ['updated', '最近更新'],
                    ['lastRun', '上次运行'],
                  ] as const).map(([field, label]) => {
                    const isCurrent = sort.field === field
                    const stateIcon = isCurrent
                      ? sort.dir === 'asc'
                        ? <ArrowUpIcon aria-hidden className="size-[14px]" />
                        : <ArrowDownIcon aria-hidden className="size-[14px]" />
                      : null
                    return (
                      <button
                        key={field}
                        type="button"
                        className={`tasks-sort-item${isCurrent ? ' is-active' : ''}`}
                        role="menuitemradio"
                        aria-checked={isCurrent}
                        onClick={() => cycleSort(field)}
                      >
                        <span className="tasks-sort-item-label">{label}</span>
                        <span className={`tasks-sort-item-icon${isCurrent ? ' is-on' : ''}`}>{stateIcon}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
            <div className="tasks-filter-btn-wrap" ref={filterRef}>
              <button
                type="button"
                className={`tasks-refresh tasks-rbar-btn${filterOpen ? ' is-active' : ''}${filterActive ? ' is-active' : ''}`}
                aria-label="筛选插件"
                title="筛选"
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <FunnelIcon aria-hidden className="size-[14px]" />
                {filterActive ? <span className="tasks-filter-dot" aria-hidden /> : null}
              </button>
              {filterOpen ? (
                <div className="tasks-filter-menu" role="menu">
                  <label className="tasks-filter-menu-label">
                    <span>按状态</span>
                    <select
                      className="tasks-filter"
                      aria-label="按状态筛选"
                      value={filter.status}
                      onChange={(e) => patchConfig({ filter: { ...filter, status: e.target.value as PluginViewFilter['status'] } })}
                    >
                      <option value="">全部状态</option>
                      <option value="running">运行中</option>
                      <option value="open">已打开</option>
                      <option value="closed">已关闭</option>
                    </select>
                  </label>
                  <label className="tasks-filter-menu-label">
                    <span>按类型</span>
                    <select
                      className="tasks-filter"
                      aria-label="按类型筛选"
                      value={filter.kind}
                      onChange={(e) => patchConfig({ filter: { ...filter, kind: e.target.value as PluginViewFilter['kind'] } })}
                    >
                      <option value="">全部类型</option>
                      <option value="web">Web</option>
                      <option value="host">Host</option>
                    </select>
                  </label>
                  <label className="tasks-filter-menu-label">
                    <span>按标签</span>
                    <select
                      className="tasks-filter"
                      aria-label="按标签筛选"
                      value={filter.tag}
                      onChange={(e) => patchConfig({ filter: { ...filter, tag: e.target.value } })}
                    >
                      <option value="">全部标签</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                  <label className="tasks-filter-menu-label">
                    <span>按时间</span>
                    <select
                      className="tasks-filter"
                      aria-label="按时间筛选"
                      value={filter.time}
                      onChange={(e) => patchConfig({ filter: { ...filter, time: e.target.value } })}
                    >
                      <option value="">全部时间</option>
                      <option value="1h">最近 1 小时</option>
                      <option value="24h">最近 1 天</option>
                      <option value="7d">最近 7 天</option>
                      <option value="30d">最近 30 天</option>
                    </select>
                  </label>
                  {filterActive ? (
                    <button
                      type="button"
                      className="tasks-filter-clear"
                      onClick={() => patchConfig({ filter: { status: '', kind: '', tag: '', time: '' } })}
                    >
                      清除筛选
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="tasks-refresh"
              aria-label="刷新插件"
              title="刷新"
              onClick={() => void refresh()}
            >
              <ArrowPathIcon aria-hidden className="size-[14px]" />
            </button>
          </div>
        </div>

        {error ? (
          <p className="pstore-error" data-testid="plugin-store-error">
            {error}
          </p>
        ) : null}

        {visible.length === 0 && !error ? (
          <p className="pstore-empty" data-testid="plugin-store-empty">
            {items.length === 0 ? '没有插件' : '没有符合筛选的插件'}
          </p>
        ) : mode === 'queue' ? (
          <div className={`pstore-list${compact ? ' is-compact' : ''}`}>
            {listGroups.map((group) => {
              const rows = grouped[group.key]
              if (!rows.length) return null
              return (
                <section key={group.key} className="pstore-list-group">
                  <header className={`pstore-list-ghead is-${group.tone}`}>
                    {group.icon}
                    <span>{group.label}</span>
                    <span className="pstore-list-count">{rows.length}</span>
                  </header>
                  <ul className="pstore-list-ul">
                    {rows.map((item) => (
                      <li
                        key={item.id}
                        className="pstore-list-item"
                        data-testid={`plugin-store-card-${item.id}`}
                        data-biu-kind="plugin"
                        data-biu-id={item.id}
                        data-biu-label={item.name}
                      >
                        <div className="pstore-list-main">
                          <span className="pstore-list-title">{item.name}</span>
                          <span className="pstore-list-id">{item.id}</span>
                          <span className="pstore-list-size">{formatBytes(item.bytes)}</span>
                          {actions(item)}
                        </div>
                        <div className="pstore-list-sub">
                          <PluginTags item={item} />
                          <span className="pstore-list-sep">·</span>
                          <PluginAuthor item={item} />
                          <span className="pstore-list-sep">·</span>
                          <span>创建 {formatWhen(item.createdAt)}</span>
                          <span className="pstore-list-sep">·</span>
                          <span>上次运行 {formatWhen(item.lastRunAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : mode === 'cards' ? (
          <div className={`pstore-cardgrid${compact ? ' is-compact' : ''}`}>
            {visible.map((item) => (
              <div
                key={item.id}
                className="pstore-minicard"
                data-testid={`plugin-store-card-${item.id}`}
                data-biu-kind="plugin"
                data-biu-id={item.id}
                data-biu-label={item.name}
              >
                <div className="pstore-minicard-title">{item.name}</div>
                <div className="pstore-minicard-meta">{formatBytes(item.bytes)} · {pluginKindLabel(item)}</div>
                <div className="pstore-minicard-meta">
                  <PluginAuthor item={item} />
                  {' · 创建 '}
                  {formatWhen(item.createdAt)}
                  {' · 上次 '}
                  {formatWhen(item.lastRunAt)}
                </div>
                <PluginTags item={item} />
                <div className="pstore-minicard-foot">
                  <PluginStatusPill item={item} />
                  {actions(item)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pstore-table-wrap">
            <table className="pstore-table">
              <thead>
                <tr>
                  <th>
                    <span className="pstore-th">
                      <PuzzlePieceIcon aria-hidden className="size-[14px]" />
                      名称
                    </span>
                  </th>
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <HashtagIcon aria-hidden className="size-[14px]" />
                        ID
                      </span>
                    </th>
                  ) : null}
                  <th>
                    <span className="pstore-th">
                      <MinusCircleIcon aria-hidden className="size-[14px]" />
                      状态
                    </span>
                  </th>
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <TagIcon aria-hidden className="size-[14px]" />
                        标签
                      </span>
                    </th>
                  ) : null}
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <UserIcon aria-hidden className="size-[14px]" />
                        作者
                      </span>
                    </th>
                  ) : null}
                  <th>
                    <span className="pstore-th">
                      <CircleStackIcon aria-hidden className="size-[14px]" />
                      大小
                    </span>
                  </th>
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <ClockIcon aria-hidden className="size-[14px]" />
                        创建
                      </span>
                    </th>
                  ) : null}
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <PlayIcon aria-hidden className="size-[14px]" />
                        上次运行
                      </span>
                    </th>
                  ) : null}
                  {!compact ? (
                    <th>
                      <span className="pstore-th">
                        <Bars3BottomLeftIcon aria-hidden className="size-[14px]" />
                        类型
                      </span>
                    </th>
                  ) : null}
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    data-testid={`plugin-store-card-${item.id}`}
                    data-biu-kind="plugin"
                    data-biu-id={item.id}
                    data-biu-label={item.name}
                  >
                    <td className="pstore-col-name">{item.name}</td>
                    {!compact ? <td className="pstore-col-id">{item.id}</td> : null}
                    <td>
                      <PluginStatusPill item={item} />
                    </td>
                    {!compact ? <td><PluginTags item={item} /></td> : null}
                    {!compact ? <td className="pstore-col-author"><PluginAuthor item={item} /></td> : null}
                    <td className="pstore-col-size">{formatBytes(item.bytes)}</td>
                    {!compact ? <td className="pstore-col-time">{formatWhen(item.createdAt)}</td> : null}
                    {!compact ? <td className="pstore-col-time">{formatWhen(item.lastRunAt)}</td> : null}
                    {!compact ? <td className="pstore-col-kind">{pluginKindLabel(item)}</td> : null}
                    <td className="pstore-col-action">{actions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dlg ? (
        <div
          className="tasks-viewdlg-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDlg(null) }}
        >
          <div className="tasks-viewdlg" role="dialog" aria-modal="true">
            <div className="tasks-viewdlg-title">
              {dlg.kind === 'delete' ? '删除视图' : dlg.kind === 'rename' ? '重命名视图' : '另存为视图'}
            </div>
            {dlg.kind === 'delete' ? (
              <div className="tasks-viewdlg-body">
                <p>确定删除视图「{dlg.view.name}」？</p>
              </div>
            ) : (
              <div className="tasks-viewdlg-body">
                <input
                  ref={dlgInputRef}
                  className="tasks-viewdlg-input"
                  value={dlgName}
                  placeholder="视图名称"
                  maxLength={80}
                  onChange={(e) => setDlgName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitDlg() }}
                />
              </div>
            )}
            <div className="tasks-viewdlg-actions">
              <button type="button" className="tasks-viewdlg-cancel" onClick={() => setDlg(null)}>取消</button>
              <button
                type="button"
                className={`tasks-viewdlg-ok${dlg.kind === 'delete' ? ' is-danger' : ''}`}
                onClick={submitDlg}
              >
                {dlg.kind === 'delete' ? '删除' : dlg.kind === 'rename' ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-80 flex items-center justify-center bg-black/55 p-4"
            data-testid="plugin-store-uninstall-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plugin-store-uninstall-title"
            onClick={() => {
              if (busy?.startsWith('rm:')) return
              setPendingUninstall(null)
            }}
          >
            <div
              className="w-[min(100%,320px)] rounded-[10px] border border-(--dsw-border) bg-(--dsw-sidebar) p-4 text-(--dsw-label)"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="plugin-store-uninstall-title" className="m-0 text-[13px] font-semibold">
                卸载「{pending.name}」？
              </h2>
              <p className="mt-1.5 mb-0 text-[11px] leading-[1.45] text-(--dsw-label-3)">
                卸载后会永久删除这份插件代码，货架上也会消失。若只是暂时不用，请点关闭。
              </p>
              <div className="mt-3 flex justify-end gap-1.5">
                <button
                  type="button"
                  className="rounded-md border-0 bg-(--dsw-hover) px-2.5 py-1 text-[11px] text-(--dsw-label) hover:bg-[#353535]"
                  data-testid="plugin-store-uninstall-cancel"
                  disabled={busy === `rm:${pending.id}`}
                  onClick={() => setPendingUninstall(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-md border-0 bg-(--dsw-hover) px-2.5 py-1 text-[11px] font-medium text-(--dsw-label) hover:bg-[#353535]"
                  data-testid="plugin-store-uninstall-confirm"
                  data-biu-action="uninstall"
                  disabled={busy === `rm:${pending.id}`}
                  onClick={() => void uninstall(pending.id)}
                >
                  {busy === `rm:${pending.id}` ? '卸载中…' : '确认卸载'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  )
}

type AppModulesService = {
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: (props: { className?: string }) => unknown
  }) => unknown
}

const moduleProps = { moduleId: 'plugins' }
const inspectorProps = { tabId: 'plugins', tabLabel: '插件', tabIcon: PuzzlePieceIcon }

function PluginStoreInspectorPanel(props: SlotProps) {
  return <PluginStorePage {...props} compact />
}

function resolveListing(extraId: string, items: StoreListing[]) {
  return (
    items.find((item) => item.id === extraId) ??
    items
      .filter((item) => extraId.startsWith(`${item.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0] ??
    null
  )
}

const WIN_MIN_W = 200
const WIN_MIN_H = 160
const WIN_CHROME_H = 32
const WIN_DEFAULT_W = 480
const WIN_DEFAULT_H = 360
let pluginWindowZ = 21

type WinGeom = { x: number; y: number; w: number; h: number }
type ResizeEdge = { north?: boolean; south?: boolean; east?: boolean; west?: boolean }
type ResizeSession = WinGeom & ResizeEdge & { px: number; py: number }

function defaultPos(seed: string): { x: number; y: number } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return {
    x: Math.max(16, Math.round(window.innerWidth / 2 - 160) + (hash % 5) * 28 - 56),
    y: Math.max(16, Math.round(window.innerHeight / 2 - 120) + (hash % 4) * 24 - 48),
  }
}

function clampGeom(next: WinGeom, lockSize: boolean): WinGeom {
  const maxX = Math.max(0, window.innerWidth - 64)
  const maxY = Math.max(0, window.innerHeight - 36)
  return {
    x: Math.min(maxX, Math.max(0, next.x)),
    y: Math.min(maxY, Math.max(0, next.y)),
    w: lockSize ? Math.min(window.innerWidth, Math.max(WIN_MIN_W, next.w)) : next.w,
    h: lockSize ? Math.min(window.innerHeight, Math.max(WIN_MIN_H, next.h)) : next.h,
  }
}

function innerHasExplicitSize(el: HTMLElement | null): { w: boolean; h: boolean } {
  if (!el) return { w: false, h: false }
  return {
    w: Boolean(el.style.width) || el.hasAttribute('width'),
    h: Boolean(el.style.height) || el.hasAttribute('height'),
  }
}

function measurePluginBox(body: HTMLElement): { w: number; h: number } {
  const inner = body.firstElementChild as HTMLElement | null
  const explicit = innerHasExplicitSize(inner)
  const w = explicit.w && inner ? inner.offsetWidth : WIN_DEFAULT_W
  const contentH = explicit.h && inner ? inner.offsetHeight : WIN_DEFAULT_H
  return {
    w: Math.max(WIN_MIN_W, w),
    h: Math.max(WIN_MIN_H, contentH + WIN_CHROME_H),
  }
}

function PluginAppWindow({
  extraId,
  title,
  pluginId,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
  children,
}: {
  extraId: string
  title: string
  pluginId: string
  fullscreen: boolean
  onClose: () => void
  onMinimize: () => void
  onToggleFullscreen: () => void
  children: ReactNode
}) {
  const [geom, setGeom] = useState<WinGeom>(() => ({
    ...defaultPos(extraId),
    w: WIN_DEFAULT_W,
    h: WIN_DEFAULT_H + WIN_CHROME_H,
  }))
  const [userSized, setUserSized] = useState(false)
  const [z, setZ] = useState(() => ++pluginWindowZ)
  const boxRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const resizeRef = useRef<ResizeSession | null>(null)

  useEffect(() => {
    if (userSized || fullscreen) return
    const body = bodyRef.current
    const box = boxRef.current
    if (!body || !box) return
    const apply = () => {
      const size = measurePluginBox(body)
      setGeom((cur) => {
        const next = { ...cur, ...size }
        if (!centeredRef.current) {
          centeredRef.current = true
          next.x = Math.max(16, Math.round((window.innerWidth - size.w) / 2))
          next.y = Math.max(16, Math.round((window.innerHeight - size.h) / 2))
        }
        return clampGeom(next, true)
      })
    }
    apply()
    const id = window.requestAnimationFrame(apply)
    const inner = body.firstElementChild
    const ro = inner ? new ResizeObserver(apply) : null
    if (inner) ro?.observe(inner)
    return () => {
      window.cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [userSized, fullscreen])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag) {
        setGeom((cur) =>
          clampGeom(
            {
              ...cur,
              x: drag.x + event.clientX - drag.px,
              y: drag.y + event.clientY - drag.py,
            },
            userSized,
          ),
        )
        return
      }
      const resize = resizeRef.current
      if (!resize) return
      const dx = event.clientX - resize.px
      const dy = event.clientY - resize.py
      let { x, y, w, h } = resize
      if (resize.east) w = resize.w + dx
      if (resize.south) h = resize.h + dy
      if (resize.west) {
        w = resize.w - dx
        x = resize.x + dx
        if (w < WIN_MIN_W) {
          x = resize.x + resize.w - WIN_MIN_W
          w = WIN_MIN_W
        }
      }
      if (resize.north) {
        h = resize.h - dy
        y = resize.y + dy
        if (h < WIN_MIN_H) {
          y = resize.y + resize.h - WIN_MIN_H
          h = WIN_MIN_H
        }
      }
      setUserSized(true)
      setGeom(clampGeom({ x, y, w, h }, true))
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [userSized])

  const bringFront = () => setZ(++pluginWindowZ)

  const startDrag = (event: ReactPointerEvent) => {
    if (fullscreen) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    bringFront()
    dragRef.current = { px: event.clientX, py: event.clientY, x: geom.x, y: geom.y }
  }

  const startResize = (edge: ResizeEdge) => (event: ReactPointerEvent) => {
    if (fullscreen) return
    event.preventDefault()
    event.stopPropagation()
    bringFront()
    const el = boxRef.current
    const r = el?.getBoundingClientRect()
    const current = {
      ...geom,
      w: r?.width ?? geom.w,
      h: r?.height ?? geom.h,
    }
    resizeRef.current = { ...edge, ...current, px: event.clientX, py: event.clientY }
  }

  const style = fullscreen
    ? { top: 16, left: 16, width: 'calc(100vw - 32px)', height: 'calc(100vh - 32px)', zIndex: z + 8 }
    : { top: geom.y, left: geom.x, width: geom.w, height: geom.h, zIndex: z }

  const handles: Array<{ key: string; className: string; edge: ResizeEdge }> = [
    { key: 'n', className: 'absolute inset-x-2 top-0 h-1.5 cursor-n-resize', edge: { north: true } },
    { key: 's', className: 'absolute inset-x-2 bottom-0 h-1.5 cursor-s-resize', edge: { south: true } },
    { key: 'e', className: 'absolute inset-y-2 right-0 w-1.5 cursor-e-resize', edge: { east: true } },
    { key: 'w', className: 'absolute inset-y-2 left-0 w-1.5 cursor-w-resize', edge: { west: true } },
    { key: 'ne', className: 'absolute top-0 right-0 size-3 cursor-nesw-resize', edge: { north: true, east: true } },
    { key: 'nw', className: 'absolute top-0 left-0 size-3 cursor-nwse-resize', edge: { north: true, west: true } },
    { key: 'se', className: 'absolute bottom-0 right-0 size-3 cursor-nwse-resize', edge: { south: true, east: true } },
    { key: 'sw', className: 'absolute bottom-0 left-0 size-3 cursor-nesw-resize', edge: { south: true, west: true } },
  ]

  return (
    <section
      ref={boxRef}
      className="group/win pointer-events-auto fixed flex min-h-0 min-w-0 flex-col overflow-hidden bg-transparent text-(--dsw-label)"
      style={style}
      data-testid={`plugin-app-window-${extraId}`}
      data-plugin-id={pluginId}
      data-fullscreen={fullscreen || undefined}
      onPointerDown={bringFront}
    >
      <header
        className={`flex h-8 shrink-0 items-center gap-3 bg-transparent px-3 opacity-0 transition-opacity duration-150 group-hover/win:opacity-100 ${fullscreen ? '' : 'cursor-grab active:cursor-grabbing'
          }`}
        onPointerDown={startDrag}
      >
        <div className="group/traffic flex items-center gap-1.75">
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#ff5f57] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title="关闭"
            aria-label={`关闭 ${title}`}
            onClick={onClose}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[8px] leading-none font-bold text-[#4d0000] group-hover/traffic:flex">
              ×
            </span>
          </button>
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#febc2e] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title="最小化"
            aria-label={`最小化 ${title}`}
            onClick={onMinimize}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[9px] leading-none font-bold text-[#985700] group-hover/traffic:flex">
              −
            </span>
          </button>
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#28c840] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title={fullscreen ? '还原' : '全屏'}
            aria-label={fullscreen ? `还原 ${title}` : `全屏 ${title}`}
            onClick={onToggleFullscreen}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[7px] leading-none font-bold text-[#0b5f18] group-hover/traffic:flex">
              {fullscreen ? '↘' : '↗'}
            </span>
          </button>
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-[12px] font-medium tracking-tight text-white/70">
          {title}
        </div>
        <span className="w-13 shrink-0" aria-hidden />
      </header>
      <div ref={bodyRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-transparent">
        {children}
      </div>
      {fullscreen
        ? null
        : handles.map((item) => (
          <div
            key={item.key}
            className={`${item.className} pointer-events-none z-10 opacity-0 group-hover/win:pointer-events-auto group-hover/win:opacity-100`}
            onPointerDown={startResize(item.edge)}
          />
        ))}
    </section>
  )
}

/** 运行中的商店插件 UI 浮层：默认套 macOS 窗口框，不插入货架列表。 */
function PluginStoreExtrasLayer(props: SlotProps) {
  const slots = props.slots as SlotsService
  const extras = useSlotEntries(slots, 'plugin-store-extras')
  const [listings, setListings] = useState<StoreListing[]>([])
  const [minimized, setMinimized] = useState<Record<string, boolean>>({})
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)

  useEffect(() => {
    if (extras.length === 0) return
    let cancelled = false
    void readJson<{ items: StoreListing[] }>('/api/plugin-store')
      .then((data) => {
        if (!cancelled) setListings(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setListings([])
      })
    return () => {
      cancelled = true
    }
  }, [extras.map((item) => item.id).join('|')])

  async function closePlugin(id: string) {
    try {
      await readJson('/api/plugin-store/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      /* 窗口仍会随 extras 卸载消失 */
    }
  }

  if (extras.length === 0) return null
  const sorted = [...extras].sort((a, b) => a.order - b.order)
  const hidden = sorted.filter((entry) => minimized[entry.id])
  return (
    <div className="pointer-events-none fixed inset-0 z-20" data-testid="plugin-store-extras">
      {sorted.map((entry) => {
        if (minimized[entry.id]) return null
        const listing = resolveListing(entry.id, listings)
        const pluginId = listing?.id ?? entry.id
        const title = listing?.name ?? entry.id
        const Component = entry.Component
        return (
          <PluginAppWindow
            key={entry.id}
            extraId={entry.id}
            title={title}
            pluginId={pluginId}
            fullscreen={fullscreenId === entry.id}
            onClose={() => {
              setMinimized((cur) => {
                const next = { ...cur }
                delete next[entry.id]
                return next
              })
              if (fullscreenId === entry.id) setFullscreenId(null)
              void closePlugin(pluginId)
            }}
            onMinimize={() => {
              if (fullscreenId === entry.id) setFullscreenId(null)
              setMinimized((cur) => ({ ...cur, [entry.id]: true }))
            }}
            onToggleFullscreen={() => setFullscreenId((cur) => (cur === entry.id ? null : entry.id))}
          >
            <Component renderSlot={() => null} />
          </PluginAppWindow>
        )
      })}
      {hidden.length ? (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {hidden.map((entry) => {
            const listing = resolveListing(entry.id, listings)
            const title = listing?.name ?? entry.id
            return (
              <button
                key={entry.id}
                type="button"
                className="rounded-lg border border-white/10 bg-[#3a3a3c] px-3 py-1.5 text-[11px] font-medium text-white/85 shadow-[0_8px_24px_rgba(0,0,0,.35)]"
                title={`还原 ${title}`}
                onClick={() =>
                  setMinimized((cur) => {
                    const next = { ...cur }
                    delete next[entry.id]
                    return next
                  })
                }
              >
                {title}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  const appModules = ctx.get('appModules') as AppModulesService | undefined
  if (!slots) throw new Error('slots service required')
  if (!appModules) throw new Error('appModules service required')
  appModules.register({
    id: 'plugins',
    label: '插件',
    path: '/plugins',
    description: 'Install prebuilt plugins without rebuilding the app',
    order: 30,
    Icon: PuzzlePieceIcon,
  })
  slots.place('app-modules', PluginStorePage, {
    key: 'plugin-store-module',
    order: 30,
    props: () => moduleProps,
  })
  slots.place('inspector-panels', PluginStoreInspectorPanel, {
    key: 'plugin-store-inspector',
    order: 11,
    props: () => inspectorProps,
  })
  slots.place('root-overlays', PluginStoreExtrasLayer, {
    key: 'plugin-store-extras-layer',
    order: 20,
    props: () => ({ slots }),
    children: {
      'plugin-store-extras': { kind: 'list' },
    },
  })
}

if (typeof document !== 'undefined') {
  const id = 'biu-plugin-store-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.pstore-root { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; color:var(--dsw-label); }
.pstore-root.is-compact { }
.pstore-root .tasks-main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; gap:10px; padding:12px 14px 14px; overflow-x:hidden; overflow-y:auto; }
.pstore-root.is-compact .tasks-main { padding:8px 10px 10px; gap:8px; }
.pstore-root .tasks-toolbar { display:flex; gap:12px; align-items:center; justify-content:space-between; min-width:0; }
.pstore-root .tasks-toolbar-left { display:flex; align-items:center; gap:6px; flex:none; min-width:0; }
.pstore-root .tasks-toolbar-right { display:flex; align-items:center; gap:6px; flex:none; margin-left:auto; }
.pstore-root .tasks-search { min-width:0; border:0; border-radius:8px; padding:6px 8px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; outline:none; }
.pstore-root .tasks-search-wrap { flex:0 1 180px; display:flex; align-items:center; gap:6px; border:0; border-radius:8px; padding:0 8px; background:transparent; color:var(--dsw-label-3); min-width:0; }
.pstore-root .tasks-search-wrap:hover, .pstore-root .tasks-search-wrap:focus-within { background:var(--dsw-hover); }
.pstore-root .tasks-search-wrap .tasks-search { flex:1; border:0; padding-left:0; background:transparent; }
.pstore-root .tasks-refresh { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:26px; border:0; border-radius:8px; padding:0; background:transparent; color:var(--dsw-label-2); font:inherit; cursor:pointer; }
.pstore-root .tasks-refresh:hover { background:var(--dsw-hover); }
.pstore-root .tasks-refresh.is-active { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 10%, var(--dsw-input)); }
.pstore-root .tasks-filter-btn-wrap { position:relative; display:inline-flex; flex:none; }
.pstore-root .tasks-filter-btn-wrap .tasks-refresh { position:relative; }
.pstore-root .tasks-filter-dot, .pstore-root .tasks-sort-dot { position:absolute; top:4px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--dsw-business); box-shadow:0 0 0 1px var(--dsw-surface); }
.pstore-root .tasks-filter-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:180px; padding:8px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:8px; }
.pstore-root .tasks-filter-menu-label { display:flex; flex-direction:column; gap:4px; font-size:10.5px; font-weight:600; color:var(--dsw-label-3); }
.pstore-root .tasks-filter-menu-label .tasks-filter { width:100%; max-width:none; }
.pstore-root .tasks-filter-clear { width:100%; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-danger); font:inherit; font-size:11px; font-weight:600; cursor:pointer; }
.pstore-root .tasks-filter { border:1px solid var(--dsw-border); border-radius:7px; padding:5px 7px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:11px; outline:none; }
.pstore-root .tasks-viewdd-wrap { position:relative; display:inline-flex; align-items:center; gap:6px; flex:none; }
.pstore-root .tasks-viewdd-btn { display:inline-flex; align-items:center; gap:6px; border:0; border-radius:8px; padding:5px 9px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; font-weight:650; cursor:pointer; }
.pstore-root .tasks-viewdd-btn:hover { background:var(--dsw-hover); }
.pstore-root .tasks-viewdd-btn.is-active { background:color-mix(in srgb, var(--dsw-business) 10%, transparent); }
.pstore-root .tasks-viewdd-name { max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstore-root .tasks-viewdd-menu { position:absolute; top:calc(100% + 6px); left:0; z-index:40; min-width:230px; padding:6px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:2px; }
.pstore-root .tasks-viewdd-head { padding:5px 8px 3px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--dsw-label-3); }
.pstore-root .tasks-viewdd-item { display:flex; align-items:center; gap:2px; border-radius:7px; }
.pstore-root .tasks-viewdd-item:hover { background:var(--dsw-hover); }
.pstore-root .tasks-viewdd-item.is-active { background:color-mix(in srgb, var(--dsw-business) 10%, transparent); }
.pstore-root .tasks-viewdd-item-main { flex:1; display:inline-flex; align-items:center; gap:7px; min-width:0; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; font-weight:550; cursor:pointer; text-align:left; }
.pstore-root .tasks-viewdd-item.is-active .tasks-viewdd-item-main { color:var(--dsw-business); font-weight:650; }
.pstore-root .tasks-viewdd-item-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstore-root .tasks-viewdd-check { flex:none; color:var(--dsw-business); }
.pstore-root .tasks-viewdd-item-actions { display:none; align-items:center; gap:2px; flex:none; padding-right:4px; }
.pstore-root .tasks-viewdd-item:hover .tasks-viewdd-item-actions { display:inline-flex; }
.pstore-root .tasks-viewdd-act { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border:0; border-radius:6px; background:transparent; color:var(--dsw-label-3); cursor:pointer; }
.pstore-root .tasks-viewdd-foot { border-top:1px solid var(--dsw-border); margin-top:4px; padding-top:4px; }
.pstore-root .tasks-viewdd-saveas { width:100%; display:inline-flex; align-items:center; gap:6px; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; }
.pstore-root .tasks-sort-wrap { position:relative; display:inline-flex; flex:none; }
.pstore-root .tasks-sort-btn { position:relative; display:inline-flex; align-items:center; justify-content:center; width:28px; height:26px; border:0; border-radius:8px; padding:0; background:transparent; color:var(--dsw-label-2); font:inherit; cursor:pointer; }
.pstore-root .tasks-sort-btn:hover { background:var(--dsw-hover); }
.pstore-root .tasks-sort-btn.is-custom, .pstore-root .tasks-sort-btn.is-active { color:var(--dsw-business); }
.pstore-root .tasks-sort-btn.is-active { background:color-mix(in srgb, var(--dsw-business) 10%, var(--dsw-input)); }
.pstore-root .tasks-sort-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:180px; padding:8px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:8px; }
.pstore-root .tasks-sort-head { font-size:10.5px; font-weight:600; color:var(--dsw-label-3); }
.pstore-root .tasks-sort-item { display:inline-flex; align-items:center; justify-content:space-between; gap:8px; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:12px; font-weight:550; cursor:pointer; text-align:left; }
.pstore-root .tasks-sort-item:hover { background:var(--dsw-hover); }
.pstore-root .tasks-sort-item.is-active { color:var(--dsw-business); font-weight:650; }
.pstore-root .tasks-sort-item-label { display:inline-flex; align-items:center; }
.pstore-root .tasks-mode-item-ico { display:inline-flex; margin-right:6px; }
.pstore-root .tasks-sort-item-icon { display:inline-flex; width:16px; justify-content:center; color:var(--dsw-label-3); }
.pstore-root .tasks-sort-item-icon.is-on { color:var(--dsw-business); }
.pstore-col-size { font-variant-numeric:tabular-nums; color:var(--dsw-label-2); white-space:nowrap; }
.pstore-col-time, .pstore-col-kind, .pstore-col-author { color:var(--dsw-label-2); white-space:nowrap; }
.pstore-muted { color:var(--dsw-label-3); }
.pstore-tags { display:inline-flex; flex-wrap:wrap; gap:4px; }
.pstore-tag { display:inline-flex; align-items:center; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:600; color:var(--dsw-label-2); background:color-mix(in srgb, var(--dsw-label-3) 12%, transparent); }
.pstore-author-link { color:var(--dsw-business); text-decoration:none; }
.pstore-author-link:hover { text-decoration:underline; }
.pstore-list-sub { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:0 8px 8px; font-size:12px; color:var(--dsw-label-3); }
.pstore-list-sep { color:var(--dsw-label-3); opacity:.6; }
.pstore-list-size { flex:none; color:var(--dsw-label-3); font-size:14px; }
.pstore-minicard-meta { font-size:12px; color:var(--dsw-label-3); }
.pstore-root.is-compact { padding:8px 10px 10px; gap:8px; }
.pstore-toolbar { display:flex; gap:12px; align-items:center; justify-content:space-between; min-width:0; }
.pstore-heading { display:flex; align-items:baseline; gap:8px; min-width:0; }
.pstore-heading h1 { margin:0; font-size:14px; font-weight:600; letter-spacing:-.01em; }
.pstore-heading span, .pstore-toolbar-count { color:var(--dsw-label-3); font-size:14px; font-variant-numeric:tabular-nums; }
.pstore-mode-wrap { position:relative; display:inline-flex; margin-left:auto; }
.pstore-mode-btn { display:inline-flex; align-items:center; justify-content:center; width:28px; height:26px; border:0; border-radius:8px; padding:0; background:transparent; color:var(--dsw-label-2); cursor:pointer; }
.pstore-mode-btn:hover { background:var(--dsw-hover); }
.pstore-mode-btn.is-active { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 10%, var(--dsw-input)); }
.pstore-mode-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:180px; padding:8px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:4px; }
.pstore-mode-head { font-size:10.5px; font-weight:600; color:var(--dsw-label-3); padding:2px 8px; }
.pstore-mode-item { display:inline-flex; align-items:center; justify-content:space-between; gap:8px; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:12px; font-weight:550; cursor:pointer; text-align:left; }
.pstore-mode-item:hover { background:var(--dsw-hover); }
.pstore-mode-item.is-active { color:var(--dsw-business); font-weight:650; }
.pstore-mode-item-label { display:inline-flex; align-items:center; }
.pstore-mode-item-ico { display:inline-flex; margin-right:6px; }
.pstore-error { margin:0; color:var(--dsw-danger); font-size:14px; }
.pstore-empty { margin:0; color:var(--dsw-label-3); font-size:14px; line-height:1.45; padding:28px 16px; text-align:center; }
.pstore-status-pill { display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:2px 8px; font-size:14px; font-weight:600; white-space:nowrap; }
.pstore-status-pill.is-todo { color:var(--dsw-label-3); background:color-mix(in srgb, var(--dsw-label-3) 10%, transparent); }
.pstore-status-pill.is-doing { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.pstore-status-pill.is-done { color:#2f7d4c; background:color-mix(in srgb, #2f7d4c 12%, transparent); }
.pstore-actions { display:inline-flex; align-items:center; gap:2px; }
.pstore-iconbtn { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border:0; border-radius:6px; padding:0; background:transparent; color:var(--dsw-label-3); cursor:pointer; }
.pstore-iconbtn:hover { background:var(--dsw-hover); color:var(--dsw-label); }
.pstore-iconbtn.is-danger:hover { color:var(--dsw-danger); background:var(--dsw-danger-soft); }
.pstore-iconbtn:disabled { opacity:.4; cursor:default; }
.pstore-table-wrap { min-width:0; width:100%; overflow:auto; border:1px solid var(--dsw-border); border-radius:10px; background:color-mix(in srgb, var(--dsw-surface) 92%, transparent); }
.pstore-table { width:max-content; min-width:100%; border-collapse:collapse; table-layout:auto; font-size:14px; }
.pstore-table th { padding:6px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-3); font-weight:600; text-align:left; white-space:nowrap; position:sticky; top:0; background:var(--dsw-surface); z-index:1; }
.pstore-th { display:inline-flex; align-items:center; gap:4px; }
.pstore-table td { padding:4px 6px; border-bottom:1px solid color-mix(in srgb, var(--dsw-border) 80%, transparent); vertical-align:middle; }
.pstore-table tr:last-child td { border-bottom:0; }
.pstore-table tr:hover td { background:color-mix(in srgb, var(--dsw-hover) 55%, transparent); }
.pstore-col-name { font-weight:600; white-space:nowrap; }
.pstore-col-id { color:var(--dsw-label-3); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px; white-space:nowrap; }
.pstore-col-blurb { max-width:360px; color:var(--dsw-label-2); white-space:normal; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pstore-col-action { width:64px; }
.pstore-list { display:flex; flex-direction:column; gap:14px; margin-top:4px; }
.pstore-list.is-compact { gap:10px; }
.pstore-list-group { display:flex; flex-direction:column; gap:6px; }
.pstore-list-ghead { display:flex; align-items:center; gap:6px; padding:4px 6px; color:var(--dsw-label-2); font-size:14px; font-weight:650; }
.pstore-list-ghead.is-doing { color:var(--dsw-business); }
.pstore-list-ghead.is-done { color:#2f7d4c; }
.pstore-list-count { margin-left:auto; color:var(--dsw-label-3); font-size:14px; font-weight:600; background:var(--dsw-muted-fill); border-radius:8px; padding:1px 7px; }
.pstore-list-ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.pstore-list-item { min-width:0; }
.pstore-list-main { display:flex; align-items:center; gap:8px; width:100%; min-width:0; border-radius:6px; padding:7px 8px; }
.pstore-list-main:hover { background:var(--dsw-hover); }
.pstore-list-title { flex:1; min-width:0; font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstore-list-id { flex:none; color:var(--dsw-label-3); font-size:14px; }
.pstore-cardgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(168px, 1fr)); gap:8px; margin-top:4px; }
.pstore-cardgrid.is-compact { grid-template-columns:repeat(auto-fill, minmax(148px, 1fr)); gap:7px; }
.pstore-minicard { display:flex; flex-direction:column; gap:8px; min-width:0; min-height:92px; overflow:hidden; border-radius:8px; padding:10px 11px; background:var(--dsw-surface); box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-border) 65%, transparent); }
.pstore-minicard:hover { box-shadow:0 1px 3px rgba(0,0,0,.08), 0 0 0 1px color-mix(in srgb, var(--dsw-border) 85%, transparent); }
.pstore-minicard-title { font-size:13px; font-weight:620; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pstore-minicard-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:auto; }
.tasks-viewdlg-backdrop { position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); }
.tasks-viewdlg { width:min(360px, calc(100vw - 32px)); background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,.25); padding:16px; display:flex; flex-direction:column; gap:12px; }
.tasks-viewdlg-title { font-size:14px; font-weight:700; color:var(--dsw-label); }
.tasks-viewdlg-body p { margin:0; font-size:12.5px; line-height:1.6; color:var(--dsw-label-2); }
.tasks-viewdlg-input { width:100%; box-sizing:border-box; border:1px solid var(--dsw-border); border-radius:8px; padding:8px 10px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:13px; outline:none; }
.tasks-viewdlg-actions { display:flex; justify-content:end; gap:8px; }
.tasks-viewdlg-cancel, .tasks-viewdlg-ok { border:1px solid var(--dsw-border); border-radius:8px; padding:6px 14px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.tasks-viewdlg-ok { border-color:var(--dsw-business); background:var(--dsw-business); color:var(--dsw-bg); }
.tasks-viewdlg-ok.is-danger { border-color:var(--dsw-danger); background:var(--dsw-danger); color:var(--dsw-bg); }
`
  document.head.appendChild(style)
}
