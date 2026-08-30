import { memo, useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react'
import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EyeIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusIcon,
  PuzzlePieceIcon,
  Square2StackIcon,
  Squares2X2Icon,
  StarIcon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon,
} from '@heroicons/react/16/solid'
import type { CollectionInfo, DbRecord } from '@biu/type-file-system'
import type { ViewMode } from './fields.ts'
import type { SavedView } from './saved-view.ts'
import {
  fetchViewPreview,
  fetchViewTotal,
  getPreviewTotal,
  getPreviewTotalsVersion,
  nextPreviewLimit,
  previewCacheKey,
  recordPreviewEmoji,
  recordPreviewLabel,
  rememberPreviewTotal,
  SIDEBAR_PREVIEW_MAX,
  subscribePreviewTotals,
  viewTotalKey,
  writeRecordEmoji,
} from './sidebar-preview.ts'
import {
  activeViewStorageKey,
  getStarredViews,
  getStarredViewsVersion,
  isViewStarred,
  loadViews,
  persistStarredViews,
  subscribeStarredViews,
  toggleStarredView,
} from './view-storage.ts'
import { pickDomAttrs, recordPickKind, viewPickId } from './pick-dom.ts'

const SIDEBAR_BRAND_GRADIENT =
  'linear-gradient(105deg, color-mix(in srgb, #0066B0 42%, var(--dsw-hover)), color-mix(in srgb, #5B3E90 40%, var(--dsw-hover)) 52%, color-mix(in srgb, #E22726 42%, var(--dsw-hover)))'

function SidebarBrandMascot({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="-15 -15 259 259" width={30} height={30} fill="none" aria-hidden>
      <defs>
        <linearGradient id={uid} x1="0" y1="0.15" x2="1" y2="0.85">
          <stop offset="0%" stopColor="color-mix(in srgb, #0066B0 42%, var(--dsw-hover))" />
          <stop offset="52%" stopColor="color-mix(in srgb, #5B3E90 40%, var(--dsw-hover))" />
          <stop offset="100%" stopColor="color-mix(in srgb, #E22726 42%, var(--dsw-hover))" />
        </linearGradient>
      </defs>
      <path
        d="M0.27 170.27C0.27 94.06 51.31 32.27 114.27 32.27C177.23 32.27 228.27 94.06 228.27 170.27L228.27 170.27C228.27 196.27 228.27 196.27 202.27 196.27L26.27 196.27C0.27 196.27 0.27 196.27 0.27 170.27Z"
        fill={`url(#${uid})`}
      />
      <g transform="translate(114.2705 118.2705) scale(1.003 0.68) translate(-114.2705 -114.2705)">
        <path
          d="M39.78 104.3L42.64 105.01L45.03 106.74L46.73 109.15L47.75 111.93L48.35 114.83L48.81 117.76L49.31 120.68L49.87 123.6L50.48 126.5L51.15 129.39L51.86 132.27L52.63 135.13L53.44 137.98L54.3 140.82L55.19 143.65L56.13 146.46L57.1 149.26L58.1 152.05L58.86 154.92L58.96 157.87L58.18 160.72L56.43 163.09L53.84 164.48L50.9 164.62L48.08 163.75L45.58 162.16L43.51 160.05L41.89 157.57L40.67 154.87L39.67 152.08L38.73 149.26L37.81 146.44L36.94 143.61L36.11 140.76L35.34 137.9L34.61 135.03L33.92 132.14L33.28 129.24L32.7 126.34L32.16 123.42L31.67 120.5L31.23 117.57L31.14 114.61L31.65 111.69L32.74 108.94L34.47 106.54L36.89 104.86Z"
          fill="#fff"
        />
        <path
          d="M108.97 125.73L111.9 126.2L114.63 127.37L117 129.16L118.84 131.49L119.99 134.23L120.32 137.18L119.85 140.11L118.59 142.8L116.78 145.16L114.84 147.42L112.89 149.67L110.93 151.92L108.97 154.16L107.01 156.39L105.03 158.62L103.05 160.85L101.07 163.06L99.07 165.28L97.09 167.5L95.09 169.71L93.05 171.88L90.69 173.67L87.89 174.66L84.93 174.81L82.02 174.22L79.31 173L76.92 171.24L74.99 168.98L73.7 166.3L73.26 163.37L73.74 160.45L75.2 157.86L77.17 155.63L79.18 153.43L81.18 151.23L83.17 149.02L85.16 146.8L87.14 144.58L89.11 142.35L91.08 140.11L93.04 137.87L95 135.63L96.95 133.38L98.89 131.12L100.87 128.89L103.25 127.12L106.02 126.04Z"
          fill="#fff"
        />
      </g>
    </svg>
  )
}

