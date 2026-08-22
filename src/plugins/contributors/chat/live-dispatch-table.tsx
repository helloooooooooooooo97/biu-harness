import { memo, type CSSProperties } from 'react'
import { LuCircleCheck, LuCircleDashed, LuCircleX, LuLoaderCircle } from 'react-icons/lu'
import {
  formatTrajectoryUsage,
  type TrajectoryUsage,
} from '../../infrastructure/session-project.ts'
import type { DispatchedTaskRow } from '../../infrastructure/session-view.ts'

export type LiveDispatchTaskRow = DispatchedTaskRow

function formatTok(n: number) {
  return n.toLocaleString('en-US')
}

function cacheHitPct(usage: TrajectoryUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null
  return Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
}

/** 与 thread / trajectory 的 UsageInline 同一套外壳 */
function UsageInline({ usage }: { usage: TrajectoryUsage }) {
  const pct = cacheHitPct(usage)
  const inStyle: CSSProperties | undefined =
    pct != null
      ? {
          backgroundImage: `linear-gradient(90deg, rgba(34, 140, 90, 0.28) 0%, rgba(34, 140, 90, 0.28) ${pct}%, rgba(15, 17, 21, 0.06) ${pct}%, rgba(15, 17, 21, 0.06) 100%)`,
        }
      : undefined
  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span
        className={`traj-usage-in-wrap${pct != null ? ' has-cache' : ''}`}
        style={inStyle}
        title={
          pct != null
            ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
            : `input ${formatTok(usage.inputTokens)}`
        }
      >
        <span className="traj-usage-in">{formatTok(usage.inputTokens)}</span>
        {pct != null ? <span className="traj-usage-cache-pct">{pct}%</span> : null}
      </span>
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title="output tokens">
        {formatTok(usage.outputTokens)}
      </span>
    </span>
  )
}

function statusMeta(status: LiveDispatchTaskRow['status'], reason?: string) {
  if (status === 'complete') {
    return {
      label: '已完成',
      className: 'text-[var(--dsw-ok,#34d399)]',
      icon: <LuCircleCheck className="size-3.5" aria-hidden />,
    }
  }
  if (status === 'running') {
    return {
      label: '运行中',
      className: 'text-[var(--dsw-business)]',
      icon: <LuLoaderCircle className="size-3.5 animate-spin" aria-hidden />,
    }
  }
  if (status === 'pending') {
    return {
      label: '等待中',
      className: 'text-[var(--dsw-label-3)]',
      icon: <LuCircleDashed className="size-3.5" aria-hidden />,
    }
  }
  return {
    label: reason ? `结束(${reason})` : '已结束',
    className: 'text-[var(--dsw-label-2)]',
    icon: <LuCircleX className="size-3.5" aria-hidden />,
  }
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
          <col style={{ width: '9.5rem' }} />
          <col style={{ width: '2.75rem' }} />
        </colgroup>
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-[var(--dsw-label-3)]">
            <th className="px-3 py-1.5 font-medium">任务</th>
            <th className="px-2 py-1.5 font-medium text-right">usage</th>
            <th className="px-2 py-1.5 font-medium text-right">状态</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => {
            const status = statusMeta(task.status, task.reason)
            return (
              <tr
                key={`${task.sessionId}-${task.wakeTs ?? index}`}
                className="border-t border-[color-mix(in_srgb,var(--dsw-border)_70%,transparent)]"
              >
                <td className="min-w-0 px-3 py-2 align-middle">
                  <div className="truncate font-semibold text-[var(--dsw-label)]">
                    {task.title ?? task.sessionId.slice(0, 8)}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[var(--dsw-label-3)]" title={task.preview}>
                    {task.tool === 'session_inject' ? 'inject' : 'wake'}
                    {task.workerTurn != null ? ` · t${task.workerTurn}` : ''}
                    {task.preview ? ` · ${task.preview}` : ''}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className="flex justify-end">
                    {task.usage ? (
                      <UsageInline usage={task.usage} />
                    ) : (
                      <span className="traj-usage-empty">—</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className={`flex justify-end ${status.className}`} title={status.label}>
                    <span className="inline-flex" aria-label={status.label}>
                      {status.icon}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--dsw-border)] bg-[color-mix(in_srgb,var(--dsw-hover)_50%,transparent)]">
            <td className="px-3 py-2 font-semibold text-[var(--dsw-label)]">合计（{tasks.length}）</td>
            <td className="px-2 py-2">
              <div className="flex justify-end">
                {total ? <UsageInline usage={total} /> : <span className="traj-usage-empty">—</span>}
              </div>
            </td>
            <td className="px-2 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
})
