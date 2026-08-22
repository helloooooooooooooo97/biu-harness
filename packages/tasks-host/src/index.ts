import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Service, type Context } from 'cordis'
import { currentSessionId } from '../../../host/plugins/core/session-scope.ts'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'
export type TaskActorKind = 'user' | 'agent'

export type TaskActor = {
  kind: TaskActorKind
  sessionId?: string
  name: string
  mascot?: { shape: string; color: string; eye?: number }
}

export type TaskExecution = {
  status: 'idle' | 'running' | 'unassigned'
  reason?: string
  turn: number | null
  assistantText: string
  updatedAt: number
}

export type TaskRow = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: number | null
  notes: string
  sort: number
  createdAt: number
  updatedAt: number
  creator: TaskActor
  assignee: TaskActor | null
  assignedAt: number | null
  /** 列表接口按需附带：从 assignee session 事件推导 */
  execution?: TaskExecution
}

export type TaskCreateInput = {
  title: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: TaskActor | null
  assigneeSessionId?: string
  dueAt?: number | null
  notes?: string
  creator?: TaskActor
}

export type TaskUpdateInput = Partial<{
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: TaskActor | null
  assigneeSessionId: string | null
  dueAt: number | null
  notes: string
  sort: number
}>

export type TaskListFilter = {
  status?: TaskStatus
  q?: string
}

type SessionEventLite = {
  type: string
  text?: string
  seq?: number
  turn?: number
  reason?: string
  ts?: number
}

type SessionPeek = {
  id: string
  config?: { title?: string }
  mascot?: { shape: string; color: string; eye?: number }
  events?: SessionEventLite[]
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
  sessions?: {
    peek: (id: string) => SessionPeek | undefined
    get?: (id: string) => Promise<SessionPeek | undefined>
  }
  agents?: {
    isBusy?: (id: string) => boolean
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

function normalizeActor(value: unknown, fallbackName = '用户'): TaskActor | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const name = value.trim()
    return name ? { kind: 'user', name: name.slice(0, 80) } : null
  }
  if (typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const kind: TaskActorKind = raw.kind === 'agent' ? 'agent' : 'user'
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 80)
      : kind === 'agent'
        ? 'Agent'
        : fallbackName
  const sessionId =
    typeof raw.sessionId === 'string' && raw.sessionId.trim() ? raw.sessionId.trim() : undefined
  let mascot: TaskActor['mascot']
  if (raw.mascot && typeof raw.mascot === 'object') {
    const m = raw.mascot as Record<string, unknown>
    if (typeof m.shape === 'string' && typeof m.color === 'string') {
      mascot = {
        shape: m.shape,
        color: m.color,
        ...(typeof m.eye === 'number' ? { eye: m.eye } : {}),
      }
    }
  }
  return {
    kind,
    name,
    ...(sessionId ? { sessionId } : {}),
    ...(mascot ? { mascot } : {}),
  }
}

function actorFromSession(record: SessionPeek): TaskActor {
  let name = record.config?.title?.trim() ?? ''
  if (!name && Array.isArray(record.events)) {
    for (let i = record.events.length - 1; i >= 0; i -= 1) {
      const event = record.events[i]
      if (event?.type === 'user/message' && typeof event.text === 'string' && event.text.trim()) {
        name = event.text.trim().slice(0, 48)
        break
      }
    }
  }
  if (!name) name = record.id.slice(0, 8)
  return {
    kind: 'agent',
    sessionId: record.id,
    name,
    ...(record.mascot ? { mascot: record.mascot } : {}),
  }
}

async function resolveCreator(host: HostCtx, explicit?: TaskActor): Promise<TaskActor> {
  if (explicit) return normalizeActor(explicit, '用户') ?? { kind: 'user', name: '用户' }
  const sessionId = currentSessionId()
  if (sessionId && host.sessions) {
    const peeked = host.sessions.peek(sessionId) ?? (await host.sessions.get?.(sessionId))
    if (peeked) return actorFromSession(peeked)
    return { kind: 'agent', sessionId, name: sessionId.slice(0, 8) }
  }
  return { kind: 'user', name: '用户' }
}

async function resolveAssignee(
  host: HostCtx,
  input: { assignee?: TaskActor | null; assigneeSessionId?: string | null },
): Promise<{ assignee: TaskActor | null; touchAssignedAt: boolean }> {
  if ('assigneeSessionId' in input) {
    const sid = input.assigneeSessionId?.trim()
    if (!sid) return { assignee: null, touchAssignedAt: true }
    if (host.sessions) {
      const peeked = host.sessions.peek(sid) ?? (await host.sessions.get?.(sid))
      if (peeked) return { assignee: actorFromSession(peeked), touchAssignedAt: true }
    }
    return { assignee: { kind: 'agent', sessionId: sid, name: sid.slice(0, 8) }, touchAssignedAt: true }
  }
  if ('assignee' in input) {
    return { assignee: normalizeActor(input.assignee), touchAssignedAt: true }
  }
  return { assignee: null, touchAssignedAt: false }
}

