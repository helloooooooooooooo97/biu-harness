import { type CSSProperties } from 'react'
import {
  formatTokens,
  formatTrajectoryUsage,
  type TrajectoryUsage,
} from '@biu/web-session-view'

function formatTok(n: number) {
  return formatTokens(n)
}

function cacheHitPct(usage: TrajectoryUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null
  return Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
}

/** 历史占比是 0~1 的有限数值才纳入合成背景。 */
function isHistPct(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
}

/**
 * 绿色圆环 = cache hit（旁注 input 数量）；红色圆环 = 历史占比。
 * cache / 历史的百分比数字放在悬浮 title。histPct 默认取 usage.histPct。
 */
export function UsageInline({
  usage,
  empty = '—',
  histPct,
}: {
  usage?: TrajectoryUsage
  empty?: string
  /** 历史 turn 输入占比（0~1）；缺省取 usage.histPct，显式传入则覆盖。 */
  histPct?: number
}) {
  if (!usage) return <span className="traj-usage-empty">{empty}</span>
  const pct = cacheHitPct(usage)
  const hist = isHistPct(histPct !== undefined ? histPct : usage.histPct)
    ? Math.round((histPct !== undefined ? histPct : usage.histPct!) * 100)
    : null
  const cacheFill = pct ?? 0
  const cacheTitle =
    pct != null
      ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
      : `input ${formatTok(usage.inputTokens)}`

  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span className="traj-usage-in-pair" title={cacheTitle}>
        <span className="traj-usage-in">{formatTok(usage.inputTokens)}</span>
        <span
          className="traj-usage-ring is-cache"
          style={{ '--fill': cacheFill, '--ring': 'rgb(87, 197, 119)', '--track': 'rgb(42, 58, 48)' } as CSSProperties}
          aria-hidden
        />
      </span>
      {hist != null ? (
        <span
          className="traj-usage-ring is-hist"
          style={{ '--fill': hist, '--ring': 'rgb(234, 89, 85)', '--track': 'rgb(61, 36, 35)' } as CSSProperties}
          title={`历史占比 ${hist}%`}
          aria-label={`历史占比 ${hist}%`}
        />
      ) : null}
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title={`output ${formatTok(usage.outputTokens)}`}>
        {formatTok(usage.outputTokens)}
      </span>
    </span>
  )
}
