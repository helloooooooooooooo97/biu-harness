import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { LlmConfig } from './llm.ts'
import type { AgentTurn, ClaimedInput } from './agent-loop.ts'
import type { MessageSender } from '../core/session-types.ts'

export type { AgentTurn, LlmConfig }

export interface AgentSendOptions {
  extraTools?: string[]
  /** false：入队后立即返回，不阻塞等回合结束（Live 派工后可再 progress）。默认 true。 */
  wait?: boolean
  /** 消息来源：Live 派工时传入 { type: 'session', sessionId } */
  sender?: MessageSender
}

export interface AgentHandle {
  sessionId: string
  send(text: string, opts?: AgentSendOptions): Promise<AgentTurn>
  inject(text: string, opts?: AgentSendOptions): void
  cancel(): void
  dispose(): void
}

export type InboxRow = {
  id: string
  kind: 'wake' | 'inject'
  text: string
}

interface LiveAgent {
  handle: AgentHandle
  inbox: ClaimedInput[]
  running?: Promise<void>
  abort: AbortController
}

let inboxSeq = 0
function nextInboxId() {
  inboxSeq += 1
  return `inq-${Date.now().toString(36)}-${inboxSeq}`
}

export class AgentsService extends Service {
  private lives = new Map<string, LiveAgent>()
  private llm: LlmConfig = { provider: 'deepseek', apiKey: '', model: 'deepseek-chat' }

  constructor(ctx: Context) {
    super(ctx, 'agents')
  }

  configure(llm: LlmConfig) {
    this.llm = llm
  }

  /** Live progress：该 session 的 agent 是否正在跑回合。 */
  isBusy(sessionId: string) {
    return Boolean(this.lives.get(sessionId)?.running)
  }

  inboxPending(sessionId: string) {
    return this.lives.get(sessionId)?.inbox.length ?? 0
  }

  /** 当前尚未 claim 的排队消息（wake / inject）。 */
  listInbox(sessionId: string): InboxRow[] {
    const live = this.lives.get(sessionId)
    if (!live) return []
    return live.inbox.map((item) => ({
      id: item.id ?? nextInboxId(),
      kind: item.kind,
      text: item.text,
    }))
  }

  private emitInbox(sessionId: string) {
    this.ctx.emit('agent/inbox', { sessionId, inbox: this.listInbox(sessionId) })
  }

  async create(sessionId?: string): Promise<AgentHandle> {
    const id = sessionId ?? (await this.ctx.sessions.create()).id
    if (!(await this.ctx.sessions.get(id))) await this.ctx.sessions.create(id)
    const existing = this.lives.get(id)
    if (existing) return existing.handle

    const live: LiveAgent = {
      inbox: [],
      abort: new AbortController(),
      handle: {} as AgentHandle,
    }

    const kick = async (): Promise<AgentTurn> => {
      let last: AgentTurn = { text: '', steps: [] }
      while (true) {
        const claimed = claim(live.inbox)
        this.emitInbox(id)
        if (!claimed) break
        last = await this.ctx.agentLoop.create(this.llm, id, live.abort.signal).run(claimed)
      }
      return last
    }

    const handle: AgentHandle = {
      sessionId: id,
      send: async (text: string, opts?: AgentSendOptions) => {
        const trimmed = text.trim()
        if (!trimmed) return { text: '请先输入内容。', steps: [] }
        const extraTools = sanitizeExtraTools(opts?.extraTools)
        const wait = opts?.wait !== false
        const entry = {
          text: trimmed,
          id: nextInboxId(),
          ...(extraTools.length ? { extraTools } : {}),
          ...(opts?.sender ? { sender: opts.sender } : {}),
        }

        // Cursor 同款：忙碌且已有 wake 排队时，再发送 → inject（并入该 wake 的下一回合）
        if (live.running && live.inbox.some((item) => item.kind === 'wake')) {
          live.inbox.push({ kind: 'inject', ...entry })
          this.emitInbox(id)
          return { text: '', steps: [] }
        }

        live.inbox.push({ kind: 'wake', ...entry })
        this.emitInbox(id)

        if (live.running) {
          if (!wait) return { text: '', steps: [] }
          await live.running
        }
        live.abort = new AbortController()
        let result: AgentTurn = { text: '', steps: [] }
        const running = kick().then((turn) => {
          result = turn
        })
        live.running = running
        this.ctx.emit('agent/status', { sessionId: id, status: 'running', step: 0 })
        if (!wait) {
          void running.finally(() => {
            if (live.running === running) live.running = undefined
          })
          return { text: '', steps: [] }
        }
        try {
          await running
          return result
        } finally {
          if (live.running === running) live.running = undefined
        }
      },
      inject: (text: string, opts?: AgentSendOptions) => {
        const trimmed = text.trim()
        if (!trimmed) return
        const extraTools = sanitizeExtraTools(opts?.extraTools)
        live.inbox.push({
          kind: 'inject',
          text: trimmed,
          id: nextInboxId(),
          ...(extraTools.length ? { extraTools } : {}),
          ...(opts?.sender ? { sender: opts.sender } : {}),
        })
        this.emitInbox(id)
      },
      cancel: () => live.abort.abort(),
      dispose: () => {
        live.abort.abort()
        this.lives.delete(id)
        this.ctx.emit('agent/inbox', { sessionId: id, inbox: [] })
      },
    }
    live.handle = handle
    this.lives.set(id, live)
    return handle
  }

  get(sessionId: string) {
    return this.lives.get(sessionId)?.handle
  }

  /** 兼容旧入口：把最后一条用户消息送进 session。 */
  async prompt(history: Array<{ role: string; content: string }>, llm: LlmConfig): Promise<AgentTurn> {
    this.configure(llm)
    const last = history.filter((item) => item.role === 'user').at(-1)?.content?.trim() ?? ''
    const agent = await this.create()
    return agent.send(last)
  }
}

function sanitizeExtraTools(names: string[] | undefined): string[] {
  if (!Array.isArray(names) || !names.length) return []
  return [...new Set(names.map((name) => String(name).trim()).filter(Boolean))]
}

function claim(inbox: ClaimedInput[]): ClaimedInput[] | undefined {
  const wakeAt = inbox.findIndex((item) => item.kind === 'wake')
  if (wakeAt < 0) return undefined
  const all = inbox.splice(0)
  const taken = all[wakeAt]!
  const injects = all.filter((item, index) => item.kind === 'inject' && index !== wakeAt)
  inbox.push(...all.filter((item, index) => index !== wakeAt && item.kind !== 'inject'))
  return [...injects, taken]
}

export const name = 'agents'
export const inject = ['agentLoop', 'sessions']

export function apply(ctx: Context) {
  new AgentsService(ctx)
}