function actorsEqual(a: TaskActor | null, b: TaskActor | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.kind === b.kind && a.name === b.name && (a.sessionId ?? '') === (b.sessionId ?? '')
}

function mapRow(row: Record<string, unknown>): TaskRow {
  let creator: TaskActor = { kind: 'user', name: '用户' }
  if (typeof row.creator_json === 'string' && row.creator_json) {
    try {
      creator = normalizeActor(JSON.parse(row.creator_json), '用户') ?? creator
    } catch {
      /* ignore */
    }
  }

  let assignee: TaskActor | null = null
  if (typeof row.assignee_json === 'string' && row.assignee_json) {
    try {
      assignee = normalizeActor(JSON.parse(row.assignee_json))
    } catch {
      /* ignore */
    }
  } else if (typeof row.assignee === 'string' && row.assignee.trim()) {
    assignee = { kind: 'user', name: row.assignee.trim() }
  }

  const assignedAt =
    row.assigned_at == null || row.assigned_at === ''
      ? assignee
        ? Number(row.created_at ?? 0) || null
        : null
      : Number(row.assigned_at)

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    dueAt: row.due_at == null ? null : Number(row.due_at),
    notes: String(row.notes ?? ''),
    sort: Number(row.sort ?? 0),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    creator,
    assignee,
    assignedAt: assignee ? assignedAt : null,
  }
}

/** 从 assignee session 的 turn 事件推导执行情况（对齐 request/response 成对回合）。 */
function deriveExecution(
  events: SessionEventLite[] | undefined,
  busy: boolean,
): TaskExecution {
  if (!events?.length) {
    return { status: busy ? 'running' : 'idle', turn: null, assistantText: '', updatedAt: 0 }
  }
  let turn: number | null = null
  let openTurn = false
  let reason: string | undefined
  let assistantText = ''
  const chunks: string[] = []
  for (const event of events) {
    if (event.type === 'turn/start') {
      turn = typeof event.turn === 'number' ? event.turn : turn
      openTurn = true
      reason = undefined
      assistantText = ''
      chunks.length = 0
    } else if (event.type === 'turn/end') {
      turn = typeof event.turn === 'number' ? event.turn : turn
      reason = typeof event.reason === 'string' ? event.reason : undefined
      openTurn = false
    } else if (event.type === 'assistant/message' && typeof event.text === 'string' && event.text.trim()) {
      assistantText = event.text
      chunks.length = 0
    } else if (event.type === 'assistant/chunk' && typeof event.text === 'string') {
      chunks.push(event.text)
    }
  }
  if (!assistantText && chunks.length) assistantText = chunks.join('')
  if (assistantText.length > 240) assistantText = `${assistantText.slice(0, 240)}…`
  const newest = events.at(-1)
  return {
    status: busy || openTurn ? 'running' : 'idle',
    ...(reason ? { reason } : {}),
    turn,
    assistantText,
    updatedAt: typeof newest?.ts === 'number' ? newest.ts : 0,
  }
}

