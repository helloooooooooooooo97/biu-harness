import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Service, type Context } from 'cordis'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'

export type TaskRow = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  dueAt: number | null
  notes: string
  sort: number
  createdAt: number
  updatedAt: number
}

export type TaskCreateInput = {
  title: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: string
  dueAt?: number | null
  notes?: string
}

export type TaskUpdateInput = Partial<{
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  dueAt: number | null
  notes: string
  sort: number
}>

export type TaskListFilter = {
  status?: TaskStatus
  q?: string
}

type HostCtx = Context & {
  http: {
    route: (
      method: string,
      pattern: string,
      handler: (route: {
        params: Record<string, string>
        query: URLSearchParams
        json: <T = unknown>() => Promise<T>
        send: (status: number, body: unknown) => void
      }) => void | Promise<void>,
    ) => unknown
    broadcast: (type: string, payload: unknown) => void
  }
  hub: {
    register: (page: {
      id: string
      title: string
      subtitle: string
      plugin: string
      kind: string
    }) => unknown
  }
  tools: {
    register: (spec: {
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (args: Record<string, unknown>) => unknown
    }) => unknown
  }
}

const STATUSES = new Set<TaskStatus>(['todo', 'doing', 'done'])
const PRIORITIES = new Set<TaskPriority>(['low', 'med', 'high'])

function now() {
  return Date.now()
}

