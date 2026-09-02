import { useEffect } from 'react'
import { ChatDockStack, ChatPane, ChatStage } from '@biu/public-ui'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import { MASCOT_COLOR_NAME, MASCOT_EYE_NAME, MASCOT_SHAPE_NAME } from '@biu/type-session'
import type { CollectionChrome, FsCellProps, FsContentProps } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { bindProjectView, type ProjectViewService } from '@biu/web-project-view'
import type { PickService } from '@biu/cap-pick/web'
import { ApprovalsRail } from './approvals.tsx'
import { ChatComposer } from './composer.tsx'
import { ChatConfigBanner } from './config-banner.tsx'
import { ChatLiveHud } from './live-hud.tsx'
import { ChatThread } from './thread.tsx'

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

type SessionChatProps = {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  useProjectView: ReturnType<typeof bindProjectView>
  projectView: ProjectViewService
  pick?: PickService
}

function SessionRecordChat({ record, ...slot }: FsContentProps & SessionChatProps) {
  const sessionId = String(record.id)
  const liveId = slot.useSessionView((state) => state.sessionId)
  useEffect(() => {
    if (slot.sessionView.get().sessionId === sessionId) return
    void slot.sessionView.load(sessionId, { view: 'chat' }).catch(() => undefined)
  }, [sessionId, slot.sessionView])
  const props = slot as SlotProps
  return (
    <ChatPane
      embed
      thread={
        <ChatStage variant="pane">{liveId === sessionId ? <ChatThread {...props} /> : null}</ChatStage>
      }
      dock={
        <ChatDockStack>
          <ChatConfigBanner {...props} />
          <ApprovalsRail {...props} />
          <ChatLiveHud {...props} />
          <ChatComposer {...props} pick={slot.pick} />
        </ChatDockStack>
      }
    />
  )
}

export function sessionsChrome(slot: SessionChatProps): CollectionChrome {
  return {
    Title: SessionTitle,
    Icon: SessionIcon,
    Content: (props) => <SessionRecordChat {...props} {...slot} />,
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
.fsdb-fileview:has(.chat-pane-embed){display:flex;flex-direction:column;flex:1;min-height:min(72vh,720px)}
.inspector-database-page .fsdb-fileview:has(.chat-pane-embed){min-height:0;flex:1}
`
  document.head.appendChild(style)
}