function TableGlyph({ icon }: { icon?: string }) {
  const cls = 'size-4'
  const name = (icon ?? '').trim().toLowerCase()
  if (name === 'puzzle-piece' || name === 'puzzle') return <PuzzlePieceIcon aria-hidden className={cls} />
  if (name === 'clipboard-document-list' || name === 'clipboard') return <ClipboardDocumentListIcon aria-hidden className={cls} />
  if (name === 'chat-bubble' || name === 'chat-bubble-left-right') return <ChatBubbleLeftRightIcon aria-hidden className={cls} />
  if (name === 'bolt') return <BoltIcon aria-hidden className={cls} />
  if (name === 'eye') return <EyeIcon aria-hidden className={cls} />
  return <TableCellsIcon aria-hidden className={cls} />
}

function ViewModeGlyph({ mode }: { mode: ViewMode }) {
  const cls = 'size-4'
  if (mode === 'queue') return <ListBulletIcon aria-hidden className={cls} />
  if (mode === 'table') return <TableCellsIcon aria-hidden className={cls} />
  if (mode === 'cards') return <Squares2X2Icon aria-hidden className={cls} />
  return <ViewColumnsIcon aria-hidden className={cls} />
}

const RECORD_EMOJI_PRESETS = ['⭐', '🔥', '✅', '📌', '💡', '🎯', '📦', '🧩', '📄', '⚡']

type PreviewState = { items: DbRecord[]; total: number; loading: boolean; error: string }

const previewCache = new Map<string, { items: DbRecord[]; total: number }>()

