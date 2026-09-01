import { memo, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ChatCount, RecordEmojiBoard, SidebarFold } from '@biu/public-ui'
import {
  ChevronDoubleLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PlusIcon,
  Square2StackIcon,
  StarIcon,
} from '@heroicons/react/16/solid'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import type { CollectionInfo, DbRecord } from '@biu/type-file-system'
import { builtinAllViewId } from '../catalog-views.ts'
import { isSystemCollection, sortDataCollections } from './database-path.ts'
import { viewsForRegisteredCollection } from './collection-nav.ts'
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
  withViewDisplay,
} from './view-storage.ts'
import { pickDomAttrs, recordPickKind, viewPickId } from './pick-dom.ts'
import { toggleExpandedViewKey } from './sidebar-nav.ts'
import { TableGlyph, ViewModeGlyph } from './nav-glyphs.tsx'

const SIDEBAR_BRAND_GRADIENT =
  'linear-gradient(105deg, color-mix(in srgb, #0066B0 42%, var(--dsw-hover)), color-mix(in srgb, #5B3E90 40%, var(--dsw-hover)) 52%, color-mix(in srgb, #E22726 42%, var(--dsw-hover)))'

type PreviewState = { items: DbRecord[]; total: number; loading: boolean; error: string }

const previewCache = new Map<string, { items: DbRecord[]; total: number }>()

