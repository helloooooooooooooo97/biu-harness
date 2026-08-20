import { useEffect } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

export function TrajectoryView(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const rows = useSessionView((state) => state.trajectory)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const sessionId = useSessionView((state) => state.sessionId)

  useEffect(() => {
    if (!focusCallId) return
    document.getElementById(`traj-call-${focusCallId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusCallId, rows])

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--dsw-label-3)]">
        Open or create a session to inspect its trajectory.
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--dsw-label-3)]">
        No session events yet. Trajectory projects the append-only log.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[var(--dsw-chat-width)] overflow-hidden rounded-[12px] border border-[var(--dsw-border)]">
      <div className="grid grid-cols-[56px_56px_140px_minmax(0,1fr)] gap-2 border-b border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] px-3 py-2 text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">
        <span>seq</span>
        <span>turn</span>
        <span>type</span>
        <span>summary</span>
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto font-mono text-[12px]">
        {rows.map((row) => {
          const focused = Boolean(focusCallId && row.callId === focusCallId)
          return (
            <div
              key={row.id}
              id={row.callId ? `traj-call-${row.callId}` : undefined}
              className={`grid grid-cols-[56px_56px_140px_minmax(0,1fr)] gap-2 border-b border-[var(--dsw-border)] px-3 py-2 last:border-0 ${
                focused ? 'bg-[var(--dsw-business-soft)]' : 'hover:bg-black/[0.02]'
              }`}
            >
              <span className="text-[var(--dsw-label-3)]">{row.seq}</span>
              <span className="text-[var(--dsw-label-3)]">{row.turn ?? '—'}</span>
              <span className="truncate text-[var(--dsw-business)]">{row.type}</span>
              <span className="truncate text-[var(--dsw-label)]" title={row.summary}>
                {row.summary}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function trajectoryProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
