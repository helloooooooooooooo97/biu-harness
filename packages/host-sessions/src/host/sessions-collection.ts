import type { CollectionSpec, DbRecord } from '@biu/type-file-system'
import { nameFromSessionMascot, type SessionConfig, type SessionSummary } from '@biu/type-session'
import { GROK_COLORS, GROK_SHAPES, ensureSessionMascot, isSessionMascot, mascotFromSessionId } from './session-mascot.ts'

type SessionsLike = {
  listSummaries: () => Promise<SessionSummary[]>
  rename: (id: string, title: string) => Promise<unknown>
  patchConfig: (id: string, patch: SessionConfig) => Promise<unknown>
  delete: (id: string) => Promise<boolean>
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
      blurb: '会话元数据可改、可删；聊天记录本身不能从这张表改。',
      order: 18,
      icon: 'chat-bubble',
    },
    records: { update: true, create: false, delete: true },
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
    remove: async (id) => {
      if (!(await sessions.delete(id))) throw new Error(`unknown session: ${id}`)
    },
  }
}
