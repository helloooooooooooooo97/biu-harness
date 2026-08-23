import { type Context } from 'cordis'
import '../../types.ts'
import { currentSessionId } from '../core/session-scope.ts'
import { estimateTokens } from '../core/sessions.ts'
import type { SessionEvent } from '../core/session-types.ts'

export const name = 'context'
export const inject = ['tools', 'sessions']

/**
 * 上下文自主管理工具：
 *  - session_compact  ：把当前前缀压缩为一段摘要（调用即压缩点，deriveMessages 从该次 tool/call 续读），之后从压缩点继续。
 *  - history_retrieve ：被压缩后，按需从历史 events 检索最相关的片段，补齐上下文。
 */
export function apply(ctx: Context) {
  ctx.tools.register({
    name: 'session_compact',
    description:
      '压缩当前会话上下文（两级操作，需在两次 step 中调用本工具两次）：\n' +
      '第 1 次调用：不传 text，返回"压缩操作指南与摘要 Prompt"。你先据此感知自己当前所处位置（进行到哪一阶段、正在做什么任务、最近聊了什么），并理解该保留什么、该丢弃什么。\n' +
      '第 2 次调用：依据指南生成一份精炼摘要，传 text 提交。本次工具调用即作为压缩点，此后 deriveMessages 从该次调用续读，之前的详细历史不再重复发送（大幅降低 token/成本）。\n' +
      '压缩后若需某段旧细节，可再调用 history_retrieve 从历史中检索。',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            '（第 2 次调用必填）压缩摘要：把到此为止的必要上下文浓缩成一段精炼结构化的文本，作为新的上下文前缀。含：当前位置/进度、已做关键决策与理由、关键约束与偏好、未完成事项/待办。可丢的：已解决的调试细节、重复行、噪音。',
        },
      },
    },
    execute: async (args) => {
      const sessionId = currentSessionId()
      if (!sessionId) throw new Error('no active session')
      const text = String(args.text ?? '').trim()

      // 第 1 次调用：不传 text → 返回操作指南 + 摘要 Prompt（让 agent 感知位置后自行总结）
      if (!text) {
        return {
          kind: 'guide',
          note: '这是 session_compact 的第 1 步（仅说明，尚未压缩）。请按以下指南生成摘要，随后用 text 参数再次调用本工具完成压缩：',
          guide: [
            '【压缩目标】把会话中此前的必要上下文浓缩为一段结构化摘要，作为新前缀，之后不再重复发送旧历史。',
            '【摘要 Prompt】请逐项覆盖：',
            '  1. 当前位置/进度：你正在做什么任务、进行到哪一阶段、最近几轮聚焦的话题。',
            '  2. 关键决策：已作出的决定与理由。',
            '  3. 约束与偏好：用户明确的要求/偏好/限制、环境相关的关键事实。',
            '  4. 未完成事项：还有哪些待办/下一步要做什么。',
            '  5. 工具与依赖状态：当前用了哪些工具、有哪些进行中的子任务(subagent/后台任务)。',
            '【可丢弃】已解决的调试细节、重复的试错过程、对话中的寒暄与噪音。',
            '【格式】用紧凑的分节文字（不要过长，保持可读），让未来能凭借该摘要直接接续工作。',
          ].join('\n'),
        }
      }

      // 第 2 次调用：带 text → 本次工具调用(tool/call session_compact)即构成压缩点，
      // deriveMessages 会识别该调用并从其 text 参数续读。无需显式写事件。
      return {
        kind: 'compacted',
        ok: true,
        sessionId,
        note: `已压缩完成：本次调用即作为压缩点，此后将从该摘要作为新前缀继续（前缀约 ${estimateTokens(text)} token），此前的详细历史仍可通过 history_retrieve 检索。`,
      }
    },
  })

  ctx.tools.register({
    name: 'history_retrieve',
    description:
      '从当前会话的完整历史中检索与查询最相关的片段（用于压缩后找回被摘要化的细节）。返回若干条相关历史文本，按相关度排序。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要检索的信息/关键词' },
        limit: { type: 'number', description: '最多返回几条（默认 5，最大 10）' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const sessionId = currentSessionId()
      if (!sessionId) throw new Error('no active session')
      const query = String(args.query ?? '')
      const limit = Math.min(10, Math.max(1, Number(args.limit ?? 5) || 5))
      const record = await ctx.sessions.get(sessionId)
      const events = record?.events ?? []

      // 抽取可检索的文本段（user/assistant 消息与 tool/result 概要）
      const segments: { text: string; kind: string; ts?: number }[] = []
      for (const ev of events) {
        if (ev.type === 'user/message') segments.push({ kind: 'user', text: ev.text, ts: ev.ts })
        else if (ev.type === 'assistant/message') segments.push({ kind: 'assistant', text: ev.text, ts: ev.ts })
        else if (ev.type === 'tool/result' && ev.detail) {
          const d = ev.detail.slice(0, 500)
          segments.push({ kind: 'tool:' + ev.name, text: d, ts: ev.ts })
        }
      }

      // 粗粒度 BM25 风格评分：查询词在本段命中次数（加权），并考虑短段更相关
      const qTokens = query
        .split(/[\s,，。；;：:、/]+/)
        .filter((w) => w.trim().length >= 2)
        .map((w) => w.toLowerCase())
      const scored: { seg: (typeof segments)[number]; score: number }[] = segments.map((seg) => {
        const lower = seg.text.toLowerCase()
        let score = 0
        for (const qt of qTokens) {
          let i = -1
          while ((i = lower.indexOf(qt, i + 1)) !== -1) score += 1
        }
        // 长度适中加分（过短信息少，过长稀释）
        if (score > 0) score += Math.max(0, 1 - Math.abs(200 - seg.text.length) / 500)
        return { seg, score }
      })
      const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)

      if (top.length === 0) {
        return {
          ok: true,
          hits: 0,
          results: [],
          note: '未找到与查询相关的内容。',
        }
      }
      return {
        ok: true,
        hits: top.length,
        results: top.map((r, i) => ({
          i: i + 1,
          kind: r.seg.kind,
          score: Number(r.score.toFixed(2)),
          ts: r.seg.ts,
          excerpt: r.seg.text.slice(0, 800),
        })),
      }
    },
  })

  // ---- compact 工具族（session 自带的上下文压缩能力，职责各自独立，不做多阶段黑盒） ----
  ctx.tools.register({
    name: 'context_compact_tutorial',
    description:
      '[session·压缩] 返回上下文压缩指南：压缩目标、该保留/该丢弃、摘要结构。压缩前请先读它，明确如何做。',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      ok: true,
      kind: 'tutorial',
      guide: [
        '【压缩目标】把会话中此前的必要上下文浓缩为一段结构化摘要，作为新前缀，之后不再重复发送旧历史。',
        '【推荐流程】先 context_compact_status 看占用是否超预算 → context_compact_brief 看最近在干嘛 → 必要时 context_compact_get_history 按关键词核对细节 → 最后 context_compact_submit 提交。不满意可反复摸底再压。',
        '【摘要 Prompt】请逐项覆盖：',
        '  1. 当前位置/进度：你正在做什么任务、进行到哪一阶段、最近几轮聚焦的话题。',
        '  2. 关键决策：已作出的决定与理由。',
        '  3. 约束与偏好：用户明确的要求/偏好/限制、环境相关的关键事实。',
        '  4. 未完成事项：还有哪些待办/下一步要做什么。',
        '  5. 工具与依赖状态：当前用了哪些工具、有哪些进行中的子任务(subagent/后台任务)。',
        '【可丢弃】已解决的调试细节、重复的试错过程、对话中的寒暄与噪音。',
        '【格式】用紧凑的分节文字（不要过长，保持可读），让未来能凭借该摘要直接接续工作。',
      ].join('\n'),
    }),
  })

  ctx.tools.register({
    name: 'context_compact_status',
    description:
      '[session·压缩] 查询当前上下文占用：直接读压缩点之前最近一次 LLM 调用的 inputTokens（真正的上下文大小），不累加、不估算。对照预算(CTX_BUDGET 默认 100 万)判断是否需要压缩。注意：本系统不自动压缩，只有显式 context_compact_submit 才写入压缩点。',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const sessionId = currentSessionId()
      if (!sessionId) throw new Error('no active session')
      const events = await loadSessionEvents(ctx, sessionId)
      const usage = lastUsageBeforeCompact(events)
      const tokens = usage.inputTokens
      const budget = Number(process.env.CTX_BUDGET ?? 1000000)
      const compacted = events.filter(
        (e) => e.type === 'tool/call' && (e.name === 'context_compact_submit' || e.name === 'session_compact'),
      )
      return {
        ok: true,
        sessionId,
        events: events.length,
        usage,
        budget,
        overBudget: tokens > budget,
        compactedAlready: compacted.length > 0,
        note:
          !usage.found
            ? '当前会话暂无 LLM 调用 usage 数据。'
            : tokens > budget
              ? `最近一次输入上下文 ${tokens} token > 预算 ${budget}，已超界，建议按需压缩。`
              : `最近一次输入上下文 ${tokens} / ${budget} token，${budget - tokens} 余量，${tokens / budget > 0.8 ? '接近上限，可考虑尽早压缩' : '暂不紧迫'}`,
      }
    },
  })

  ctx.tools.register({
    name: 'context_compact_brief',
    description:
      '[session·压缩] 生成当前会话的摸底简报：事件构成统计 + 最近几轮用户/AI 要点。压缩前自查自己在干什么用。',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const sessionId = currentSessionId()
      if (!sessionId) throw new Error('no active session')
      const { brief, stats } = buildBrief(await loadSessionEvents(ctx, sessionId))
      return { ok: true, sessionId, events: stats, brief }
    },
  })

  ctx.tools.register({
    name: 'context_compact_get_history',
    description:
      '[session·压缩] 按关键词检索本会话（或指定会话）的历史片段。压缩前核对关键细节用；可按不同关键词反复调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '要检索的信息/关键词' },
        limit: { type: 'number', description: '最多返回几条（默认 5，最大 10）' },
        sessionId: { type: 'string', description: '（可选）要检索的会话 id，缺省为当前会话' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const sid = String(args.sessionId ?? '') || currentSessionId()
      if (!sid) throw new Error('no active session')
      const query = String(args.query ?? '')
      const limit = Math.min(10, Math.max(1, Number(args.limit ?? 5) || 5))
      const hits = retrieveHistory(await loadSessionEvents(ctx, sid), query, limit)
      if (hits.length === 0) {
        return { ok: true, hits: 0, sessionId: sid, results: [], note: '未找到与查询相关的内容。' }
      }
      return {
        ok: true,
        hits: hits.length,
        sessionId: sid,
        results: hits.map((s) => ({ kind: s.kind, ts: s.ts, excerpt: s.text.slice(0, 800) })),
      }
    },
  })

  ctx.tools.register({
    name: 'context_compact_submit',
    description:
      '[session·压缩] 提交压缩摘要。本次工具调用即作为压缩点：deriveMessages 会识别该调用、从 text 参数续读，此前的详细历史不再重复发送。传 text 即可提交。',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '压缩摘要：浓缩必要上下文的结构化文本，作为新前缀。含位置/进度、关键决策、约束偏好、未完成事项。',
        },
      },
      required: ['text'],
    },
    execute: async (args) => {
      const sessionId = currentSessionId()
      if (!sessionId) throw new Error('no active session')
      const text = String(args.text ?? '').trim()
      if (!text) throw new Error('context_compact_submit 需要 text 参数（压缩摘要内容）')
      return {
        ok: true,
        sessionId,
        note: `已提交压缩点（前缀约 ${estimateTokens(text)} token）。推荐先用 context_compact_get_history 复核摘要准确性、按需再压。`,
      }
    },
  })
}

