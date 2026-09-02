import { useEffect, useState } from 'react'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import { MASCOT_COLOR_NAME, MASCOT_EYE_NAME, MASCOT_SHAPE_NAME } from '@biu/type-session'
import type { CollectionChrome, FsCellProps, FsContentProps } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'
import {
  compactSessionEvents,
  projectNodes,
  SESSION_LOAD_TURNS,
  type ChatNode,
  type SessionEvent,
} from '@biu/web-session-view'
import { MarkdownBody } from './markdown.tsx'

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

function SessionTranscript({ record }: FsContentProps) {
  const sessionId = String(record.id)
  const [nodes, setNodes] = useState<ChatNode[]>([])
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let gone = false
    setStatus('loading')
    setNodes([])
    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}?turns=${SESSION_LOAD_TURNS}`)
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { events?: SessionEvent[] }
        const events = compactSessionEvents(Array.isArray(body.events) ? body.events : [])
        const next = projectNodes(events).filter((node) => node.kind !== 'turn')
        if (gone) return
        setNodes(next)
        setStatus(next.length ? 'ready' : 'empty')
      } catch {
        if (!gone) setStatus('error')
      }
    })()
    return () => {
      gone = true
    }
  }, [sessionId])
  if (status === 'loading') return <p className="sessions-log-empty">加载聊天记录…</p>
  if (status === 'error') return <p className="sessions-log-empty">无法加载聊天记录</p>
  if (status === 'empty') return <p className="sessions-log-empty">还没有聊天记录</p>
  return (
    <div className="sessions-log" data-testid="session-record-log">
      {nodes.map((node) => {
        if (node.kind === 'user') {
          return (
            <div key={node.id} className="chat-user-card">
              <div className="chat-user-card-body text-(--dsw-label)">
                <div className="whitespace-pre-wrap break-words">{node.text}</div>
              </div>
            </div>
          )
        }
        if (node.kind === 'reply') {
          return (
            <div key={node.id} className="chat-reply-block">
              <div className="chat-reply-body">
                <MarkdownBody text={node.copyText} />
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export const sessionsChrome: CollectionChrome = {
  Title: SessionTitle,
  Icon: SessionIcon,
  Content: SessionTranscript,
  cells: {
    mascotShape: MascotShapeCell,
    mascotColor: MascotColorCell,
    mascotEye: MascotEyeCell,
  },
}

if (typeof document !== 'undefined') {
  const id = 'biu-sessions-chrome-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.sessions-title-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.sessions-log{display:flex;flex-direction:column;gap:16px;min-width:0;padding:8px 0 24px}
.sessions-log-empty{margin:0;padding:8px 0;color:var(--dsw-label-3)}
.inspector-database-page .fsdb-fileview:has(.sessions-log),.inspector-database-page .fsdb-fileview:has(.sessions-log-empty){min-height:0}
`
  document.head.appendChild(style)
}
