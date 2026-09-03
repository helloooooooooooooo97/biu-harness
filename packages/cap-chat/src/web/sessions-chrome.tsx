import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ChatDockStack, ChatPane, ChatStage, OutlineNav } from '@biu/public-ui'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import { MASCOT_COLOR_NAME, MASCOT_EYE_NAME, MASCOT_SHAPE_NAME } from '@biu/type-session'
import type { CollectionChrome, FsCellProps, FsContentProps } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'
import {
  deriveChatOutline,
  getChatOutlineFilter,
  mergeDispatchedUsageIntoNodes,
  projectNodes,
  SESSION_LOAD_TURNS,
  subscribeChatOutline,
  type ChatNode,
  type ChatOutlineFilter,
  type SessionEvent,
  type TrajectoryUsage,
  upsertSessionEvent,
} from '@biu/web-session-view'
import { ChatNodeList } from './thread.tsx'
import { ChatComposer } from './composer.tsx'
import type { SnapshotService } from '@biu/web-snapshot'

function sessionMascot(record: DbRecord) {
  const raw = record.mascot
  if (!raw || typeof raw !== 'object') return undefined
  const mascot = raw as { shape?: unknown; color?: unknown; eye?: unknown }
  if (typeof mascot.shape !== 'string' || typeof mascot.color !== 'string') return undefined
  return {
    shape: mascot.shape,
    color: mascot.color,
    ...(typeof mascot.eye === 'number' ? { eye: mascot.eye } : {}),
  }
}

function SessionIcon({ record }: { record: DbRecord }) {
  const identity = resolveSessionMascot(String(record.id), sessionMascot(record))
  return <SidebarMascot size={20} sessionId={String(record.id)} identity={identity} animate={false} title="" />
}

function SessionTitle({ label }: { record: DbRecord; label: string }) {
  return <span className="sessions-title-label">{label}</span>
}

function MascotShapeCell({ value }: FsCellProps) {
  const key = String(value ?? '')
  return <span>{MASCOT_SHAPE_NAME[key] ?? key}</span>
}

function MascotColorCell({ value }: FsCellProps) {
  const key = String(value ?? '')
  return <span>{MASCOT_COLOR_NAME[key] ?? key}</span>
}

function MascotEyeCell({ value }: FsCellProps) {
  const n = Number(value)
  if (!Number.isFinite(n)) return <span>—</span>
  const name = MASCOT_EYE_NAME[Math.abs(Math.trunc(n)) % MASCOT_EYE_NAME.length]
  return <span>{name}</span>
}

function escapeId(id: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
}

function useIdleSessionView<S>(sel: (state: { pending: boolean; inbox: never[]; sessionId: string }) => S): S {
  return sel({ pending: false, inbox: [], sessionId: '' })
}

const idleSessionView = {
  send: async () => undefined,
  cancel: async () => undefined,
  flushInbox: async () => undefined,
  get: () => ({ sessionId: '' }),
} as never

function SessionRecordChat({
  record,
  snapshot,
}: FsContentProps & { snapshot?: SnapshotService }) {
  const sessionId = String(record.id)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [nodes, setNodes] = useState<ChatNode[]>([])
  const [boundPending, setBoundPending] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])
  const go = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-testid="session-record-chat"] [data-node-id="${escapeId(id)}"]`,
    )
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  useLayoutEffect(() => {
    const el = anchorRef.current
    const root = el?.closest('.fsdb-right') ?? el?.closest('.fsdb-right-body') ?? el?.closest('.fsdb-detail-stage')
    setHost(root instanceof HTMLElement ? root : null)
  }, [])
  useEffect(() => {
    const ac = new AbortController()
    void fetch(`/api/sessions/${sessionId}?turns=${SESSION_LOAD_TURNS}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body || !Array.isArray(body.events)) return
        const next = body.events as SessionEvent[]
        setEvents(next)
        setNodes(
          mergeDispatchedUsageIntoNodes(
            projectNodes(next),
            (body.dispatchedUsageByTurn as Record<string, TrajectoryUsage>) ?? {},
          ),
        )
      })
      .catch(() => undefined)
    return () => ac.abort()
  }, [sessionId])
  useEffect(() => {
    if (!snapshot) return
    const offSession = snapshot.onMessage('session', (payload) => {
      const detail = payload as { sessionId?: string; event?: SessionEvent }
      if (detail.sessionId !== sessionId || !detail.event) return
      setEvents((prev) => {
        const next = upsertSessionEvent(prev, detail.event as SessionEvent)
        setNodes(projectNodes(next))
        return next
      })
    })
    const offAgent = snapshot.onMessage('agent', (payload) => {
      const status = payload as { sessionId?: string; status?: string }
      if (status.sessionId !== sessionId) return
      setBoundPending(status.status === 'running')
    })
    return () => {
      offSession()
      offAgent()
    }
  }, [snapshot, sessionId])
  useLayoutEffect(() => {
    const el = stageRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [sessionId, nodes])
  const outline = <OutlineNav items={items} testId="session-outline" onSelect={go} />
  return (
    <>
      {host ? createPortal(<div className="session-outline-host">{outline}</div>, host) : null}
      <div ref={anchorRef} className="session-record-chat-host">
        <ChatPane
          embed
          thread={
            <ChatStage variant="pane" stageRef={stageRef}>
              <ChatNodeList nodes={nodes} onInspect={() => undefined} onFork={() => undefined} />
            </ChatStage>
          }
          dock={
            <ChatDockStack>
              <ChatComposer
                boundSessionId={sessionId}
                boundPending={boundPending}
                useSessionView={useIdleSessionView}
                sessionView={idleSessionView}
              />
            </ChatDockStack>
          }
        />
      </div>
    </>
  )
}

export function sessionsChrome(snapshot?: SnapshotService): CollectionChrome {
  return {
    Title: SessionTitle,
    Icon: SessionIcon,
    Content: (props) => <SessionRecordChat {...props} snapshot={snapshot} />,
    cells: {
      mascotShape: MascotShapeCell,
      mascotColor: MascotColorCell,
      mascotEye: MascotEyeCell,
    },
  }
}

if (typeof document !== 'undefined') {
  const id = 'biu-sessions-chrome-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.sessions-title-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.session-record-chat-host{display:flex;flex-direction:column;flex:1;min-height:0;width:100%}
.fsdb-fileview:has(.chat-pane-embed){display:flex;flex-direction:column;flex:1;min-height:min(72vh,720px);overflow:hidden;background:#191919}
.inspector-database-page .fsdb-fileview:has(.chat-pane-embed){min-height:0;flex:1}
.fsdb-detail-main:has(.chat-pane-embed){display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;background:#191919;padding-bottom:0}
.fsdb-detail-screen:has(.chat-pane-embed) .fsdb-detail-split,.fsdb-detail-screen:has(.chat-pane-embed){flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.fsdb-right-body:has(.chat-pane-embed){overflow:hidden}
.inspector-database-page .fsdb-detail-stage:has(.chat-pane-embed){flex:1;min-height:0;align-self:stretch}
.session-outline-host{position:absolute;inset:0;z-index:20;pointer-events:none}
.fsdb-right:has(.session-outline-host),.fsdb-right-body:has(.session-outline-host),.fsdb-detail-stage:has(.session-outline-host){position:relative}
.session-outline-host .chat-outline{left:8px;top:50%}
`
  document.head.appendChild(style)
}
