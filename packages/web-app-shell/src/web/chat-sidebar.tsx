import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
  buildSidebarGroups,
  type SidebarGroupBy,
} from '@biu/web-session-view'
import { useSidebarCollapseStore } from '@biu/web-session-view'
import { SidebarMascot } from '@biu/web-mascot'
import { resolveSessionMascot } from '@biu/web-mascot'
import { FolderGlyph } from '@biu/web-session-view/folder-glyph'
import {
  LuChevronDown,
  LuChevronRight,
  LuPanelLeftClose,
  LuPin,
  LuPlus,
  LuRadio,
  LuTag,
} from 'react-icons/lu'

const GROUP_BY_KEY = 'cordis.sidebar.groupBy'

function readGroupBy(): SidebarGroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'tag' ? 'tag' : 'project'
  } catch {
    return 'project'
  }
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
    <div className={`chat-session-row group${active ? ' is-active' : ''}${pinned ? ' is-pinned' : ''}`}>
      <Link
        to={`/s/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left text-[12px] leading-4"
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
      </Link>
      <button
        type="button"
        className={`chat-session-row-pin${pinned ? ' is-on' : ''}`}
        aria-pressed={pinned}
        aria-label={pinned ? `取消置顶 ${item.title}` : `置顶 ${item.title}`}
        title={pinned ? '取消置顶' : '置顶'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onPin(item)
        }}
      >
        <LuPin className="size-3.5" />
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
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 7V5h4v2m-6 3v8m4-8v8m-7-11 1 14h10l1-14" />
        </svg>
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
  const [groupBy, setGroupBy] = useState<SidebarGroupBy>(readGroupBy)
  const sidebarGroups = useMemo(() => buildSidebarGroups(sessions, groupBy), [sessions, groupBy])
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
    const group = sidebarGroups.find((item) => item.sessions.some((row) => row.id === routeSessionId))
    if (!group || group.key === PINNED_GROUP_KEY) return
    expandProjectGroup(group.key)
  }, [routeSessionId, sidebarGroups, expandProjectGroup])

  const createChat = useCallback(
    (opts: { type?: 'chat' | 'live'; projectPath?: string } = {}) => {
      void sessionView.newSession(opts).then((id) => navigate(`/s/${id}`))
    },
    [navigate, sessionView],
  )

  const deleteChat = useCallback(
    (item: SessionListItem) => {
      if (!window.confirm(`Delete session “${item.title}”?`)) return
      const wasActive = item.id === sessionId
      void sessionView.deleteSession(item.id).then(() => {
        if (!wasActive) return
        const next = sessionView.get().sessionId
        navigate(next ? `/s/${next}` : '/')
      })
    },
    [navigate, sessionId, sessionView],
  )

  const pinChat = useCallback(
    (item: SessionListItem) => {
      void sessionView.setSessionPinned(item.id, !item.pinned)
    },
    [sessionView],
  )

  const changeGroupBy = useCallback((next: SidebarGroupBy) => {
    setGroupBy(next)
    try {
      localStorage.setItem(GROUP_BY_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <aside
      className={`app-side-bar min-h-0 flex-col overflow-hidden border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] ${
        visible ? 'flex' : 'hidden'
      }`}
      aria-hidden={!visible}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-3 pb-3">
        <div className="mb-1 flex items-center justify-between gap-2 px-2">
          <span className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Chat</span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-[6px] text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)]"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            onClick={onCollapse}
          >
            <LuPanelLeftClose className="size-3.5" />
          </button>
        </div>

        <div className="app-side-actions" role="navigation" aria-label="Chat actions">
          <button
            type="button"
            className="app-side-actions-item"
            title="添加聊天"
            aria-label="添加聊天"
            onClick={() => createChat({ type: 'chat' })}
          >
            <span className="app-side-actions-icon" aria-hidden>
              <LuPlus className="size-4" />
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
              <LuRadio className="size-4" />
            </span>
            <span className="app-side-actions-label">新建 Live</span>
          </button>
        </div>

        <div className="mt-2 flex items-center gap-0.5 px-2" role="tablist" aria-label="侧栏分组">
          <button
            type="button"
            role="tab"
            aria-selected={groupBy === 'project'}
            className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold ${
              groupBy === 'project'
                ? 'bg-[var(--dsw-hover-strong)] text-[var(--dsw-label)]'
                : 'text-[var(--dsw-label-3)] hover:text-[var(--dsw-label)]'
            }`}
            onClick={() => changeGroupBy('project')}
          >
            项目
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={groupBy === 'tag'}
            className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold ${
              groupBy === 'tag'
                ? 'bg-[var(--dsw-hover-strong)] text-[var(--dsw-label)]'
                : 'text-[var(--dsw-label-3)] hover:text-[var(--dsw-label)]'
            }`}
            onClick={() => changeGroupBy('tag')}
          >
            标签
          </button>
        </div>

        <div className="mt-2 space-y-1.5">
          {sessions.length === 0 ? (
            <p className="px-2 text-[11px] leading-4 text-[var(--dsw-label-3)]">No chats yet. Send a message or create one.</p>
          ) : (
            sidebarGroups.map((group) => {
              const collapsed = Boolean(collapsedProjects[group.key])
              const isUngrouped = group.key === UNGROUPED_PROJECT_KEY || group.key === UNGROUPED_TAG_KEY
              const canAddHere = group.kind === 'project' || group.kind === 'ungrouped'
              return (
                <div key={group.key} className="min-w-0">
                  <div className="group/header mb-0.5 flex items-center gap-0.5 px-1">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 rounded-[6px] px-1 py-0.5 text-left text-[11px] font-semibold tracking-wide text-[var(--dsw-label-3)] uppercase hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]"
                      title={group.path ?? group.label}
                      aria-expanded={!collapsed}
                      onClick={() => toggleProjectGroup(group.key)}
                    >
                      {collapsed ? (
                        <LuChevronRight className="size-3 shrink-0" />
                      ) : (
                        <LuChevronDown className="size-3 shrink-0" />
                      )}
                      {group.kind === 'pinned' ? (
                        <LuPin className="size-3 shrink-0 opacity-80" />
                      ) : group.kind === 'tag' ? (
                        <LuTag className="size-3 shrink-0 opacity-80" />
                      ) : isUngrouped ? (
                        <span className="grid size-3 place-items-center text-[10px] opacity-70" aria-hidden>
                          —
                        </span>
                      ) : (
                        <FolderGlyph className="size-3 shrink-0 opacity-80" />
                      )}
                      <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{group.label}</span>
                      <span className="shrink-0 font-mono text-[10px] opacity-60">{group.sessions.length}</span>
                    </button>
                    {canAddHere ? (
                      <button
                        type="button"
                        className="grid size-5 shrink-0 place-items-center rounded-[6px] text-[var(--dsw-label-3)] opacity-0 hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)] group-hover/header:opacity-100 focus:opacity-100"
                        title={isUngrouped ? '在未分组下添加聊天' : `在 ${group.label} 下添加聊天`}
                        aria-label={isUngrouped ? '在未分组下添加聊天' : `在 ${group.label} 下添加聊天`}
                        onClick={() =>
                          createChat({
                            type: 'chat',
                            ...(group.path ? { projectPath: group.path } : {}),
                          })
                        }
                      >
                        <LuPlus className="size-3" />
                      </button>
                    ) : null}
                  </div>
                  <div className={`min-w-0 ${collapsed ? 'hidden' : ''}`} aria-hidden={collapsed}>
                    {group.sessions.map((item) => (
                      <SessionRow
                        key={`${group.key}:${item.id}`}
                        item={item}
                        active={item.id === routeSessionId}
                        busy={Boolean(busySessions[item.id]) || (item.id === routeSessionId && agentBusy)}
                        dancing={dancing}
                        onDelete={deleteChat}
                        onPin={pinChat}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </aside>
  )
})
