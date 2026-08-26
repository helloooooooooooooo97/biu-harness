import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isMascotDancing, subscribeMascotDance } from '@biu/web-mascot'
import {
  PINNED_GROUP_KEY,
  UNGROUPED_PROJECT_KEY,
  UNGROUPED_TAG_KEY,
  bindSessionView,
  buildSidebarSections,
  type SessionListItem,
  type SessionViewService,
  type SidebarSectionKind,
  useSidebarCollapseStore,
} from '@biu/web-session-view'
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
  LuTrash2,
} from 'react-icons/lu'

function SessionTagHint({ tags }: { tags?: string[] }) {
  const list = (tags ?? []).map((tag) => tag.trim()).filter(Boolean)
  if (!list.length) return null
  const extra = list.length - 1
  return (
    <span className="side-page-tag">
      {list[0]}
      {extra > 0 ? <span className="side-page-tag-more">+{extra}</span> : null}
    </span>
  )
}

const SessionRow = memo(function SessionRow({
  item,
  active,
  busy,
  dancing,
  depth,
  showTags,
  onDelete,
  onPin,
}: {
  item: SessionListItem
  active: boolean
  busy: boolean
  dancing: boolean
  depth: 0 | 1
  showTags: boolean
  onDelete: (item: SessionListItem) => void
  onPin: (item: SessionListItem) => void
}) {
  const identity = resolveSessionMascot(item.id, item.mascot)
  const pinned = Boolean(item.pinned)
  return (
    <div
      className={`side-page${active ? ' is-active' : ''}${pinned ? ' is-pinned' : ''}${depth ? ' is-nested' : ''}`}
    >
      <Link to={`/s/${item.id}`} className="side-page-link">
        <SidebarMascot
          size={18}
          sessionId={item.id}
          identity={identity}
          busy={busy}
          animate={false}
          dancing={dancing}
          title={dancing ? '跳舞中 🎉' : `${identity.shape} · ${identity.color}`}
        />
        <span className="side-page-title">
          {(item.type ?? 'chat') === 'live' ? <span className="side-page-live">Live</span> : null}
          {item.title}
        </span>
        {showTags ? <SessionTagHint tags={item.tags} /> : null}
      </Link>
      <div className="side-page-tools">
        <button
          type="button"
          className={`side-tool${pinned ? ' is-on' : ''}`}
          aria-pressed={pinned}
          aria-label={pinned ? `取消置顶 ${item.title}` : `置顶 ${item.title}`}
          title={pinned ? '取消置顶' : '置顶'}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onPin(item)
          }}
        >
          <LuPin />
        </button>
        <button
          type="button"
          className="side-tool is-danger"
          aria-label={`删除 ${item.title}`}
          title="删除"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete(item)
          }}
        >
          <LuTrash2 />
        </button>
      </div>
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
  const agentBusy = useSessionView((state) => state.agentStatus === 'running' || state.pending)
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
  const sections = useMemo(() => buildSidebarSections(sessions), [sessions])
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SidebarSectionKind, boolean>>>({
    tag: true,
  })
  const toggleSection = useCallback((kind: SidebarSectionKind) => {
    setCollapsedSections((prev) => ({ ...prev, [kind]: !prev[kind] }))
  }, [])
  const dancing = useSyncExternalStore(
    subscribeMascotDance,
    () => isMascotDancing(),
    () => false,
  )
  const prevRouteSessionRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const prev = prevRouteSessionRef.current
    prevRouteSessionRef.current = routeSessionId
    if (!routeSessionId || prev === routeSessionId) return
    const group = sections
      .flatMap((section) => section.groups ?? [])
      .find((item) => item.sessions.some((row) => row.id === routeSessionId))
    if (!group || group.key === PINNED_GROUP_KEY) return
    expandProjectGroup(group.key)
    setCollapsedSections((prev) => ({ ...prev, [group.kind === 'tag' ? 'tag' : 'project']: false }))
  }, [routeSessionId, sections, expandProjectGroup])

  const createChat = useCallback(
    (opts: { type?: 'chat' | 'live'; projectPath?: string } = {}) => {
      void sessionView.newSession(opts).then((id) => navigate(`/s/${id}`))
    },
    [navigate, sessionView],
  )

  const deleteChat = useCallback(
    (item: SessionListItem) => {
      if (!window.confirm(`删除会话 “${item.title}”？`)) return
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

  return (
    <aside className={`app-side-bar${visible ? ' is-open' : ''}`} aria-hidden={!visible}>
      <div className="side-scroll">
        <div className="side-head">
          <span className="side-head-title">会话</span>
          <button
            type="button"
            className="side-tool"
            title="收起侧栏"
            aria-label="收起侧栏"
            onClick={onCollapse}
          >
            <LuPanelLeftClose />
          </button>
        </div>

        <div className="side-cmds" role="navigation" aria-label="新建">
          <button type="button" className="side-cmd" onClick={() => createChat({ type: 'chat' })}>
            <LuPlus />
            <span>新会话</span>
          </button>
          <button type="button" className="side-cmd" onClick={() => createChat({ type: 'live' })}>
            <LuRadio />
            <span>新 Live</span>
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="side-empty">还没有会话。</p>
        ) : (
          sections.map((section) => {
            const sectionCollapsed = Boolean(collapsedSections[section.kind])
            return (
              <section key={section.kind} className="side-sec">
                <button
                  type="button"
                  className="side-sec-label"
                  aria-expanded={!sectionCollapsed}
                  onClick={() => toggleSection(section.kind)}
                >
                  <span className="side-sec-chev" aria-hidden>
                    {sectionCollapsed ? <LuChevronRight /> : <LuChevronDown />}
                  </span>
                  {section.label}
                </button>
                {sectionCollapsed ? null : section.sessions ? (
                  <div className="side-sec-body">
                    {section.sessions.map((item) => (
                      <SessionRow
                        key={`pinned:${item.id}`}
                        item={item}
                        active={item.id === routeSessionId}
                        busy={Boolean(busySessions[item.id]) || (item.id === routeSessionId && agentBusy)}
                        dancing={dancing}
                        depth={0}
                        showTags
                        onDelete={deleteChat}
                        onPin={pinChat}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="side-sec-body">
                    {section.groups?.map((group) => {
                      const collapsed = Boolean(collapsedProjects[group.key])
                      const isUngrouped = group.key === UNGROUPED_PROJECT_KEY || group.key === UNGROUPED_TAG_KEY
                      const canAddHere = group.kind === 'project' || group.kind === 'ungrouped'
                      return (
                        <div key={group.key} className="side-group">
                          <div className="side-group-head">
                            <button
                              type="button"
                              className="side-group-toggle"
                              title={group.path ?? group.label}
                              aria-expanded={!collapsed}
                              onClick={() => toggleProjectGroup(group.key)}
                            >
                              <span className="side-group-chev" aria-hidden>
                                {collapsed ? <LuChevronRight /> : <LuChevronDown />}
                              </span>
                              {isUngrouped ? (
                                <span className="side-group-dot" aria-hidden />
                              ) : (
                                <FolderGlyph className="side-group-icon" />
                              )}
                              <span className="side-group-name">{group.label}</span>
                            </button>
                            {canAddHere ? (
                              <button
                                type="button"
                                className="side-tool side-group-add"
                                title={isUngrouped ? '在未分组下添加' : `在 ${group.label} 下添加`}
                                aria-label={isUngrouped ? '在未分组下添加' : `在 ${group.label} 下添加`}
                                onClick={() =>
                                  createChat({
                                    type: 'chat',
                                    ...(group.path ? { projectPath: group.path } : {}),
                                  })
                                }
                              >
                                <LuPlus />
                              </button>
                            ) : null}
                          </div>
                          <div className={`side-group-body${collapsed ? ' is-collapsed' : ''}`}>
                            {group.sessions.map((item) => (
                              <SessionRow
                                key={`${group.key}:${item.id}`}
                                item={item}
                                active={item.id === routeSessionId}
                                busy={Boolean(busySessions[item.id]) || (item.id === routeSessionId && agentBusy)}
                                dancing={dancing}
                                depth={1}
                                showTags={section.kind !== 'tag'}
                                onDelete={deleteChat}
                                onPin={pinChat}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </aside>
  )
})
