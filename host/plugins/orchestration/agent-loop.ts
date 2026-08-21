import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { AssistantReply, ChatOptions, LlmClient, LlmConfig, LlmMessage } from './llm.ts'
import type { InboxKind } from '../core/session-types.ts'
import { runWithSession } from '../core/session-scope.ts'
import { runWithExtraTools } from '../registry/tools.ts'

export interface AgentTurn {
  text: string
  steps: Array<{ name: string; ok: boolean; detail: string }>
}

export interface ClaimedInput {
  kind: InboxKind
  text: string
  /** slash 为本回合临时放开的额外工具（极简模式） */
  extraTools?: string[]
}

export interface PreStepReq {
  sessionId: string
  messages: ClaimedInput[]
  reject?: string
}

/** 可替换的 turn 驱动；agents 只依赖此薄接口。 */
export interface AgentRunner {
  run(claimed: ClaimedInput[]): Promise<AgentTurn>
}

export type AgentLoopFactory = (config: LlmConfig, sessionId: string, signal: AbortSignal) => AgentRunner

export class AgentLoop implements AgentRunner {
  constructor(
    private ctx: Context,
    private llm: LlmClient,
    private sessionId: string,
    private signal: AbortSignal,
  ) {}

  async run(claimed: ClaimedInput[]): Promise<AgentTurn> {
    const extras = [
      ...new Set(claimed.flatMap((item) => item.extraTools ?? []).map((name) => name.trim()).filter(Boolean)),
    ]
    return runWithSession(this.sessionId, () => runWithExtraTools(extras, () => this.runInSession(claimed)))
  }

