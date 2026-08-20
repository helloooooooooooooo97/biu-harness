import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { LlmConfig } from './llm.ts'
import type { AgentTurn, ClaimedInput } from './agent-loop.ts'

export type { AgentTurn, LlmConfig }

export interface AgentHandle {
  sessionId: string
  send(text: string): Promise<AgentTurn>
  inject(text: string): void
  cancel(): void
  dispose(): void
}

interface LiveAgent {
  handle: AgentHandle
  inbox: ClaimedInput[]
  running?: Promise<void>
  abort: AbortController
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

  async create(sessionId?: string): Promise<AgentHandle> {
    const session = sessionId ? await this.ctx.sessions.get(sessionId) : undefined
    const id = session?.id ?? (await this.ctx.sessions.create()).id
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
        if (!claimed) break
        last = await this.ctx.agentLoop.create(this.llm, id, live.abort.signal).run(claimed)
      }
      return last
    }

    const handle: AgentHandle = {
      sessionId: id,
      send: async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return { text: '请先输入内容。', steps: [] }
        if (!this.llm.apiKey) {
          await this.ctx.sessions.append(id, { type: 'turn/start', turn: 0 })
          await this.ctx.sessions.append(id, { type: 'user/message', text: trimmed, kind: 'wake' })
          const echo = `未配置 API Key，本地回声：${trimmed}`
          await this.ctx.sessions.append(id, { type: 'assistant/message', text: echo })
          await this.ctx.sessions.append(id, { type: 'turn/end', turn: 0, reason: 'echo' })
          return { text: echo, steps: [] }
        }
        live.inbox.push({ kind: 'wake', text: trimmed })
        if (live.running) await live.running
        let result: AgentTurn = { text: '', steps: [] }
        live.abort = new AbortController()
        live.running = kick().then((turn) => {
          result = turn
        })
        try {
          await live.running
          return result
        } finally {
          live.running = undefined
        }
      },
      inject: (text: string) => {
        const trimmed = text.trim()
        if (trimmed) live.inbox.push({ kind: 'inject', text: trimmed })
      },
      cancel: () => live.abort.abort(),
      dispose: () => {
        live.abort.abort()
        this.lives.delete(id)
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
