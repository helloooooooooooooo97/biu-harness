import { memo } from 'react'
import {
  formatTrajectoryUsage,
  type TrajectoryUsage,
} from '../../infrastructure/session-project.ts'
import type { DispatchedTaskRow } from '../../infrastructure/session-view.ts'

export type LiveDispatchTaskRow = DispatchedTaskRow

function formatTok(n: number) {
  return n.toLocaleString('en-US')
}

function statusLabel(status: LiveDispatchTaskRow['status'], reason?: string) {
  if (status === 'complete') return '已完成'
  if (status === 'running') return '运行中'
  if (status === 'pending') return '等待中'
  return reason ? `结束(${reason})` : '已结束'
}

function statusClass(status: LiveDispatchTaskRow['status']) {
  if (status === 'complete') return 'text-[var(--dsw-ok,#34d399)]'
  if (status === 'running') return 'text-[var(--dsw-business)]'
  if (status === 'pending') return 'text-[var(--dsw-label-3)]'
  return 'text-[var(--dsw-label-2)]'
}

function sumUsage(tasks: LiveDispatchTaskRow[]): TrajectoryUsage | undefined {
  let input = 0
  let output = 0
  let total = 0
  let cache = 0
  let hit = false
  for (const task of tasks) {
    if (!task.usage) continue
    hit = true
    input += task.usage.inputTokens
    output += task.usage.outputTokens
    total += task.usage.totalTokens ?? task.usage.inputTokens + task.usage.outputTokens
    cache += task.usage.cacheReadTokens ?? 0
  }
  if (!hit) return undefined
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    ...(cache ? { cacheReadTokens: cache } : {}),
  }
}

export const LiveDispatchTable = memo(function LiveDispatchTable({
  tasks,
}: {
  tasks: LiveDispatchTaskRow[]
}) {
  if (!tasks.length) return null
  const total = sumUsage(tasks)

  return (
    <div
      className="mt-3 overflow-hidden rounded-[10px] border border-[var(--dsw-border)] bg-[color-mix(in_srgb,var(--dsw-sidebar)_65%,transparent)]"
      data-testid="live-dispatch-table"
    >
      <div className="border-b border-[var(--dsw-border)] px-3 py-2 text-[11px] font-semibold text-[var(--dsw-label-2)]">
        本回合派工
      </div>
      <table className="w-full table-fixed border-collapse text-left text-[11px]">
        <colgroup>
          <col />
          <col style={{ width: '7.5rem' }} />
          <col style={{ width: '4.75rem' }} />
        </colgroup>
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-[var(--dsw-label-3)]">
            <th className="px-3 py-1.5 font-medium">任务</th>
            <th className="px-2 py-1.5 font-medium text-right">usage</th>
            <th className="px-3 py-1.5 font-medium text-right">状态</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => (
            <tr
              key={`${task.sessionId}-${task.wakeTs ?? index}`}
              className="border-t border-[color-mix(in_srgb,var(--dsw-border)_70%,transparent)]"
            >
              <td className="min-w-0 px-3 py-2 align-top">
                <div className="truncate font-semibold text-[var(--dsw-label)]">
                  {task.title ?? task.sessionId.slice(0, 8)}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[var(--dsw-label-3)]" title={task.preview}>
                  {task.tool === 'session_inject' ? 'inject' : 'wake'}
                  {task.workerTurn != null ? ` · t${task.workerTurn}` : ''}
                  {task.preview ? ` · ${task.preview}` : ''}
                </div>
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-right tabular-nums text-[var(--dsw-label-2)]">
                {task.usage
                  ? `${formatTok(task.usage.inputTokens)}→${formatTok(task.usage.outputTokens)}`
                  : '—'}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2 align-top text-right font-semibold ${statusClass(task.status)}`}
              >
                {statusLabel(task.status, task.reason)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--dsw-border)] bg-[color-mix(in_srgb,var(--dsw-hover)_50%,transparent)]">
            <td className="px-3 py-2 font-semibold text-[var(--dsw-label)]">合计（{tasks.length}）</td>
            <td
              className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--dsw-label)]"
              title={formatTrajectoryUsage(total)}
            >
              {total
                ? `${formatTok(total.inputTokens)}→${formatTok(total.outputTokens)}`
                : '—'}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
})
