import { memo, useId, useState } from 'react'
import {
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  PlusIcon,
  PuzzlePieceIcon,
  Square2StackIcon,
  StarIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/16/solid'
import type { CollectionInfo } from '@biu/type-file-system'
import type { SavedView } from './saved-view.ts'
import {
  activeViewStorageKey,
  loadStarredTables,
  loadViews,
  persistStarredTables,
  toggleStarredTable,
} from './view-storage.ts'

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
    </svg>
  )
}

function TableGlyph({ icon }: { icon?: string }) {
  const cls = 'size-4'
  const name = (icon ?? '').trim().toLowerCase()
  if (name === 'puzzle-piece' || name === 'puzzle') return <PuzzlePieceIcon aria-hidden className={cls} />
  if (name === 'clipboard-document-list' || name === 'clipboard') return <ClipboardDocumentListIcon aria-hidden className={cls} />
  return <TableCellsIcon aria-hidden className={cls} />
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
}: {
  tables: CollectionInfo[]
  collectionPath: string
  title: string
  views: SavedView[]
  activeViewId: string | null
  onOpenTable?: (path: string) => void
  onApplyView: (view: SavedView) => void
  onRenameView: (view: SavedView) => void
  onDeleteView: (view: SavedView) => void
  onAddView: () => void
  onCopyView: () => void
}) {
  const listedTables = tables.length ? tables : [{ path: collectionPath, label: title, view: { title } } as CollectionInfo]
  const [openTables, setOpenTables] = useState<Record<string, boolean>>(() => ({ [collectionPath]: true }))
  const [starredTables, setStarredTables] = useState(loadStarredTables)
  const [favOpen, setFavOpen] = useState(() => {
    try {
      return localStorage.getItem('fsdb.favOpen') !== '0'
    } catch {
      return true
    }
  })
  const starredRows = listedTables.filter((table) => starredTables.includes(table.path))

  function toggleStar(path: string) {
    setStarredTables((prev) => {
      const next = toggleStarredTable(prev, path)
      persistStarredTables(next)
      return next
    })
  }

  function openTable(path: string) {
    setOpenTables((prev) => ({ ...prev, [path]: true }))
    onOpenTable?.(path)
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
      <div className="fsdb-collection-head">
        <div className="fsdb-collection-name">数据</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <div className="app-side-actions" role="navigation" aria-label="视图操作">
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
        <section className="mt-2 min-w-0">
          {starredRows.length ? (
            <>
              <div className="sidebar-section-head min-w-0">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-normal">收藏</span>
                </button>
                <span className="sidebar-chat-count">
                  <span className="sidebar-chat-count-num">{starredRows.length}</span>
                </span>
              </div>
              {favOpen ? (
                <div className="sidebar-session-list mb-2">
                  {starredRows.map((table) => {
                    const name = table.view?.title ?? table.label
                    return (
                      <div
                        key={`star:${table.path}`}
                        className={`chat-session-row group${table.path === collectionPath ? ' is-active' : ''} is-pinned`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5"
                          onClick={() => openTable(table.path)}
                        >
                          <span className="grid size-6 shrink-0 place-items-center">
                            <TableGlyph icon={table.view?.icon} />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                        </button>
                        <button
                          type="button"
                          className="chat-session-row-star is-on"
                          aria-pressed
                          aria-label={`取消收藏 ${name}`}
                          title="取消收藏"
                          onClick={() => toggleStar(table.path)}
                        >
                          <StarIcon className="size-4 text-[#f5b700]" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </>
          ) : null}
          <div className="sidebar-section-head min-w-0">
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-normal">数据</span>
            <span className="sidebar-chat-count">
              <span className="sidebar-chat-count-num">{listedTables.length}</span>
            </span>
          </div>
          <div className="sidebar-session-list">
            {listedTables.map((table) => {
              const name = table.view?.title ?? table.label
              const open = openTables[table.path] ?? table.path === collectionPath
              const listed = table.path === collectionPath ? views : loadViews(table.path)
              const starred = starredTables.includes(table.path)
              return (
                <div key={table.path}>
                  <div className={`chat-session-row group${table.path === collectionPath ? ' is-active' : ''}${starred ? ' is-pinned' : ''}`}>
                    <button
                      type="button"
                      className="fsdb-nav-chevron"
                      aria-expanded={open}
                      aria-label={open ? `折叠 ${name}` : `展开 ${name}`}
                      onClick={() => setOpenTables((prev) => ({ ...prev, [table.path]: !open }))}
                    >
                      <ChevronRightIcon className={`size-4${open ? ' rotate-90' : ''}`} />
                    </button>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5"
                      onClick={() => openTable(table.path)}
                    >
                      <span className="grid size-6 shrink-0 place-items-center">
                        <TableGlyph icon={table.view?.icon} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    </button>
                    <span className="sidebar-chat-count" title="视图数量">
                      <span className="sidebar-chat-count-num">{listed.length}</span>
                    </span>
                    <button
                      type="button"
                      className={`chat-session-row-star${starred ? ' is-on' : ''}`}
                      aria-pressed={starred}
                      aria-label={starred ? `取消收藏 ${name}` : `收藏 ${name}`}
                      title={starred ? '取消收藏' : '收藏'}
                      onClick={() => toggleStar(table.path)}
                    >
                      <StarIcon className={`size-4${starred ? ' text-[#f5b700]' : ''}`} />
                    </button>
                  </div>
                  {open
                    ? listed.map((view) => (
                        <div
                          key={view.id}
                          className={`chat-session-row group${table.path === collectionPath && view.id === activeViewId ? ' is-active' : ''}`}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-7 text-left text-[14px] leading-5"
                            onClick={() => {
                              if (table.path !== collectionPath) {
                                try {
                                  localStorage.setItem(activeViewStorageKey(table.path), view.id)
                                } catch {
                                  /* ignore */
                                }
                                openTable(table.path)
                                return
                              }
                              onApplyView(view)
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{view.name}</span>
                          </button>
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
  )
})