function ViewRecordPreview({
  path,
  view,
  open,
  recordKind,
  onOpenRecord,
}: {
  path: string
  view: SavedView
  open: boolean
  recordKind: string
  onOpenRecord?: (recordId: string) => void
}) {
  const key = previewCacheKey(path, view)
  const cached = previewCache.get(key)
  const [state, setState] = useState<PreviewState>(() => ({
    items: cached?.items ?? [],
    total: cached?.total ?? 0,
    loading: !cached,
    error: '',
  }))
  const [pickerId, setPickerId] = useState<string | null>(null)
  const [emojiDraft, setEmojiDraft] = useState('')

  useEffect(() => {
    if (!open) return
    const hit = previewCache.get(key)
    if (hit) {
      setState({ items: hit.items, total: hit.total, loading: false, error: '' })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    void fetchViewPreview(path, view, 0).then(
      (page) => {
        if (cancelled) return
        previewCache.set(key, { items: page.items, total: page.total })
        rememberPreviewTotal(key, page.total)
        setState({ items: page.items, total: page.total, loading: false, error: '' })
      },
      (err: unknown) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, loading: false, error: String(err) }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, open, path, view.query, view.sortField, view.sortDir, view.filters])
  useEffect(() => {
    if (!pickerId) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.fsdb-emoji-picker, .fsdb-record-icon')) return
      setPickerId(null)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [pickerId])

  async function loadMore() {
    const more = nextPreviewLimit(state.items.length, state.total)
    if (!more || state.loading) return
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const page = await fetchViewPreview(path, view, state.items.length, more)
      const items = [...state.items, ...page.items]
      const total = page.total
      previewCache.set(key, { items, total })
      rememberPreviewTotal(key, total)
      setState({ items, total, loading: false, error: '' })
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: String(err) }))
    }
  }

  async function saveEmoji(row: DbRecord, next: string) {
    try {
      const emoji = await writeRecordEmoji(path, row.id, next)
      const items = state.items.map((item) => (item.id === row.id ? { ...item, emoji } : item))
      previewCache.set(key, { items, total: state.total })
      setState((prev) => ({ ...prev, items }))
      setPickerId(null)
      window.dispatchEvent(new Event('fsdb:change'))
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }))
    }
  }

  if (!open) return null
  const remaining = Math.max(0, state.total - state.items.length)
  const capped = state.items.length >= SIDEBAR_PREVIEW_MAX && remaining > 0
  return (
    <div className="fsdb-view-preview" role="list">
      {state.items.map((row) => {
        const emoji = recordPreviewEmoji(row)
        return (
          <div
            key={row.id}
            className="chat-session-row"
            role="listitem"
            {...pickDomAttrs(recordKind, row.id, recordPreviewLabel(row))}
          >
            <div className="chat-session-row-main flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5">
              <span className="fsdb-record-icon relative grid size-6 shrink-0 place-items-center">
                <button
                  type="button"
                  className="grid size-6 place-items-center border-0 bg-transparent p-0 text-[16px] leading-none text-inherit"
                  title={emoji ? '更换图标' : '设置图标'}
                  aria-label={emoji ? `更换 ${recordPreviewLabel(row)} 的图标` : `设置 ${recordPreviewLabel(row)} 的图标`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setPickerId((prev) => (prev === row.id ? null : row.id))
                    setEmojiDraft(emoji)
                  }}
                >
                  {emoji ? <span className="fsdb-record-emoji">{emoji}</span> : <DocumentTextIcon aria-hidden className="size-4" />}
                </button>
                {pickerId === row.id ? (
                  <div className="fsdb-emoji-picker" data-biu-ignore onClick={(event) => event.stopPropagation()}>
                    <div className="fsdb-emoji-picker-presets">
                      {RECORD_EMOJI_PRESETS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="fsdb-emoji-picker-item"
                          onClick={() => void saveEmoji(row, item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <input
                      className="fsdb-emoji-picker-input"
                      value={emojiDraft}
                      placeholder="输入 emoji"
                      maxLength={8}
                      onChange={(event) => setEmojiDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveEmoji(row, emojiDraft)
                        }
                        if (event.key === 'Escape') setPickerId(null)
                      }}
                    />
                    <button type="button" className="fsdb-emoji-picker-clear" onClick={() => void saveEmoji(row, '')}>
                      恢复默认
                    </button>
                  </div>
                ) : null}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-medium text-inherit"
                title={recordPreviewLabel(row)}
                onClick={() => onOpenRecord?.(row.id)}
              >
                {recordPreviewLabel(row)}
              </button>
            </div>
          </div>
        )
      })}
      {state.loading && !state.items.length ? (
        <div className="fsdb-view-preview-hint">加载中…</div>
      ) : null}
      {state.error ? <div className="fsdb-view-preview-hint">{state.error}</div> : null}
      {!state.loading && !state.error && !state.items.length ? (
        <div className="fsdb-view-preview-hint">没有数据</div>
      ) : null}
      {remaining > 0 && !capped ? (
        <button type="button" className="fsdb-view-preview-more" disabled={state.loading} onClick={() => void loadMore()}>
          {state.loading ? '加载中…' : `还有 ${remaining} 条 · 加载更多`}
        </button>
      ) : null}
      {capped ? <div className="fsdb-view-preview-hint">侧栏最多预览 {SIDEBAR_PREVIEW_MAX} 条，完整数据在主区</div> : null}
    </div>
  )
}

function ChatCount({ count }: { count: number | undefined }) {
  if (count == null) return null
  return (
    <span className="sidebar-chat-count" title={`${count} 条`}>
      <span className="sidebar-chat-count-num">{count}</span>
    </span>
  )
}

function usePreviewTotalsVersion() {
  return useSyncExternalStore(subscribePreviewTotals, getPreviewTotalsVersion, () => 0)
}

