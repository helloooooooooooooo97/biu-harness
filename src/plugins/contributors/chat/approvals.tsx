import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

export function ApprovalsRail(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const approvals = useSessionView((state) => state.approvals)

  if (!approvals.length) return null

  return (
    <div className="mx-auto w-full max-w-[calc(var(--dsw-chat-width)+32px)] space-y-2">
      {approvals.map((item) => (
        <div
          key={item.id}
          className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-[var(--dsw-label)]"
        >
          <div className="mb-1 font-medium">Approval · {item.name}</div>
          <pre className="mb-2 max-h-20 overflow-auto whitespace-pre-wrap text-[var(--dsw-label-2)]">
            {JSON.stringify(item.args, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1 text-[11px] text-white"
              style={{ background: 'var(--dsw-business)' }}
              onClick={() => void sessionView.decideApproval(item.id, true)}
            >
              Allow
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--dsw-border)] px-3 py-1 text-[11px]"
              onClick={() => void sessionView.decideApproval(item.id, false)}
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
