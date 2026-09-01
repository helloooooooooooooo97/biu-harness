import type { CollectionSpec, DbRecord } from '@biu/type-file-system'

type Actor = {
  name?: string
  sessionId?: string
  kind?: string
  mascot?: { shape: string; color: string; eye?: number }
}

type Usage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

type TaskReport = {
  sessionId?: string
  turn?: number | null
  usage?: Usage
}

type TaskRow = DbRecord & {
  title?: string
  creator?: Actor | null
  assignee?: Actor | null
  parentId?: string | null
  dependsOn?: string[]
  blocked?: boolean
  reports?: TaskReport[]
  usage?: Usage
  trigger?: unknown
  nextTriggerAt?: number | null
}

export type TasksLike = {
  list: () => TaskRow[]
  get: (id: string) => TaskRow | undefined
  update: (id: string, patch: Record<string, unknown>) => DbRecord
  create: (input: Record<string, unknown> & { title: string; creator: Actor }) => TaskRow
  delete: (id: string) => boolean
}

const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, totalTokens: 0 }

function asUsage(value: unknown): Usage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rec = value as Record<string, unknown>
  const totalTokens = Number(rec.totalTokens)
  const inputTokens = Number(rec.inputTokens)
  const outputTokens = Number(rec.outputTokens)
  const cacheReadTokens = Number(rec.cacheReadTokens)
  if (![totalTokens, inputTokens, outputTokens, cacheReadTokens].some((n) => Number.isFinite(n) && n > 0)) return null
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    cacheReadTokens: Number.isFinite(cacheReadTokens) ? cacheReadTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  }
}

function addUsage(...usages: Usage[]): Usage {
  const next = { ...ZERO_USAGE }
  for (const usage of usages) {
    next.inputTokens += usage.inputTokens
    next.outputTokens += usage.outputTokens
    next.cacheReadTokens += usage.cacheReadTokens
    next.totalTokens += usage.totalTokens
  }
  return next
}

function ownUsage(row: TaskRow): Usage {
  const stored = asUsage(row.usage)
  if (stored) return stored
  const byKey = new Map<string, Usage>()
  for (const report of row.reports ?? []) {
    const usage = asUsage(report.usage)
    if (!usage) continue
    byKey.set(`${report.sessionId ?? ''}:${report.turn ?? ''}`, usage)
  }
  return byKey.size ? addUsage(...byKey.values()) : ZERO_USAGE
}

function parentChain(row: TaskRow, lookup: (id: string) => TaskRow | undefined) {
  const parts: string[] = []
  let cur: TaskRow | undefined = row
  for (let guard = 0; guard < 16 && cur?.parentId; guard++) {
    const parent = lookup(cur.parentId)
    if (!parent) break
    parts.unshift(String(parent.title ?? ''))
    cur = parent
  }
  return parts.filter(Boolean).join(' / ')
}

function taskRecord(row: TaskRow, lookup: (id: string) => TaskRow | undefined, usage: Usage, aggregate: boolean): DbRecord {
  return {
    id: row.id,
    title: row.title ?? '',
    status: row.status ?? 'todo',
    priority: row.priority ?? 'med',
    difficulty: row.difficulty ?? 'med',
    project: row.project ?? '',
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    dueAt: row.dueAt ?? null,
    description: row.description ?? '',
    notes: row.notes ?? '',
    creator: row.creator?.name ?? '用户',
    creatorSessionId: row.creator?.sessionId ?? '',
    creatorActor: row.creator ?? { kind: 'user', name: '用户' },
    assignee: row.assignee?.name ?? '',
    assigneeSessionId: row.assignee?.sessionId ?? '',
    assigneeActor: row.assignee ?? null,
    parentId: row.parentId ?? null,
    dependsOn: Array.isArray(row.dependsOn) ? row.dependsOn.map(String).filter(Boolean) : [],
    blocked: Boolean(row.blocked),
    parentChain: parentChain(row, lookup),
    usage: usage.totalTokens,
    usageParts: { ...usage, aggregate },
    reports: row.reports ?? [],
    trigger: row.trigger ?? null,
    nextTriggerAt: row.nextTriggerAt ?? null,
    createdAt: row.createdAt ?? 0,
    updatedAt: row.updatedAt ?? 0,
  }
}