export const DataSidebar = memo(function DataSidebar({
  tables,
  collectionPath,
  title,
  views,
  activeViewId,
  onOpenTable,
  onApplyView,
  onRenameView,
  onDeleteView,
  onAddView,
  onCopyView,
  onOpenRecord,
}: {
  tables: CollectionInfo[]
  collectionPath: string
  title: string
  views: SavedView[]
  activeViewId: string | null
  onOpenTable?: (path: string, viewId?: string) => void
  onApplyView: (view: SavedView) => void
  onRenameView: (view: SavedView) => void
  onDeleteView: (view: SavedView) => void
  onAddView: () => void
  onCopyView: () => void
  onOpenRecord?: (path: string, view: SavedView, recordId: string) => void
}) {
  const listedTables = useMemo(
    () => (tables.length ? tables : [{ path: collectionPath, label: title, view: { title } } as CollectionInfo]),
    [collectionPath, tables, title],
  )
  const [openTables, setOpenTables] = useState<Record<string, boolean>>(() => ({ [collectionPath]: true }))
  useSyncExternalStore(subscribeStarredViews, getStarredViewsVersion, () => 0)
  const starredViews = getStarredViews()
  const [favOpen, setFavOpen] = useState(() => {
    try {
      return localStorage.getItem('fsdb.favOpen') !== '0'
    } catch {
      return true
    }
  })
  const [dataOpen, setDataOpen] = useState(true)
  const [expandedViewKey, setExpandedViewKey] = useState<string | null>(null)
  usePreviewTotalsVersion()

  function viewsFor(path: string) {
    return path === collectionPath ? views : loadViews(path)
  }

  const starredRows = starredViews.flatMap((item) => {
    const table = listedTables.find((row) => row.path === item.path)
    const view = viewsFor(item.path).find((row) => row.id === item.viewId)
    if (!table || !view) return []
    return [{ table, view }]
  })

  const countJobs = useMemo(() => {
    const jobs: Array<{ path: string; view: SavedView }> = []
    if (favOpen) {
      for (const { table, view } of starredRows) jobs.push({ path: table.path, view })
    }
    if (dataOpen) {
      for (const table of listedTables) {
        if (openTables[table.path]) {
          for (const view of viewsFor(table.path)) jobs.push({ path: table.path, view })
        }
      }
    }
    return jobs
  }, [dataOpen, favOpen, listedTables, openTables, starredRows, views, collectionPath])

  const countJobKey = countJobs.map((job) => viewTotalKey(job.path, job.view)).join('|')
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      countJobs.map((job) =>
        fetchViewTotal(job.path, job.view).catch(() => {
          if (cancelled) return
        }),
      ),
    )
    return () => {
      cancelled = true
    }
  }, [countJobKey, countJobs])

  function toggleStar(path: string, viewId: string) {
    persistStarredViews(toggleStarredView(getStarredViews(), path, viewId))
  }

  function openView(path: string, viewId: string) {
    try {
      localStorage.setItem(activeViewStorageKey(path), viewId)
    } catch {
      /* ignore */
    }
    setOpenTables((prev) => ({ ...prev, [path]: true }))
    const listed = viewsFor(path)
    const view = listed.find((item) => item.id === viewId)
    if (path !== collectionPath) {
      onOpenTable?.(path, viewId)
      return
    }
    if (view) onApplyView(view)
  }

  function toggleViewPreview(key: string) {
    setExpandedViewKey((prev) => (prev === key ? null : key))
  }

  function openRecord(path: string, view: SavedView, recordId: string) {
    openView(path, view.id)
    onOpenRecord?.(path, view, recordId)
  }

  return (
    <aside
      className="app-side-bar fsdb-views flex min-h-0 flex-col overflow-hidden border-r border-(--dsw-border) bg-(--dsw-sidebar)"
      aria-label="数据"
    >
      <div className="app-side-bar-head">
        <span className="flex min-w-0 items-center gap-1.5">
          <SidebarBrandMascot className="size-8 shrink-0" />
          <span
            className="inline-flex min-w-0 max-w-full items-center truncate rounded-md px-2 py-0.5 text-[14px] font-semibold tracking-wide text-white"
            style={{ background: SIDEBAR_BRAND_GRADIENT }}
          >
            biu harness
          </span>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <div className="app-side-actions" role="navigation" aria-label="视图操作" data-biu-ignore>
          <button type="button" className="app-side-actions-item" title="添加视图" onClick={onAddView}>
            <span className="app-side-actions-icon" aria-hidden>
              <PlusIcon className="size-4 shrink-0" />
            </span>
            <span className="app-side-actions-label">添加视图</span>
          </button>
          <button type="button" className="app-side-actions-item" title="拷贝视图" onClick={onCopyView}>
            <span className="app-side-actions-icon" aria-hidden>
              <Square2StackIcon className="size-4 shrink-0" />
            </span>
            <span className="app-side-actions-label">拷贝视图</span>
          </button>
        </div>

        <div className="mt-2 space-y-1.5">
          {starredRows.length ? (
            <section className="min-w-0">
              <div className="sidebar-section-head min-w-0">
                <div className="flex min-h-8 min-w-0 flex-1 items-center">
                  <button
                    type="button"
                    className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-bold tracking-wider"
                    aria-expanded={favOpen}
                    onClick={() => {
                      const next = !favOpen
                      setFavOpen(next)
                      try {
                        localStorage.setItem('fsdb.favOpen', next ? '1' : '0')
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate tracking-normal">收藏</span>
                  </button>
                </div>
                <ChatCount count={starredRows.length} />
              </div>
              {favOpen ? (
                <div className="min-w-0 pt-0.5">
                  {starredRows.map(({ table, view }) => {
                    const tableName = table.view?.title ?? table.label
                    const active = table.path === collectionPath && view.id === activeViewId
                    const previewKey = `star:${table.path}:${view.id}`
                    const expanded = expandedViewKey === previewKey
                    return (
                      <div key={previewKey} className="min-w-0">
                        <div
                          className={`chat-session-row group${active ? ' is-active' : ''} is-pinned`}
                          {...pickDomAttrs('view', viewPickId(table.path, view.id), view.name)}
                        >
                          <div className="chat-session-row-main flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5">
                            <button
                              type="button"
                              className="grid size-6 shrink-0 place-items-center border-0 bg-transparent p-0 text-inherit"
                              title={expanded ? '收起记录' : '展开记录'}
                              aria-expanded={expanded}
                              onClick={() => toggleViewPreview(previewKey)}
                            >
                              <span className="sidebar-rail-icon sidebar-group-fold">
                                <span className="sidebar-group-fold-face">
                                  <ViewModeGlyph mode={view.mode} />
                                </span>
                                <span className="sidebar-group-fold-chevron">
                                  {expanded ? (
                                    <ChevronDownIcon className="size-4 shrink-0 opacity-80" />
                                  ) : (
                                    <ChevronRightIcon className="size-4 shrink-0 opacity-80" />
                                  )}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-medium text-inherit"
                              onClick={() => openView(table.path, view.id)}
                            >
                              {view.name}
                            </button>
                          </div>
                          <ChatCount count={getPreviewTotal(viewTotalKey(table.path, view))} />
                          <span className="grid size-6 shrink-0 place-items-center" title={tableName} aria-label={tableName}>
                            <TableGlyph icon={table.view?.icon} />
                          </span>
                          <button
                            type="button"
                            className="chat-session-row-star is-on"
                            aria-pressed
                            aria-label={`取消收藏 ${view.name}`}
                            title="取消收藏"
                            onClick={() => toggleStar(table.path, view.id)}
                          >
                            <StarIcon className="size-4 shrink-0 text-[#f5b700]" />
                          </button>
                        </div>
                        <ViewRecordPreview
                          path={table.path}
                          view={view}
                          open={expanded}
                          recordKind={recordPickKind(table.view?.moduleId)}
                          onOpenRecord={(id) => openRecord(table.path, view, id)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="min-w-0">
            <div className="sidebar-section-head min-w-0">
              <div className="flex min-h-8 min-w-0 flex-1 items-center">
                <button
                  type="button"
                  className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-bold tracking-wider"
                  aria-expanded={dataOpen}
                  onClick={() => setDataOpen((prev) => !prev)}
                >
                  <span className="min-w-0 flex-1 truncate tracking-normal">数据</span>
                </button>
              </div>
              <ChatCount count={listedTables.length} />
            </div>
            {dataOpen ? (
              <div className="min-w-0 space-y-1.5 pt-0.5">
                {listedTables.map((table) => {
                  const name = table.view?.title ?? table.label
                  const open = openTables[table.path] ?? false
                  const listed = viewsFor(table.path)
                  return (
                    <div key={table.path} className="min-w-0">
                      <div className="sidebar-group-head mb-0.5">
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md text-left text-[14px] font-medium tracking-normal text-inherit outline-none hover:text-(--dsw-sidebar-fg-active) focus-visible:ring-1 focus-visible:ring-(--dsw-border)"
                          title={name}
                          aria-expanded={open}
                          {...pickDomAttrs('collection', table.path, name)}
                          onClick={() => {
                            setOpenTables((prev) => ({ ...prev, [table.path]: !open }))
                            if (!listed.length) onOpenTable?.(table.path)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setOpenTables((prev) => ({ ...prev, [table.path]: !open }))
                            }
                          }}
                        >
                          <span className="grid size-6 shrink-0 place-items-center" aria-hidden>
                            <span className="sidebar-rail-icon sidebar-group-fold">
                              <span className="sidebar-group-fold-face">
                                <TableGlyph icon={table.view?.icon} />
                              </span>
                              <span className="sidebar-group-fold-chevron">
                                {open ? (
                                  <ChevronDownIcon className="size-4 shrink-0 opacity-80" />
                                ) : (
                                  <ChevronRightIcon className="size-4 shrink-0 opacity-80" />
                                )}
                              </span>
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                        </div>
                        <ChatCount count={listed.length} />
                      </div>
                      <div className={`sidebar-session-list min-w-0 ${open ? '' : 'hidden'}`} aria-hidden={!open}>
                        {listed.map((view) => {
                          const starred = isViewStarred(starredViews, table.path, view.id)
                          const active = table.path === collectionPath && view.id === activeViewId
                          const previewKey = `${table.path}:${view.id}`
                          const expanded = expandedViewKey === previewKey
                          return (
                            <div key={view.id} className="min-w-0">
                              <div
                                className={`chat-session-row group${active ? ' is-active' : ''}${starred ? ' is-pinned' : ''}`}
                                {...pickDomAttrs('view', viewPickId(table.path, view.id), view.name)}
                              >
                                <div className="chat-session-row-main flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5">
                                  <button
                                    type="button"
                                    className="grid size-6 shrink-0 place-items-center border-0 bg-transparent p-0 text-inherit"
                                    title={expanded ? '收起记录' : '展开记录'}
                                    aria-expanded={expanded}
                                    onClick={() => toggleViewPreview(previewKey)}
                                  >
                                    <span className="sidebar-rail-icon sidebar-group-fold">
                                      <span className="sidebar-group-fold-face">
                                        <ViewModeGlyph mode={view.mode} />
                                      </span>
                                      <span className="sidebar-group-fold-chevron">
                                        {expanded ? (
                                          <ChevronDownIcon className="size-4 shrink-0 opacity-80" />
                                        ) : (
                                          <ChevronRightIcon className="size-4 shrink-0 opacity-80" />
                                        )}
                                      </span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-medium text-inherit"
                                    onClick={() => openView(table.path, view.id)}
                                  >
                                    {view.name}
                                  </button>
                                </div>
                                <ChatCount count={getPreviewTotal(viewTotalKey(table.path, view))} />
                                {table.path === collectionPath ? (
                                  <>
                                    <button
                                      type="button"
                                      className="chat-session-row-delete"
                                      title="重命名"
                                      aria-label={`重命名 ${view.name}`}
                                      onClick={() => onRenameView(view)}
                                    >
                                      <PencilSquareIcon className="size-4 shrink-0" />
                                    </button>
                                    <button
                                      type="button"
                                      className="chat-session-row-delete"
                                      title="删除"
                                      aria-label={`删除 ${view.name}`}
                                      onClick={() => onDeleteView(view)}
                                    >
                                      <TrashIcon className="size-4 shrink-0" />
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  className={`chat-session-row-star${starred ? ' is-on' : ''}`}
                                  aria-pressed={starred}
                                  aria-label={starred ? `取消收藏 ${view.name}` : `收藏 ${view.name}`}
                                  title={starred ? '取消收藏' : '收藏'}
                                  onClick={() => toggleStar(table.path, view.id)}
                                >
                                  <StarIcon className={`size-4 shrink-0${starred ? ' text-[#f5b700]' : ''}`} />
                                </button>
                              </div>
                              <ViewRecordPreview
                                path={table.path}
                                view={view}
                                open={expanded}
                                recordKind={recordPickKind(table.view?.moduleId)}
                                onOpenRecord={(id) => openRecord(table.path, view, id)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </aside>
  )
})
