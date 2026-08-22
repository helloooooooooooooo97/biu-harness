import type { Context } from 'cordis'
import '../../types.ts'
import { currentSessionId } from '../core/session-scope.ts'
import { normalizeSessionType, type SessionEvent, type SessionType } from '../core/session-types.ts'

export const LIVE_TOOL_NAMES = [
  'session_list',
  'session_inspect',
  'session_progress',
  'session_wake',
  'session_inject',
] as const

const LIVE_PROMPT = `你是 Live 指挥席（文字版）：调度其他 chat session，而不是亲自改代码或跑长任务。
工作流：session_list / session_inspect 了解现场 → session_wake（wait=false 可先派工）或 session_inject → session_progress 抽查进度。
异步派工（wait=false / inject）后，worker turn/end 会旁白回本会话。
向用户汇报要克制：只在关键节点、明显卡住、或用户追问时旁白，不要刷屏。
回答简洁：说明调度了谁、当前状态、下一步。`

export interface SessionProgressSnapshot {
  sessionId: string
  type: SessionType
  status: 'idle' | 'running'
  turn: number | null
  step: number | null
  reason?: string
  lastTool?: { name: string; ok?: boolean } | null
  assistantText: string
  eventCount: number
  newestSeq: number
  updatedAt: number
  inboxPending: number
}

/** 测试可见：当前未撤销的 live→worker 监听。 */


/** 从事件日志推导 worker 进度快照（供 Live 抽查）。 */
export function buildSessionProgress(
  events: SessionEvent[],
  opts: { afterSeq?: number; textLimit?: number; busy?: boolean; inboxPending?: number } = {},
): Omit<SessionProgressSnapshot, 'sessionId' | 'type'> {
  const textLimit = Math.min(2000, Math.max(80, opts.textLimit ?? 600))
  const afterSeq =
    opts.afterSeq == null || !Number.isFinite(opts.afterSeq) ? undefined : opts.afterSeq

  let turn: number | null = null
  let step: number | null = null
  let reason: string | undefined
  let openTurn = false
  let lastTool: { name: string; ok?: boolean } | null = null
  let assistantText = ''
  const chunkParts: string[] = []
  let deltaTool: { name: string; ok?: boolean } | null = null
  let deltaAssistant = ''
  const deltaChunks: string[] = []

  for (const event of events) {
    const inDelta = afterSeq == null || event.seq > afterSeq
    if (event.type === 'turn/start') {
      turn = event.turn
      step = null
      reason = undefined
      openTurn = true
      chunkParts.length = 0
      assistantText = ''
      if (inDelta) {
        deltaChunks.length = 0
        deltaAssistant = ''
      }
    } else if (event.type === 'turn/end') {
      turn = event.turn
      reason = event.reason
      openTurn = false
      step = null
    } else if (event.type === 'step/start') {
      turn = event.turn
      step = event.step
      openTurn = true
    } else if (event.type === 'step/end') {
      turn = event.turn
      step = event.step
    } else if (event.type === 'tool/call') {
      lastTool = { name: event.name }
      if (inDelta) deltaTool = { name: event.name }
    } else if (event.type === 'tool/result') {
      lastTool = { name: event.name, ok: event.ok }
      if (inDelta) deltaTool = { name: event.name, ok: event.ok }
    } else if (event.type === 'assistant/message') {
      if (event.text.trim()) {
        assistantText = event.text
        chunkParts.length = 0
        if (inDelta) {
          deltaAssistant = event.text
          deltaChunks.length = 0
        }
      }
    } else if (event.type === 'assistant/chunk') {
      chunkParts.push(event.text)
      if (inDelta) deltaChunks.push(event.text)
    }
  }

  if (!assistantText.trim() && chunkParts.length) assistantText = chunkParts.join('')
  let reportText = afterSeq == null ? assistantText : deltaAssistant
  if (!reportText.trim() && afterSeq != null && deltaChunks.length) reportText = deltaChunks.join('')
  if (!reportText.trim()) reportText = assistantText
  if (reportText.length > textLimit) reportText = `${reportText.slice(0, textLimit)}…`

  const newest = events.at(-1)
  const busy = Boolean(opts.busy) || openTurn
  return {
    status: busy ? 'running' : 'idle',
    turn,
    step,
    ...(reason ? { reason } : {}),
    lastTool: afterSeq == null ? lastTool : deltaTool ?? lastTool,
    assistantText: reportText,
    eventCount: events.length,
    newestSeq: newest?.seq ?? -1,
    updatedAt: newest?.ts ?? 0,
    inboxPending: opts.inboxPending ?? 0,
  }
}

