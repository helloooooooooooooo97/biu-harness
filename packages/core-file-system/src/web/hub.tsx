import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PuzzlePieceIcon,
  TableCellsIcon,
} from '@heroicons/react/16/solid'
import type { CollectionInfo } from '@biu/type-file-system'
import type { CollectionChrome, DatabaseUi } from '@biu/type-file-system/ui'
import type { SlotProps } from '@biu/type-slots'
import { CollectionBrowser, SidebarBrandMascot, SIDEBAR_BRAND_GRADIENT } from './browser.tsx'
import {
  collectionFromLocation,
  DATABASE_MODULE_ID,
  DATABASE_MODULE_PATH,
  getLiveNavCollections,
  navCollections,
  normalizeNavPath,
  subscribeLiveNavCollections,
} from './hub-nav.ts'
import {
  ensureViews,
  loadActiveViewId,
  rememberActiveView,
  viewCount,
  VIEWS_EVENT,
} from './view-store.ts'

const EMPTY_CHROME: CollectionChrome = {}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'clipboard-document-list': ClipboardDocumentListIcon,
  clipboard: ClipboardDocumentListIcon,
  'puzzle-piece': PuzzlePieceIcon,
  puzzle: PuzzlePieceIcon,
  'table-cells': TableCellsIcon,
  folder: FolderIcon,
}

function resolveIcon(name?: string) {
  if (!name) return TableCellsIcon
  return ICONS[name] ?? ICONS[name.trim().toLowerCase()] ?? TableCellsIcon
}

function openKey(path: string) {
  return `fsdb.hubOpen:${path}`
}

function isOpen(path: string, fallback: boolean) {
  try {
    const raw = localStorage.getItem(openKey(path))
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* ignore */
  }
  return fallback
}

