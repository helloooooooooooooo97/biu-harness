import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { isMascotDancing, subscribeMascotDance } from '@biu/web-mascot'
import {
  bindSessionView,
  type SessionListItem,
  type SessionViewService,
} from '@biu/web-session-view'
import {
  PINNED_GROUP_KEY,
  UNGROUPED_PROJECT_KEY,
  UNGROUPED_TAG_KEY,
  buildSidebarSections,
  type SidebarGroupBy,
  type SidebarSectionKind,
} from '@biu/web-session-view'
import { useSidebarCollapseStore } from '@biu/web-session-view'
import { SidebarMascot } from '@biu/web-mascot'
import { resolveSessionMascot } from '@biu/web-mascot'
import { FolderGlyph } from '@biu/web-session-view/folder-glyph'
import { chromeIcon, chromeIconClass, groupIcon, groupIconClass } from './chrome-icon.ts'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  PlusIcon,
  SignalIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/16/solid'
import { FolderIcon as FolderGroupIcon, TagIcon as TagGroupIcon, FolderMinusIcon as FolderMinusGroupIcon, BookmarkSlashIcon as BookmarkSlashGroupIcon } from '@heroicons/react/20/solid'

/** 项目/标签分组视图的持久化 key。 */
const GROUP_BY_KEY = 'cordis.sidebar.groupBy'

function readGroupBy(): SidebarGroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'tag' ? 'tag' : 'project'
  } catch {
    return 'project'
  }
}

/** 每行 tag 徽标：最多显示 2 个，其余以 +N（剩余数量）展示。 */
function SessionTagBadges({ tags }: { tags?: string[] }) {
  const list = (tags ?? []).map((tag) => tag.trim()).filter(Boolean)
  if (!list.length) return null
  const shown = list.slice(0, 2)
  const extra = list.length - shown.length
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-0.5 pl-0.5">
      {shown.map((tag) => (
        <span
          key={tag}
          className="max-w-[72px] truncate rounded-[4px] bg-[var(--dsw-hover-weak,var(--dsw-hover))] px-1 py-px text-[11px] leading-[15px] font-medium text-[var(--dsw-label-3)]"
        >
          {tag}
        </span>
      ))}
      {extra > 0 ? (
        <span className="shrink-0 rounded-[4px] px-0.5 py-px text-[11px] leading-[15px] font-medium text-[var(--dsw-label-3)] opacity-80">
          +{extra}
        </span>
      ) : null}
    </span>
  )
}

