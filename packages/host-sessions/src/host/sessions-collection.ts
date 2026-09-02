import type { CollectionSpec, DbRecord } from '@biu/type-file-system'
import {
  nameFromSessionMascot,
  normalizeSessionType,
  type SessionConfig,
  type SessionEvent,
  type SessionSummary,
} from '@biu/type-session'
import { GROK_COLORS, GROK_SHAPES, ensureSessionMascot, isSessionMascot, mascotFromSessionId } from './session-mascot.ts'

type SessionRecordLike = {
  id: string
  type?: string
  events: SessionEvent[]
  config?: SessionConfig | null
  project?: { path?: string; name?: string } | null
}

type SessionsLike = {
  listSummaries: () => Promise<SessionSummary[]>
  rename: (id: string, title: string) => Promise<unknown>
  patchConfig: (id: string, patch: SessionConfig) => Promise<unknown>
  delete: (id: string) => Promise<boolean>
  create?: (opts?: { type?: string; title?: string; config?: SessionConfig }) => Promise<{ id: string }>
  require?: (id: string) => Promise<SessionRecordLike>
  setProject?: (id: string, project: { path: string } | null) => Promise<unknown>
  isBusy?: (id: string) => boolean
  inboxPending?: (id: string) => number
}

function asRecord(row: SessionSummary): DbRecord {
  const mascot =
    row.mascot && isSessionMascot(row.mascot) ? ensureSessionMascot(row.id, row.mascot) : mascotFromSessionId(row.id)
  return {
    id: row.id,
    title: row.title,
    type: row.type ?? 'chat',
    pinned: Boolean(row.config?.pinned),
    tags: Array.isArray(row.config?.tags) ? row.config.tags.map(String) : [],
    eventCount: row.eventCount,
    project: row.project?.name ?? '',
    updatedAt: row.updatedAt,
    mascot,
    mascotName: nameFromSessionMascot(mascot),
    mascotShape: mascot.shape,
    mascotColor: mascot.color,
    mascotEye: mascot.eye,
  }
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

function sessionProgress(record: SessionRecordLike, opts: { afterSeq?: number; textLimit?: number; busy?: boolean; inboxPending?: number }) {
  const textLimit = Math.min(2000, Math.max(80, opts.textLimit ?? 600))
  const afterSeq = opts.afterSeq == null || !Number.isFinite(opts.afterSeq) ? undefined : opts.afterSeq
  let turn: number | null = null
  let step: number | null = null
  let reason: string | undefined
  let openTurn = false
  let lastTool: { name: string; ok?: boolean } | null = null
  let assistantText = ''
  for (const event of record.events) {
    const inDelta = afterSeq == null || event.seq > afterSeq
    if (event.type === 'turn/start') {
      turn = event.turn
      step = null
      reason = undefined
      openTurn = true
      assistantText = ''
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
    } else if (event.type === 'tool/call' && inDelta) lastTool = { name: event.name }
    else if (event.type === 'tool/result' && inDelta) lastTool = { name: event.name, ok: event.ok }
    else if (event.type === 'assistant/message' && event.text.trim() && inDelta) assistantText = event.text
  }
  if (assistantText.length > textLimit) assistantText = `${assistantText.slice(0, textLimit)}…`
  const newest = record.events.at(-1)
  const busy = Boolean(opts.busy) || openTurn
  return {
    status: busy ? 'running' : 'idle',
    turn,
    step,
    ...(reason ? { reason } : {}),
    lastTool,
    assistantText,
    eventCount: record.events.length,
    newestSeq: newest?.seq ?? -1,
    updatedAt: newest?.ts ?? 0,
    inboxPending: opts.inboxPending ?? 0,
  }
}

export function sessionsCollection(sessions: SessionsLike): CollectionSpec {
  const list = async () => (await sessions.listSummaries()).map(asRecord)
  return {
    id: 'sessions',
    path: '/sessions',
    label: '会话',
    view: {
      moduleId: 'sessions-db',
      route: '/db-sessions',
      title: '会话',
      inspector: true,
      blurb: '会话元数据可改、可删；聊天记录本身不能从这张表改。进度/检查走 db_action。',
      order: 18,
      icon: 'chat-bubble',
    },
    records: { update: true, create: Boolean(sessions.create), delete: true },
    schema: {
      labelField: 'title',
      columns: ['title', 'type', 'pinned', 'tags', 'eventCount', 'project', 'updatedAt'],
      fields: {
        title: { type: 'string', label: '标题', writable: true },
        type: { type: 'select', label: '类型', enum: ['chat', 'live'] },
        pinned: { type: 'boolean', label: '置顶', writable: true },
        tags: { type: 'multi-select', label: '标签', writable: true },
        eventCount: { type: 'number', label: '事件数', computed: true, sortable: true },
        project: { type: 'string', label: '项目' },
        updatedAt: { type: 'datetime', label: '更新时间', sortable: true },
        mascotName: { type: 'string', label: '形象', computed: true },
        mascotShape: { type: 'select', label: '外形', enum: [...GROK_SHAPES], computed: true },
        mascotColor: { type: 'select', label: '颜色', enum: [...GROK_COLORS], computed: true },
        mascotEye: { type: 'number', label: '眼睛', computed: true },
      },
    },
    list,
    get: async (id) => (await list()).find((row) => row.id === id) ?? null,
    update: async (id, patch) => {
      if (typeof patch.title === 'string') await sessions.rename(id, patch.title)
      const config: SessionConfig = {}
      if (typeof patch.pinned === 'boolean') config.pinned = patch.pinned
      if (Array.isArray(patch.tags)) config.tags = patch.tags.map((item) => String(item))
      if (Object.keys(config).length) await sessions.patchConfig(id, config)
      const next = (await list()).find((row) => row.id === id)
      if (!next) throw new Error(`unknown session: ${id}`)
      return next
    },
    create: sessions.create
      ? async (fields = {}) => {
          const rec = await sessions.create!({
            ...(typeof fields.title === 'string' ? { title: fields.title } : {}),
            ...(fields.type === 'live' || fields.type === 'chat' ? { type: String(fields.type) } : {}),
          })
          const next = (await list()).find((row) => row.id === rec.id)
          if (!next) throw new Error(`unknown session: ${rec.id}`)
          return next
        }
      : undefined,
    remove: async (id) => {
      if (!(await sessions.delete(id))) throw new Error(`unknown session: ${id}`)
    },
    actions: [
      {
        id: 'inspect',
        label: '检查',
        placement: ['detail'],
        parameters: {
          type: 'object',
          properties: { limit: { type: 'number' } },
        },
        run: async (id, _record, args) => {
          if (!sessions.require) throw new Error('session inspect unavailable')
          const record = await sessions.require(id)
          const limit = Math.min(40, Math.max(1, Number(args?.limit) || 12))
          return {
            id: record.id,
            type: normalizeSessionType(record.type),
            status: sessions.isBusy?.(id) ? 'running' : 'idle',
            title: record.config?.title,
            config: record.config ?? null,
            project: record.project ?? null,
            tags: record.config?.tags ?? [],
            pinned: Boolean(record.config?.pinned),
            eventCount: record.events.length,
            recent: recentMessages(record.events, limit),
          }
        },
      },
      {
        id: 'progress',
        label: '进度',
        placement: ['row', 'detail'],
        parameters: {
          type: 'object',
          properties: {
            afterSeq: { type: 'number' },
            textLimit: { type: 'number' },
          },
        },
        run: async (id, _record, args) => {
          if (!sessions.require) throw new Error('session progress unavailable')
          const record = await sessions.require(id)
          return {
            sessionId: record.id,
            type: normalizeSessionType(record.type),
            ...sessionProgress(record, {
              afterSeq: args?.afterSeq == null ? undefined : Number(args.afterSeq),
              textLimit: args?.textLimit == null ? undefined : Number(args.textLimit),
              busy: sessions.isBusy?.(id),
              inboxPending: sessions.inboxPending?.(id),
            }),
          }
        },
      },
      {
        id: 'star',
        label: '收藏',
        placement: ['row', 'detail'],
        parameters: {
          type: 'object',
          properties: { pinned: { type: 'boolean' } },
        },
        run: async (id, record, args) => {
          const current = Boolean(record.pinned)
          const next = typeof args?.pinned === 'boolean' ? args.pinned : !current
          await sessions.patchConfig(id, { pinned: next })
          return { id, pinned: next }
        },
      },
      {
        id: 'tag',
        label: '标签',
        placement: ['detail'],
        parameters: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            op: { type: 'string', enum: ['add', 'set', 'remove', 'clear'] },
          },
        },
        run: async (id, record, args) => {
          const op = args?.op === 'set' || args?.op === 'remove' || args?.op === 'clear' ? args.op : 'add'
          const incoming = Array.isArray(args?.tags)
            ? args.tags.map((item) => String(item).trim()).filter(Boolean)
            : typeof args?.tag === 'string' && args.tag.trim()
              ? [args.tag.trim()]
              : []
          if (op !== 'clear' && incoming.length === 0) throw new Error('tag or tags required')
          const current = [...new Set((Array.isArray(record.tags) ? record.tags : []).map((item) => String(item)))]
          let next: string[]
          if (op === 'clear') next = []
          else if (op === 'set') next = [...new Set(incoming)]
          else if (op === 'remove') next = current.filter((item) => !incoming.includes(item))
          else next = [...new Set([...current, ...incoming])]
          next = next.slice(0, 24)
          await sessions.patchConfig(id, { tags: next })
          return { id, op, tags: next }
        },
      },
      {
        id: 'configure',
        label: '配置',
        placement: ['detail'],
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            project: { type: 'string' },
            model: { type: 'string' },
            provider: { type: 'string', enum: ['deepseek', 'openai'] },
            systemPrompt: { type: 'string' },
            agentMode: { type: 'string', enum: ['standard', 'minimal', 'create'] },
            extraTools: { type: 'array', items: { type: 'string' } },
            pinned: { type: 'boolean' },
          },
        },
        run: async (id, _record, args = {}) => {
          const config: SessionConfig = {}
          if (typeof args.title === 'string') config.title = args.title
          if (typeof args.model === 'string') config.model = args.model
          if (args.provider === 'deepseek' || args.provider === 'openai') config.provider = args.provider
          if (typeof args.systemPrompt === 'string') config.systemPrompt = args.systemPrompt
          if (args.agentMode === 'standard' || args.agentMode === 'minimal' || args.agentMode === 'create') {
            config.agentMode = args.agentMode
          }
          if (Array.isArray(args.extraTools)) config.extraTools = args.extraTools.map((item) => String(item))
          if (typeof args.pinned === 'boolean') config.pinned = args.pinned
          if (Object.keys(config).length) await sessions.patchConfig(id, config)
          if (typeof args.project === 'string' && sessions.setProject) {
            const path = args.project.trim()
            await sessions.setProject(id, path ? { path } : null)
          }
          return (await list()).find((row) => row.id === id)
        },
      },
    ],
  }
}
