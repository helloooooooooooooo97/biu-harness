import type { Context } from 'cordis'
import { currentSessionId } from '@biu/host-sessions/scope'
import { normalizeSessionType, type SessionEvent, type SessionType } from '@biu/type-session'

export const LIVE_TOOL_NAMES = [
  'db_list',
  'db_read',
  'db_update',
  'db_create',
  'db_delete',
  'db_stat',
  'db_action',
  'db_content',
] as const

const LIVE_PROMPT = `你是 Live 指挥席（文字版）：调度其他 chat session，而不是亲自改代码或跑长任务。
工作流：用 db_list /sessions 和 db_action action=inspect / progress 了解现场；新建用 db_create /sessions，改元数据用 db_update 或 db_action configure/tag/star。上下文压缩用 db_action action=compact / clear / retrieve / status。派工必须走任务体系：db_create /tasks、db_update 指派 assigneeSessionId、db_action action=deliver 派发、action=report 上报；不要直接 dispatch。废弃会话用 db_delete /sessions/<id>。
异步派工后不要等待对方完成：完成态在目标 session 自己的 turn 里，需要时再 inspect / progress。
向用户汇报要克制：只在关键节点、明显卡住、或用户追问时说明，不要刷屏。
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

export const name = 'live-sessions'
export const inject = ['tools', 'sessions', 'agents', 'systemPrompt']

export function apply(ctx: Context) {
  ctx.systemPrompt.register('live.persona', () => {
    const sessionId = currentSessionId()
    if (!sessionId) return ''
    const type = normalizeSessionType(ctx.sessions.peek(sessionId)?.type)
    return type === 'live' ? LIVE_PROMPT : ''
  })

}
