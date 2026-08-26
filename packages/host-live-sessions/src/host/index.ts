import type { Context } from 'cordis'
import { currentSessionId } from '@biu/host-sessions/scope'
import { normalizeSessionType, type SessionEvent, type SessionType } from '@biu/type-session'

export const LIVE_TOOL_NAMES = [
  'session_list',
  'session_inspect',
  'session_progress',
  'session_create',
  'session_rename',
  'session_configure',
  'session_delete',
  'session_tag',
  'session_star',
] as const

const LIVE_PROMPT = `你是 Live 指挥席（文字版）：调度其他 chat session，而不是亲自改代码或跑长任务。
工作流：session_list / session_inspect（含 tags / pinned）了解现场 → 需要时可 session_create（可带 project 绑定文件夹）新建、session_rename / session_configure（可改 project）调整目标，用 session_tag 打标签、session_star 收藏。派工必须走任务体系：用 tasks_create 建任务、tasks_update 指派 assigneeSessionId、task_deliver 派发给目标 session，进度用 task_report 上报/回传；不要直接用 dispatch 绕过任务系统。用 session_progress 抽查进度。废弃的 session 可 session_delete 清理。
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
    description: '列出 session（含自己，self=true；含 type 与 busy 状态）。Live 指挥席专用。',
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
        .filter((item) => (filter ? normalizeSessionType(item.type) === filter : true))
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          title: item.title,
          type: normalizeSessionType(item.type),
          self: item.id === selfId,
          status: ctx.agents.isBusy(item.id) ? ('running' as const) : ('idle' as const),
          eventCount: item.eventCount,
          updatedAt: item.updatedAt,
          project: item.project?.name,
          tags: item.config?.tags ?? [],
          pinned: Boolean(item.config?.pinned),
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
        title: record.config?.title,
        config: record.config ?? null,
        project: record.project,
        tags: record.config?.tags ?? [],
        pinned: Boolean(record.config?.pinned),
        eventCount: record.events.length,
        recent: recentMessages(record.events, limit),
      }
    },
  })

  ctx.tools.register({
    name: 'session_progress',
    description:
      '抽查目标 session 的运行进度（turn/step/status/最近 assistant 摘要）。派工后按需查看，勿高频刷屏。',
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
    name: 'session_create',
    description:
      '创建新的 chat session（可带标题、初始配置、绑定工作区文件夹）。Live 指挥席专用。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '会话显示名' },
        type: { type: 'string', description: "默认 'chat'；一般不要创建 live" },
        project: {
          type: 'string',
          description: '绑定的主机绝对路径文件夹；创建后也可再改',
        },
        model: { type: 'string' },
        provider: { type: 'string', enum: ['deepseek', 'openai'] },
        systemPrompt: { type: 'string' },
        agentMode: { type: 'string', enum: ['standard', 'minimal'] },
        extraTools: { type: 'array', items: { type: 'string' } },
      },
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const type = args.type === 'live' ? 'live' : 'chat'
      let record = await ctx.sessions.create(undefined, {
        type,
        ...(typeof args.title === 'string' ? { title: args.title } : {}),
        config: {
          ...(typeof args.model === 'string' ? { model: args.model } : {}),
          ...(args.provider === 'deepseek' || args.provider === 'openai' ? { provider: args.provider } : {}),
          ...(typeof args.systemPrompt === 'string' ? { systemPrompt: args.systemPrompt } : {}),
          ...(args.agentMode === 'standard' || args.agentMode === 'minimal'
            ? { agentMode: args.agentMode }
            : {}),
          ...(Array.isArray(args.extraTools)
            ? { extraTools: args.extraTools.map((name) => String(name)) }
            : {}),
        },
      })
      if (typeof args.project === 'string' && args.project.trim()) {
        await ctx.sessions.setProject(record.id, { path: args.project.trim() })
        record = await ctx.sessions.require(record.id)
      }
      return {
        id: record.id,
        type: normalizeSessionType(record.type),
        title: record.config?.title ?? record.id.slice(0, 8),
        config: record.config ?? null,
        project: record.project ?? null,
      }
    },
  })

  ctx.tools.register({
    name: 'session_rename',
    description: '重命名目标 session 的显示标题。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['sessionId', 'title'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      const title = String(args.title || '').trim()
      if (!targetId) throw new Error('sessionId required')
      if (!title) throw new Error('title required')
      const record = await ctx.sessions.rename(targetId, title)
      return { id: record.id, title: record.config?.title ?? title }
    },
  })

  ctx.tools.register({
    name: 'session_configure',
    description:
      '修改目标 session 的配置（title/model/provider/systemPrompt/agentMode/extraTools/project/pinned）。未传字段保持不变；systemPrompt 传空串可清回默认；project 传空串可解绑文件夹。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        title: { type: 'string' },
        project: {
          type: 'string',
          description: '绑定文件夹的绝对路径；传空串解绑；可重复修改',
        },
        model: { type: 'string' },
        provider: { type: 'string', enum: ['deepseek', 'openai'] },
        systemPrompt: { type: 'string' },
        agentMode: { type: 'string', enum: ['standard', 'minimal'] },
        extraTools: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean', description: 'true=收藏（即侧栏置顶 pinned）；false=取消收藏' },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      let record = await ctx.sessions.patchConfig(targetId, {
        ...(typeof args.title === 'string' ? { title: args.title } : {}),
        ...(typeof args.model === 'string' ? { model: args.model } : {}),
        ...(args.provider === 'deepseek' || args.provider === 'openai' ? { provider: args.provider } : {}),
        ...(typeof args.systemPrompt === 'string' ? { systemPrompt: args.systemPrompt } : {}),
        ...(args.agentMode === 'standard' || args.agentMode === 'minimal'
          ? { agentMode: args.agentMode }
          : {}),
        ...(Array.isArray(args.extraTools)
          ? { extraTools: args.extraTools.map((name) => String(name)) }
          : {}),
        ...(typeof args.pinned === 'boolean' ? { pinned: args.pinned } : {}),
      })
      if (typeof args.project === 'string') {
        const path = args.project.trim()
        await ctx.sessions.setProject(targetId, path ? { path } : null)
        record = await ctx.sessions.require(targetId)
      }
      return {
        id: record.id,
        config: record.config ?? null,
        project: record.project ?? null,
      }
    },
  })

  ctx.tools.register({
    name: 'session_tag',
    description:
      '给目标 session 打/移除标签（侧栏标签组）。可用 op 选 add/set/remove/clear，默认 add。可一次传单个 tag 字符串或 tags 数组。返回更新后的 tags 列表。可结合 session_list（含 tags 字段）筛选调度。Live 指挥席专用。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '目标 session id' },
        tag: { type: 'string', description: '单个标签名（与 tags 二选一）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签名数组（与 tag 二选一；append 合并去重）' },
        op: {
          type: 'string',
          enum: ['add', 'set', 'remove', 'clear'],
          description: 'add=追加（默认，去重）；set=整体替换；remove=移除指定；clear=清空全部',
        },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      const record = await ctx.sessions.require(targetId)

      const op = args.op === 'set' || args.op === 'remove' || args.op === 'clear' ? args.op : 'add'
      const incoming = Array.isArray(args.tags)
        ? args.tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof args.tag === 'string' && args.tag.trim()
          ? [args.tag.trim()]
          : []
      if (op !== 'clear' && incoming.length === 0) throw new Error('tag or tags required (except for clear)')

      const current = [...new Set((record.config?.tags ?? []).map((t) => String(t).trim()).filter(Boolean))]
      let next: string[]
      if (op === 'clear') next = []
      else if (op === 'set') next = [...new Set(incoming)]
      else if (op === 'remove') next = current.filter((t) => !incoming.includes(t))
      else next = [...new Set([...current, ...incoming])]
      next = next.slice(0, 24)

      const patched = await ctx.sessions.patchConfig(targetId, { tags: next })
      return { id: targetId, op, tags: patched.config?.tags ?? [] }
    },
  })

  ctx.tools.register({
    name: 'session_star',
    description:
      '收藏/取消收藏目标 session（即侧栏置顶 pinned）。传 pinned=true 收藏；pinned=false 取消收藏；不传时切换。返回更新后的 pinned 状态。Live 指挥席专用。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '目标 session id' },
        pinned: { type: 'boolean', description: 'true=收藏（黄色星星）；false=取消收藏；不传则切换' },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      const record = await ctx.sessions.require(targetId)
      const current = Boolean(record.config?.pinned)
      const next = typeof args.pinned === 'boolean' ? args.pinned : !current
      const patched = await ctx.sessions.patchConfig(targetId, { pinned: next })
      return { id: targetId, pinned: Boolean(patched.config?.pinned) }
    },
  })

  ctx.tools.register({
    name: 'session_delete',
    description: '删除目标 chat session 及其全部历史（缓存+存储）。若要删除的 session 正在运行会先中止。不能删除当前 live session 自身。Live 指挥席专用。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '要删除的 session id' },
      },
      required: ['sessionId'],
    },
    execute: async (args) => {
      const selfId = await requireLiveCaller(ctx)
      const targetId = String(args.sessionId || '').trim()
      if (!targetId) throw new Error('sessionId required')
      if (targetId === selfId) throw new Error('cannot delete the current live session')
      const record = await ctx.sessions.require(targetId)
      // 中止并释放该 session 的 agent（若在跑）
      const agent = ctx.agents.get(targetId)
      if (agent) agent.dispose()
      await ctx.sessions.delete(targetId)
      return {
        id: targetId,
        deleted: true,
        title: record.config?.title ?? null,
      }
    },
  })
}
