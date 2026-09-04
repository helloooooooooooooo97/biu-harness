import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ChatPane, ChatStage, OutlineNav, SidebarOutlinePortal } from '@biu/public-ui'
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
} from '@biu/web-session-view'
import { ChatNodeList } from './thread.tsx'

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

function SessionRecordChat({ record }: FsContentProps) {
  const sessionId = String(record.id)
  const [nodes, setNodes] = useState<ChatNode[]>([])
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])
  const go = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-testid="session-record-chat"] [data-node-id="${escapeId(id)}"]`,
    )
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  useEffect(() => {
    const ac = new AbortController()
    void fetch(`/api/sessions/${sessionId}?turns=${SESSION_LOAD_TURNS}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body || !Array.isArray(body.events)) return
        setNodes(
          mergeDispatchedUsageIntoNodes(
            projectNodes(body.events as SessionEvent[]),
            (body.dispatchedUsageByTurn as Record<string, TrajectoryUsage>) ?? {},
          ),
        )
      })
      .catch(() => undefined)
    return () => ac.abort()
  }, [sessionId])
  const outline = items.length ? (
    <SidebarOutlinePortal>
      <OutlineNav items={items} testId="session-outline" onSelect={go} />
    </SidebarOutlinePortal>
  ) : null
  return (
    <>
      {outline}
      <ChatPane
        embed
        thread={
          <ChatStage variant="pane">
            <ChatNodeList nodes={nodes} onInspect={() => undefined} onFork={() => undefined} />
          </ChatStage>
        }
      />
    </>
  )
}

export function sessionsChrome(): CollectionChrome {
  return {
    Title: SessionTitle,
    Icon: SessionIcon,
    Content: SessionRecordChat,
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
.fsdb-fileview:has(.chat-pane-embed){display:flex;flex-direction:column;flex:none;min-width:0;min-height:0;height:auto;width:100%;max-width:100%;background:#191919}
.inspector-database-page .fsdb-fileview:has(.chat-pane-embed){min-height:0;flex:1}
.fsdb-detail-main:has(.chat-pane-embed),.fsdb-detail-screen:has(.chat-pane-embed){background:#191919}
.fsdb-detail-main:has(.chat-pane-embed) .chat-pane-embed{padding-inline:0;min-width:0;min-height:0;width:100%;max-width:100%;box-sizing:border-box}
.fsdb-detail-main:has(.chat-pane-embed) .chat-pane-embed,.fsdb-detail-main:has(.chat-pane-embed) .chat-overlay-thread,.fsdb-detail-main:has(.chat-pane-embed) .chat-stage{overflow:visible;flex:none;min-width:0;min-height:0;height:auto;max-width:100%;overscroll-behavior:auto;align-items:stretch;scrollbar-gutter:auto}
.fsdb-detail-main:has(.chat-pane-embed) .chat-stage>*{max-width:100%;width:100%;min-width:0;box-sizing:border-box}
`
  document.head.appendChild(style)
}
