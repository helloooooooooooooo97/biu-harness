import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Service, type Context } from 'cordis'
import { currentSessionId } from '../../../host/plugins/core/session-scope.ts'

type DatabaseSync = import('node:sqlite').DatabaseSync
type SQLInputValue = import('node:sqlite').SQLInputValue

const require = createRequire(import.meta.url)

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'
export type TaskDifficulty = 'low' | 'med' | 'high'
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

/** agent 通过 task_report 主动提交的一条执行报告 */
export type TaskReport = {
  sessionId: string
  sessionName?: string
  turn: number | null
  status: 'doing' | 'done'
  note?: string
  ts: number
}

export type TaskRow = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  /** 难度（高/中/低） */
  difficulty: TaskDifficulty
  dueAt: number | null
  /** 任务描述 */
  description: string
  /** 备忘 */
  notes: string
  /** 归属项目（可为空） */
  project: string | null
  /** 标签（类型/性质） */
  tags: string[]
  /** 父任务 id（树：最大 MAX_DEPTH 层） */
  parentId: string | null
  /** 依赖的任务 id 列表（DAG：无环） */
  dependsOn: string[]
  /** 树深度（根=0） */
  depth: number
  /** 阻塞状态（派生）：todo 且存在未完成的依赖任务 */
  blocked?: boolean
  /** 阻塞来源任务 id（派生）：哪些未完成的依赖（含递归）阻塞了它 */
  blockedBy?: string[]
  /** report 中 done 的次数（派生） */
  doneCount?: number
  sort: number
  createdAt: number
  updatedAt: number
  creator: TaskActor
  assignee: TaskActor | null
  assignedAt: number | null
  /** agent 通过 task_report 提交的执行报告历史 */
  reports?: TaskReport[]
  /** 列表接口按需附带：优先从 reports 派生，无 reports 时才从事件推导 */
  execution?: TaskExecution
}

export type TaskCreateInput = {
  title: string
  status?: TaskStatus
  priority?: TaskPriority
  difficulty?: TaskDifficulty
  assignee?: TaskActor | null
  assigneeSessionId?: string
  dueAt?: number | null
  description?: string
  notes?: string
  creator?: TaskActor
  project?: string | null
  tags?: string[]
  parentId?: string | null
  dependsOn?: string[]
}

export type TaskUpdateInput = Partial<{
  title: string
  status: TaskStatus
  priority: TaskPriority
  difficulty: TaskDifficulty
  assignee: TaskActor | null
  assigneeSessionId: string | null
  dueAt: number | null
  description: string
  notes: string
  sort: number
  project: string | null
  tags: string[]
  parentId: string | null
  dependsOn: string[]
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
}

const STATUSES = new Set<TaskStatus>(['todo', 'doing', 'done'])
const PRIORITIES = new Set<TaskPriority>(['low', 'med', 'high'])
const DIFFICULTIES = new Set<TaskDifficulty>(['low', 'med', 'high'])

function now() {
  return Date.now()
}

