import { SidebarMascot, resolveSessionMascot } from '@biu/web-mascot'
import { MASCOT_COLOR_NAME, MASCOT_EYE_NAME, MASCOT_SHAPE_NAME } from '@biu/type-session'
import type { CollectionChrome, FsCellProps } from '@biu/type-file-system/ui'
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

export const sessionsChrome: CollectionChrome = {
  Title: SessionTitle,
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
.sessions-title{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;vertical-align:middle}
.sessions-title .sidebar-mascot{flex:none}
.sessions-title-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
`
  document.head.appendChild(style)
}
