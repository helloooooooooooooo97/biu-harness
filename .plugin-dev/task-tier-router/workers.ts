/**
 * 分层 worker 池：为每个层级槽位准备一个专属 session，并让它跑指定模型。
 *
 * 关键点：模型切换不改核心逻辑，而是写 session.config.{provider,model}。
 * cap-chat 的 resolveLlm(sessionId) 会用会话覆盖盖掉全局默认，
 * host-agents 每回合都调它，所以同一进程里不同 session 可以并行跑不同模型。
 */

import { sessionTitle, type TierDef } from './tiers.ts'

export interface SessionRecordLike {
  id: string
  config?: { title?: string; model?: string; provider?: string; systemPrompt?: string }
}

export interface HostLike {
  sessions: {
    create(id?: string, opts?: Record<string, unknown>): Promise<SessionRecordLike>
    get(id: string): Promise<SessionRecordLike | undefined>
    peek(id: string): SessionRecordLike | undefined
    patchConfig(id: string, patch: Record<string, unknown>): Promise<SessionRecordLike>
    setProject(id: string, project: { path: string } | null): Promise<unknown>
  }
  agents: {
    create(sessionId?: string): Promise<{
      sessionId: string
      send(text: string, opts?: Record<string, unknown>): Promise<{ text: string; steps?: unknown[] }>
    }>
  }
  logger(tag: string): { info(msg: string): void; error(msg: unknown): void }
}

export interface WorkerHandle {
  def: TierDef
  sessionId: string
  /** 跑一轮对话，返回文本 */
  ask(prompt: string): Promise<string>
}

/**
 * 建（或复用）某槽位的 session。
 * 一次 run 内 slot → sessionId 缓存在 pool 里，避免同层重复建会话。
 */
export async function ensureWorker(
  host: HostLike,
  def: TierDef,
  runLabel: string,
  opts: { project?: string; pool: Map<string, string> },
): Promise<WorkerHandle> {
  const cached = opts.pool.get(def.slot)
  if (cached) {
    const alive = host.sessions.peek(cached) ?? (await host.sessions.get(cached))
    if (alive) return makeHandle(host, def, cached)
  }

  const record = await host.sessions.create(undefined, {
    type: 'chat',
    title: sessionTitle(def, runLabel),
    config: {
      provider: def.provider,
      model: def.model,
      systemPrompt: def.persona,
      // 执行层需要动手的能力，统一给 standard；规划/统筹只出文本也用 standard，
      // 保持一致以免 minimal 模式下工具缺失导致行为不一致。
      agentMode: 'standard',
      tags: ['tier-router', def.tier],
    },
  })

  // create 时的 config 已带 provider/model，这里再 patch 一次做兜底：
  // normalizeSessionConfig 对未知字段会静默丢弃，patch 后回读校验更稳。
  await host.sessions.patchConfig(record.id, {
    provider: def.provider,
    model: def.model,
    systemPrompt: def.persona,
  })

  if (opts.project) {
    try {
      await host.sessions.setProject(record.id, { path: opts.project })
    } catch (error) {
      host.logger('tier-router').error(`bind project failed slot=${def.slot}: ${String(error)}`)
    }
  }

  opts.pool.set(def.slot, record.id)
  return makeHandle(host, def, record.id)
}

function makeHandle(host: HostLike, def: TierDef, sessionId: string): WorkerHandle {
  return {
    def,
    sessionId,
    ask: async (prompt: string) => {
      const agent = await host.agents.create(sessionId)
      const turn = await agent.send(prompt, { wait: true })
      return String(turn.text ?? '').trim()
    },
  }
}

/** 回读 session 实际生效的模型，用于报告里证明「这一层真的走了那个模型」。 */
export function effectiveModel(host: HostLike, sessionId: string): string {
  const peek = host.sessions.peek(sessionId)
  return peek?.config?.model ?? '(unknown)'
}
