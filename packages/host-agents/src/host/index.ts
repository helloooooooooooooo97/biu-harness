import { Service, type Context } from 'cordis'
import type { LlmConfig } from '@biu/host-llm'
import type { AgentTurn, ClaimedInput } from '@biu/type-agent-loop'
import type { MessageSender } from '@biu/type-session'

export type { AgentTurn, LlmConfig }

export interface AgentSendOptions {
  extraTools?: string[]
  /** false：入队后立即返回，不阻塞等回合结束（Live 派工后可再 progress）。默认 true。 */
  wait?: boolean
  /** 消息来源：Live 派工时传入 { type: 'session', sessionId } */
  sender?: MessageSender
  images?: Array<{ name: string; mime: string; url: string }>
}

export interface AgentHandle {
  sessionId: string
  send(text: string, opts?: AgentSendOptions): Promise<AgentTurn>
  inject(text: string, opts?: AgentSendOptions): void
  /** 空回车：abort 当前回合，立刻 kick/claim 队列（需至少一条 wake） */
  flush(opts?: { wait?: boolean }): Promise<{ flushed: boolean }>
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

  private resolveLlm(sessionId: string): LlmConfig {
    const chat = this.ctx.get('chat') as { resolveLlm?: (id?: string | null) => LlmConfig } | undefined
    return chat?.resolveLlm?.(sessionId) ?? this.llm
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
        last = await this.ctx.agentLoop.create(this.resolveLlm(id), id, live.abort.signal).run(claimed)
      }
      return last
    }

    const startKick = (wait: boolean): Promise<AgentTurn> => {
      live.abort = new AbortController()
      let result: AgentTurn = { text: '', steps: [] }
      const running = kick()
        .then((turn) => {
          result = turn
        })
        .finally(() => {
          if (live.running === running) live.running = undefined
        })
      live.running = running
      this.ctx.emit('agent/status', { sessionId: id, status: 'running', step: 0 })
      if (!wait) {
        void running.catch(() => undefined)
        return Promise.resolve({ text: '', steps: [] })
      }
      return running.then(() => result).catch((error) => {
        if (/cancelled|AbortError|aborted/i.test(String(error))) {
          return { text: '', steps: [] }
        }
        throw error
      })
    }

    const handle: AgentHandle = {
      sessionId: id,
      send: async (text: string, opts?: AgentSendOptions) => {
        const trimmed = text.trim()
        const images = sanitizeImages(opts?.images)
        if (!trimmed && !images?.length) return { text: '请先输入内容。', steps: [] }
        const extraTools = sanitizeExtraTools(opts?.extraTools)
        const wait = opts?.wait !== false
        const entry = {
          text: trimmed || '（图片）',
          id: nextInboxId(),
          ...(extraTools.length ? { extraTools } : {}),
          ...(opts?.sender ? { sender: opts.sender } : {}),
          ...(images ? { images } : {}),
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
          await live.running.catch(() => undefined)
        }
        return startKick(wait)
      },
      inject: (text: string, opts?: AgentSendOptions) => {
        const trimmed = text.trim()
        const images = sanitizeImages(opts?.images)
        if (!trimmed && !images?.length) return
        const extraTools = sanitizeExtraTools(opts?.extraTools)
        live.inbox.push({
          kind: 'inject',
          text: trimmed || '（图片）',
          id: nextInboxId(),
          ...(extraTools.length ? { extraTools } : {}),
          ...(opts?.sender ? { sender: opts.sender } : {}),
          ...(images ? { images } : {}),
        })
        this.emitInbox(id)
      },
      flush: async (opts?: { wait?: boolean }) => {
        const wait = opts?.wait !== false
        // claim 需要 wake；队列里没有 wake 时空回车无意义
        if (!live.inbox.some((item) => item.kind === 'wake')) {
          return { flushed: false }
        }
        live.abort.abort()
        if (live.running) {
          await live.running.catch(() => undefined)
        }
        await startKick(wait)
        return { flushed: true }
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

function sanitizeImages(raw: AgentSendOptions['images']): ClaimedInput['images'] {
  if (!Array.isArray(raw) || !raw.length) return undefined
  const out: NonNullable<ClaimedInput['images']> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const mime = String(item.mime ?? '')
    const url = String(item.url ?? '')
    const name = String(item.name ?? 'image.png').slice(0, 80)
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(mime)) continue
    if (!url.startsWith('data:image/') || url.length > 8 * 1024 * 1024) continue
    out.push({ name: name || 'image.png', mime, url })
    if (out.length >= 6) break
  }
  return out.length ? out : undefined
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
  const agents = new AgentsService(ctx)
  // 无循环依赖地把"按 session 取 AgentHandle"的能力装进 SessionsService：
  // agents 依赖 sessions（单向）；反向派工能力通过 sessions.installAgentFactory 回调注入。
  ctx.sessions.installAgentFactory((id) => agents.create(id))
}
