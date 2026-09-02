import { isSessionCompactPoint, type SessionEvent } from '@biu/type-session'

export const COMPACT_GUIDE = [
  '【压缩目标】把会话中此前的必要上下文浓缩为一段结构化摘要，作为新前缀，之后不再重复发送旧历史。',
  '【摘要 Prompt】请逐项覆盖：',
  '  1. 当前位置/进度：你正在做什么任务、进行到哪一阶段、最近几轮聚焦的话题。',
  '  2. 关键决策：已作出的决定与理由。',
  '  3. 约束与偏好：用户明确的要求/偏好/限制、环境相关的关键事实。',
  '  4. 未完成事项：还有哪些待办/下一步要做什么。',
  '  5. 工具与依赖状态：当前用了哪些工具、有哪些进行中的子任务(subagent/后台任务)。',
  '【可丢弃】已解决的调试细节、重复的试错过程、对话中的寒暄与噪音。',
  '【格式】用紧凑的分节文字（不要过长，保持可读），让未来能凭借该摘要直接接续工作。',
].join('\n')

export function lastUsageBeforeCompact(events: SessionEvent[]): {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  found: boolean
} {
  type AssistantUsage = NonNullable<Extract<SessionEvent, { type: 'assistant/message' }>['usage']>
  let last: AssistantUsage | undefined
  for (const ev of events) {
    if (isSessionCompactPoint(ev)) {
      last = undefined
      continue
    }
    if (ev.type === 'assistant/message' && ev.usage) last = ev.usage
  }
  if (!last) return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, found: false }
  return {
    inputTokens: last.inputTokens ?? 0,
    outputTokens: last.outputTokens ?? 0,
    totalTokens: last.totalTokens ?? (last.inputTokens ?? 0) + (last.outputTokens ?? 0),
    cacheReadTokens: last.cacheReadTokens ?? 0,
    found: true,
  }
}

function extractSegments(events: SessionEvent[]): { kind: string; text: string; ts?: number }[] {
  const segments: { kind: string; text: string; ts?: number }[] = []
  for (const ev of events) {
    if (ev.type === 'user/message') segments.push({ kind: 'user', text: ev.text, ts: ev.ts })
    else if (ev.type === 'assistant/message') segments.push({ kind: 'assistant', text: ev.text, ts: ev.ts })
    else if (ev.type === 'tool/result' && ev.detail) {
      segments.push({ kind: 'tool:' + ev.name, text: ev.detail.slice(0, 500), ts: ev.ts })
    }
  }
  return segments
}

export function retrieveHistory(
  events: SessionEvent[],
  query: string,
  limit: number,
): { kind: string; text: string; ts?: number }[] {
  const segments = extractSegments(events)
  const qTokens = query
    .split(/[\s,，。；;：:、/]+/)
    .filter((w) => w.trim().length >= 2)
    .map((w) => w.toLowerCase())
  const scored = segments.map((seg) => {
    const lower = seg.text.toLowerCase()
    let score = 0
    for (const qt of qTokens) {
      let i = -1
      while ((i = lower.indexOf(qt, i + 1)) !== -1) score += 1
    }
    if (score > 0) score += Math.max(0, 1 - Math.abs(200 - seg.text.length) / 500)
    return { seg, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.seg)
}