/* ---- compact 辅助函数 ---- */

async function loadSessionEvents(ctx: Context, sessionId: string): Promise<SessionEvent[]> {
  const record = await ctx.sessions.get(sessionId)
  return record?.events ?? []
}

/**
 * 读出"压缩点之前最近一次 LLM 调用"的真实上下文占用：
 * 找最近一次压缩工具调用(tool/call context_compact_submit|session_compact)之后的最后一条带 usage 的 assistant/message，
 * 直接取其 inputTokens（inputTokens 即当时发送给模型的整个上下文大小，无需累加/估算）。
 */
export function lastUsageBeforeCompact(events: SessionEvent[]): {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  found: boolean
} {
  let last: (typeof events)[number]['usage'] & { totalTokens?: number } | undefined
  for (const ev of events) {
    if (ev.type === 'tool/call' && (ev.name === 'context_compact_submit' || ev.name === 'session_compact')) {
      // 遇到压缩点，重置为"压缩点之后"的视野，只读压缩后最近一次调用
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

/** 抽出可检索的文本段（user/assistant 消息与 tool/result 概要）。 */
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

/** BM25 风格检索：按关键词返回最相关的历史片段。 */
export function retrieveHistory(events: SessionEvent[], query: string, limit: number): { kind: string; text: string; ts?: number }[] {
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

const BRIEF_TAIL = 6

/** 生成摸底简报：事件构成统计 + 最近几轮 user/assistant 要点。 */
export function buildBrief(events: SessionEvent[]): { brief: string; stats: Record<string, number> } {
  const stats: Record<string, number> = {}
  const tail: string[] = []
  for (const ev of events) {
    stats[ev.type] = (stats[ev.type] ?? 0) + 1
  }
  for (const ev of events) {
    if (tail.length >= BRIEF_TAIL) break
    if (ev.type === 'user/message' || ev.type === 'assistant/message') {
      const line = ev.text.trim()
      if (line) tail.unshift(`- [${ev.type === 'user/message' ? 'user' : 'assistant'}] ${line.slice(0, 160)}`)
    }
  }
  const brief = [
    `【事件构成】${Object.entries(stats)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ')}`,
    tail.length ? `【最近要点】\n${tail.join('\n')}` : '【最近要点】无可见文本',
  ].join('\n')
  return { brief, stats }
}
