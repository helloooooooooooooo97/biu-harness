import type { CollectionSpec, DbRecord } from '@biu/type-file-system'
import type { SessionConfig, SessionSummary } from '@biu/type-session'

type SessionsLike = {
  listSummaries: () => Promise<SessionSummary[]>
  rename: (id: string, title: string) => Promise<unknown>
  patchConfig: (id: string, patch: SessionConfig) => Promise<unknown>
}

function asRecord(row: SessionSummary): DbRecord {
  return {
    id: row.id,
    title: row.title,
    type: row.type ?? 'chat',
    pinned: Boolean(row.config?.pinned),
    tags: Array.isArray(row.config?.tags) ? row.config.tags.map(String) : [],
    eventCount: row.eventCount,
    project: row.project?.name ?? '',
    updatedAt: row.updatedAt,
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
      blurb: '已有聊天 Session 的只读登记；改标题/置顶/标签会写回会话配置，不替代侧栏聊天。',
      order: 18,
      icon: 'chat-bubble',
    },
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
      },
    },
    list,
    get: async (id) => (await list()).find((row) => row.id === id) ?? null,
    write: async (id, patch) => {
      if (typeof patch.title === 'string') await sessions.rename(id, patch.title)
      const config: SessionConfig = {}
      if (typeof patch.pinned === 'boolean') config.pinned = patch.pinned
      if (Array.isArray(patch.tags)) config.tags = patch.tags.map((item) => String(item))
      if (Object.keys(config).length) await sessions.patchConfig(id, config)
      const next = (await list()).find((row) => row.id === id)
      if (!next) throw new Error(`unknown session: ${id}`)
      return next
    },
  }
}
