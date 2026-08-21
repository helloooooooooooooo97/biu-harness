import type { Context } from 'cordis'
import '../../types.ts'
import { currentSessionId } from '../core/session-scope.ts'
import { normalizeSessionType, type SessionEvent, type SessionType } from '../core/session-types.ts'

export const LIVE_TOOL_NAMES = [
  'session_list',
  'session_inspect',
  'session_wake',
  'session_inject',
] as const

const LIVE_PROMPT = `你是 Live 指挥席（文字版）：调度其他 chat session，而不是亲自改代码或跑长任务。
优先用 session_list / session_inspect 了解现场，再用 session_wake（新任务）或 session_inject（补充指示）派工。
回答简洁：说明你调度了谁、做了什么、结果如何。`

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
  ctx.systemPrompt.register('live.persona', () => {
    const sessionId = currentSessionId()
    if (!sessionId) return ''
    const type = normalizeSessionType(ctx.sessions.peek(sessionId)?.type)
    return type === 'live' ? LIVE_PROMPT : ''
  })

  ctx.tools.register({
    name: 'session_list',
    description: '列出其他 session（含 type/status 摘要）。Live 指挥席专用。',
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
        project: record.project,
        eventCount: record.events.length,
        recent: recentMessages(record.events, limit),
      }
    },
  })

  ctx.tools.register({
    name: 'session_wake',
    description: '向目标 chat session 发送一条 wake 用户消息并启动其 agent 回合。',
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
      if (targetId === selfId) throw new Error('cannot wake the current live session')
      const target = await ctx.sessions.require(targetId)
      if (normalizeSessionType(target.type) === 'live') {
        throw new Error('cannot wake another live session; target a chat session')
      }
      const agent = await ctx.agents.create(targetId)
      const turn = await agent.send(text)
      return {
        sessionId: targetId,
        queued: false,
        text: turn.text.slice(0, 1200),
        steps: turn.steps.length,
      }
    },
  })

  ctx.tools.register({
    name: 'session_inject',
    description: '向目标 session 注入补充指示（inject）；若对方正在跑会进入 inbox。',
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
      await ctx.sessions.require(targetId)
      const agent = await ctx.agents.create(targetId)
      agent.inject(text)
      return { sessionId: targetId, queued: true }
    },
  })
}