function setOpen(path: string, next: boolean) {
  try {
    localStorage.setItem(openKey(path), next ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function subscribeViews(fn: () => void) {
  window.addEventListener(VIEWS_EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(VIEWS_EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

export function DatabaseHub({
  collections,
  databaseUi,
}: {
  collections: CollectionInfo[]
  databaseUi?: DatabaseUi
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const live = useSyncExternalStore(subscribeLiveNavCollections, getLiveNavCollections, getLiveNavCollections)
  const listed = useMemo(() => navCollections(live.length ? live : collections), [collections, live])
  const active = collectionFromLocation(listed, location.pathname)
  const [tick, setTick] = useState(0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const start: Record<string, boolean> = {}
    for (const row of listed) start[row.path] = isOpen(row.path, false)
    return start
  })
  const [hubOpen, setHubOpen] = useState(() => {
    try {
      return localStorage.getItem('fsdb.viewsOpen:database') !== '0'
    } catch {
      return true
    }
  })

  useEffect(() => subscribeViews(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    function onToggle(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id
      if (id && id !== DATABASE_MODULE_ID) return
      setHubOpen((prev) => {
        const next = !prev
        try {
          localStorage.setItem('fsdb.viewsOpen:database', next ? '1' : '0')
        } catch {
          /* ignore */
        }
        return next
      })
    }
    window.addEventListener('biu:toggle-module-sidebar', onToggle)
    return () => window.removeEventListener('biu:toggle-module-sidebar', onToggle)
  }, [])

  useEffect(() => {
    if (!active) return
    const route = normalizeNavPath(active.view!.route)
    const here = normalizeNavPath(location.pathname)
    if (here === DATABASE_MODULE_PATH || here === '/') {
      navigate(route, { replace: true })
    }
  }, [active, location.pathname, navigate])

  useEffect(() => {
    if (!active) return
    setExpanded((prev) => {
      if (prev[active.path]) return prev
      setOpen(active.path, true)
      return { ...prev, [active.path]: true }
    })
  }, [active])

  const path = active?.path ?? ''
  const title = active?.view?.title ?? active?.label ?? '数据'
  const blurb = active?.view?.blurb ?? ''
  const chrome = useSyncExternalStore(
    (fn) => (databaseUi ? databaseUi.subscribe(fn) : () => undefined),
    () => (path ? databaseUi?.chrome(path) ?? EMPTY_CHROME : EMPTY_CHROME),
    () => (path ? databaseUi?.chrome(path) ?? EMPTY_CHROME : EMPTY_CHROME),
  )
  const activeViewId = path ? loadActiveViewId(path, ensureViews(path)) : null

  function toggleGroup(row: CollectionInfo) {
    setExpanded((prev) => {
      const next = !prev[row.path]
      setOpen(row.path, next)
      return { ...prev, [row.path]: next }
    })
  }

  function openCollection(row: CollectionInfo) {
    const route = normalizeNavPath(row.view!.route)
    if (normalizeNavPath(location.pathname) !== route) navigate(route)
    setExpanded((prev) => {
      if (prev[row.path]) return prev
      setOpen(row.path, true)
      return { ...prev, [row.path]: true }
    })
  }

  function openView(row: CollectionInfo, viewId: string) {
    rememberActiveView(row.path, viewId)
    setTick((n) => n + 1)
    const route = normalizeNavPath(row.view!.route)
    if (normalizeNavPath(location.pathname) !== route) navigate(route)
  }

  if (!active) {
    return (
      <div className="fsdb-page tasks-root">
        <div className="tasks-main fsdb-main">
          <p className="tasks-error">还没有登记到 File System 的数据表。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fsdb-page tasks-root">
      {hubOpen ? (
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
          <div className="fsdb-collection-head">
            <div className="fsdb-collection-name">数据</div>
            <p className="fsdb-footnote">任务、页面和插件都在这里，展开即可看各表的视图。</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            <section className="mt-1 min-w-0" data-views-epoch={tick}>
              <div className="sidebar-session-list">
                {listed.map((row) => {
                  const Icon = resolveIcon(row.view?.icon)
                  const open = !!expanded[row.path]
                  const views = ensureViews(row.path)
                  const count = viewCount(row.path)
                  const selected = row.path === active.path
                  const name = row.view?.title ?? row.label
                  return (
                    <div key={row.path} className="fsdb-nav-group">
                      <div className={`chat-session-row${selected ? ' is-active' : ''}`}>
                        <button
                          type="button"
                          className="fsdb-nav-chevron"
                          aria-expanded={open}
                          aria-label={open ? `折叠 ${name}` : `展开 ${name}`}
                          onClick={() => toggleGroup(row)}
                        >
                          <ChevronRightIcon className={`size-4${open ? ' rotate-90' : ''}`} />
                        </button>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5"
                          onClick={() => openCollection(row)}
                        >
                          <span className="grid size-6 shrink-0 place-items-center">
                            <Icon aria-hidden className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                        </button>
                        <span className="sidebar-chat-count" title="视图数量">
                          <span className="sidebar-chat-count-num">{count}</span>
                        </span>
                      </div>
                      {open
                        ? views.map((view) => (
                            <div
                              key={view.id}
                              className={`chat-session-row fsdb-nav-view${selected && view.id === activeViewId ? ' is-active' : ''}`}
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-7 text-left text-[14px] leading-5"
                                onClick={() => openView(row, view.id)}
                              >
                                <span className="min-w-0 flex-1 truncate">{view.name}</span>
                              </button>
                            </div>
                          ))
                        : null}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </aside>
      ) : null}
      <CollectionBrowser
        key={`${path}:${activeViewId ?? ''}`}
        moduleId={DATABASE_MODULE_ID}
        collectionPath={path}
        title={title}
        blurb={blurb}
        chrome={chrome}
        hideViewsSidebar
      />
    </div>
  )
}

export function DatabaseHubPage(props: SlotProps) {
  const ui = props.databaseUi as DatabaseUi | undefined
  const collections = (props.collections as CollectionInfo[] | undefined) ?? []
  return <DatabaseHub collections={collections} databaseUi={ui} />
}
