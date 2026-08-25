import { type CSSProperties } from 'react'
import {
  formatTokens,
  formatTrajectoryUsage,
  type TrajectoryUsage,
} from '../../infrastructure/session-project.ts'

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
 * Input 包成胶囊；绿色(cache hit)与红色(历史占比)各自从左→右铺设，多段 linear-gradient
 * 合成在同一背景上：红色层在下、绿色层在上，alpha 混合呈现叠加色，两段互不强制铺满。
 *
 * histPct 默认取 usage.histPct（探底成功则出红色历史占比段），但也可用 histPct 参数覆盖。
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

  // 红、绿各 0~100%，独立叠加；任一存在才设背景。红层在下、绿层在上。
  const layers: string[] = []
  if (hist != null) layers.push(`linear-gradient(90deg, rgba(229, 72, 77, 0.3) 0%, rgba(229, 72, 77, 0.3) ${hist}%, transparent ${hist}%)`)
  if (pct != null)
    layers.push(
      `linear-gradient(90deg, rgba(34, 140, 90, 0.28) 0%, rgba(34, 140, 90, 0.28) ${pct}%, rgba(15, 17, 21, 0.06) ${pct}%, rgba(15, 17, 21, 0.06) 100%)`,
    )
  const inStyle: CSSProperties | undefined =
    layers.length > 0 ? { backgroundImage: layers.join(', ') } : undefined

  const title = hist != null
    ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct ?? 0}% · 历史占比 ${hist}%`
    : pct != null
      ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
      : `input ${formatTok(usage.inputTokens)}`

  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span
        className={`traj-usage-in-wrap${pct != null ? ' has-cache' : ''}${hist != null ? ' has-hist' : ''}`}
        style={inStyle}
        title={title}
      >
        {hist != null ? <span className="traj-usage-hist-pct">{hist}%</span> : null}
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