async function requireLiveCaller(ctx: Context) {
  const sessionId = currentSessionId()
  if (!sessionId) throw new Error('live tools require an active session')
  const record = await ctx.sessions.require(sessionId)
  if (normalizeSessionType(record.type) !== 'live') {
    throw new Error('live tools are only available in live sessions')
  }
  return sessionId
}

function recentMessages(events: SessionEvent[], limit = 12) {
  const out: Array<{ role: string; text: string; kind?: string }> = []
  for (let i = events.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const event = events[i]!
    if (event.type === 'user/message') {
      out.push({ role: 'user', text: event.text, kind: event.kind })
    } else if (event.type === 'assistant/message' && event.text.trim()) {
      out.push({ role: 'assistant', text: event.text.slice(0, 800) })
    }
  }
  return out.reverse()
}


export const name = 'live-sessions'
export const inject = ['tools', 'sessions', 'agents', 'systemPrompt']

export function apply(ctx: Context) {
  /** wait=false / inject：听目标 session 的 turn/end，旁白后停掉 */
  const watchTurnEnd = (liveId: string, workerId: string) => {
    if (!liveId || !workerId || liveId === workerId) return
    const stop = ctx.on('session/event', ({ sessionId, event }) => {
      if (sessionId !== workerId || event.type !== 'turn/end') return
      stop()
      void (async () => {
        const worker = await ctx.sessions.get(workerId)
        if (!worker) return
        const last = [...worker.events].reverse().find((e) => e.type === 'assistant/message' && e.text.trim())
        const summary = (last && 'text' in last ? String(last.text) : '').trim().replace(/\s+/g, ' ').slice(0, 280)
        const done = event.reason === 'complete' || event.reason === 'completed'
        const status = done ? '已完成' : `结束（${event.reason}）`
        const label = workerId.slice(0, 8)
        const note = summary
          ? `[指挥席] ${label} ${status} · turn ${event.turn}\n${summary}`
          : `[指挥席] ${label} ${status} · turn ${event.turn}`
        try {
          await ctx.sessions.append(liveId, { type: 'assistant/message', text: note })
        } catch (error) {
          console.warn('[live-sessions] turn/end note failed', error)
        }
      })()
    })
  }

  ctx.systemPrompt.register('live.persona', () => {
    const sessionId = currentSessionId()
    if (!sessionId) return ''
    const type = normalizeSessionType(ctx.sessions.peek(sessionId)?.type)
    return type === 'live' ? LIVE_PROMPT : ''
  })

  ctx.tools.register({
    name: 'session_list',
    description: '列出其他 session（含 type 与 busy 状态）。Live 指挥席专用。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: "可选过滤：'chat' | 'live'" },
        limit: { type: 'number', description: '最多返回条数，默认 30' },
      },
    },
    execute: async (args) => {
      const selfId = await requireLiveCaller(ctx)
      const filter =
        args.type === 'live' || args.type === 'chat' ? (args.type as SessionType) : undefined
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 30))
      const items = await ctx.sessions.listSummaries()
      const sessions = items
        .filter((item) => item.id !== selfId)
        .filter((item) => (filter ? normalizeSessionType(item.type) === filter : true))
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          title: item.title,
          type: normalizeSessionType(item.type),
          status: ctx.agents.isBusy(item.id) ? ('running' as const) : ('idle' as const),
          eventCount: item.eventCount,
          updatedAt: item.updatedAt,
          project: item.project?.name,
        }))
      return { count: sessions.length, sessions }
    },
  })

  ctx.tools.register({
    name: 'session_inspect',
    description: '查看某个 session 的元信息与最近消息，便于决定如何派工。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        limit: { type: 'number', description: '最近消息条数，默认 12' },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      const record = await ctx.sessions.require(targetId)
      const limit = Math.min(40, Math.max(1, Number(args.limit) || 12))
      return {
        id: record.id,
        type: normalizeSessionType(record.type),
        status: ctx.agents.isBusy(targetId) ? 'running' : 'idle',
        project: record.project,
        eventCount: record.events.length,
        recent: recentMessages(record.events, limit),
      }
    },
  })

  ctx.tools.register({
    name: 'session_progress',
    description:
      '抽查目标 session 的运行进度（turn/step/status/最近 assistant 摘要）。派工后用于旁白，勿高频刷屏。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        afterSeq: { type: 'number', description: '只看该 seq 之后的事件（增量抽查）' },
        textLimit: { type: 'number', description: 'assistant 摘要最大字符，默认 600' },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      const record = await ctx.sessions.require(targetId)
      const afterSeq =
        args.afterSeq == null || args.afterSeq === '' ? undefined : Number(args.afterSeq)
      const textLimit = args.textLimit == null ? undefined : Number(args.textLimit)
      const progress = buildSessionProgress(record.events, {
        afterSeq: Number.isFinite(afterSeq) ? afterSeq : undefined,
        textLimit: Number.isFinite(textLimit) ? textLimit : undefined,
        busy: ctx.agents.isBusy(targetId),
        inboxPending: ctx.agents.inboxPending(targetId),
      })
      return {
        sessionId: record.id,
        type: normalizeSessionType(record.type),
        ...progress,
      } satisfies SessionProgressSnapshot
    },
  })

  ctx.tools.register({
    name: 'session_wake',
    description:
      '向目标 chat session 发送 wake 并启动 agent。wait=false 时立即返回，完成时自动旁白回 Live。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        text: { type: 'string' },
        wait: {
          type: 'boolean',
          description: '默认 true 等回合结束；false 则入队后立即返回 queued',
        },
      },
      required: ['sessionId', 'text'],
    },
    execute: async (args) => {
      const selfId = await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      const text = String(args.text || '').trim()
      const wait = args.wait !== false && args.wait !== 'false'
      if (!targetId) throw new Error('sessionId required')
      if (!text) throw new Error('text required')
      if (targetId === selfId) throw new Error('cannot wake the current live session')
      const target = await ctx.sessions.require(targetId)
      if (normalizeSessionType(target.type) === 'live') {
        throw new Error('cannot wake another live session; target a chat session')
      }
      const agent = await ctx.agents.create(targetId)
      if (!wait) {
        // 先订阅再派工，避免极快完成时丢掉 turn/end；结束后自动 dispose
        watchTurnEnd(selfId, targetId)
        void agent.send(text, { wait: false })
        return { sessionId: targetId, queued: true, wait: false }
      }
      const turn = await agent.send(text, { wait: true })
      return {
        sessionId: targetId,
        queued: false,
        wait: true,
        text: turn.text.slice(0, 1200),
        steps: turn.steps.length,
      }
    },
  })

  ctx.tools.register({
    name: 'session_inject',
    description: '向目标 session 注入补充指示（inject）；若对方正在跑会进入 inbox。完成后旁白回 Live。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['sessionId', 'text'],
    },
    execute: async (args) => {
      const selfId = await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      const text = String(args.text || '').trim()
      if (!targetId) throw new Error('sessionId required')
      if (!text) throw new Error('text required')
      if (targetId === selfId) throw new Error('cannot inject into the current live session')
      const target = await ctx.sessions.require(targetId)
      watchTurnEnd(selfId, targetId)
      const agent = await ctx.agents.create(targetId)
      agent.inject(text)
      return { sessionId: targetId, queued: true }
    },
  })
}