function recordsWithUsage(rows: TaskRow[]): DbRecord[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const kids = new Map<string, string[]>()
  for (const row of rows) {
    const parent = String(row.parentId ?? '')
    if (!parent) continue
    const list = kids.get(parent) ?? []
    list.push(row.id)
    kids.set(parent, list)
  }
  const own = new Map(rows.map((row) => [row.id, ownUsage(row)]))
  const memo = new Map<string, Usage>()
  const roll = (id: string): Usage => {
    const hit = memo.get(id)
    if (hit) return hit
    const next = addUsage(own.get(id) ?? ZERO_USAGE, ...(kids.get(id) ?? []).map(roll))
    memo.set(id, next)
    return next
  }
  return rows.map((row) =>
    taskRecord(row, (id) => byId.get(id), roll(row.id), Boolean(kids.get(row.id)?.length)),
  )
}

export function tasksCollection(tasks: TasksLike): CollectionSpec {
  return {
    id: 'tasks',
    path: '/tasks',
    label: '任务',
    view: {
      moduleId: 'tasks',
      route: '/tasks',
      title: '任务',
      inspector: true,
      blurb: 'Task table in File System; detail panes host scripts and progress reports.',
      order: 21,
      icon: 'clipboard-document-list',
    },
    schema: {
      labelField: 'title',
      contentField: 'description',
      parentField: 'parentId',
      columns: ['title', 'status', 'priority', 'difficulty', 'usage', 'creator', 'assignee', 'project', 'tags', 'dueAt'],
      fields: {
        title: { type: 'string', label: '标题', writable: true },
        status: { type: 'select', label: '状态', writable: true, enum: ['todo', 'doing', 'done'] },
        priority: { type: 'select', label: '优先级', writable: true, enum: ['low', 'med', 'high'] },
        difficulty: { type: 'select', label: '难度', writable: true, enum: ['low', 'med', 'high'] },
        usage: { type: 'number', label: '消耗', computed: true, sortable: true },
        project: { type: 'string', label: '项目', writable: true },
        tags: { type: 'multi-select', label: '标签', writable: true },
        dueAt: { type: 'datetime', label: '截止', writable: true },
        description: { type: 'string', label: '描述', writable: true },
        notes: { type: 'string', label: '备忘', writable: true },
        creator: { type: 'string', label: '创建人' },
        assignee: { type: 'string', label: '承担者' },
        parentId: { type: 'string', label: '父任务', writable: true },
        dependsOn: { type: 'multi-select', label: '依赖' },
      },
    },
    records: { update: true, create: true, delete: true },
    list: () => recordsWithUsage(tasks.list()),
    get: (id) => recordsWithUsage(tasks.list()).find((row) => row.id === id) ?? null,
    update: (id, patch) => {
      const next = tasks.update(id, patch) as TaskRow
      const rows = tasks.list().map((row) => (row.id === id ? { ...row, ...next, id } : row))
      return recordsWithUsage(rows).find((row) => row.id === id) ?? taskRecord(next, (pid) => tasks.get(pid), ZERO_USAGE, false)
    },
    create: (fields = {}) => {
      const title = typeof fields.title === 'string' && fields.title.trim() ? fields.title.trim() : '未命名任务'
      const row = tasks.create({ ...fields, title, creator: { kind: 'user', name: '用户' } })
      return recordsWithUsage(tasks.list()).find((item) => item.id === row.id) ?? taskRecord(row, (pid) => tasks.get(pid), ZERO_USAGE, false)
    },
    remove: (id) => {
      if (!tasks.delete(id)) throw new Error(`unknown task: ${id}`)
    },
  }
}