  private async runInSession(claimed: ClaimedInput[]): Promise<AgentTurn> {
    const session = this.ctx.sessions
    const turn = session.deriveMessages(this.sessionId).filter((item) => item.role === 'user').length + 1
    await session.append(this.sessionId, { type: 'turn/start', turn })

    let req: PreStepReq = { sessionId: this.sessionId, messages: claimed }
    req = this.ctx.waterfall('agent/pre-step', req, () => req)
    if (req.reject) {
      await session.append(this.sessionId, { type: 'turn/end', turn, reason: req.reject })
      this.ctx.emit('agent/status', { status: 'idle' })
      return { text: req.reject, steps: [] }
    }
    if (!req.messages.length) {
      await session.append(this.sessionId, { type: 'turn/end', turn, reason: 'empty' })
      return { text: '（空回合）', steps: [] }
    }

    for (const item of req.messages) {
      await session.append(this.sessionId, { type: 'user/message', text: item.text, kind: item.kind })
    }

    // 分段 prompt 只在 turn 开头写入一次，避免每 step 污染权威日志；derive 取最后一条 system/prompt。
    await session.append(this.sessionId, { type: 'system/prompt', text: this.ctx.systemPrompt.assemble() })

    const steps: AgentTurn['steps'] = []
    let final = '（空回复）'
    let chunkBuf = ''
    let chunkFlush: Promise<void> = Promise.resolve()
    let chunkTimer: ReturnType<typeof setTimeout> | null = null

    const flushChunks = () => {
      if (chunkTimer != null) {
        clearTimeout(chunkTimer)
        chunkTimer = null
      }
      if (!chunkBuf) return chunkFlush
      const text = chunkBuf
      chunkBuf = ''
      chunkFlush = chunkFlush.then(async () => {
        await session.append(this.sessionId, { type: 'assistant/chunk', text })
      })
      return chunkFlush
    }

    const queueChunk = (text: string) => {
      if (!text) return
      chunkBuf += text
      if (chunkTimer != null) return
      chunkTimer = setTimeout(() => {
        chunkTimer = null
        void flushChunks()
      }, 48)
    }

    for (let step = 0; ; step++) {
      if (this.signal.aborted) {
        await flushChunks()
        await session.append(this.sessionId, { type: 'turn/end', turn, reason: 'cancelled' })
        throw new Error('cancelled')
      }
      this.ctx.emit('agent/status', { status: 'running', step })
      await session.append(this.sessionId, { type: 'step/start', turn, step })

      const messages = session.deriveMessages(this.sessionId)
      let reply: AssistantReply
      try {
        reply = await this.llm.chat(messages, this.ctx.tools.schemas(), this.signal, {
          onDelta: async (text) => {
            queueChunk(text)
          },
        })
        await flushChunks()
      } catch (error) {
        await flushChunks()
        if (this.signal.aborted) {
          await session.append(this.sessionId, { type: 'turn/end', turn, reason: 'cancelled' })
          this.ctx.emit('agent/status', { status: 'idle' })
          throw new Error('cancelled')
        }
        const detail = String(error)
        const text = `模型调用失败：${detail}`
        await session.append(this.sessionId, { type: 'assistant/message', text })
        await session.append(this.sessionId, { type: 'step/end', turn, step })
        await session.append(this.sessionId, { type: 'turn/end', turn, reason: 'llm-error' })
        this.ctx.emit('agent/status', { status: 'idle' })
        return { text, steps }
      }

      if (!reply.toolCalls.length) {
        final = reply.content?.trim() || '（空回复）'
        await session.append(this.sessionId, {
          type: 'assistant/message',
          text: final,
          ...(reply.usage ? { usage: reply.usage } : {}),
        })
        await session.append(this.sessionId, { type: 'step/end', turn, step })
        await session.append(this.sessionId, { type: 'turn/end', turn, reason: 'complete' })
        this.ctx.emit('agent/status', { status: 'idle', step })
        return { text: final, steps }
      }

      await session.append(this.sessionId, {
        type: 'assistant/message',
        text: reply.content ?? '',
        tool_calls: reply.toolCalls,
        ...(reply.usage ? { usage: reply.usage } : {}),
      })

      for (const call of reply.toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
        } catch {
          args = {}
        }
        await session.append(this.sessionId, { type: 'tool/call', id: call.id, name: call.name, arguments: call.arguments })
        let detail = ''
        let ok = true
        try {
          detail = stringify(await this.ctx.tools.invoke(call.name, args, this.signal))
        } catch (error) {
          ok = false
          detail = String(error)
        }
        steps.push({ name: call.name, ok, detail })
        await session.append(this.sessionId, { type: 'tool/result', id: call.id, name: call.name, ok, detail })
      }
      await session.append(this.sessionId, { type: 'step/end', turn, step })
      final = steps.at(-1)?.detail ?? final
    }
  }
}

export class AgentLoopService extends Service {
  private factory: AgentLoopFactory

  constructor(ctx: Context) {
    super(ctx, 'agentLoop')
    this.factory = (config, sessionId, signal) => this.defaultCreate(config, sessionId, signal)
  }

  /** 换策略（回声 / 真模型 / 评测）而不改 agents 句柄与 inbox。 */
  setFactory(factory: AgentLoopFactory) {
    this.factory = factory
  }

  create(config: LlmConfig, sessionId: string, signal: AbortSignal): AgentRunner {
    return this.factory(config, sessionId, signal)
  }

  private defaultCreate(config: LlmConfig, sessionId: string, signal: AbortSignal): AgentRunner {
    const llm = config.apiKey
      ? this.ctx.llm.forConfig(config)
      : {
          chat: async (messages: LlmMessage[], _tools?: unknown[], _signal?: AbortSignal, options?: ChatOptions) => {
            const last = [...messages].reverse().find((item) => item.role === 'user')?.content
            const text = `未配置 API Key，本地回声：${last ?? ''}`
            await options?.onDelta?.(text)
            return { content: text, toolCalls: [] }
          },
        }
    return new AgentLoop(this.ctx, llm, sessionId, signal)
  }
}

function stringify(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const name = 'agent-loop'
export const inject = ['llm', 'tools', 'sessions', 'systemPrompt']

export function apply(ctx: Context) {
  new AgentLoopService(ctx)
}