async function enrichExecution(host: HostCtx, task: TaskRow): Promise<TaskRow> {
  const sid = task.assignee?.sessionId
  if (!sid) {
    return { ...task, execution: { status: 'unassigned', turn: null, assistantText: '', updatedAt: 0 } }
  }
  const record = host.sessions?.peek(sid) ?? (await host.sessions?.get?.(sid))
  const busy = Boolean(host.agents?.isBusy?.(sid))
  return { ...task, execution: deriveExecution(record?.events, busy) }
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
        updated_at INTEGER NOT NULL,
        creator_json TEXT,
        assignee_json TEXT,
        assigned_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS tasks_status_sort ON tasks(status, sort, updated_at DESC);
    `)
    for (const sql of [
      'ALTER TABLE tasks ADD COLUMN creator_json TEXT',
      'ALTER TABLE tasks ADD COLUMN assignee_json TEXT',
      'ALTER TABLE tasks ADD COLUMN assigned_at INTEGER',
    ]) {
      try {
        this.db.exec(sql)
      } catch {
        /* already exists */
      }
    }
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
      clauses.push(
        '(title LIKE ? OR notes LIKE ? OR assignee LIKE ? OR creator_json LIKE ? OR assignee_json LIKE ?)',
      )
      const like = `%${filter.q.trim()}%`
      params.push(like, like, like, like, like)
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

  create(input: TaskCreateInput & { creator: TaskActor; assignee?: TaskActor | null; assignedAt?: number | null }): TaskRow {
    const title = String(input.title ?? '').trim()
    if (!title) throw new Error('title required')
    const id = nextId()
    const ts = now()
    const status = asStatus(input.status)
    const priority = asPriority(input.priority)
    const dueAt = input.dueAt == null || Number.isNaN(Number(input.dueAt)) ? null : Number(input.dueAt)
    const notes = String(input.notes ?? '')
    const creator = normalizeActor(input.creator, '用户') ?? { kind: 'user', name: '用户' }
    const assignee = input.assignee ? normalizeActor(input.assignee) : null
    const assignedAt = assignee ? (input.assignedAt ?? ts) : null
    const assigneeLabel = assignee?.name ?? ''
    const maxSort = this.db
      .prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM tasks WHERE status = ?')
      .get(status) as { m: number }
    const sort = Number(maxSort?.m ?? 0) + 1
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, status, priority, assignee, due_at, notes, sort,
          created_at, updated_at, creator_json, assignee_json, assigned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        title,
        status,
        priority,
        assigneeLabel,
        dueAt,
        notes,
        sort,
        ts,
        ts,
        JSON.stringify(creator),
        assignee ? JSON.stringify(assignee) : null,
        assignedAt,
      )
    this.emitChange()
    return this.get(id)!
  }

  update(id: string, patch: TaskUpdateInput & { assignee?: TaskActor | null; assignedAt?: number | null }): TaskRow {
    const current = this.get(id)
    if (!current) throw new Error('unknown task')
    const title = patch.title != null ? String(patch.title).trim() : current.title
    if (!title) throw new Error('title required')
    const status = patch.status != null ? asStatus(patch.status) : current.status
    const priority = patch.priority != null ? asPriority(patch.priority) : current.priority
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

    let assignee = current.assignee
    let assignedAt = current.assignedAt
    if ('assignee' in patch) {
      assignee = patch.assignee ? normalizeActor(patch.assignee) : null
      if (!actorsEqual(assignee, current.assignee)) {
        assignedAt = assignee ? (patch.assignedAt ?? now()) : null
      }
    }

    const ts = now()
    this.db
      .prepare(
        `UPDATE tasks SET
          title = ?, status = ?, priority = ?, assignee = ?, due_at = ?, notes = ?, sort = ?,
          updated_at = ?, assignee_json = ?, assigned_at = ?
         WHERE id = ?`,
      )
      .run(
        title,
        status,
        priority,
        assignee?.name ?? '',
        dueAt,
        notes,
        sort,
        ts,
        assignee ? JSON.stringify(assignee) : null,
        assignedAt,
        id,
      )
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
export const inject = ['http', 'hub', 'tools', 'sessions']

export function apply(ctx: Context) {
  const host = ctx as HostCtx
  const dbPath = join(process.cwd(), '.cordis', 'tasks.sqlite')
  const tasks = new TasksService(ctx, dbPath).open()

  async function present(row: TaskRow): Promise<TaskRow> {
    return enrichExecution(host, row)
  }

  async function presentMany(rows: TaskRow[]): Promise<TaskRow[]> {
    return Promise.all(rows.map((row) => present(row)))
  }

  host.hub.register({
    id: 'tasks',
    title: '任务',
    subtitle: 'Table / Board · SQLite · Agent tools',
    plugin: 'tasks',
    kind: 'tasks',
  })

  host.tools.register({
    name: 'tasks_list',
    description: '列出任务（含创建人、分配人、执行情况；可按 status / 关键词筛选）',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'doing', 'done'], description: '状态筛选' },
        q: { type: 'string', description: '标题/备注/负责人/创建人关键词' },
      },
    },
    execute: async (args) =>
      presentMany(
        tasks.list({
          ...(args.status ? { status: asStatus(args.status) } : {}),
          ...(args.q ? { q: String(args.q) } : {}),
        }),
      ),
  })

  host.tools.register({
    name: 'tasks_get',
    description: '按 id 获取任务详情（含执行情况）',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '任务 id' } },
      required: ['id'],
    },
    execute: async (args) => {
      const row = tasks.get(String(args.id ?? ''))
      if (!row) throw new Error('unknown task')
      return present(row)
    },
  })

  host.tools.register({
    name: 'tasks_create',
    description: '创建任务（自动记录创建 Agent；可用 assigneeSessionId 分配给某 session）',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'med', 'high'] },
        assigneeSessionId: { type: 'string', description: '分配给的 session id（Agent）' },
        assignee: { type: 'string', description: '分配给人名（非 Agent 时）' },
        dueAt: { type: 'number', description: '截止时间戳 ms' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    execute: async (args) => {
      const creator = await resolveCreator(host)
      let assignee: TaskActor | null = null
      if (typeof args.assigneeSessionId === 'string' && args.assigneeSessionId.trim()) {
        const resolved = await resolveAssignee(host, { assigneeSessionId: String(args.assigneeSessionId) })
        assignee = resolved.assignee
      } else if (typeof args.assignee === 'string' && args.assignee.trim()) {
        assignee = { kind: 'user', name: String(args.assignee).trim() }
      }
      const row = tasks.create({
        title: String(args.title ?? ''),
        ...(args.status != null ? { status: asStatus(args.status) } : {}),
        ...(args.priority != null ? { priority: asPriority(args.priority) } : {}),
        ...(args.dueAt != null ? { dueAt: Number(args.dueAt) } : {}),
        ...(args.notes != null ? { notes: String(args.notes) } : {}),
        creator,
        assignee,
      })
      return present(row)
    },
  })

  host.tools.register({
    name: 'tasks_update',
    description: '更新任务字段（可改分配人 assigneeSessionId / assignee；改 status 即换看板列）',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'med', 'high'] },
        assigneeSessionId: { type: ['string', 'null'], description: '分配 session；null 清空' },
        assignee: { type: ['string', 'null'], description: '分配人名；null 清空' },
        dueAt: { type: ['number', 'null'] },
        notes: { type: 'string' },
        sort: { type: 'number' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const id = String(args.id ?? '')
      const patch: TaskUpdateInput & { assignee?: TaskActor | null } = {}
      if (args.title != null) patch.title = String(args.title)
      if (args.status != null) patch.status = asStatus(args.status)
      if (args.priority != null) patch.priority = asPriority(args.priority)
      if (args.dueAt !== undefined) patch.dueAt = args.dueAt == null ? null : Number(args.dueAt)
      if (args.notes != null) patch.notes = String(args.notes)
      if (args.sort != null) patch.sort = Number(args.sort)
      if (args.assigneeSessionId !== undefined) {
        const resolved = await resolveAssignee(host, {
          assigneeSessionId: args.assigneeSessionId == null ? null : String(args.assigneeSessionId),
        })
        patch.assignee = resolved.assignee
      } else if (args.assignee !== undefined) {
        patch.assignee =
          args.assignee == null || !String(args.assignee).trim()
            ? null
            : { kind: 'user', name: String(args.assignee).trim() }
      }
      return present(tasks.update(id, patch))
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

  host.http.route('GET', '/api/tasks', async (route) => {
    const statusRaw = route.query.get('status')
    const q = route.query.get('q') ?? undefined
    const status = statusRaw && STATUSES.has(statusRaw as TaskStatus) ? (statusRaw as TaskStatus) : undefined
    const rows = await presentMany(tasks.list({ ...(status ? { status } : {}), ...(q ? { q } : {}) }))
    route.send(200, { tasks: rows })
  })

  host.http.route('POST', '/api/tasks', async (route) => {
    try {
      const body = (await route.json()) as TaskCreateInput
      const creator = await resolveCreator(host, body.creator)
      const resolved = await resolveAssignee(host, {
        ...(body.assigneeSessionId !== undefined ? { assigneeSessionId: body.assigneeSessionId } : {}),
        ...(body.assignee !== undefined ? { assignee: body.assignee } : {}),
      })
      const row = tasks.create({
        ...body,
        creator,
        assignee: resolved.touchAssignedAt ? resolved.assignee : body.assignee ?? null,
      })
      route.send(201, { task: await present(row) })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  host.http.route('GET', '/api/tasks/:id', async (route) => {
    const row = tasks.get(route.params.id)
    if (!row) return route.send(404, { error: 'unknown task' })
    route.send(200, { task: await present(row) })
  })

  host.http.route('PATCH', '/api/tasks/:id', async (route) => {
    try {
      const body = (await route.json()) as TaskUpdateInput
      const patch: TaskUpdateInput & { assignee?: TaskActor | null } = { ...body }
      if (body.assigneeSessionId !== undefined || body.assignee !== undefined) {
        const resolved = await resolveAssignee(host, {
          ...(body.assigneeSessionId !== undefined ? { assigneeSessionId: body.assigneeSessionId } : {}),
          ...(body.assignee !== undefined ? { assignee: body.assignee } : {}),
        })
        if (resolved.touchAssignedAt) patch.assignee = resolved.assignee
      }
      const row = tasks.update(route.params.id, patch)
      route.send(200, { task: await present(row) })
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
