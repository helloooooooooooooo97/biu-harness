import { SidebarMascot, resolveSessionMascot } from '@biu/web-mascot'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'

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

function SessionTitle({ record, label }: { record: DbRecord; label: string }) {
  const identity = resolveSessionMascot(String(record.id), sessionMascot(record))
  return (
    <span className="sessions-title">
      <SidebarMascot size={20} sessionId={String(record.id)} identity={identity} animate={false} title={label} />
      <span className="sessions-title-label">{label}</span>
    </span>
  )
}

export const sessionsChrome: CollectionChrome = {
  Title: SessionTitle,
}

if (typeof document !== 'undefined') {
  const id = 'biu-sessions-chrome-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.sessions-title{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;vertical-align:middle}
.sessions-title .sidebar-mascot{flex:none}
.sessions-title-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
`
  document.head.appendChild(style)
}
