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
  LinkIcon,
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
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function pluginTags(item: StoreListing) {
  return Array.isArray(item.tags) ? item.tags.filter(Boolean) : []
}

function PluginTags({ item }: { item: StoreListing }) {
  const tags = pluginTags(item)
  if (!tags.length) return <span className="pstore-muted">—</span>
  return (
    <span className="tasks-tags">
      {tags.map((tag) => (
        <span key={tag} className="tasks-tag">{tag}</span>
      ))}
    </span>
  )
}

function PluginAuthor({ item }: { item: StoreListing }) {
  const author = item.author?.trim()
  const href = item.authorUrl?.trim()
  const link = href && /^https?:\/\//i.test(href) ? href : ''
  if (!author && !link) return <span className="pstore-muted">—</span>
  if (!link) return <span>{author}</span>
  return (
    <a
      className="pstore-author-link"
      href={link}
      target="_blank"
      rel="noreferrer"
      title={link}
      onClick={(event) => event.stopPropagation()}
    >
      <span>{author || link}</span>
      <LinkIcon aria-hidden className="size-[12px]" />
    </a>
  )
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
      <span className="tasks-status-pill is-doing">
        <ArrowPathIcon aria-hidden className="size-[14px]" />
        <span>运行中</span>
      </span>
    )
  }
  if (item.enabled) {
    return (
      <span className="tasks-status-pill is-done">
        <CheckCircleIcon aria-hidden className="size-[14px]" />
        <span>已打开</span>
      </span>
    )
  }
  return (
    <span className="tasks-status-pill is-todo">
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
    <div className="tasks-row-actions">
      {item.enabled ? (
        <button
          type="button"
          className="tasks-icon-btn"
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
          className="tasks-icon-btn"
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
        className="tasks-icon-btn is-danger"
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
                placeholder="搜索"
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
          <p className="tasks-error" data-testid="plugin-store-error">
            {error}
          </p>
        ) : null}

        {visible.length === 0 && !error ? (
          <p className="tasks-empty" data-testid="plugin-store-empty">
            {items.length === 0 ? '没有插件' : '没有符合筛选的插件'}
          </p>
        ) : mode === 'queue' ? (
          <div className={`tasks-queue${compact ? ' is-compact' : ''}`}>
            {listGroups.map((group) => {
              const rows = grouped[group.key]
              if (!rows.length) return null
              return (
                <section key={group.key} className={`tasks-queue-group is-${group.tone}`}>
                  <header className={`tasks-queue-ghead is-${group.tone}`}>
                    {group.icon}
                    <span className="tasks-queue-glabel">{group.label}</span>
                    <span className="tasks-queue-count">{rows.length}</span>
                  </header>
                  <ul className="tasks-queue-list">
                    {rows.map((item) => (
                      <li
                        key={item.id}
                        className={`tasks-queue-item is-${group.tone}`}
                        data-testid={`plugin-store-card-${item.id}`}
                        data-biu-kind="plugin"
                        data-biu-id={item.id}
                        data-biu-label={item.name}
                      >
                        <div className="tasks-queue-item-main">
                          <span className="tasks-queue-item-title">{item.name}</span>
                          {pluginTags(item).length ? <PluginTags item={item} /> : null}
                          <span className="tasks-queue-meta">
                            <PluginAuthor item={item} />
                            <span className="tasks-time">{pluginKindLabel(item)}</span>
                            <span className="tasks-time">{formatWhen(item.createdAt)}</span>
                            <span className="tasks-time">{formatBytes(item.bytes)}</span>
                          </span>
                          {actions(item)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : mode === 'cards' ? (
          <div className={`tasks-cardgrid${compact ? ' is-compact' : ''}`}>
            {visible.map((item) => (
              <div
                key={item.id}
                className="tasks-minicard"
                data-testid={`plugin-store-card-${item.id}`}
                data-biu-kind="plugin"
                data-biu-id={item.id}
                data-biu-label={item.name}
              >
                <div className="tasks-minicard-title">
                  <span className="tasks-minicard-titletext">{item.name}</span>
                </div>
                {pluginTags(item).length ? <PluginTags item={item} /> : null}
                <div className="tasks-minicard-foot">
                  <PluginStatusPill item={item} />
                  <span className="tasks-minicard-assignee">
                    <span className="tasks-actor">
                      <span className="tasks-actor-name"><PluginAuthor item={item} /></span>
                    </span>
                  </span>
                  {actions(item)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tasks-table-wrap">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>
                    <span className="tasks-th">
                      <HashtagIcon aria-hidden className="size-[14px]" />
                      ID
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <PuzzlePieceIcon aria-hidden className="size-[14px]" />
                      名称
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <TagIcon aria-hidden className="size-[14px]" />
                      标签
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <Bars3BottomLeftIcon aria-hidden className="size-[14px]" />
                      简介
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <MinusCircleIcon aria-hidden className="size-[14px]" />
                      状态
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <UserIcon aria-hidden className="size-[14px]" />
                      作者
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <CircleStackIcon aria-hidden className="size-[14px]" />
                      大小
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <PuzzlePieceIcon aria-hidden className="size-[14px]" />
                      类型
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <ClockIcon aria-hidden className="size-[14px]" />
                      创建
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <PencilSquareIcon aria-hidden className="size-[14px]" />
                      更新
                    </span>
                  </th>
                  <th>
                    <span className="tasks-th">
                      <PlayIcon aria-hidden className="size-[14px]" />
                      上次运行
                    </span>
                  </th>
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
                    <td className="pstore-col-id">{item.id}</td>
                    <td className="pstore-col-name" title={item.name}>{item.name}</td>
                    <td className="pstore-col-tags"><PluginTags item={item} /></td>
                    <td className="pstore-col-blurb" title={item.blurb || undefined}>
                      {item.blurb?.trim() || <span className="pstore-muted">—</span>}
                    </td>
                    <td className="tasks-col-status">
                      <PluginStatusPill item={item} />
                    </td>
                    <td className="tasks-col-actor"><PluginAuthor item={item} /></td>
                    <td className="tasks-col-usage">{formatBytes(item.bytes)}</td>
                    <td className="tasks-col-project">{pluginKindLabel(item)}</td>
                    <td className="tasks-col-time">{formatWhen(item.createdAt)}</td>
                    <td className="tasks-col-time">{formatWhen(item.updatedAt)}</td>
                    <td className="tasks-col-time">{formatWhen(item.lastRunAt)}</td>
                    <td className="tasks-col-action">{actions(item)}</td>
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
.pstore-root.is-compact .tasks-main { padding:8px 10px 10px; gap:8px; }
.pstore-muted { color:var(--dsw-label-3); }
.pstore-author-link { display:inline-flex; align-items:center; gap:4px; color:var(--dsw-business); text-decoration:none; white-space:nowrap; }
.pstore-author-link:hover { text-decoration:underline; }
.pstore-col-name { max-width:120px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pstore-col-id { color:var(--dsw-label-3); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px; white-space:nowrap; }
.pstore-col-blurb { max-width:280px; color:var(--dsw-label-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pstore-col-tags { white-space:nowrap; }
.pstore-col-tags .tasks-tags { flex-wrap:nowrap; }
.pstore-col-tags .tasks-tag { max-width:none; }
.pstore-root .tasks-queue-item-main .tasks-tags { flex:none; flex-wrap:nowrap; }
.pstore-root .tasks-minicard .tasks-tags { flex-wrap:wrap; }
.pstore-root .tasks-icon-btn:disabled { opacity:.4; cursor:default; }
`
  document.head.appendChild(style)
}
