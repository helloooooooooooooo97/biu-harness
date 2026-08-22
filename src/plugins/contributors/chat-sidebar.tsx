import { memo, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  bindSessionView,
  type SessionListItem,
  type SessionViewService,
} from '../infrastructure/session-view.ts'
import {
  UNGROUPED_PROJECT_KEY,
  groupSessionsByProject,
} from '../infrastructure/session-groups.ts'
import { useSidebarCollapseStore } from '../infrastructure/sidebar-collapse-store.ts'
import { SidebarMascot } from './mascot/sidebar-mascot.tsx'
import { resolveSessionMascot } from './mascot/session-mascot.ts'
import { FolderGlyph } from './chat/project-panel.tsx'
import {
  LuChevronDown,
  LuChevronRight,
  LuLayoutDashboard,
  LuPanelLeftClose,
  LuPlus,
  LuRadio,
} from 'react-icons/lu'

const SessionRow = memo(function SessionRow({
  item,
  active,
  busy,
  view,
  onDelete,
}: {
  item: SessionListItem
  active: boolean
  busy: boolean
  view: string
  onDelete: (item: SessionListItem) => void
}) {
  const identity = resolveSessionMascot(item.id, item.mascot)
  return (
    <div
      className={`group mb-px flex w-full items-stretch rounded-[6px] ${
        active ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]' : 'hover:bg-[var(--dsw-hover)]'
      }`}
    >
      <Link
        to={`/s/${item.id}${view === 'debug' ? '/debug' : ''}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left text-[12px] leading-4"
      >
        <SidebarMascot
          size={20}
          sessionId={item.id}
          identity={identity}
          busy={busy}
          title={`${identity.shape} · ${identity.color}`}
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
        className="shrink-0 px-1.5 text-[var(--dsw-label-3)] opacity-0 hover:text-[var(--dsw-danger)] group-hover:opacity-100 focus:opacity-100"
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
  const view = useSessionView((state) => state.view)
  const agentBusy = useSessionView((state) => state.agentStatus === 'running')
  const collapsedProjects = useSidebarCollapseStore((state) => state.collapsed)
  const toggleProjectGroup = useSidebarCollapseStore((state) => state.toggle)
  const projectGroups = useMemo(() => groupSessionsByProject(sessions), [sessions])

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
          <Link to="/dashboard" className="app-side-actions-item" title="Dashboard" aria-label="Dashboard">
            <span className="app-side-actions-icon" aria-hidden>
              <LuLayoutDashboard className="size-4" />
            </span>
            <span className="app-side-actions-label">Dashboard</span>
          </Link>
        </div>

        <div className="mt-2 space-y-1.5">
          {sessions.length === 0 ? (
            <p className="px-2 text-[11px] leading-4 text-[var(--dsw-label-3)]">No chats yet. Send a message or create one.</p>
          ) : (
            projectGroups.map((group) => {
              const hasRouteSession = Boolean(
                routeSessionId && group.sessions.some((row) => row.id === routeSessionId),
              )
              const collapsed = Boolean(collapsedProjects[group.key]) && !hasRouteSession
              const isUngrouped = group.key === UNGROUPED_PROJECT_KEY
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
                      {isUngrouped ? (
                        <span className="grid size-3 place-items-center text-[10px] opacity-70" aria-hidden>
                          —
                        </span>
                      ) : (
                        <FolderGlyph className="size-3 shrink-0 opacity-80" />
                      )}
                      <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{group.label}</span>
                      <span className="shrink-0 font-mono text-[10px] opacity-60">{group.sessions.length}</span>
                    </button>
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
                  </div>
                  {/* hidden 保活，避免展开时重新 mount 行（哪怕只有几条也少一次协调） */}
                  <div className={`min-w-0 ${collapsed ? 'hidden' : ''}`} aria-hidden={collapsed}>
                    {group.sessions.map((item) => (
                      <SessionRow
                        key={item.id}
                        item={item}
                        active={item.id === routeSessionId}
                        busy={item.id === routeSessionId && agentBusy}
                        view={view}
                        onDelete={deleteChat}
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