const SessionRow = memo(function SessionRow({
  item,
  active,
  busy,
  dancing,
  onDelete,
  onPin,
}: {
  item: SessionListItem
  active: boolean
  busy: boolean
  dancing: boolean
  onDelete: (item: SessionListItem) => void
  onPin: (item: SessionListItem) => void
}) {
  const identity = resolveSessionMascot(item.id, item.mascot)
  const pinned = Boolean(item.pinned)
  return (
    <div
      className={`chat-session-row group${active ? ' is-active' : ''}${pinned ? ' is-pinned' : ''}`}
      data-biu-kind="session"
      data-biu-id={item.id}
      data-biu-label={item.title}
    >
      <Link
        to={`/s/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[14px] leading-5"
      >
        <SidebarMascot
          size={24}
          sessionId={item.id}
          identity={identity}
          busy={busy}
          animate={false}
          dancing={dancing}
          title={dancing ? '跳舞中 🎉' : `${identity.shape} · ${identity.color}`}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {(item.type ?? 'chat') === 'live' ? (
            <span className="mr-1 text-[9px] font-semibold tracking-wide text-[var(--dsw-label-3)] uppercase">
              live
            </span>
          ) : null}
          {item.title}
        </span>
        <SessionTagBadges tags={item.tags} />
      </Link>
      <button
        type="button"
        className={`chat-session-row-star${pinned ? ' is-on' : ''}`}
        aria-pressed={pinned}
        aria-label={pinned ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
        title={pinned ? '取消收藏' : '收藏'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onPin(item)
        }}
      >
        <StarIcon className={chromeIconClass(pinned ? 'text-[#f5b700]' : undefined)} />
      </button>
      <button
        type="button"
        className="chat-session-row-delete"
        aria-label={`Delete session ${item.title}`}
        title="Delete"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDelete(item)
        }}
      >
        <TrashIcon {...chromeIcon} />
      </button>
    </div>
  )
})

export type ChatSidebarProps = {
  visible: boolean
  routeSessionId: string | null
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  onCollapse: () => void
}

/**
 * 独立订阅折叠态与 sessions：组展开/收缩只重渲侧栏，不拖垮 Shell 里的 Chat Markdown 主区。
 */
export const ChatSidebar = memo(function ChatSidebar({
  visible,
  routeSessionId,
  useSessionView,
  sessionView,
  onCollapse,
}: ChatSidebarProps) {
  const navigate = useNavigate()
  const sessions = useSessionView((state) => state.sessions)
  const sessionId = useSessionView((state) => state.sessionId)
  const agentBusy = useSessionView(
    (state) => state.agentStatus === 'running' || state.pending,
  )
  // 用签名订阅，避免 busySessions 对象引用抖动导致整栏重渲
  const busySignature = useSessionView((state) =>
    Object.keys(state.busySessions)
      .sort()
      .join(','),
  )
  const busySessions = useMemo(() => {
    const map: Record<string, true> = {}
    if (!busySignature) return map
    for (const id of busySignature.split(',')) {
      if (id) map[id] = true
    }
    return map
  }, [busySignature])
  const collapsedProjects = useSidebarCollapseStore((state) => state.collapsed)
  const toggleProjectGroup = useSidebarCollapseStore((state) => state.toggle)
  const expandProjectGroup = useSidebarCollapseStore((state) => state.expand)
  // 数据分组视图：项目树 / 标签树（持久化记忆用户选择）
  const [groupBy, setGroupBy] = useState<SidebarGroupBy>(readGroupBy)
  const changeGroupBy = useCallback((next: SidebarGroupBy) => {
    setGroupBy(next)
    // 完整保存/恢复，不截断
    try {
      localStorage.setItem(GROUP_BY_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])
  // 板块并存：收藏 + (项目|标签)，由上而下
  const sections = useMemo(() => buildSidebarSections(sessions, groupBy), [sessions, groupBy])
  // 板块级收缩（点击标题可展开/收缩，不显示收缩按钮，层级靠 kind 图标表达）
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SidebarSectionKind, boolean>>>({})
  const [pendingDelete, setPendingDelete] = useState<SessionListItem | null>(null)
  const toggleSection = useCallback((kind: SidebarSectionKind) => {
    setCollapsedSections((prev) => ({ ...prev, [kind]: !prev[kind] }))
  }, [])
  const dancing = useSyncExternalStore(
    subscribeMascotDance,
    () => isMascotDancing(),
    () => false,
  )
  const prevRouteSessionRef = useRef<string | null>(null)

  // 仅在「切到」另一会话时展开其所在组；列表刷新不会顶开用户刚折叠的组
  useLayoutEffect(() => {
    const prev = prevRouteSessionRef.current
    prevRouteSessionRef.current = routeSessionId
    if (!routeSessionId || prev === routeSessionId) return
    const group = sections
      .flatMap((section) => section.groups ?? [])
      .find((item) => item.sessions.some((row) => row.id === routeSessionId))
    if (!group || group.key === PINNED_GROUP_KEY) return
    expandProjectGroup(group.key)
  }, [routeSessionId, sections, expandProjectGroup])

  const createChat = useCallback(
    (opts: { type?: 'chat' | 'live'; projectPath?: string } = {}) => {
      void sessionView.newSession(opts).then((id) => navigate(`/s/${id}`))
    },
    [navigate, sessionView],
  )

  const requestDeleteChat = useCallback((item: SessionListItem) => {
    setPendingDelete(item)
  }, [])

  const confirmDeleteChat = useCallback(() => {
    if (!pendingDelete) return
    const item = pendingDelete
    setPendingDelete(null)
    const wasActive = item.id === sessionId
    void sessionView.deleteSession(item.id).then(() => {
      if (!wasActive) return
      const next = sessionView.get().sessionId
      navigate(next ? `/s/${next}` : '/')
    })
  }, [navigate, pendingDelete, sessionId, sessionView])

  const pinChat = useCallback(
    (item: SessionListItem) => {
      void sessionView.setSessionPinned(item.id, !item.pinned)
    },
    [sessionView],
  )

  return (
    <aside
      className={`app-side-bar min-h-0 flex-col overflow-hidden border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] ${
        visible ? 'flex' : 'hidden'
      }`}
      aria-hidden={!visible}
    >
      <div className="app-side-bar-head">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Chat</span>
        <button
          type="button"
          className="grid size-[26px] place-items-center rounded-[6px] text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)]"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
        >
          <ChevronDoubleLeftIcon {...chromeIcon} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <div className="app-side-actions" role="navigation" aria-label="Chat actions">
          <button
            type="button"
            className="app-side-actions-item"
            title="添加聊天"
            aria-label="添加聊天"
            onClick={() => createChat({ type: 'chat' })}
          >
            <span className="app-side-actions-icon" aria-hidden>
              <PlusIcon {...chromeIcon} />
            </span>
            <span className="app-side-actions-label">添加聊天</span>
          </button>
          <button
            type="button"
            className="app-side-actions-item"
            title="新建 Live"
            aria-label="新建 Live"
            onClick={() => createChat({ type: 'live' })}
          >
            <span className="app-side-actions-icon" aria-hidden>
              <SignalIcon {...chromeIcon} />
            </span>
            <span className="app-side-actions-label">新建 Live</span>
          </button>
        </div>

        <div className="mt-2 space-y-1.5">
          {sessions.length === 0 ? (
            <p className="px-2 text-[11px] leading-4 text-[var(--dsw-label-3)]">No chats yet. Send a message or create one.</p>
          ) : (
            sections.map((section) => {
              const sectionCollapsed = Boolean(collapsedSections[section.kind])
              return (
                <section key={section.kind} className="min-w-0">
                  {/* 板块标题：收藏 / (项目|标签)，可点击整行展开/收缩；层级靠 kind 图标表达；悬浮时右侧露出分组切换 tab */}
                  <div className="sidebar-section-head min-w-0">
                    <button
                      type="button"
                      className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-bold tracking-wider text-[var(--dsw-label-3)] hover:text-[var(--dsw-label)]"
                      aria-expanded={!sectionCollapsed}
                      onClick={() => toggleSection(section.kind)}
                    >
                      <span className="min-w-0 flex-1 truncate tracking-normal">{section.label}</span>
                      <span className="shrink-0 font-mono text-[10px] opacity-60">
                        {section.sessions
                          ? section.sessions.length
                          : section.groups?.reduce((sum, g) => sum + g.sessions.length, 0) ?? 0}
                      </span>
                    </button>
                    {section.kind !== 'pinned' ? (
                      <div
                        className="sidebar-view-switch"
                        role="group"
                        aria-label="分组视图切换"
                      >
                        <button
                          type="button"
                          title="按项目分组"
                          aria-pressed={groupBy === 'project'}
                          className={`sidebar-view-switch-btn${groupBy === 'project' ? ' is-on' : ''}`}
                          onClick={() => changeGroupBy('project')}
                        >
                          <FolderGroupIcon {...groupIcon} />
                        </button>
                        <button
                          type="button"
                          title="按标签分组"
                          aria-pressed={groupBy === 'tag'}
                          className={`sidebar-view-switch-btn${groupBy === 'tag' ? ' is-on' : ''}`}
                          onClick={() => changeGroupBy('tag')}
                        >
                          <TagGroupIcon {...groupIcon} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {!sectionCollapsed ? (
                    <div className="min-w-0 space-y-1.5 pt-0.5">
                      {section.sessions
                        ? section.sessions.map((item) => (
                            <SessionRow
                              key={`pinned:${item.id}`}
                              item={item}
                              active={item.id === routeSessionId}
                              busy={Boolean(busySessions[item.id]) || (item.id === routeSessionId && agentBusy)}
                              dancing={dancing}
                              onDelete={requestDeleteChat}
                              onPin={pinChat}
                            />
                          ))
                        : section.groups?.map((group) => {
                        const collapsed = Boolean(collapsedProjects[group.key])
                        const isUngrouped = group.key === UNGROUPED_PROJECT_KEY || group.key === UNGROUPED_TAG_KEY
                        const canAddHere = group.kind === 'project' || group.kind === 'ungrouped'
                        return (
                          <div key={group.key} className="min-w-0">
                            <div className="sidebar-group-head mb-0.5 flex items-center">
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex min-h-[32px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[6px] text-left text-[14px] font-medium tracking-normal text-[var(--dsw-label-3)] outline-none hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)] focus-visible:ring-1 focus-visible:ring-[var(--dsw-border)]"
                                title={group.path ?? group.label}
                                aria-expanded={!collapsed}
                                onClick={() => toggleProjectGroup(group.key)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    toggleProjectGroup(group.key)
                                  }
                                }}
                              >
                                <span className="sidebar-rail-icon sidebar-group-fold" aria-hidden>
                                  <span className="sidebar-group-fold-face">
                                    {group.kind === 'pinned' ? (
                                      <StarIcon className={chromeIconClass('text-[#f5b700]')} />
                                    ) : group.key === UNGROUPED_PROJECT_KEY ? (
                                      <FolderMinusGroupIcon className={groupIconClass('opacity-80')} />
                                    ) : group.key === UNGROUPED_TAG_KEY ? (
                                      <BookmarkSlashGroupIcon className={groupIconClass('opacity-80')} />
                                    ) : group.kind === 'tag' ? (
                                      <TagGroupIcon className={groupIconClass('opacity-80')} />
                                    ) : (
                                      <FolderGlyph className="size-5 opacity-80" />
                                    )}
                                  </span>
                                  <span className="sidebar-group-fold-chevron">
                                    {collapsed ? (
                                      <ChevronRightIcon className={chromeIconClass('opacity-80')} />
                                    ) : (
                                      <ChevronDownIcon className={chromeIconClass('opacity-80')} />
                                    )}
                                  </span>
                                </span>
                                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                                <span className="shrink-0 font-mono text-[10px] opacity-60">{group.sessions.length}</span>
                                {canAddHere ? (
                                  <button
                                    type="button"
                                    className="sidebar-add"
                                    title={isUngrouped ? '在未分组下添加聊天' : `在 ${group.label} 下添加聊天`}
                                    aria-label={isUngrouped ? '在未分组下添加聊天' : `在 ${group.label} 下添加聊天`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      createChat({
                                        type: 'chat',
                                        ...(group.path ? { projectPath: group.path } : {}),
                                      })
                                    }}
                                  >
                                    <PlusIcon {...chromeIcon} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div className={`sidebar-session-list min-w-0 ${collapsed ? 'hidden' : ''}`} aria-hidden={collapsed}>
                              {group.sessions.map((item) => (
                                <SessionRow
                                  key={`${group.key}:${item.id}`}
                                  item={item}
                                  active={item.id === routeSessionId}
                                  busy={Boolean(busySessions[item.id]) || (item.id === routeSessionId && agentBusy)}
                                  dancing={dancing}
                                  onDelete={requestDeleteChat}
                                  onPin={pinChat}
                                />
                              ))}
                            </div>
                          </div>
                        )
                        })
                    }
                    </div>
                  ) : null}
                </section>
              )
            })
          )}
        </div>
      </div>
      {pendingDelete && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
              data-testid="chat-session-delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-session-delete-title"
              onClick={() => setPendingDelete(null)}
            >
              <div
                className="w-[min(100%,320px)] rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] p-4 text-[var(--dsw-label)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="chat-session-delete-title" className="m-0 text-[13px] font-semibold">
                  删除「{pendingDelete.title}」？
                </h2>
                <p className="mt-1.5 mb-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                  删除后无法恢复这份会话。
                </p>
                <div className="mt-3 flex justify-end gap-1.5">
                  <button
                    type="button"
                    className="rounded-[6px] border-0 bg-[var(--dsw-hover)] px-2.5 py-1 text-[11px] text-[var(--dsw-label)] hover:bg-[#353535]"
                    data-testid="chat-session-delete-cancel"
                    onClick={() => setPendingDelete(null)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] border-0 bg-[var(--dsw-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--dsw-label)] hover:bg-[#353535]"
                    data-testid="chat-session-delete-confirm"
                    onClick={confirmDeleteChat}
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
})