function nextId() {
  return `task_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 树的嵌套最大深度（根=0，叶子到 MAX_DEPTH 为止） */
const MAX_DEPTH = 3

/**
 * 判断依赖链是否全部完成（递归，沿 dependsOn 向下）。
 * seen 用于防御环（create/update 已防环，这里作为兜底）。
 */
export function depsSatisfied(row: TaskRow, getById: (id: string) => TaskRow | undefined, seen: Set<string> = new Set()): boolean {
  for (const depId of row.dependsOn ?? []) {
    if (seen.has(depId)) continue
    seen.add(depId)
    const dep = getById(depId)
    if (!dep || dep.status !== 'done') return false
    if (!depsSatisfied(dep, getById, seen)) return false
  }
  return true
}

/** 派生阻塞：任务处于待办状态 且 存在未完成的依赖 → true */
export function computeBlocked(row: TaskRow, getById: (id: string) => TaskRow | undefined): boolean {
  if (row.status !== 'todo') return false
  return !depsSatisfied(row, getById)
}

/**
 * 计算阻塞该任务的具体来源任务 id 列表（递归沿 dependsOn 收集所有未完成的依赖及其依赖）。
 * 返回顺序即阻塞链从近到远。
 */
export function computeBlockedBy(row: TaskRow, getById: (id: string) => TaskRow | undefined, seen: Set<string> = new Set()): string[] {
  if (row.status !== 'todo') return []
  const out: string[] = []
  for (const depId of row.dependsOn ?? []) {
    if (seen.has(depId)) continue
    const dep = getById(depId)
    if (!dep) {
      out.push(depId)
      continue
    }
    if (dep.status !== 'done') {
      out.push(depId)
      seen.add(depId)
      // 递归：依赖任务若也被阻塞（它的依赖未完成），一并加入，说明阻塞链路
      for (const sub of computeBlockedBy(dep, getById, seen)) {
        if (!out.includes(sub)) out.push(sub)
      }
    }
  }
  return out
}

function asStatus(value: unknown, fallback: TaskStatus = 'todo'): TaskStatus {
  const raw = String(value ?? fallback)
  return STATUSES.has(raw as TaskStatus) ? (raw as TaskStatus) : fallback
}

function asPriority(value: unknown, fallback: TaskPriority = 'med'): TaskPriority {
  const raw = String(value ?? fallback)
  return PRIORITIES.has(raw as TaskPriority) ? (raw as TaskPriority) : fallback
}

function asDifficulty(value: unknown, fallback: TaskDifficulty = 'med'): TaskDifficulty {
  const raw = String(value ?? fallback)
  return DIFFICULTIES.has(raw as TaskDifficulty) ? (raw as TaskDifficulty) : fallback
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
  // 只要有调用方 session，就以该 agent 为创建人；不因 sessions service 未就绪而回退成"用户"。
  if (sessionId) {
    if (host.sessions) {
      const peeked = host.sessions.peek(sessionId) ?? (await host.sessions.get?.(sessionId))
      if (peeked) return actorFromSession(peeked)
    }
    return { kind: 'agent', sessionId, name: sessionId.slice(0, 8) }
  }
  return { kind: 'user', name: '用户' }
}

async function resolveAssignee(
  host: HostCtx,
  input: { assignee?: unknown; assigneeSessionId?: string | null },
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
    const assignee = await coerceAssigneeArg(host, input.assignee)
    return { assignee, touchAssignedAt: true }
  }
  return { assignee: null, touchAssignedAt: false }
}

/**
 * 工具 / API 入参归一：
 * - null / '' → 清空
 * - string 人名 → user
 * - string sessionId / UUID → agent（查 sessions）
 * - JSON 字符串对象 / actor 对象 → agent|user（带 sessionId 时补全 mascot/name）
 */
export async function coerceAssigneeArg(host: HostCtx, value: unknown): Promise<TaskActor | null> {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return coerceAssigneeArg(host, JSON.parse(trimmed))
      } catch {
        /* fall through as plain name */
      }
    }
    if (/^[0-9a-f]{8}-[0-9a-f-]+$/i.test(trimmed) || (trimmed.length >= 20 && !/\s/.test(trimmed))) {
      const resolved = await resolveAssignee(host, { assigneeSessionId: trimmed })
      return resolved.assignee
    }
    return { kind: 'user', name: trimmed.slice(0, 80) }
  }
  if (typeof value !== 'object') return null
  // 避免 String(object) → "[object Object]"
  const actor = normalizeActor(value)
  if (!actor) return null
  if (actor.sessionId) {
    if (host.sessions) {
      const peeked = host.sessions.peek(actor.sessionId) ?? (await host.sessions.get?.(actor.sessionId))
      if (peeked) {
        const fromSession = actorFromSession(peeked)
        return {
          ...fromSession,
          ...(actor.name && actor.name !== 'Agent' ? { name: actor.name } : {}),
          ...(actor.mascot ? { mascot: actor.mascot } : {}),
        }
      }
    }
    return {
      kind: 'agent',
      sessionId: actor.sessionId,
      name: actor.name || actor.sessionId.slice(0, 8),
      ...(actor.mascot ? { mascot: actor.mascot } : {}),
    }
  }
  return actor
}

const ASSIGNEE_PARAM = {
  description:
    '分配人。支持：人名字符串；sessionId 字符串；或 actor 对象 { kind, sessionId?, name?, mascot? }；null 清空。也可用 assigneeSessionId。',
} as const

const ASSIGNEE_SESSION_PARAM = {
  type: ['string', 'null'] as const,
  description: '分配给某 session（Agent）；null 清空。与 assignee 二选一，优先本字段。',
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

  const reports: TaskReport[] = []
  if (typeof row.reports_json === 'string' && row.reports_json) {
    try {
      const parsed = JSON.parse(row.reports_json)
      if (Array.isArray(parsed)) {
        for (const r of parsed) {
          if (r && typeof r === 'object' && typeof r.sessionId === 'string') {
            reports.push({
              sessionId: String(r.sessionId),
              ...(typeof r.sessionName === 'string' ? { sessionName: r.sessionName } : {}),
              turn: typeof r.turn === 'number' ? r.turn : null,
              status: r.status === 'doing' || r.status === 'done' ? r.status : 'doing',
              ...(typeof r.note === 'string' ? { note: r.note } : {}),
              ts: typeof r.ts === 'number' ? r.ts : Number(row.updated_at ?? 0),
            })
          }
        }
      }
    } catch {
      /* ignore malformed reports */
    }
  }

  const tags: string[] = []
  if (typeof row.tags_json === 'string' && row.tags_json) {
    try {
      const parsed = JSON.parse(row.tags_json)
      if (Array.isArray(parsed)) {
        for (const tag of parsed) {
          if (typeof tag === 'string' && tag.trim()) {
            const t = tag.trim()
            if (!tags.includes(t)) tags.push(t)
          }
        }
      }
    } catch {
      /* ignore malformed tags */
    }
  }

  const dependsOn: string[] = []
  if (typeof row.depends_on === 'string' && row.depends_on) {
    try {
      const parsed = JSON.parse(row.depends_on)
      if (Array.isArray(parsed)) {
        for (const d of parsed) {
          if (typeof d === 'string' && d && !dependsOn.includes(d)) dependsOn.push(d)
        }
      }
    } catch {
      /* ignore malformed depends_on */
    }
  }

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    difficulty: asDifficulty(row.difficulty),
    dueAt: row.due_at == null ? null : Number(row.due_at),
    description: String(row.description ?? ''),
    notes: String(row.notes ?? ''),
    project: typeof row.project === 'string' && row.project.trim() ? row.project.trim() : null,
    tags,
    parentId: typeof row.parent_id === 'string' && row.parent_id ? row.parent_id : null,
    dependsOn,
    depth: typeof row.depth === 'number' ? Number(row.depth) : 0,
    sort: Number(row.sort ?? 0),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    creator,
    assignee,
    assignedAt: assignee ? assignedAt : null,
    reports,
  }
}

/**
 * 从 assignee session 事件流推导执行情况。
 * 只看 turn/start…turn/end；不查询 agents.isBusy（任务层不耦合 agent 运行时）。
 * 已分配但尚无 turn → idle（空窗期由任务自身 status/doing 表达）。
 */
export function deriveExecution(events: SessionEventLite[] | undefined): TaskExecution {
  if (!events?.length) {
    return { status: 'idle', turn: null, assistantText: '', updatedAt: 0 }
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
    status: openTurn ? 'running' : 'idle',
    ...(reason ? { reason } : {}),
    turn,
    assistantText,
    updatedAt: typeof newest?.ts === 'number' ? newest.ts : 0,
  }
}

/**
 * 从 agent 通过 task_report 提交的报告历史派生执行状态。
 * 任务当前状态 = 最新一次 report 的 status：
 *  - 最新为 done  -> idle + reason 'complete'（已完成）
 *  - 最新为 doing -> running（进行中）
 *  - 没有 report  -> unassigned？不：任务已分配但 agent 尚未开始，应视为 idle（等进行）。
 * 用最新的 done/doing 判定，后一个 report 天然覆盖前一个状态。
 */
export function deriveExecutionFromReports(reports: TaskReport[] | undefined): TaskExecution {
  if (!reports?.length) {
    return { status: 'idle', turn: null, assistantText: '', updatedAt: 0 }
  }
  const last = reports[reports.length - 1]
  return {
    status: last.status === 'done' ? 'idle' : 'running',
    ...(last.status === 'done' ? { reason: 'complete' } : {}),
    turn: last.turn,
    assistantText: typeof last.note === 'string' && last.note ? last.note.slice(0, 240) : '',
    updatedAt: last.ts,
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
        difficulty TEXT NOT NULL DEFAULT 'med',
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
      "ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE tasks ADD COLUMN reports_json TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE tasks ADD COLUMN start_at INTEGER',
      "ALTER TABLE tasks ADD COLUMN project TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE tasks ADD COLUMN parent_id TEXT DEFAULT ''",
      "ALTER TABLE tasks ADD COLUMN depends_on TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE tasks ADD COLUMN depth INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE tasks ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'med'",
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
    const params: SQLInputValue[] = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter.q?.trim()) {
      clauses.push(
        '(title LIKE ? OR description LIKE ? OR notes LIKE ? OR assignee LIKE ? OR creator_json LIKE ? OR assignee_json LIKE ?)',
      )
      const like = `%${filter.q.trim()}%`
      params.push(like, like, like, like, like, like)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks ${where} ORDER BY
          CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
          sort DESC, updated_at DESC`,
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
    const difficulty = asDifficulty(input.difficulty)
    const dueAt = input.dueAt == null || Number.isNaN(Number(input.dueAt)) ? null : Number(input.dueAt)
    const description = String(input.description ?? '')
    const notes = String(input.notes ?? '')
    const project = typeof input.project === 'string' && input.project.trim() ? input.project.trim() : ''
    const tags = (Array.isArray(input.tags) ? input.tags : []).map((t) => String(t).trim()).filter((t) => t)

    // 树：父任务存在 + 深度不超 MAX_DEPTH；否则抛错
    const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null
    let depth = 0
    if (parentId) {
      const parent = this.get(parentId)
      if (!parent) throw new Error(`unknown parent task: ${parentId}`)
      if (parent.depth + 1 > MAX_DEPTH) throw new Error(`depth exceeds MAX_DEPTH=${MAX_DEPTH}`)
      depth = parent.depth + 1
    }
    const dependsOn = (Array.isArray(input.dependsOn) ? input.dependsOn : [])
      .map((d) => String(d))
      .filter((d) => d && d !== id)

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
          id, title, status, priority, difficulty, assignee, due_at, description, notes, sort,
          created_at, updated_at, creator_json, assignee_json, assigned_at,
          project, tags_json, parent_id, depends_on, depth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        title,
        status,
        priority,
        difficulty,
        assigneeLabel,
        dueAt,
        description,
        notes,
        sort,
        ts,
        ts,
        JSON.stringify(creator),
        assignee ? JSON.stringify(assignee) : null,
        assignedAt,
        project,
        JSON.stringify(tags),
        parentId,
        JSON.stringify(dependsOn),
        depth,
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
    const difficulty = patch.difficulty != null ? asDifficulty(patch.difficulty) : current.difficulty
    const dueAt =
      patch.dueAt === undefined
        ? current.dueAt
        : patch.dueAt == null || Number.isNaN(Number(patch.dueAt))
          ? null
          : Number(patch.dueAt)
    const notes = patch.notes != null ? String(patch.notes) : current.notes
    const description = patch.description != null ? String(patch.description) : current.description
    const project =
      patch.project === undefined
        ? (current.project ?? '')
        : typeof patch.project === 'string' && patch.project.trim()
          ? patch.project.trim()
          : ''
    const tags =
      Array.isArray(patch.tags)
        ? (patch.tags.map((t) => String(t).trim()).filter((t) => t))
        : current.tags
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

    // 树：改父任务时重算 depth（并级联更新其下所有子树）
    let parentId = current.parentId
    let depth = current.depth
    if ('parentId' in patch) {
      parentId = typeof patch.parentId === 'string' && patch.parentId ? patch.parentId : null
      if (parentId) {
        if (parentId === id) throw new Error('cannot set a task as its own parent')
        const parent = this.get(parentId)
        if (!parent) throw new Error(`unknown parent task: ${parentId}`)
        if (parent.depth + 1 > MAX_DEPTH) throw new Error(`depth exceeds MAX_DEPTH=${MAX_DEPTH}`)
        depth = parent.depth + 1
      } else {
        depth = 0
      }
    }

    // DAG：改依赖时做环检测（从本节点沿依赖反向 DFS，若遇到自己则成环）
    let dependsOn = current.dependsOn
    if (patch.dependsOn !== undefined) {
      dependsOn = (patch.dependsOn as string[]).map(String).filter((d) => d && d !== id)
      this.assertNoCycle(id, dependsOn)
    }

    const ts = now()
    this.db
      .prepare(
        `UPDATE tasks SET
          title = ?, status = ?, priority = ?, difficulty = ?, assignee = ?, due_at = ?, description = ?, notes = ?, sort = ?,
          updated_at = ?, assignee_json = ?, assigned_at = ?, project = ?, tags_json = ?,
          parent_id = ?, depends_on = ?, depth = ?
         WHERE id = ?`,
      )
      .run(
        title,
        status,
        priority,
        difficulty,
        assignee?.name ?? '',
        dueAt,
        description,
        notes,
        sort,
        ts,
        assignee ? JSON.stringify(assignee) : null,
        assignedAt,
        project,
        JSON.stringify(tags),
        parentId,
        JSON.stringify(dependsOn),
        depth,
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

  /** DAG 环检测：从每个依赖任务沿其依赖链 DFS，若回溯到本任务则成环 */
  private assertNoCycle(id: string, dependsOn: string[]): void {
    const visited = new Set<string>()
    const dfs = (nodeId: string) => {
      if (nodeId === id) throw new Error('dependency cycle detected')
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      const node = this.get(nodeId)
      if (!node) return
      for (const d of node.dependsOn) dfs(d)
    }
    for (const d of dependsOn) dfs(d)
  }

  /** 追加一条 agent 通过 task_report 提交的执行报告（不可篡改式累积） */
  report(id: string, report: TaskReport): TaskRow {
    const current = this.get(id)
    if (!current) throw new Error('unknown task')
    const reports = [...(current.reports ?? []), report]
    const ts = now()
    this.db
      .prepare('UPDATE tasks SET reports_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(reports), ts, id)
    this.emitChange()
    return this.get(id)!
  }
}

export const name = 'tasks'
export const inject = ['http', 'hub', 'tools', 'sessions']

export function apply(ctx: Context) {
  const host = ctx as HostCtx
  const dbPath = join(process.cwd(), '.cordis', 'tasks.sqlite')
  const tasks = new TasksService(ctx, dbPath).open()

  async function present(row: TaskRow): Promise<TaskRow> {
    // 完成状态（todo/doing/done）尊重已存储的 row.status：它由 task_report 上报 或 人/AI 手动 update 维护（last-write-wins）。
    // 无任何信号时默认 todo。
    const counts = (row.reports ?? []).filter((r) => r.status === 'done').length
    const base = { ...row, status: row.status || 'todo' }
    return {
      ...base,
      doneCount: counts,
      // 阻塞始终派生：待办 + 存在未完成依赖；并给出阻塞来源链
      blocked: computeBlocked({ ...row, status: base.status }, (id) => tasks.get(id)),
      blockedBy: computeBlockedBy({ ...row, status: base.status }, (id) => tasks.get(id)),
      execution: (row.reports ?? []).length
        ? deriveExecutionFromReports(row.reports)
        : { status: 'idle', turn: null, assistantText: '', updatedAt: 0 },
    }
  }

  async function presentMany(rows: TaskRow[]): Promise<TaskRow[]> {
    return Promise.all(rows.map((row) => present(row)))
  }

  host.hub.register({
    id: 'tasks',
    title: '任务',
    subtitle: '',
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
        difficulty: { type: 'string', enum: ['low', 'med', 'high'], description: '难度（low=低, med=中, high=高）' },
        assigneeSessionId: ASSIGNEE_SESSION_PARAM,
        assignee: ASSIGNEE_PARAM,
        dueAt: { type: 'number', description: '截止时间戳 ms' },
        description: { type: 'string', description: '任务描述' },
        notes: { type: 'string', description: '备忘' },
        project: { type: 'string', description: '归属项目（如 cordis-web）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签（类型/性质）' },
        parentId: { type: 'string', description: '父任务 id（树层级，深度上限 3）' },
        dependsOn: { type: 'array', items: { type: 'string' }, description: '依赖的任务 id 列表（DAG，自动防环）' },
      },
      required: ['title'],
    },
    execute: async (args) => {
      const creator = await resolveCreator(host)
      let assignee: TaskActor | null = null
      if (args.assigneeSessionId !== undefined && args.assigneeSessionId !== null && String(args.assigneeSessionId).trim()) {
        const resolved = await resolveAssignee(host, { assigneeSessionId: String(args.assigneeSessionId) })
        assignee = resolved.assignee
      } else if (args.assignee !== undefined) {
        assignee = await coerceAssigneeArg(host, args.assignee)
      }
      const row = tasks.create({
        title: String(args.title ?? ''),
        ...(args.status != null ? { status: asStatus(args.status) } : {}),
        ...(args.priority != null ? { priority: asPriority(args.priority) } : {}),
        ...(args.difficulty != null ? { difficulty: asDifficulty(args.difficulty) } : {}),
        ...(args.dueAt != null ? { dueAt: Number(args.dueAt) } : {}),
        ...(args.description != null ? { description: String(args.description) } : {}),
        ...(args.notes != null ? { notes: String(args.notes) } : {}),
        ...(args.project != null ? { project: String(args.project) } : {}),
        ...(Array.isArray(args.tags) ? { tags: args.tags.map(String).filter(Boolean) } : {}),
        ...(args.parentId != null ? { parentId: String(args.parentId) || null } : {}),
        ...(Array.isArray(args.dependsOn) ? { dependsOn: args.dependsOn.map(String).filter(Boolean) } : {}),
        creator,
        assignee,
      })
      return present(row)
    },
  })

  host.tools.register({
    name: 'tasks_update',
    description:
      '更新任务字段。分配人请用 assigneeSessionId，或 assignee（人名 / sessionId / actor 对象）；改 status 即换状态。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'med', 'high'] },
        difficulty: { type: 'string', enum: ['low', 'med', 'high'], description: '难度（low=低, med=中, high=高）' },
        assigneeSessionId: ASSIGNEE_SESSION_PARAM,
        assignee: ASSIGNEE_PARAM,
        dueAt: { type: ['number', 'null'] },
        description: { type: 'string', description: '任务描述' },
        notes: { type: 'string', description: '备忘' },
        sort: { type: 'number' },
        project: { type: ['string', 'null'], description: '归属项目（如 cordis-web），传 null 清除' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签（类型/性质），替换整个列表' },
        parentId: { type: ['string', 'null'], description: '父任务 id（树层级，深度上限 3），传 null 移到根' },
        dependsOn: { type: 'array', items: { type: 'string' }, description: '依赖的任务 id 列表（DAG，自动防环），替换整个列表' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const id = String(args.id ?? '')
      const patch: TaskUpdateInput & { assignee?: TaskActor | null } = {}
      if (args.title != null) patch.title = String(args.title)
      if (args.status != null) patch.status = asStatus(args.status)
      if (args.priority != null) patch.priority = asPriority(args.priority)
      if (args.difficulty != null) patch.difficulty = asDifficulty(args.difficulty)
      if (args.dueAt !== undefined) patch.dueAt = args.dueAt == null ? null : Number(args.dueAt)
      if (args.description != null) patch.description = String(args.description)
      if (args.notes != null) patch.notes = String(args.notes)
      if (args.sort != null) patch.sort = Number(args.sort)
      if (args.project !== undefined) {
        patch.project = args.project == null ? null : String(args.project).trim() || null
      }
      if (Array.isArray(args.tags)) patch.tags = args.tags.map(String).filter(Boolean)
      if (args.parentId !== undefined) {
        patch.parentId = args.parentId == null ? null : String(args.parentId) || null
      }
      if (Array.isArray(args.dependsOn)) patch.dependsOn = args.dependsOn.map(String).filter(Boolean)
      if (args.assigneeSessionId !== undefined) {
        const resolved = await resolveAssignee(host, {
          assigneeSessionId: args.assigneeSessionId == null ? null : String(args.assigneeSessionId),
        })
        patch.assignee = resolved.assignee
      } else if (args.assignee !== undefined) {
        patch.assignee = await coerceAssigneeArg(host, args.assignee)
      }
      return present(tasks.update(id, patch))
    },
  })

  host.tools.register({
    name: 'task_report',
    description:
      'agent 在执行任务时主动上报进度。每完成一轮(一个 turn)，调用一次并关联到任务：未搞定传 status=doing，彻底搞定传 status=done。任务执行视图会累积这份报告历史（次数、每次的 turn/状态/说明）。任务当前状态 = 最新一次 report 的 status。',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 id' },
        status: { type: 'string', enum: ['doing', 'done'], description: 'doing=还在做；done=本任务已彻底完成' },
        note: { type: 'string', description: '本轮做了什么/当前进度（可选 payload）' },
      },
      required: ['taskId'],
    },
    execute: async (args) => {
      const id = String(args.taskId ?? '')
      const row = tasks.get(id)
      if (!row) throw new Error('unknown task')
      const status = args.status === 'done' ? 'done' : 'doing'
      const sessionId = currentSessionId()
      // 取当前 session 最新 turn
      let turn: number | null = null
      if (sessionId) {
        const record = host.sessions?.peek(sessionId) ?? (await host.sessions?.get?.(sessionId))
        if (record?.events?.length) {
          for (const ev of record.events) {
            if (ev.type === 'turn/start' || ev.type === 'turn/end') {
              if (typeof ev.turn === 'number') turn = ev.turn
            }
          }
        }
      }
      const report: TaskReport = {
        sessionId: sessionId ?? 'unknown',
        ...(sessionId ? { sessionName: sessionId.slice(0, 8) } : {}),
        turn,
        status,
        ...(typeof args.note === 'string' && args.note.trim() ? { note: String(args.note).trim() } : {}),
        ts: now(),
      }
      tasks.report(id, report)
      // report 同时推进完成状态（doing/done），last-write-wins
      tasks.update(id, { status })
      return present(tasks.get(id)!)
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

  host.tools.register({
    name: 'tasks_update_many',
    description:
      '批量更新任务（一次更新多个任务）。每个 update 含 id 与要更新的字段（title/status/priority/difficulty/description/notes/project/tags/parentId/dependsOn/dueAt），未传字段保持不变。',
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['todo', 'doing', 'done'] },
              priority: { type: 'string', enum: ['low', 'med', 'high'] },
              difficulty: { type: 'string', enum: ['low', 'med', 'high'], description: '难度（low=低, med=中, high=高）' },
              dueAt: { type: ['number', 'null'] },
              description: { type: 'string' },
              notes: { type: 'string' },
              project: { type: ['string', 'null'] },
              tags: { type: 'array', items: { type: 'string' } },
              parentId: { type: ['string', 'null'] },
              dependsOn: { type: 'array', items: { type: 'string' } },
              assigneeSessionId: ASSIGNEE_SESSION_PARAM,
            },
            required: ['id'],
          },
          description: '更新项列表',
        },
      },
      required: ['updates'],
    },
    execute: async (args) => {
      const updates = (Array.isArray(args.updates) ? args.updates : []) as Array<Record<string, unknown>>
      const updated: TaskRow[] = []
      const errors: { id: string; error: string }[] = []
      for (const u of updates) {
        const id = String(u.id ?? '')
        if (!tasks.get(id)) {
          errors.push({ id, error: 'unknown task' })
          continue
        }
        const patch: TaskUpdateInput & { assignee?: TaskActor | null } = {}
        if (u.title != null) patch.title = String(u.title)
        if (u.status != null) patch.status = asStatus(u.status as TaskStatus)
        if (u.priority != null) patch.priority = asPriority(u.priority as TaskPriority)
        if (u.difficulty != null) patch.difficulty = asDifficulty(u.difficulty as TaskDifficulty)
        if (u.dueAt !== undefined) patch.dueAt = u.dueAt == null ? null : Number(u.dueAt)
        if (u.description != null) patch.description = String(u.description)
        if (u.notes != null) patch.notes = String(u.notes)
        if (u.project !== undefined) patch.project = u.project == null ? null : String(u.project).trim() || null
        if (Array.isArray(u.tags)) patch.tags = u.tags.map(String).filter(Boolean)
        if (u.parentId !== undefined) patch.parentId = u.parentId == null ? null : String(u.parentId) || null
        if (Array.isArray(u.dependsOn)) patch.dependsOn = u.dependsOn.map(String).filter(Boolean)
        if (u.assigneeSessionId !== undefined) {
          const resolved = await resolveAssignee(host, {
            assigneeSessionId: u.assigneeSessionId == null ? null : String(u.assigneeSessionId),
          })
          patch.assignee = resolved.assignee
        }
        try {
          updated.push(await present(tasks.update(id, patch)))
        } catch (error) {
          errors.push({ id, error: String(error) })
        }
      }
      return { ok: true, updated, errors }
    },
  })

  host.tools.register({
    name: 'tasks_delete_many',
    description: '批量删除任务（一次可删多个）',
    parameters: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' }, description: '要删除的任务 id 列表' } },
      required: ['ids'],
    },
    execute: (args) => {
      const ids = (Array.isArray(args.ids) ? args.ids : []).map(String)
      let deleted = 0
      const missing: string[] = []
      for (const id of ids) {
        if (tasks.delete(id)) deleted++
        else missing.push(id)
      }
      return { ok: true, deleted, missing }
    },
  })

  host.tools.register({
    name: 'tasks_create_many',
    description: '批量创建任务（一次建多个，各任务可独立设置 项目/标签/父任务/依赖/分配人/状态/优先级/难度/截止）',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['todo', 'doing', 'done'] },
              priority: { type: 'string', enum: ['low', 'med', 'high'] },
              difficulty: { type: 'string', enum: ['low', 'med', 'high'], description: '难度（low=低, med=中, high=高）' },
              assigneeSessionId: ASSIGNEE_SESSION_PARAM,
              project: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              parentId: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
              dueAt: { type: 'number' },
              description: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['title'],
          },
          description: '任务列表',
        },
      },
      required: ['tasks'],
    },
    execute: async (args) => {
      const items = (Array.isArray(args.tasks) ? args.tasks : []) as Array<Record<string, unknown>>
      const creator = await resolveCreator(host)
      const created: TaskRow[] = []
      for (const item of items) {
        let assignee: TaskActor | null = null
        if (item.assigneeSessionId) {
          const resolved = await resolveAssignee(host, { assigneeSessionId: String(item.assigneeSessionId) })
          assignee = resolved.assignee
        } else if (item.assignee !== undefined) {
          assignee = await coerceAssigneeArg(host, item.assignee as unknown)
        }
        const row = tasks.create({
          title: String(item.title ?? ''),
          ...(item.status != null ? { status: asStatus(item.status as TaskStatus) } : {}),
          ...(item.priority != null ? { priority: asPriority(item.priority as TaskPriority) } : {}),
          ...(item.difficulty != null ? { difficulty: asDifficulty(item.difficulty as TaskDifficulty) } : {}),
          ...(item.dueAt != null ? { dueAt: Number(item.dueAt) } : {}),
          ...(item.project != null ? { project: String(item.project) } : {}),
          ...(Array.isArray(item.tags) ? { tags: item.tags.map(String).filter(Boolean) } : {}),
          ...(item.parentId != null ? { parentId: String(item.parentId) || null } : {}),
          ...(Array.isArray(item.dependsOn) ? { dependsOn: item.dependsOn.map(String).filter(Boolean) } : {}),
          ...(item.description != null ? { description: String(item.description) } : {}),
          ...(item.notes != null ? { notes: String(item.notes) } : {}),
          creator,
          assignee,
        })
        created.push(row)
      }
      return { created: presentMany(created) }
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

  // 批量创建
  host.http.route('POST', '/api/tasks/batch', async (route) => {
    try {
      const body = (await route.json()) as { tasks: TaskCreateInput[] }
      const items = Array.isArray(body.tasks) ? body.tasks : []
      const creator = await resolveCreator(host)
      const created: TaskRow[] = []
      for (const input of items) {
        const resolved = await resolveAssignee(host, {
          ...(input.assigneeSessionId !== undefined ? { assigneeSessionId: input.assigneeSessionId } : {}),
          ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
        })
        const row = tasks.create({ ...input, creator, assignee: resolved.touchAssignedAt ? resolved.assignee : input.assignee ?? null })
        created.push(row)
      }
      route.send(201, { tasks: await presentMany(created) })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  // 批量删除
  host.http.route('DELETE', '/api/tasks', async (route) => {
    try {
      const body = (await route.json()) as { ids: string[] }
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      let deleted = 0
      const missing: string[] = []
      for (const id of ids) {
        if (tasks.delete(id)) deleted++
        else missing.push(id)
      }
      route.send(200, { ok: true, deleted, missing })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
}