function nextId() {
  return `task_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function asStatus(value: unknown, fallback: TaskStatus = 'todo'): TaskStatus {
  const raw = String(value ?? fallback)
  return STATUSES.has(raw as TaskStatus) ? (raw as TaskStatus) : fallback
}

function asPriority(value: unknown, fallback: TaskPriority = 'med'): TaskPriority {
  const raw = String(value ?? fallback)
  return PRIORITIES.has(raw as TaskPriority) ? (raw as TaskPriority) : fallback
}

function mapRow(row: Record<string, unknown>): TaskRow {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    assignee: String(row.assignee ?? ''),
    dueAt: row.due_at == null ? null : Number(row.due_at),
    notes: String(row.notes ?? ''),
    sort: Number(row.sort ?? 0),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
  }
}

export class TasksService extends Service {
  private db!: DatabaseSync

  constructor(ctx: Context, private dbPath: string) {
    super(ctx, 'tasks')
  }

  open() {
    mkdirSync(dirname(this.dbPath), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'med',
        assignee TEXT NOT NULL DEFAULT '',
        due_at INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        sort REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_status_sort ON tasks(status, sort, updated_at DESC);
    `)
    return this
  }

  private emitChange() {
    try {
      const host = this.ctx as HostCtx
      host.http?.broadcast?.('tasks', { ts: now() })
    } catch {
      /* host http 未就绪（单测） */
    }
  }

  list(filter: TaskListFilter = {}): TaskRow[] {
    const clauses: string[] = []
    const params: unknown[] = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter.q?.trim()) {
      clauses.push('(title LIKE ? OR notes LIKE ? OR assignee LIKE ?)')
      const like = `%${filter.q.trim()}%`
      params.push(like, like, like)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks ${where} ORDER BY
          CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
          sort ASC, updated_at DESC`,
      )
      .all(...params) as Array<Record<string, unknown>>
    return rows.map(mapRow)
  }

  get(id: string): TaskRow | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return row ? mapRow(row) : undefined
  }

  create(input: TaskCreateInput): TaskRow {
    const title = String(input.title ?? '').trim()
    if (!title) throw new Error('title required')
    const id = nextId()
    const ts = now()
    const status = asStatus(input.status)
    const priority = asPriority(input.priority)
    const assignee = String(input.assignee ?? '').trim()
    const dueAt = input.dueAt == null || Number.isNaN(Number(input.dueAt)) ? null : Number(input.dueAt)
    const notes = String(input.notes ?? '')
    const maxSort = this.db
      .prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM tasks WHERE status = ?')
      .get(status) as { m: number }
    const sort = Number(maxSort?.m ?? 0) + 1
    this.db
      .prepare(
        `INSERT INTO tasks (id, title, status, priority, assignee, due_at, notes, sort, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, title, status, priority, assignee, dueAt, notes, sort, ts, ts)
    this.emitChange()
    return this.get(id)!
  }

  update(id: string, patch: TaskUpdateInput): TaskRow {
    const current = this.get(id)
    if (!current) throw new Error('unknown task')
    const title = patch.title != null ? String(patch.title).trim() : current.title
    if (!title) throw new Error('title required')
    const status = patch.status != null ? asStatus(patch.status) : current.status
    const priority = patch.priority != null ? asPriority(patch.priority) : current.priority
    const assignee = patch.assignee != null ? String(patch.assignee).trim() : current.assignee
    const dueAt =
      patch.dueAt === undefined
        ? current.dueAt
        : patch.dueAt == null || Number.isNaN(Number(patch.dueAt))
          ? null
          : Number(patch.dueAt)
    const notes = patch.notes != null ? String(patch.notes) : current.notes
    let sort = patch.sort != null ? Number(patch.sort) : current.sort
    if (status !== current.status && patch.sort == null) {
      const maxSort = this.db
        .prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM tasks WHERE status = ?')
        .get(status) as { m: number }
      sort = Number(maxSort?.m ?? 0) + 1
    }
    const ts = now()
    this.db
      .prepare(
        `UPDATE tasks SET title = ?, status = ?, priority = ?, assignee = ?, due_at = ?, notes = ?, sort = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(title, status, priority, assignee, dueAt, notes, sort, ts, id)
    this.emitChange()
    return this.get(id)!
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id) as { changes: number }
    if (result.changes > 0) this.emitChange()
    return result.changes > 0
  }
}

export const name = 'tasks'
export const inject = ['http', 'hub', 'tools']

export function apply(ctx: Context) {
  const host = ctx as HostCtx
  const dbPath = join(process.cwd(), '.cordis', 'tasks.sqlite')
  const tasks = new TasksService(ctx, dbPath).open()

  host.hub.register({
    id: 'tasks',
    title: '任务',
    subtitle: 'Table / Board · SQLite · Agent tools',
    plugin: 'tasks',
    kind: 'tasks',
  })

  host.tools.register({
    name: 'tasks_list',
    description: '列出任务（可按 status / 关键词筛选）',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'doing', 'done'], description: '状态筛选' },
        q: { type: 'string', description: '标题/备注/负责人关键词' },
      },
    },
    execute: (args) =>
      tasks.list({
        ...(args.status ? { status: asStatus(args.status) } : {}),
        ...(args.q ? { q: String(args.q) } : {}),
      }),
  })

  host.tools.register({
    name: 'tasks_get',
    description: '按 id 获取任务详情',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '任务 id' } },
      required: ['id'],
    },
    execute: (args) => {
      const row = tasks.get(String(args.id ?? ''))
      if (!row) throw new Error('unknown task')
      return row
    },
  })

  host.tools.register({
    name: 'tasks_create',
    description: '创建任务',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'med', 'high'] },
        assignee: { type: 'string' },
        dueAt: { type: 'number', description: '截止时间戳 ms' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    execute: (args) =>
      tasks.create({
        title: String(args.title ?? ''),
        ...(args.status != null ? { status: asStatus(args.status) } : {}),
        ...(args.priority != null ? { priority: asPriority(args.priority) } : {}),
        ...(args.assignee != null ? { assignee: String(args.assignee) } : {}),
        ...(args.dueAt != null ? { dueAt: Number(args.dueAt) } : {}),
        ...(args.notes != null ? { notes: String(args.notes) } : {}),
      }),
  })

  host.tools.register({
    name: 'tasks_update',
    description: '更新任务字段（改 status 即换看板列）',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'med', 'high'] },
        assignee: { type: 'string' },
        dueAt: { type: ['number', 'null'] },
        notes: { type: 'string' },
        sort: { type: 'number' },
      },
      required: ['id'],
    },
    execute: (args) => {
      const id = String(args.id ?? '')
      const patch: TaskUpdateInput = {}
      if (args.title != null) patch.title = String(args.title)
      if (args.status != null) patch.status = asStatus(args.status)
      if (args.priority != null) patch.priority = asPriority(args.priority)
      if (args.assignee != null) patch.assignee = String(args.assignee)
      if (args.dueAt !== undefined) patch.dueAt = args.dueAt == null ? null : Number(args.dueAt)
      if (args.notes != null) patch.notes = String(args.notes)
      if (args.sort != null) patch.sort = Number(args.sort)
      return tasks.update(id, patch)
    },
  })

  host.tools.register({
    name: 'tasks_delete',
    description: '删除任务',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    execute: (args) => {
      const ok = tasks.delete(String(args.id ?? ''))
      if (!ok) throw new Error('unknown task')
      return { ok: true }
    },
  })

  host.http.route('GET', '/api/tasks', (route) => {
    const statusRaw = route.query.get('status')
    const q = route.query.get('q') ?? undefined
    const status = statusRaw && STATUSES.has(statusRaw as TaskStatus) ? (statusRaw as TaskStatus) : undefined
    route.send(200, { tasks: tasks.list({ ...(status ? { status } : {}), ...(q ? { q } : {}) }) })
  })

  host.http.route('POST', '/api/tasks', async (route) => {
    try {
      const body = (await route.json()) as TaskCreateInput
      const row = tasks.create(body)
      route.send(201, { task: row })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  host.http.route('GET', '/api/tasks/:id', (route) => {
    const row = tasks.get(route.params.id)
    if (!row) return route.send(404, { error: 'unknown task' })
    route.send(200, { task: row })
  })

  host.http.route('PATCH', '/api/tasks/:id', async (route) => {
    try {
      const body = (await route.json()) as TaskUpdateInput
      const row = tasks.update(route.params.id, body)
      route.send(200, { task: row })
    } catch (error) {
      const message = String(error)
      route.send(message.includes('unknown') ? 404 : 400, { error: message })
    }
  })

  host.http.route('DELETE', '/api/tasks/:id', (route) => {
    const ok = tasks.delete(route.params.id)
    if (!ok) return route.send(404, { error: 'unknown task' })
    route.send(200, { ok: true })
  })
}
