import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

export function ApprovalsRail(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const approvals = useSessionView((state) => state.approvals)

  if (!approvals.length) {
    return (
      <div className="rounded-xl border border-[#3c4043] bg-[#18191a] p-3 text-xs text-[#9aa0a6]">
        无待审批工具。hold 模式下敏感工具会出现在这里。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold tracking-widest text-[#9aa0a6] uppercase">审批</h3>
      {approvals.map((item) => (
        <div key={item.id} className="rounded-xl border border-[#5b4636] bg-[#2a2118] p-3 text-xs text-[#e8eaed]">
          <div className="mb-1 font-medium">{item.name}</div>
          <pre className="mb-2 max-h-24 overflow-auto whitespace-pre-wrap text-[#c4c7c5]">
            {JSON.stringify(item.args, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full bg-[#4d6bfe] px-3 py-1 text-[11px] text-white"
              onClick={() => void sessionView.decideApproval(item.id, true)}
            >
              允许
            </button>
            <button
              type="button"
              className="rounded-full border border-[#5f6368] px-3 py-1 text-[11px]"
              onClick={() => void sessionView.decideApproval(item.id, false)}
            >
              拒绝
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