function ViewRecordPreview({
  path,
  view,
  open,
  recordKind,
  tableIcon,
  onOpenRecord,
}: {
  path: string
  view: SavedView
  open: boolean
  recordKind: string
  tableIcon?: string
  onOpenRecord?: (recordId: string, row?: DbRecord) => void
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
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
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
      setPickerAnchor(null)
      window.dispatchEvent(new Event('fsdb:change'))
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }))
    }
  }

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
                    const btn = event.currentTarget
                    setPickerId((prev) => {
                      if (prev === row.id) {
                        setPickerAnchor(null)
                        return null
                      }
                      setPickerAnchor(btn)
                      return row.id
                    })
                    setEmojiDraft(emoji)
                  }}
                >
                  {emoji ? <span className="fsdb-record-emoji">{emoji}</span> : <TableGlyph icon={tableIcon} />}
                </button>
                {pickerId === row.id && pickerAnchor ? (
                  <RecordEmojiBoard
                    anchor={pickerAnchor}
                    draft={emojiDraft}
                    onDraft={setEmojiDraft}
                    onPick={(next) => void saveEmoji(row, next)}
                    onClear={() => void saveEmoji(row, '')}
                    onClose={() => {
                      setPickerId(null)
                      setPickerAnchor(null)
                    }}
                  />
                ) : null}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-medium text-inherit"
                title={recordPreviewLabel(row)}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenRecord?.(row.id, row)
                }}
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
  expandedViewKey: expandedViewKeyProp,
  onExpandedViewKeyChange,
  onCollapse,
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
  onAddView: (path?: string) => void
  onCopyView: () => void
  onOpenRecord?: (path: string, view: SavedView, recordId: string, row?: DbRecord) => void
  expandedViewKey?: string | null
  onExpandedViewKeyChange?: (key: string | null) => void
  onCollapse?: () => void
}) {
  const listedTables = useMemo(() => {
    const raw = tables.length ? tables : ([{ path: collectionPath, label: title, view: { title } }] as CollectionInfo[])
    const { user, system } = sortDataCollections(raw)
    return [...user, ...system]
  }, [collectionPath, tables, title])
  const { user: userTables, system: systemTables } = useMemo(() => sortDataCollections(listedTables), [listedTables])
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
  const [userOpen, setUserOpen] = useState(true)
  const [systemOpen, setSystemOpen] = useState(true)
  const [expandedViewKeyLocal, setExpandedViewKeyLocal] = useState<string | null>(null)
  const expandedViewKey = expandedViewKeyProp !== undefined ? expandedViewKeyProp : expandedViewKeyLocal
  const setExpandedViewKey = onExpandedViewKeyChange ?? setExpandedViewKeyLocal
  usePreviewTotalsVersion()

  function viewsFor(path: string) {
    const listed = path === collectionPath ? views : loadViews(path)
    return viewsForRegisteredCollection(path, tables, listed).map((view) => withViewDisplay(path, view))
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
    if (userOpen) {
      for (const table of userTables) {
        if (openTables[table.path]) {
          for (const view of viewsFor(table.path)) jobs.push({ path: table.path, view })
        }
      }
    }
    if (systemOpen) {
      for (const table of systemTables) {
        if (openTables[table.path]) {
          for (const view of viewsFor(table.path)) jobs.push({ path: table.path, view })
        }
      }
    }
    return jobs
  }, [userOpen, systemOpen, favOpen, userTables, systemTables, listedTables, openTables, starredRows, tables, views, collectionPath])

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
    onOpenTable?.(path, viewId)
  }

  function toggleViewPreview(key: string) {
    const next = toggleExpandedViewKey(expandedViewKey, key)
    if (onExpandedViewKeyChange) onExpandedViewKeyChange(next)
    else setExpandedViewKeyLocal(next)
  }

  function openRecord(path: string, view: SavedView, recordId: string, row?: DbRecord) {
    onOpenRecord?.(path, view, recordId, row)
  }

  function renderTableRows(rows: CollectionInfo[]) {
    return rows.map((table) => {
      const name = table.view?.title ?? table.label
      const open = openTables[table.path] ?? false
      const listed = viewsFor(table.path)
      const system = isSystemCollection(table.path)
      return (
        <div key={table.path} className="min-w-0" data-collection-kind={system ? 'system' : 'user'}>
          <div className="sidebar-group-head mb-0.5">
            <div
              className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-[14px] font-medium tracking-normal text-inherit"
              title={name}
              aria-expanded={open}
              {...pickDomAttrs('collection', table.path, name)}
            >
              <button
                type="button"
                className="grid size-6 shrink-0 place-items-center border-0 bg-transparent p-0 text-inherit"
                title={open ? '收起视图' : '展开视图'}
                aria-label={open ? '收起视图' : '展开视图'}
                onClick={() => setOpenTables((prev) => ({ ...prev, [table.path]: !open }))}
              >
                <span className="sidebar-rail-icon sidebar-group-fold" aria-hidden>
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
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left font-medium text-inherit outline-none hover:text-(--dsw-sidebar-fg-active) focus-visible:ring-1 focus-visible:ring-(--dsw-border)"
                onClick={() => onOpenTable?.(table.path, builtinAllViewId(table.path))}
              >
                {name}
              </button>
              <button
                type="button"
                className="sidebar-add"
                title={`在 ${name} 下添加视图`}
                aria-label={`在 ${name} 下添加视图`}
                data-testid={`sidebar-add-view-${table.path}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenTables((prev) => ({ ...prev, [table.path]: true }))
                  onAddView(table.path)
                }}
              >
                <PlusIcon className="size-4 shrink-0" />
              </button>
            </div>
            <ChatCount count={listed.length} />
          </div>
          <SidebarFold open={open} className="sidebar-session-list min-w-0">
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
                    {table.path === collectionPath && !view.builtin ? (
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
                          <TrashGlyph className="size-4 shrink-0" />
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
                  <SidebarFold open={expanded}>
                  <ViewRecordPreview
                    path={table.path}
                    view={view}
                    open={expanded}
                    recordKind={recordPickKind(table.view?.moduleId)}
                    tableIcon={table.view?.icon}
                    onOpenRecord={(id, row) => openRecord(table.path, view, id, row)}
                  />
                  </SidebarFold>
                </div>
              )
            })}
          </SidebarFold>
        </div>
      )
    })
  }

  const [shellSlot, setShellSlot] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById('shell-module-sidebar'),
  )
  useLayoutEffect(() => {
    setShellSlot(document.getElementById('shell-module-sidebar'))
  }, [])

  const body = (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <div className="app-side-actions" role="navigation" aria-label="视图操作" data-biu-ignore>
          <button type="button" className="app-side-actions-item" title="添加视图" onClick={() => onAddView()}>
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
              <SidebarFold open={favOpen}>
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
                        <SidebarFold open={expanded}>
                        <ViewRecordPreview
                          path={table.path}
                          view={view}
                          open={expanded}
                          recordKind={recordPickKind(table.view?.moduleId)}
                          tableIcon={table.view?.icon}
                          onOpenRecord={(id, row) => openRecord(table.path, view, id, row)}
                        />
                        </SidebarFold>
                      </div>
                    )
                  })}
                </div>
              </SidebarFold>
            </section>
          ) : null}

          <section className="min-w-0">
            <div className="sidebar-section-head min-w-0">
              <div className="flex min-h-8 min-w-0 flex-1 items-center">
                <button
                  type="button"
                  className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-bold tracking-wider"
                  aria-expanded={userOpen}
                  onClick={() => setUserOpen((prev) => !prev)}
                >
                  <span className="min-w-0 flex-1 truncate tracking-normal">用户数据</span>
                </button>
              </div>
              <ChatCount count={userTables.length} />
            </div>
            <SidebarFold open={userOpen}>
              <div className="min-w-0 space-y-1.5 pt-0.5" data-testid="sidebar-user-collections">
                {userTables.length ? renderTableRows(userTables) : (
                  <div className="px-1 py-1 text-[12px] text-(--dsw-label-3)">还没有可改的表</div>
                )}
              </div>
            </SidebarFold>
          </section>

          {systemTables.length ? (
            <section className="min-w-0">
              <div className="sidebar-section-head min-w-0">
                <div className="flex min-h-8 min-w-0 flex-1 items-center">
                  <button
                    type="button"
                    className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-bold tracking-wider"
                    aria-expanded={systemOpen}
                    title="系统运行时记下的数据"
                    onClick={() => setSystemOpen((prev) => !prev)}
                  >
                    <span className="min-w-0 flex-1 truncate tracking-normal">系统数据</span>
                  </button>
                </div>
                <ChatCount count={systemTables.length} />
              </div>
              <SidebarFold open={systemOpen}>
                <div className="min-w-0 space-y-1.5 pt-0.5" data-testid="sidebar-system-collections">
                  {renderTableRows(systemTables)}
                </div>
              </SidebarFold>
            </section>
          ) : null}
        </div>
      </div>
  )

  if (shellSlot) {
    return createPortal(
      <div className="fsdb-views flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-label="数据">
        {body}
      </div>,
      shellSlot,
    )
  }

  return (
    <aside
      className="app-side-bar fsdb-views flex min-h-0 flex-col overflow-hidden border-r border-(--dsw-border) bg-(--dsw-sidebar)"
      aria-label="数据"
    >
      <div className="app-side-bar-head app-side-bar-head-brand">
        <span
          className="inline-flex min-w-0 max-w-full items-center truncate rounded-md px-2 py-0.5 text-[14px] font-semibold tracking-wide text-white"
          style={{ background: SIDEBAR_BRAND_GRADIENT }}
        >
          Biu Agent OS
        </span>
        <button
          type="button"
          className="chat-view-header-expand"
          title="收起左侧边栏"
          aria-label="收起左侧边栏"
          data-testid="sidebar-collapse"
          onClick={onCollapse}
        >
          <ChevronDoubleLeftIcon aria-hidden className="size-4" />
        </button>
      </div>
      {body}
    </aside>
  )
})
