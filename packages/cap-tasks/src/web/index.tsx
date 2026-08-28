import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Service, type Context } from 'cordis'
import { bindSnapshot, type Snapshot, type SnapshotService } from '@biu/web-snapshot'

// ---- mascot 静态形状：引用外部 grok-bot 包的同源 geometry（/grok-bot/geometry-data.js 暴露 window.GROK_GEO）----
// 类型取自主应用 grok-bot-types 的 Window.GROK_GEO 声明，tasks-ui 不重复声明。
const MASCOT_GEO_SRC = '/grok-bot/geometry-data.js'
type GrokGeo = NonNullable<Window['GROK_GEO']>
import {
  SignalIcon,
  CpuChipIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  ClipboardDocumentListIcon,
  HashtagIcon,
  ClockIcon,
  CircleStackIcon,
  FlagIcon,
  LockClosedIcon,
  ArrowsPointingOutIcon,
  ArrowPathIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShareIcon,
  ClipboardDocumentCheckIcon,
  BoltIcon,
  PlayIcon,
  CursorArrowRippleIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  TableCellsIcon,
  TagIcon,
  FolderIcon,
  Bars3BottomLeftIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
  PlusIcon,
  ArrowsUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilSquareIcon,
} from '@heroicons/react/16/solid'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node as RFNode,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export type SlotProps = Record<string, unknown> & {
  renderSlot?: (name: string) => unknown
}

type SlotsService = {
  place: (
    slot: string,
    view: unknown,
    opts: { key: string; order: number; props?: () => Record<string, unknown> },
  ) => unknown
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'
export type TaskDifficulty = 'low' | 'med' | 'high'

export type TaskActor = {
  kind: 'user' | 'agent'
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

export type TaskReport = {
  sessionId: string
  sessionName?: string
  turn: number | null
  status: 'doing' | 'done'
  note?: string
  ts: number
  /** 该 report 当回合固化的消耗（task_report 落库，删 session 不丢）；旧数据可能缺失。 */
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; totalTokens: number }
}

export type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  difficulty: TaskDifficulty
  dueAt: number | null
  description: string
  notes: string
  sort: number
  createdAt: number
  updatedAt: number
  creator: TaskActor
  assignee: TaskActor | null
  assignedAt: number | null
  project: string | null
  tags: string[]
  parentId: string | null
  dependsOn?: string[]
  depth: number
  blocked?: boolean
  blockedBy?: string[]
  reports?: TaskReport[]
  execution?: TaskExecution
  /** 本任务持久化消耗（后端 task 表固化，删 session 不丢）；旧数据可能缺失。 */
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; totalTokens: number }
  /** 本任务总消耗 token（= usage.totalTokens）。 */
  totalTokens?: number
  /** 自动触发配置（后端 tasks 表持久化）。source 为 null 时自动触发不开启。 */
  trigger?: {
    enabled: boolean
    cron: string | null
    at: number | null
    on: string[]
    state: 'idle' | 'pending' | 'delivered' | 'done' | 'cancelled'
    lastRun: number | null
  }
  /** 下次触发时间戳（派生）。 */
  nextTriggerAt?: number | null
}

// ==================== 视图系统（Notion 风格）类型 ====================
export type TaskViewMode = 'queue' | 'table' | 'board' | 'graph'
export type TaskViewSortField = 'priority' | 'due' | 'updated' | 'created' | 'status'
export type TaskViewSortDir = 'asc' | 'desc'

export type TaskViewFilter = {
  project: string
  tags: string[]
  time: string // ''=全部 | '1h' | '24h' | '7d' | '30d'
}

export type TaskViewSort = {
  field: TaskViewSortField
  dir: TaskViewSortDir
}

/** 视图配置：呈现方式 + 筛选 + 排序 */
export type TaskViewConfig = {
  mode: TaskViewMode
  filter: TaskViewFilter
  sort: TaskViewSort
}

export const VIEW_MODE_OPTIONS: Array<{ id: TaskViewMode; label: string }> = [
  { id: 'queue', label: '队列' },
  { id: 'table', label: '表格' },
  { id: 'board', label: '看板' },
  { id: 'graph', label: '依赖' },
]

export type TaskView = {
  id: string
  name: string
  config: TaskViewConfig
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export function defaultViewConfig(): TaskViewConfig {
  return {
    mode: 'table',
    filter: { project: '', tags: [], time: '' },
    // 默认排序：状态 → 优先级 → 截止（status 为复合排序）
    sort: { field: 'status', dir: 'asc' },
  }
}

const SORT_FIELD_LABEL: Record<TaskViewSortField, string> = {
  priority: '优先级',
  due: '截止时间',
  updated: '最近更新',
  created: '创建时间',
  status: '状态',
}

const VIEW_MODE_ICON: Record<TaskViewMode, ReactNode> = {
  queue: <ClipboardDocumentCheckIcon aria-hidden className="size-[14px]" />,
  table: <TableCellsIcon aria-hidden className="size-[14px]" />,
  board: <ViewColumnsIcon aria-hidden className="size-[14px]" />,
  graph: <ShareIcon aria-hidden className="size-[14px]" />,
}

const PRIORITY_RANK: Record<TaskPriority, number> = { low: 0, med: 1, high: 2 }
const STATUS_RANK: Record<TaskStatus, number> = { todo: 0, doing: 1, done: 2 }

function dueRank(t: Task): number {
  return t.dueAt && t.dueAt > 0 ? t.dueAt : Number.MAX_SAFE_INTEGER
}

/** 按视图排序配置对任务排序：status 字段为「状态→优先级→截止」复合排序（默认）。 */
export function sortTasks(tasks: Task[], sort: TaskViewSort): Task[] {
  const dir = sort.dir === 'desc' ? -1 : 1
  const cmp = (a: Task, b: Task): number => {
    let c = 0
    const f = sort.field
    if (f === 'status') {
      c = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (c === 0) c = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (c === 0) c = dueRank(a) - dueRank(b)
    } else if (f === 'priority') {
      c = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (c === 0) c = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    } else if (f === 'due') {
      c = dueRank(a) - dueRank(b)
      if (c === 0) c = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    } else if (f === 'updated') {
      c = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
    } else {
      c = (a.createdAt ?? 0) - (b.createdAt ?? 0)
    }
    if (c === 0) c = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
    if (c === 0) c = a.id.localeCompare(b.id)
    return c * dir
  }
  return [...tasks].sort(cmp)
}

const STATUS_META: Array<{ id: TaskStatus; label: string; icon: ReactNode }> = [
  { id: 'todo', label: '待办', icon: <MinusCircleIcon aria-hidden className="size-[14px]" /> },
  { id: 'doing', label: '进行中', icon: <ArrowPathIcon aria-hidden className="size-[14px]" /> },
  { id: 'done', label: '已完成', icon: <CheckCircleIcon aria-hidden className="size-[14px]" /> },
]

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: '低',
  med: '中',
  high: '高',
}

const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  low: '低',
  med: '中',
  high: '高',
}

const LEVEL_NUM: Record<TaskPriority | TaskDifficulty, number> = {
  low: 1,
  med: 2,
  high: 3,
}

const MASCOT_COLOR: Record<string, string> = {
  black: '#2a2a2a',
  brown: '#8b5a2b',
  red: '#d64545',
  orange: '#e07a2f',
  yellow: '#d4a017',
  green: '#3d9a5f',
  cyan: '#2a9f9a',
  blue: '#3b6fd9',
  violet: '#7a5ccf',
  magenta: '#c44f9a',
  gray: '#7a7f87',
}

type AgentOption = {
  id: string
  name: string
  mascot?: TaskActor['mascot']
}

async function fetchAgents(): Promise<AgentOption[]> {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as {
    sessions?: Array<{ id?: string; title?: string; mascot?: TaskActor['mascot'] }>
  }
  if (!Array.isArray(body.sessions)) return []
  return body.sessions
    .filter((s) => typeof s?.id === 'string' && s.id)
    .map((s) => ({
      id: s.id as string,
      name: (s.title && s.title.trim()) ? s.title.trim() : (s.id as string).slice(0, 8),
      ...(s.mascot ? { mascot: s.mascot } : {}),
    }))
}

async function fetchTasks(q = ''): Promise<Task[]> {
  const url = q.trim() ? `/api/tasks?q=${encodeURIComponent(q.trim())}` : '/api/tasks'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { tasks?: Task[] }
  return Array.isArray(body.tasks) ? body.tasks : []
}

async function patchTask(id: string, patch: Record<string, unknown>): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = (await res.json()) as { task?: Task; error?: string }
  if (!res.ok || !body.task) throw new Error(body.error || `HTTP ${res.status}`)
  return body.task
}

async function removeTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

// ---- 视图（/api/task-views）----
async function fetchTaskViews(): Promise<TaskView[]> {
  const res = await fetch('/api/task-views')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { views?: TaskView[] }
  return Array.isArray(body.views) ? body.views : []
}

async function createTaskView(name: string, config: TaskViewConfig): Promise<TaskView> {
  const res = await fetch('/api/task-views', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, config }),
  })
  const body = (await res.json()) as { view?: TaskView; error?: string }
  if (!res.ok || !body.view) throw new Error(body.error || `HTTP ${res.status}`)
  return body.view
}

async function patchTaskView(id: string, patch: { name?: string; config?: TaskViewConfig }): Promise<TaskView> {
  const res = await fetch(`/api/task-views/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = (await res.json()) as { view?: TaskView; error?: string }
  if (!res.ok || !body.view) throw new Error(body.error || `HTTP ${res.status}`)
  return body.view
}

async function deleteTaskView(id: string): Promise<void> {
  const res = await fetch(`/api/task-views/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

export type TurnStats = {
  turn: number
  stepCount: number
  startTs?: number
  endTs?: number
  durationMs?: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

async function fetchTurnStats(sessionId: string, turn: number | null): Promise<TurnStats | null> {
  if (!sessionId || turn == null) return null
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turn-stats?turn=${encodeURIComponent(String(turn))}`)
  if (!res.ok || res.status === 404) return null
  const body = (await res.json()) as Partial<TurnStats>
  if (typeof body?.turn !== 'number') return null
  return {
    turn: body.turn,
    stepCount: body.stepCount ?? 0,
    ...(typeof body.startTs === 'number' ? { startTs: body.startTs } : {}),
    ...(typeof body.endTs === 'number' ? { endTs: body.endTs } : {}),
    ...(typeof body.durationMs === 'number' ? { durationMs: body.durationMs } : {}),
    inputTokens: body.inputTokens ?? 0,
    outputTokens: body.outputTokens ?? 0,
    cacheReadTokens: body.cacheReadTokens ?? 0,
    totalTokens: body.totalTokens ?? (body.inputTokens ?? 0) + (body.outputTokens ?? 0),
  }
}

function formatTurnDuration(durationMs?: number): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return '—'
  const s = Math.round(durationMs / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m${sec}s`
}

function formatTokens(n: number): string {
  if (!n) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** 消耗明细聚合：input/output/cacheRead/total 分开累加，供胶囊(aligned .traj-usage)展示。 */
type SumUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}
const ZERO_USAGE: SumUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, totalTokens: 0 }
function sumUsage(...usages: SumUsage[]): SumUsage {
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let totalTokens = 0
  for (const u of usages) {
    inputTokens += u.inputTokens
    outputTokens += u.outputTokens
    cacheReadTokens += u.cacheReadTokens
    totalTokens += u.totalTokens
  }
  return { inputTokens, outputTokens, cacheReadTokens, totalTokens }
}

function formatWhen(ts: number | null | undefined): string {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDueInput(ts: number | null): string {
  if (!ts) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function useTasks(pollMs = 2500) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await fetchTasks(query)
      setTasks(next)
      setError('')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [refresh, pollMs])

  return { tasks, setTasks, error, loading, refresh, query, setQuery }
}

function useAgents(pollMs = 8000): { agents: AgentOption[]; loading: boolean } {
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loadCount, setLoadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchAgents()
      setAgents(next)
      setLoadCount((c) => c + 1)
    } catch {
      /* keep last list */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [refresh, pollMs])

  return { agents, loading: loadCount === 0 }
}

function TimeLabel({ ts, empty = '—' }: { ts: number | null | undefined; empty?: string }) {
  if (!ts) {
    return (
      <span className="tasks-time is-empty">
        <ClockIcon aria-hidden className="size-[14px]" />
        {empty}
      </span>
    )
  }
  return (
    <span className="tasks-time" title={new Date(ts).toLocaleString()}>
      <ClockIcon aria-hidden className="size-[14px]" />
      {formatWhen(ts)}
    </span>
  )
}

let geoPromise: Promise<void> | null = null
function loadMascotGeo(): Promise<void> {
  if (typeof window === 'undefined' || window.GROK_GEO) return Promise.resolve()
  if (!geoPromise) {
    geoPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-tasks-grok-geo]`)
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('grok geo load error')), { once: true })
        return
      }
      const el = document.createElement('script')
      el.src = MASCOT_GEO_SRC
      el.async = false
      el.dataset.tasksGrokGeo = '1'
      el.addEventListener('load', () => resolve(), { once: true })
      el.addEventListener('error', () => reject(new Error('grok geo load error')), { once: true })
      document.head.appendChild(el)
    }).catch((err) => {
      geoPromise = null
      throw err
    })
  }
  return geoPromise
}

function polyPath(poly: number[][]) {
  if (!poly.length) return ''
  let d = ''
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i]!
    d += `${i === 0 ? 'M' : 'L'}${x} ${y}`
  }
  return `${d}Z`
}

function mascotFaceTransform(Re: number, face: { x?: number; y?: number; sx?: number; sy?: number }) {
  const sx = (face.sx ?? 1) * 1.18
  const sy = face.sy ?? 1
  return `translate(${Re + (face.x ?? 0)} ${Re + (face.y ?? 0)}) scale(${sx} ${sy}) translate(${-Re} ${-Re})`
}

function MascotAvatar({
  shape,
  color,
  eye = 1,
  busy = false,
  size = 16,
}: {
  shape?: string
  color?: string
  eye?: number
  busy?: boolean
  size?: number
}) {
  const [geo, setGeo] = useState<Window['GROK_GEO'] | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadMascotGeo().then(() => {
      if (!cancelled) setGeo(window.GROK_GEO ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const s = (shape || 'blob') as string
  const appr = geo?.shapes?.[s] ?? geo?.shapes?.blob
  const path = appr?.path ?? ''
  const fill = geo?.palette?.[color || 'gray']?.light ?? '#7a7f87'
  const vb = geo?.viewBox ?? { minX: -15, minY: -15, width: 259, height: 259 }
  const eyes = geo?.eyes
  const frame = eyes?.[Math.min(Math.max(0, eye | 0), (eyes?.length ?? 1) - 1)] ?? eyes?.[0]
  const eyePaths =
    frame && frame.length >= 2
      ? ([polyPath(frame[0]!), polyPath(frame[1]!)] as const)
      : null
  const face = appr?.face ?? {}
  const ready = Boolean(path)

  return (
    <span
      className={`tasks-avatar tasks-mascot${busy ? ' is-busy' : ''}`}
      style={{ width: size, height: size, border: 0, background: 'transparent', boxShadow: 'none' }}
      aria-hidden
      title={color ? `${color} ${shape}` : shape}
    >
      {ready ? (
        <svg
          width={size}
          height={size}
          viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
          style={{ width: size, height: size, overflow: 'visible', display: 'block' }}
        >
          <path d={path} fill={fill} />
          {eyePaths ? (
            <g transform={mascotFaceTransform(geo?.Re ?? 114.27, face)}>
              <path d={eyePaths[0]} fill="#fff" />
              <path d={eyePaths[1]} fill="#fff" />
            </g>
          ) : null}
        </svg>
      ) : (
        <span className="tasks-avatar" style={{ background: fill }}>
          <CpuChipIcon style={{ width: size * 0.68, height: size * 0.68 }} />
        </span>
      )}
      {busy ? <span className="tasks-mascot-busy" aria-hidden /> : null}
    </span>
  )
}

function ActorChip({
  actor,
  empty = '未分配',
  avatar = true,
}: {
  actor: TaskActor | null | undefined
  empty?: string
  avatar?: boolean
}) {
  if (!actor) {
    if (!avatar) {
      return <span className="tasks-actor is-empty">{empty}</span>
    }
    return (
      <span className="tasks-actor is-empty">
        <UserIcon aria-hidden className="size-[14px]" />
        {empty}
      </span>
    )
  }
  const color = actor.mascot?.color
    ? (MASCOT_COLOR[actor.mascot.color] ?? '#7a7f87')
    : actor.kind === 'agent'
      ? '#3b6fd9'
      : '#7a7f87'
  const initial = (actor.name || '?').trim().slice(0, 1).toUpperCase()
  return (
    <span
      className="tasks-actor"
      title={actor.sessionId ? `${actor.name} · ${actor.sessionId.slice(0, 8)}` : actor.name}
    >
      {avatar ? (
        actor.kind === 'agent' && actor.mascot ? (
          <MascotAvatar shape={actor.mascot.shape} color={actor.mascot.color} eye={actor.mascot.eye} size={16} />
        ) : (
          <span className="tasks-avatar" style={{ background: color }} aria-hidden>
            {initial}
          </span>
        )
      ) : null}
      <span className="tasks-actor-name">{actor.name}</span>
    </span>
  )
}

function AssigneePicker({
  actor,
  agents,
  loading,
  onPick,
  onClear,
}: {
  actor: TaskActor | null | undefined
  agents: AgentOption[]
  loading: boolean
  onPick: (sessionId: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="tasks-assignee-picker" ref={rootRef}>
      <button
        type="button"
        className="tasks-assignee-trigger"
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
        title="选择分配 Agent"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ActorChip actor={actor} avatar={false} />
      </button>
      {open ? (
        <div className="tasks-assignee-menu" role="listbox">
          <button
            type="button"
            className={`tasks-assignee-option ${!actor ? 'is-selected' : ''}`}
            role="option"
            aria-selected={!actor}
            onClick={() => {
              onClear()
              setOpen(false)
            }}
          >
            <span className="tasks-avatar tasks-avatar-clear" aria-hidden>
              <XMarkIcon className="size-[14px]" />
            </span>
            <span className="tasks-actor-name">未分配</span>
          </button>
          {agents.map((agent) => (
            <button
              type="button"
              key={agent.id}
              className={`tasks-assignee-option ${actor?.sessionId === agent.id ? 'is-selected' : ''}`}
              role="option"
              aria-selected={actor?.sessionId === agent.id}
              onClick={() => {
                if (actor?.sessionId !== agent.id) onPick(agent.id)
                setOpen(false)
              }}
            >
              {agent.mascot ? (
                <MascotAvatar shape={agent.mascot.shape} color={agent.mascot.color} eye={agent.mascot.eye} size={16} />
              ) : (
                <span className="tasks-avatar">
                  <CpuChipIcon className="size-[14px]" />
                </span>
              )}
              <span className="tasks-actor-name">{agent.name}</span>
            </button>
          ))}
          {loading ? (
            <div className="tasks-assignee-loading">
              <ArrowPathIcon className="size-[14px] tasks-spin" aria-hidden />
              加载 Agent…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ReportBadge({ reports }: { reports: TaskReport[] }) {
  const last = reports[reports.length - 1]
  const done = last?.status === 'done'
  // 按时间倒序展示报告历史（最新的在前）
  const history = [...reports].reverse()
  const summary = history
    .map((r) => `${r.status === 'done' ? '✓ 完成' : '… 进行中'}${r.turn != null ? ` T${r.turn}` : ''}${r.note ? ` — ${r.note}` : ''}`)
    .join('\n')
  const tip = `报告 ${reports.length} 次：\n${summary || '(空)'}`
  if (done) {
    return (
      <span className="tasks-exec is-idle" title={tip}>
        <CheckCircleIcon aria-hidden className="size-[14px]" />
        report {reports.length}次 · 已完成
      </span>
    )
  }
  return (
    <span className="tasks-exec is-running" title={tip}>
      <ArrowPathIcon className="size-[14px] tasks-spin" aria-hidden />
      report {reports.length}次 · 进行中
    </span>
  )
}

/** 把 cron 拆成字段数组（支持 5 或 6 字段）。秒级=6字段（秒 分 时 日 月 周）。 */
function parseCronFields(cron: string | null | undefined): (string | null)[] {
  if (!cron) return []
  const parts = cron.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts.map((p) => (p === '*' ? null : p)) : []
}

/* 单个 cron 字段友好解读：星斜杠N → 每N；N-M → N到M；N → 具体值；星 → 每次 */
function cronFieldWord(f: string): string {
  if (f === '*') return '每次'
  const sl = f.match(/^\*\/(\d+)$/)
  if (sl) return `每${sl[1]}`
  const range = f.match(/^(\d+)-(\d+)$/)
  if (range) return `${range[1]}到${range[2]}`
  return f
}

/** cron → 中文友好解读（如 星斜杠5 全星 → 「每5秒」）。 */
function cronPreview(cron: string | null | undefined): string {
  const f = parseCronFields(cron)
  const fieldNames = ['分钟', '小时', '日', '月', '星期']
  if (f.length === 6) {
    // 秒级：秒 + 分 时 日 月 周
    const sec = cronFieldWord(f[0] ?? '*')
    const nonSec = f.slice(1)
    if (nonSec.every((x) => x == null)) return `每${sec}触发一次`
    const rest = nonSec
      .map((x, i) => (x ? `${fieldNames[i]}${cronFieldWord(x)}` : null))
      .filter(Boolean)
      .join('，')
    return `每${sec}，${rest}时触发`
  }
  if (f.length === 5) {
    // 5字段：分 时 日 月 周
    if (f.every((x) => x == null)) return '每分钟触发一次'
    const nonStar = f.map((x, i) => (x ? `${fieldNames[i]}${cronFieldWord(x)}` : null)).filter(Boolean)
    // 常见：每天 hh:mm
    const min = f[0], hour = f[1], day = f[2], month = f[3], week = f[4]
    const isNumeric = (v: string | null) => v != null && /^\d+$/.test(v)
    if (isNumeric(hour) && isNumeric(min) && !day && !month && !week) {
      return `每天${hour}时${min}分触发`
    }
    if (week && !day && !month && !week.includes('/') && (isNumeric(week) || week === '*')) {
      const wk = /^\d$/.test(week) ? Number(week) : 1
      const w = ['日', '一', '二', '三', '四', '五', '六'][wk] ?? week
      return `每周${w}触发`
    }
    return nonStar.length ? `满足 ${nonStar.join('，')} 时触发` : '每分钟触发一次'
  }
  return f.length ? `cron: ${cron}` : '未设置'
}

/** 用「秒/分/时/日/月/周」7 字段合成 cron：若秒为 * 或空则输出 5 字段，否则输出 6 字段（秒级）。非法返回 null。 */
function composeCron(s: string, m: string, h: string, d: string, mo: string, w: string): string | null {
  const day = d === '*' ? '*' : d
  const fields = [m || '*', h || '*', day || '*', mo || '*', w || '*']
  if (s && s !== '*') fields.unshift(s) // 秒级 → 6字段
  return fields.join(' ')
}

const CRON_FIELD_RE = /^(\*|\*\/\d+|\d+|\d+-\d+)$/

/** 校验单个 cron 字段是否合法（支持 星、星斜杠N、N、N-M）。 */
function cronFieldValid(v: string): boolean {
  if (!v) return true
  return CRON_FIELD_RE.test(v.trim())
}

/** 从 cron 推断预设模式；无法识别返回 'custom'。 */
function inferTriggerMode(cron: string): string {
  const f = parseCronFields(cron)
  if (f.length === 6 && f[0] != null && f[0].startsWith('*/') && f.slice(1).every((x) => x == null)) return 'sec'
  if (f.length === 5) {
    const [m, h, d, mo, w] = f
    if (m != null && m.startsWith('*/') && !h && !d && !mo && !w) return 'min'
    if (h != null && h.startsWith('*/') && !m && !d && !mo && !w) return 'hour'
    if (h && m && !d && !mo && !w) return 'day'
    if (w && !m && !h && !d && !mo) return 'week'
  }
  return 'custom'
}

/** 从 cron 派生 7 字段编辑值（无则为空）。 */
function spawnCronFields(cron: string): { s: string; m: string; h: string; d: string; mo: string; w: string } {
  const f = parseCronFields(cron)
  if (f.length === 6) return { s: f[0] ?? '', m: f[1] ?? '', h: f[2] ?? '', d: f[3] ?? '', mo: f[4] ?? '', w: f[5] ?? '' }
  if (f.length === 5) return { s: '', m: f[0] ?? '', h: f[1] ?? '', d: f[2] ?? '', mo: f[3] ?? '', w: f[4] ?? '' }
  return { s: '', m: '', h: '', d: '', mo: '', w: '' }
}

/** 从 cron 的「星斜杠N」中取 N（默认 def）。 */
function inferN(cron: string, def: number): string {
  const f = parseCronFields(cron)
  const first = f.find((x) => x && x.startsWith('*/'))
  if (!first) return String(def)
  const n = first.match(/^\*\/(\d+)$/)?.[1]
  return n || String(def)
}
function inferH(cron: string, def: string | number = '10'): string {
  const f = parseCronFields(cron)
  const idx = f.length === 6 ? 2 : 1 // 小时在秒级为 index2，5字段为 index1
  const v = f[idx]
  if (v == null) return String(def)
  return /^\d+$/.test(v) ? v : String(def)
}
function inferM(cron: string, def: string | number = '0'): string {
  const f = parseCronFields(cron)
  const idx = f.length === 6 ? 1 : 0 // 分钟在秒级为 index1，5字段为 index0
  const v = f[idx]
  if (v == null) return String(def)
  return /^\d+$/.test(v) ? v : String(def)
}
function inferW(cron: string, def = '1'): string {
  const f = parseCronFields(cron)
  const w = f.length === 6 ? f[5] : f[4]
  return w && /^\d$/.test(w) ? w : def
}

/** 预设 → cron 合成并回写；mode 为预设 key。 */
function presetCron(mode: string, fields: { s: string; m: string; h: string; d: string; mo: string; w: string }, n: string, hh: string, mm: string, wk: string): string {
  switch (mode) {
    case 'sec':
      return `*/${n} * * * * *`
    case 'min':
      return `*/${n} * * * *`
    case 'hour':
      return `0 */${n} * * *`
    case 'day':
      return `${mm || '0'} ${hh || '0'} * * *`
    case 'week':
      return `0 0 * * ${wk || '1'}`
    default:
      return composeCron(fields.s, fields.m, fields.h, fields.d, fields.mo, fields.w) ?? ''
  }
}

/** nextTriggerAt 友好化：距今时间差。 */
function timeUntilLabel(ts: number): string {
  const diff = ts - Date.now()
  if (diff <= 0) return '立即'
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}秒后`
  const min = Math.round(s / 60)
  if (min < 60) return `${min}分钟后`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}小时后`
  const day = Math.round(hr / 24)
  return `${day}天后`
}

/** 一句话规则摘要：由 cron/at/on 合成自然语言。 */
function triggerSummary(cron: string, at: number | null | undefined, on: string[]): string {
  const parts: string[] = []
  if (cron) parts.push(cronPreview(cron))
  if (at) {
    const d = new Date(at)
    parts.push(`在 ${d.getMonth() + 1}月${d.getDate()}日 触发`)
  }
  const evMap: Record<string, string> = { 'dep:done': '依赖完成', 'turn:end': '回合结束' }
  for (const e of on) parts.push(evMap[e] ?? e)
  if (!parts.length) return '配置自动化规则'
  return parts.join('，')
}


/** 触发源数量：cron(at 单独) 1 + at 1 + on 各事件。 */
function triggerSourceCount(t: Task['trigger'] | undefined): number {
  if (!t) return 0
  return (t.cron ? 1 : 0) + (t.at ? 1 : 0) + (t.on?.length ?? 0)
}

/** trigger 标记：有触发配置(triggerSourceCount>0)即显示小图标与数量角标。已启用用醒目色，未启用用灰。hover 显示 cron 解读与事件列表。 */
function TriggerMark({ trigger, iconClass = 'size-[14px]' }: { trigger?: Task['trigger']; iconClass?: string }) {
  const count = triggerSourceCount(trigger)
  if (!trigger || count <= 0) return null
  const state = trigger.state ?? 'idle'
  const enabled = !!trigger.enabled
  const cron = trigger.cron ? `（${cronPreview(trigger.cron)}）· ${trigger.cron}` : ''
  const parts = [`自动触发：${state}`, `源×${count}`]
  if (trigger.cron) parts.push(`cron: ${cron}`)
  if (trigger.at) parts.push(`定点: ${new Date(trigger.at).toLocaleString()}`)
  if (trigger.on?.length) parts.push(`事件: ${trigger.on.join(', ')}`)
  if (!enabled) parts.push('（未启用调度）')
  const title = parts.join('｜')
  return (
    <span className={`tasks-trigger-mark ${enabled ? `is-${state}` : 'is-off'}`} title={title} aria-label="自动触发">
      <ClockIcon aria-hidden className={iconClass} />
      <span className="tasks-trigger-mark-state">{enabled ? state : 'off'}</span>
      <span className="tasks-trigger-count">{count}</span>
    </span>
  )
}

/** 自动触发开关：表格行内一键启停 task.trigger.enabled。乐观更新 + 落库确认。 */
function TriggerToggle({ task, onUpdate }: { task: Task; onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void> }) {
  const enabled = !!task.trigger?.enabled
  const count = triggerSourceCount(task.trigger)
  return (
    <button
      type="button"
      className={`tasks-trigger-toggle${enabled ? ' is-on' : ''}`}
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? `自动触发已开启（${task.title}）` : `自动触发已关闭（${task.title}）`}
      title={enabled ? '点击关闭自动触发' : '点击开启自动触发'}
      onClick={(e) => {
        e.stopPropagation()
        void onUpdate(task.id, { trigger: { enabled: !enabled } })
      }}
    >
      <ClockIcon aria-hidden className="size-[14px]" />
      {count > 0 ? <span className="tasks-trigger-count">{count}</span> : null}
    </button>
  )
}


function tagColor(tag: string): string {
  const palette = [
    '#3b6fd9', '#8a5fd3', '#2f9e8f', '#d9822b', '#c94f4f', '#4b8f4b',
    '#b15b8e', '#5b6fb1', '#a07b3f', '#3f8fb1',
  ]
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return palette[h % palette.length]!
}

function TagChips({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null
  return (
    <span className="tasks-tags">
      {tags.map((t) => (
        <span key={t} className="tasks-tag" style={{ '--tag': tagColor(t) } as CSSProperties}>
          {t}
        </span>
      ))}
    </span>
  )
}

function TagMultiSelect({
  tags,
  options,
  onChange,
}: {
  tags: string[]
  options: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const q = draft.trim().toLowerCase()
  const available = useMemo(
    () => options.filter((t) => !tags.includes(t)).sort((a, b) => a.localeCompare(b, 'zh')),
    [options, tags],
  )
  const filtered = useMemo(
    () => (q ? available.filter((t) => t.toLowerCase().includes(q)) : available),
    [available, q],
  )
  const createLabel = draft.trim()
  const canCreate = Boolean(createLabel) && !tags.includes(createLabel) && !options.some((t) => t.toLowerCase() === q)
  const menuItems = canCreate ? [...filtered, `__create__:${createLabel}`] : filtered

  useEffect(() => {
    setHi(0)
  }, [q, tags.join('\0')])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const add = (tag: string) => {
    const next = tag.trim()
    if (!next || tags.includes(next)) return
    onChange([...tags, next])
    setDraft('')
    setHi(0)
  }
  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag))
  const pickHi = () => {
    const item = menuItems[hi]
    if (!item) {
      if (createLabel) add(createLabel)
      return
    }
    add(item.startsWith('__create__:') ? item.slice(10) : item)
  }

  return (
    <div className="tasks-tag-select-wrap" ref={rootRef}>
      <div
        className="tasks-tag-select"
        onClick={() => {
          setOpen(true)
          rootRef.current?.querySelector('input')?.focus()
        }}
      >
        {tags.map((t) => (
          <span key={t} className="tasks-tag" style={{ '--tag': tagColor(t) } as CSSProperties}>
            {t}
            <button type="button" className="tasks-tag-x" title="移除" aria-label={`移除 ${t}`} onClick={(e) => { e.stopPropagation(); remove(t) }}>
              <XMarkIcon aria-hidden className="size-[12px]" />
            </button>
          </span>
        ))}
        <input
          className="tasks-tag-select-input"
          value={draft}
          placeholder={tags.length ? '搜索' : '搜索或添加标签'}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setHi((i) => (menuItems.length ? (i + 1) % menuItems.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setHi((i) => (menuItems.length ? (i - 1 + menuItems.length) % menuItems.length : 0))
            } else if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              pickHi()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              e.preventDefault()
              onChange(tags.slice(0, -1))
            }
          }}
        />
      </div>
      {open ? (
        <div className="tasks-tag-select-menu" role="listbox">
          {filtered.map((t, i) => (
            <button
              type="button"
              key={t}
              role="option"
              className={`tasks-tag-select-option${i === hi ? ' is-active' : ''}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(t)}
            >
              <span className="tasks-tag" style={{ '--tag': tagColor(t) } as CSSProperties}>{t}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className={`tasks-tag-select-option${hi === filtered.length ? ' is-active' : ''}`}
              onMouseEnter={() => setHi(filtered.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(createLabel)}
            >
              添加「{createLabel}」
            </button>
          ) : null}
          {!filtered.length && !canCreate ? (
            <div className="tasks-tag-select-empty">{q ? '无匹配标签' : '暂无可用标签'}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function CellSelect<T extends string>({
  value,
  options,
  onSelect,
  renderValue,
  valueClass,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  onSelect: (v: T) => void
  renderValue: (current: { value: T; label: string; icon?: ReactNode } | undefined) => ReactNode
  valueClass?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div className="tasks-cellselect" ref={ref}>
      <button
        type="button"
        className={`tasks-cellselect-trigger ${valueClass ?? ''}`}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {renderValue(current)}
      </button>
      {open ? (
        <div className="tasks-cellselect-menu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`tasks-cellselect-option ${o.value === value ? 'is-selected' : ''}`}
              onClick={() => {
                onSelect(o.value)
                setOpen(false)
              }}
            >
              {o.icon ?? null}
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ExecBadge({ execution, reports }: { execution?: TaskExecution; reports?: TaskReport[] }) {
  if (reports?.length) return <ReportBadge reports={reports} />
  // 没有任何 task_report 上报：视为"未执行/等在做"，绝不显示已完成
  if (!execution || execution.status === 'unassigned') {
    return (
      <span className="tasks-exec is-muted">
        <MinusCircleIcon aria-hidden className="size-[14px]" />
        未派工
      </span>
    )
  }
  return (
    <span className="tasks-exec is-muted" title="尚无 agent 上报执行进度">
      <SignalIcon aria-hidden className="size-[14px]" />
      未执行
    </span>
  )
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const meta = STATUS_META.find((item) => item.id === status)
  return <span className={`tasks-status-icon is-${status}`}>{meta?.icon}</span>
}

function StatusPill({ status, reportCount, blocked, dueAt, now = Date.now() }: { status: TaskStatus; reportCount: number; blocked?: boolean; dueAt?: number | null; now?: number }) {
  const meta = STATUS_META.find((s) => s.id === status)
  const label = (meta?.label as string | undefined) ?? status
  // 逾期派生：未完成且已过截止时间（比 blocked/普通状态更紧迫，优先展示）
  const overdue = status !== 'done' && !!dueAt && dueAt <= now
  if (overdue) {
    return (
      <span className="tasks-status-pill is-overdue" title={blocked ? '已过截止时间（且被前置任务阻塞）' : '已过截止时间'}>
        <ClockIcon aria-hidden className="size-[14px]" />
        <span className="tasks-status-label">已逾期</span>
      </span>
    )
  }
  // 阻塞是待办的派生：显示"被阻塞"，不加报告计数（还没开工，不可能有 report）
  if (blocked) {
    return (
      <span className="tasks-status-pill is-blocked" title="依赖前置未完成，暂时无法开工">
        <LockIcon aria-hidden className="size-[14px]" />
        <span className="tasks-status-label">被阻塞</span>
      </span>
    )
  }
  return (
    <span className={`tasks-status-pill is-${status}`} title="状态由执行报告驱动，不可手动修改">
      {meta?.icon ?? null}
      <span className="tasks-status-label">{label}</span>
      {reportCount ? (
        <span className="tasks-status-reports" title={`执行报告 ${reportCount} 次`}>
          {reportCount}
        </span>
      ) : null}
    </span>
  )
}
const LockIcon = LockClosedIcon

function ThIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <th>
      <span className="tasks-th">
        {icon}
        {children}
      </span>
    </th>
  )
}

/** Agent 远程任务变更：WS `tasks` 广播。view-switch 切视图；view-changed 同步筛选/模式；其余刷新任务列表。 */
class TasksViewService extends Service {
  private switchListeners = new Set<(viewId: string, ts?: number) => void>()
  private changeListeners = new Set<() => void>()
  private viewChangedListeners = new Set<(viewId: string) => void>()

  constructor(ctx: Context) {
    super(ctx, 'tasksView')
  }

  subscribeViewSwitch = (fn: (viewId: string, ts?: number) => void) => {
    this.switchListeners.add(fn)
    return () => {
      this.switchListeners.delete(fn)
    }
  }

  subscribeChange = (fn: () => void) => {
    this.changeListeners.add(fn)
    return () => {
      this.changeListeners.delete(fn)
    }
  }

  subscribeViewChanged = (fn: (viewId: string) => void) => {
    this.viewChangedListeners.add(fn)
    return () => {
      this.viewChangedListeners.delete(fn)
    }
  }

  handleViewSwitch(viewId: string, ts?: number) {
    for (const fn of this.switchListeners) fn(viewId, ts)
  }

  handleViewChanged(viewId: string) {
    for (const fn of this.viewChangedListeners) fn(viewId)
  }

  handleChange() {
    for (const fn of this.changeListeners) fn()
  }

  handleTasksEvent(payload: unknown) {
    const p = payload as { type?: string; viewId?: string; ts?: number } | undefined
    if (p?.type === 'view-switch' && p.viewId) {
      this.handleViewSwitch(p.viewId, p.ts)
    } else if (p?.type === 'view-changed' && p.viewId) {
      this.handleViewChanged(p.viewId)
    }
    this.handleChange()
  }
}

function TasksWorkspace({ compact = false, tasksView }: { compact?: boolean; tasksView?: TasksViewService }) {
  const { tasks, setTasks, error, loading, refresh, query, setQuery } = useTasks(compact ? 3000 : 2500)
  const { agents, loading: agentsLoading } = useAgents()
  const [detailId, setDetailId] = useState<string | null>(null)

  // ---- 视图系统（Notion 风格）：视图列表 + 当前视图 + 当前配置 ----
  const [views, setViews] = useState<TaskView[]>([])
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [config, setConfig] = useState<TaskViewConfig>(defaultViewConfig)
  // hydrated：视图列表加载完成并已恢复当前视图配置后才允许自动保存
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchTaskViews()
        if (cancelled) return
        setViews(list)
        let savedId: string | null = null
        try {
          savedId = window.localStorage.getItem('tasks.activeViewId')
        } catch {
          /* ignore */
        }
        const target = (savedId ? list.find((v) => v.id === savedId) : undefined) ?? list[0] ?? null
        setActiveViewId(target?.id ?? null)
        if (target) setConfig(target.config)
      } catch {
        /* 服务不可用：留在默认配置 */
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeView = useMemo(() => views.find((v) => v.id === activeViewId) ?? null, [views, activeViewId])
  const mode = config.mode
  const { project: projectFilter, tags: tagFilter, time: timeFilter } = config.filter
  const sort = config.sort
  const filterActive = Boolean(projectFilter || tagFilter.length || timeFilter)
  // 排序非默认（字段≠status 或 非升序）时，排序按钮右上角显示圆点（与筛选按钮一致）
  const sortCustom = sort.field !== 'status' || sort.dir !== 'asc'

  // 自动保存：配置变化（mode / 筛选 / 排序）→ 防抖 PATCH 回当前视图
  const configKey = JSON.stringify(config)
  useEffect(() => {
    if (!hydrated || !activeView) return
    if (configKey === JSON.stringify(activeView.config)) return
    const timer = window.setTimeout(() => {
      patchTaskView(activeView.id, { config })
        .then((updated) => {
          setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
        })
        .catch(() => {
          /* 静默失败：下次配置变化时重试 */
        })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [configKey, config, activeView, hydrated])

  const switchView = async (id: string) => {
    let v: TaskView | undefined = views.find((x) => x.id === id)
    if (!v) {
      try {
        const list = await fetchTaskViews()
        setViews(list)
        v = list.find((x) => x.id === id)
      } catch {
        /* 服务不可用：保持现状 */
      }
    }
    if (!v) return
    setActiveViewId(id)
    setConfig(v.config)
    try {
      window.localStorage.setItem('tasks.activeViewId', id)
    } catch {
      /* ignore */
    }
  }

  const activeViewIdRef = useRef(activeViewId)
  activeViewIdRef.current = activeViewId

  // Agent 远程：tasks_update 刷新列表；tasks_view_* 同步当前筛选/模式
  useEffect(() => {
    if (!tasksView) return
    const offSwitch = tasksView.subscribeViewSwitch((viewId) => {
      void switchView(viewId)
    })
    const offChange = tasksView.subscribeChange(() => {
      void refresh()
    })
    const offView = tasksView.subscribeViewChanged((viewId) => {
      void (async () => {
        try {
          const list = await fetchTaskViews()
          setViews(list)
          const currentId = activeViewIdRef.current
          const updated = list.find((v) => v.id === viewId)
          if (updated && currentId === viewId) {
            setConfig(updated.config)
            return
          }
          if (!updated && currentId === viewId) {
            const fallback = list[0]
            setActiveViewId(fallback?.id ?? null)
            if (fallback) setConfig(fallback.config)
          }
        } catch {
          /* 服务不可用 */
        }
      })()
    })
    return () => {
      offSwitch()
      offChange()
      offView()
    }
  }, [tasksView, views, hydrated, refresh])

  // ---- 视图对话框（自绘模态：另存为 / 重命名 / 删除确认，不使用系统 prompt/confirm/alert） ----
  type ViewDlgState =
    | { kind: 'saveAs' }
    | { kind: 'rename'; view: TaskView }
    | { kind: 'delete'; view: TaskView }
  const [dlg, setDlg] = useState<ViewDlgState | null>(null)
  const dlgInputRef = useRef<HTMLInputElement>(null)
  const [dlgName, setDlgName] = useState('')
  const [dlgBusy, setDlgBusy] = useState(false)
  const [dlgError, setDlgError] = useState('')

  const openDlg = (next: ViewDlgState) => {
    setDlgError('')
    setDlgBusy(false)
    if (next.kind === 'saveAs') {
      setDlgName(activeView ? `${activeView.name} 副本` : '')
    } else if (next.kind === 'rename') {
      setDlgName(next.view.name)
    }
    setDlg(next)
  }

  useEffect(() => {
    if (!dlg) return
    // 打开后聚焦输入框；Esc 取消
    const id = window.setTimeout(() => dlgInputRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setDlg(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [dlg])

  const submitDlg = async () => {
    if (!dlg || dlgBusy) return
    if (dlg.kind === 'delete') {
      setDlgBusy(true)
      try {
        await deleteTaskView(dlg.view.id)
        const rest = views.filter((x) => x.id !== dlg.view.id)
        setViews(rest)
        if (activeViewId === dlg.view.id) {
          const next = rest[0] ?? null
          setActiveViewId(next?.id ?? null)
          if (next) setConfig(next.config)
        }
        setDlg(null)
      } catch (err) {
        setDlgBusy(false)
        setDlgError(String(err))
      }
      return
    }
    const name = dlgName.trim()
    if (!name) {
      setDlgError('请输入视图名称')
      return
    }
    setDlgBusy(true)
    try {
      if (dlg.kind === 'saveAs') {
        const v = await createTaskView(name, config)
        setViews((prev) => [...prev, v])
        setActiveViewId(v.id)
        setConfig(v.config)
        try {
          window.localStorage.setItem('tasks.activeViewId', v.id)
        } catch {
          /* ignore */
        }
      } else {
        if (name === dlg.view.name) {
          setDlg(null)
          return
        }
        const updated = await patchTaskView(dlg.view.id, { name })
        setViews((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      }
      setDlg(null)
    } catch (err) {
      setDlgBusy(false)
      setDlgError(String(err))
    }
  }

  // ---- 筛选菜单 ----
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  // ---- 视图下拉菜单 ----
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  // ---- 排序下拉菜单 ----
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  // 点击外部关闭所有弹出菜单
  useEffect(() => {
    if (!viewMenuOpen && !sortMenuOpen && !filterOpen && !modeMenuOpen) return
    const onDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (
        viewMenuRef.current?.contains(node) ||
        sortMenuRef.current?.contains(node) ||
        filterRef.current?.contains(node) ||
        modeMenuRef.current?.contains(node)
      ) {
        return
      }
      setViewMenuOpen(false)
      setSortMenuOpen(false)
      setFilterOpen(false)
      setModeMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [viewMenuOpen, sortMenuOpen, filterOpen, modeMenuOpen])

  // 项目 / 标签筛选
  const allProjects = useMemo(() => {
    return [...new Set(tasks.map((t) => t.project).filter((p): p is string => Boolean(p)))].sort()
  }, [tasks])
  const allTags = useMemo(() => {
    return [...new Set(tasks.flatMap((t) => t.tags))].sort()
  }, [tasks])

  // 配置更新助手：改筛选 / 改排序 / 改呈现方式（均绑定当前视图并自动保存）
  const patchConfig = (patch: Partial<TaskViewConfig>) => setConfig((c) => ({ ...c, ...patch }))
  const patchFilter = (patch: Partial<TaskViewFilter>) => setConfig((c) => ({ ...c, filter: { ...c.filter, ...patch } }))
  const setDisplayMode = (next: TaskViewMode) => {
    if (next === mode) return
    patchConfig({ mode: next })
  }

  // 排序字段点击循环：未选中 → 升序 → 降序 → 还原（默认：状态升序）
  const cycleSort = (field: TaskViewSortField) => {
    if (sort.field !== field) {
      patchConfig({ sort: { field, dir: 'asc' } })
    } else if (sort.dir === 'asc') {
      patchConfig({ sort: { field, dir: 'desc' } })
    } else {
      patchConfig({ sort: { field: 'status', dir: 'asc' } })
    }
  }

  const filteredTasks = useMemo(() => {
    if (!projectFilter && !tagFilter.length && !timeFilter) return tasks
    const ageMs = timeFilter === '1h' ? 3600e3 : timeFilter === '24h' ? 86400e3 : timeFilter === '7d' ? 7 * 86400e3 : timeFilter === '30d' ? 30 * 86400e3 : 0
    const cutoff = ageMs ? Date.now() - ageMs : 0
    return tasks.filter((t) => {
      if (projectFilter && t.project !== projectFilter) return false
      if (tagFilter.length && !(t.tags ?? []).some((tag) => tagFilter.includes(tag))) return false
      if (cutoff) {
        const recent = Math.max(t.createdAt ?? 0, t.updatedAt ?? 0)
        if (!recent || recent < cutoff) return false
      }
      return true
    })
  }, [tasks, projectFilter, tagFilter, timeFilter])

  // 排序：作用于筛选结果之上
  const sortedTasks = useMemo(() => sortTasks(filteredTasks, sort), [filteredTasks, sort])

  const detailTask = useMemo(
    () => (detailId ? tasks.find((item) => item.id === detailId) ?? null : null),
    [detailId, tasks],
  )

  const detailNavIds = useMemo(() => {
    if (mode === 'queue') return buildQueueRows(sortedTasks).map((t) => t.id)
    if (mode === 'board') {
      const cols: BoardKey[] = ['overdue', 'todo', 'blocked', 'doing', 'done']
      const colOf = (t: Task): BoardKey => (isOverdue(t) ? 'overdue' : t.blocked ? 'blocked' : t.status)
      return cols.flatMap((c) => sortedTasks.filter((t) => colOf(t) === c).map((t) => t.id))
    }
    return buildTreeRows(sortedTasks, {}).map((t) => t.id)
  }, [mode, sortedTasks])

  const detailNav = useMemo(() => {
    const ids = detailNavIds
    const idx = detailId ? ids.indexOf(detailId) : -1
    const n = ids.length
    if (idx < 0 || n < 2) return { prev: null as string | null, next: null as string | null }
    return { prev: ids[(idx - 1 + n) % n]!, next: ids[(idx + 1) % n]! }
  }, [detailNavIds, detailId])

  useEffect(() => {
    if (!detailId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId])

  async function onUpdate(id: string, patch: Record<string, unknown>) {
    // trigger 为字段级合并（局部更新），避免乐观替换丢失 cron/on/state 等既有字段
    setTasks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const merged = { ...item, ...patch } as Task
        if (patch.trigger && item.trigger) {
          merged.trigger = { ...item.trigger, ...(patch.trigger as object) }
        }
        return merged
      }),
    )
    try {
      const task = await patchTask(id, patch)
      setTasks((prev) => prev.map((item) => (item.id === id ? task : item)))
    } catch {
      void refresh()
    }
  }

  async function onDelete(id: string) {
    setTasks((prev) => prev.filter((item) => item.id !== id))
    if (detailId === id) setDetailId(null)
    try {
      await removeTask(id)
    } catch {
      void refresh()
    }
  }

  return (
    <div className={`tasks-root${compact ? ' is-compact' : ''}${detailTask ? ' has-detail' : ''}`}>
      <div className="tasks-main">
        <div className="tasks-toolbar">
          <div className="tasks-toolbar-left">
          {/* 视图下拉（Notion 数据库左上角风格） */}
          <div className="tasks-viewdd-wrap" ref={viewMenuRef}>
            <button
              type="button"
              className={`tasks-viewdd-btn${viewMenuOpen ? ' is-active' : ''}`}
              aria-label="切换视图"
              aria-haspopup="menu"
              aria-expanded={viewMenuOpen}
              onClick={() => setViewMenuOpen((v) => !v)}
            >
              <Squares2X2Icon aria-hidden className="size-[14px]" />
              <span className="tasks-viewdd-name">{activeView?.name ?? '未保存'}</span>
              <ChevronDownIcon aria-hidden className="size-[14px]" />
            </button>
            {viewMenuOpen ? (
              <div className="tasks-viewdd-menu" role="menu">
                <div className="tasks-viewdd-head">视图</div>
                {views.length === 0 ? (
                  <div className="tasks-viewdd-empty">还没有已保存的视图</div>
                ) : null}
                {views.map((v) => (
                  <div key={v.id} className={`tasks-viewdd-item${v.id === activeViewId ? ' is-active' : ''}`}>
                    <button
                      type="button"
                      className="tasks-viewdd-item-main"
                      role="menuitemradio"
                      aria-checked={v.id === activeViewId}
                      onClick={() => { switchView(v.id); setViewMenuOpen(false) }}
                    >
                      <span className="tasks-viewdd-item-name">{v.name}</span>
                      {v.id === activeViewId ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-viewdd-check" /> : null}
                    </button>
                    <span className="tasks-viewdd-item-actions">
                      <button type="button" className="tasks-viewdd-act" title="重命名" onClick={() => openDlg({ kind: 'rename', view: v })}>
                        <PencilSquareIcon aria-hidden className="size-[14px]" />
                      </button>
                      <button type="button" className="tasks-viewdd-act is-danger" title="删除" onClick={() => openDlg({ kind: 'delete', view: v })}>
                        <TrashIcon aria-hidden className="size-[14px]" />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="tasks-viewdd-foot">
                  <button type="button" className="tasks-viewdd-saveas" onClick={() => { setViewMenuOpen(false); openDlg({ kind: 'saveAs' }) }}>
                    <PlusIcon aria-hidden className="size-[14px]" />
                    另存为视图
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          </div>

          <div className="tasks-toolbar-right">
          <label className="tasks-search-wrap">
            <MagnifyingGlassIcon aria-hidden className="size-[14px]" />
            <input
              className="tasks-search"
              value={query}
              placeholder="搜索标题 / 人 / 描述"
              aria-label="搜索任务"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="tasks-sort-wrap" ref={modeMenuRef}>
            <button
              type="button"
              className={`tasks-sort-btn${modeMenuOpen ? ' is-active' : ''}`}
              aria-label="查看模式"
              title={`模式：${VIEW_MODE_OPTIONS.find((opt) => opt.id === mode)?.label ?? mode}`}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              onClick={() => setModeMenuOpen((v) => !v)}
            >
              {VIEW_MODE_ICON[mode]}
            </button>
            {modeMenuOpen ? (
              <div className="tasks-sort-menu" role="menu">
                <div className="tasks-sort-head">查看模式</div>
                {VIEW_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`tasks-sort-item${mode === opt.id ? ' is-active' : ''}`}
                    role="menuitemradio"
                    aria-checked={mode === opt.id}
                    onClick={() => {
                      setDisplayMode(opt.id)
                      setModeMenuOpen(false)
                    }}
                  >
                    <span className="tasks-sort-item-label">
                      <span className="tasks-mode-item-ico">{VIEW_MODE_ICON[opt.id]}</span>
                      {opt.label}
                    </span>
                    {mode === opt.id ? <CheckCircleIcon aria-hidden className="size-[14px] tasks-sort-item-icon is-on" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {/* 排序按钮（仅图标：字段+升降序在菜单内，位于筛选按钮左侧） */}
          <div className="tasks-sort-wrap" ref={sortMenuRef}>
            <button
              type="button"
              className={`tasks-sort-btn${sortMenuOpen ? ' is-active' : ''}${sortCustom ? ' is-custom' : ''}`}
              aria-label="排序"
              title={`排序：${SORT_FIELD_LABEL[sort.field]}${sort.dir === 'asc' ? ' ↑' : ' ↓'}`}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
              onClick={() => setSortMenuOpen((v) => !v)}
            >
              <ArrowsUpDownIcon aria-hidden className="size-[14px]" />
              {sortCustom ? <span className="tasks-sort-dot" aria-hidden /> : null}
            </button>
            {sortMenuOpen ? (
              <div className="tasks-sort-menu" role="menu">
                <div className="tasks-sort-head">排序依据</div>
                {(
                  [
                    ['status', '状态'],
                    ['priority', '优先级'],
                    ['due', '截止时间'],
                    ['updated', '最近更新'],
                    ['created', '创建时间'],
                  ] as const
                ).map(([field, label]) => {
                  const isCurrent = sort.field === field
                  const stateIcon = isCurrent
                    ? sort.dir === 'asc'
                      ? <ArrowUpIcon aria-hidden className="size-[14px]" />
                      : <ArrowDownIcon aria-hidden className="size-[14px]" />
                    : null
                  return (
                    <button
                      key={field}
                      type="button"
                      className={`tasks-sort-item${isCurrent ? ' is-active' : ''}`}
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      title={isCurrent ? (sort.dir === 'asc' ? '当前升序，点击切为降序' : '当前降序，点击还原默认') : `按「${label}」升序排序`}
                      onClick={() => cycleSort(field)}
                    >
                      <span className="tasks-sort-item-label">{label}</span>
                      <span className={`tasks-sort-item-icon${isCurrent ? ' is-on' : ''}`}>{stateIcon}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
          <div className="tasks-filter-btn-wrap" ref={filterRef}>
            <button
              type="button"
              className={`tasks-refresh tasks-rbar-btn${filterOpen ? ' is-active' : ''}${filterActive ? ' is-active' : ''}`}
              aria-label="筛选任务"
              title="筛选"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <AdjustmentsHorizontalIcon aria-hidden className="size-[14px]" />
              {filterActive ? <span className="tasks-filter-dot" aria-hidden /> : null}
            </button>
            {filterOpen ? (
              <div className="tasks-filter-menu" role="menu">
                <label className="tasks-filter-menu-label">
                  <span>按项目</span>
                  <select
                    className="tasks-filter"
                    aria-label="按项目筛选"
                    value={projectFilter}
                    onChange={(e) => patchFilter({ project: e.target.value })}
                  >
                    <option value="">全部项目</option>
                    {allProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tasks-filter-menu-label">
                  <span>按标签</span>
                  <select
                    className="tasks-filter"
                    aria-label="按标签筛选"
                    value={tagFilter[0] ?? ''}
                    onChange={(e) => patchFilter({ tags: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">全部标签</option>
                    {allTags.map((t) => (
                      <option key={t} value={t}>
                        #{t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tasks-filter-menu-label">
                  <span>按时间</span>
                  <select
                    className="tasks-filter"
                    aria-label="按时间筛选"
                    value={timeFilter}
                    onChange={(e) => patchFilter({ time: e.target.value })}
                  >
                    <option value="">全部时间</option>
                    <option value="1h">最近 1 小时</option>
                    <option value="24h">最近 1 天</option>
                    <option value="7d">最近 7 天</option>
                    <option value="30d">最近 30 天</option>
                  </select>
                </label>
                {filterActive ? (
                  <button
                    type="button"
                    className="tasks-filter-clear"
                    onClick={() => patchFilter({ project: '', tags: [], time: '' })}
                  >
                    清除筛选
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="tasks-refresh"
            aria-label="刷新任务"
            title="刷新"
            onClick={refresh}
          >
            <ArrowPathIcon aria-hidden className="size-[14px]" />
          </button>
          </div>
        </div>

        {error ? <div className="tasks-error">{error}</div> : null}
        {loading && tasks.length === 0 ? <div className="tasks-empty">加载中…</div> : null}

        {mode === 'queue' ? (
          <TasksQueue
            tasks={sortedTasks}
            detailId={detailId}
            onOpenDetail={setDetailId}
            onUpdate={onUpdate}
            compact={compact}
            agents={agents}
            agentsLoading={agentsLoading}
          />
        ) : mode === 'board' ? (
          <TasksBoard
            tasks={sortedTasks}
            detailId={detailId}
            onOpenDetail={setDetailId}
            onUpdate={onUpdate}
            compact={compact}
            agents={agents}
            agentsLoading={agentsLoading}
          />
        ) : mode === 'graph' ? (
          <TasksGraph tasks={sortedTasks} onOpenDetail={setDetailId} detailId={detailId} compact={compact} />
        ) : (
          <TasksTable
            tasks={sortedTasks}
            detailId={detailId}
            onOpenDetail={setDetailId}
            onUpdate={onUpdate}
            onDelete={onDelete}
            compact={compact}
            agents={agents}
            agentsLoading={agentsLoading}
          />
        )}
      </div>

      {detailTask ? (
        <div
          className="tasks-modal-backdrop"
          onClick={() => setDetailId(null)}
          onKeyDown={undefined}
        >
        <TaskDetailPanel
          task={detailTask}
          onClose={() => setDetailId(null)}
          onPrev={detailNav.prev ? () => setDetailId(detailNav.prev) : undefined}
          onNext={detailNav.next ? () => setDetailId(detailNav.next) : undefined}
          onUpdate={onUpdate}
          onDelete={onDelete}
          agents={agents}
          agentsLoading={agentsLoading}
          allTasks={tasks}
        />
        </div>
      ) : null}

      {/* 视图对话框：另存为 / 重命名 / 删除确认（自绘，替代系统 prompt/confirm/alert） */}
      {dlg ? (
        <div
          className="tasks-viewdlg-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !dlgBusy) setDlg(null) }}
        >
          <div className="tasks-viewdlg" role="dialog" aria-modal="true" aria-label={dlg.kind === 'delete' ? '删除视图' : dlg.kind === 'rename' ? '重命名视图' : '另存为视图'}>
            <div className="tasks-viewdlg-title">
              {dlg.kind === 'delete' ? '删除视图' : dlg.kind === 'rename' ? '重命名视图' : '另存为视图'}
            </div>
            {dlg.kind === 'delete' ? (
              <div className="tasks-viewdlg-body">
                <p>确定删除视图「{dlg.view.name}」？删除后不可恢复。</p>
              </div>
            ) : (
              <div className="tasks-viewdlg-body">
                <input
                  ref={dlgInputRef}
                  className="tasks-viewdlg-input"
                  value={dlgName}
                  placeholder="视图名称"
                  maxLength={80}
                  disabled={dlgBusy}
                  onChange={(e) => { setDlgName(e.target.value); if (dlgError) setDlgError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submitDlg() }}
                />
                {dlgError ? <div className="tasks-viewdlg-error">{dlgError}</div> : null}
              </div>
            )}
            <div className="tasks-viewdlg-actions">
              <button
                type="button"
                className="tasks-viewdlg-cancel"
                disabled={dlgBusy}
                onClick={() => setDlg(null)}
              >
                取消
              </button>
              <button
                type="button"
                className={`tasks-viewdlg-ok${dlg.kind === 'delete' ? ' is-danger' : ''}`}
                disabled={dlgBusy}
                onClick={() => void submitDlg()}
              >
                {dlgBusy ? '处理中…' : dlg.kind === 'delete' ? '删除' : dlg.kind === 'rename' ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// 树的 DFS 排序：父在前、子随其后；collapsed 决定是否深入展开子树（默认全展开）
export function buildTreeRows(tasks: Task[], collapsed: Record<string, boolean>): Task[] {
  const children = new Map<string, Task[]>()
  for (const t of tasks) {
    const p = t.parentId ?? ''
    if (!children.has(p)) children.set(p, [])
    children.get(p)!.push(t)
  }
  const out: Task[] = []
  const visit = (parentKey: string) => {
    // 同级兄弟保持传入顺序（已是排序后的顺序），树结构不变
    const list = children.get(parentKey) ?? []
    for (const t of list) {
      out.push(t)
      if (!collapsed[t.id]) visit(t.id)
    }
  }
  visit('')
  return out
}

// 逾期判定：未完成且已过截止时间
function isOverdue(t: Task, now = Date.now()): boolean {
  return t.status !== 'done' && !!t.dueAt && t.dueAt <= now
}

// 队列视图分组键：已逾期 → 进行中 → 待办 → 阻塞 → 已完成
type QueueKey = 'overdue' | 'doing' | 'todo' | 'blocked' | 'done'
const QUEUE_GROUPS: { key: QueueKey; label: string; icon: ReactNode }[] = [
  { key: 'overdue', label: '已逾期', icon: <ClockIcon aria-hidden className="size-[14px]" /> },
  { key: 'doing', label: '进行中', icon: <ArrowPathIcon aria-hidden className="size-[14px]" /> },
  { key: 'todo', label: '待办', icon: <MinusCircleIcon aria-hidden className="size-[14px]" /> },
  { key: 'blocked', label: '阻塞', icon: <LockClosedIcon aria-hidden className="size-[14px]" /> },
  { key: 'done', label: '已完成', icon: <CheckCircleIcon aria-hidden className="size-[14px]" /> },
]

/**
 * 叶节点判定：任务无任何子任务（不在任何任务的 parentId 中）即为叶节点。
 * 队列视图仅展示叶节点，并按状态分组排序。
 * 时间排序：同一状态内用 scheduledAt/dueAt (若有) 优先，否则回退 createdAt（无稳定 dueAt 的用创建时间保证稳定可辨序）。
 */
export function buildQueueRows(tasks: Task[]): Task[] {
  const childSet = new Set<string>()
  for (const t of tasks) if (t.parentId) childSet.add(t.parentId)
  const leafs = tasks.filter((t) => !childSet.has(t.id))
  const colOf = (t: Task): QueueKey => (isOverdue(t) ? 'overdue' : t.blocked ? 'blocked' : (t.status === 'done' ? 'done' : (t.status === 'doing' ? 'doing' : 'todo')))
  const group = new Map<QueueKey, Task[]>()
  for (const t of leafs) {
    const k = colOf(t)
    if (!group.has(k)) group.set(k, [])
    group.get(k)!.push(t)
  }
  const out: Task[] = []
  for (const { key } of QUEUE_GROUPS) {
    // 组内保持传入顺序（已是按视图排序后的顺序），仅按状态分组
    out.push(...(group.get(key) ?? []))
  }
  return out
}

type BoardKey = 'overdue' | 'todo' | 'blocked' | 'doing' | 'done'
const BOARD_COLUMNS: { key: BoardKey; label: string; icon: ReactNode }[] = [
  { key: 'overdue', label: '已逾期', icon: <ClockIcon aria-hidden className="size-[14px]" /> },
  { key: 'todo', label: '待办', icon: <MinusCircleIcon aria-hidden className="size-[14px]" /> },
  { key: 'blocked', label: '阻塞', icon: <LockClosedIcon aria-hidden className="size-[14px]" /> },
  { key: 'doing', label: '进行中', icon: <ArrowPathIcon aria-hidden className="size-[14px]" /> },
  { key: 'done', label: '完成', icon: <CheckCircleIcon aria-hidden className="size-[14px]" /> },
]

function TasksBoard({
  tasks,
  detailId,
  onOpenDetail,
  onUpdate,
  compact,
}: {
  tasks: Task[]
  detailId: string | null
  onOpenDetail: (id: string) => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  compact: boolean
  agents: AgentOption[]
  agentsLoading: boolean
}) {
  const byStatus = useMemo(() => {
    const map: Record<string, Task[]> = { overdue: [], todo: [], blocked: [], doing: [], done: [] }
    for (const t of tasks) {
      // 逾期优先；阻塞是待办的派生：todo + blocked → 阻塞列
      const key = isOverdue(t) ? 'overdue' : t.blocked ? 'blocked' : t.status
      ;(map[key] ??= []).push(t)
    }
    return map
  }, [tasks])

  return (
    <div className={`tasks-board${compact ? ' is-compact' : ''}`}>
      {BOARD_COLUMNS.map((col) => (
        <section key={col.key} className={`tasks-board-col is-${col.key}`}>
          <header className="tasks-board-colhead">
            {col.icon}
            <span>{col.label}</span>
            <span className="tasks-board-count">{byStatus[col.key]?.length ?? 0}</span>
          </header>
          <div className="tasks-board-list">
            {byStatus[col.key]?.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`tasks-card${detailId === task.id ? ' is-active' : ''} is-p-${task.priority}`}
                data-biu-kind="task"
                data-biu-id={task.id}
                data-biu-label={task.title}
                onClick={() => onOpenDetail(task.id)}
              >
                <div className="tasks-card-title">
                  <span className="tasks-card-titletext">{task.title}</span>
                  <TriggerMark trigger={task.trigger} iconClass="size-[14px]" />
                  {task.blocked ? (
                    <span className="tasks-card-blocked" title="被依赖任务阻塞，无法开工"><LockClosedIcon aria-hidden className="size-[14px]" /></span>
                  ) : null}
                </div>
                {task.description ? (
                  <div className="tasks-card-desc" title={task.description}>
                    {task.description}
                  </div>
                ) : null}
                <div className="tasks-card-meta">
                  {task.assignee && task.assignee.kind === 'agent' && task.assignee.mascot ? (
                    <MascotAvatar shape={task.assignee.mascot.shape} color={task.assignee.mascot.color} eye={task.assignee.mascot.eye} busy={task.status === 'doing'} size={14} />
                  ) : null}
                  <span className="tasks-card-assignee">{task.assignee?.name ?? '未分配'}</span>
                  {task.dueAt ? (
                    <span className={`tasks-card-due${task.dueAt < Date.now() && task.status !== 'done' ? ' is-overdue' : ''}`}>
                      {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <div className="tasks-card-badges">
                  <span className="tasks-card-badge is-reports" title={`报告 ${task.reports?.length ?? 0} 次`}>
                    <ClipboardDocumentListIcon aria-hidden className="size-[14px]" />
                    {task.reports?.length ?? 0}
                  </span>
                  <span className={`tasks-card-badge is-p-${task.priority}`} title={`优先级：${PRIORITY_LABEL[task.priority]}`}>
                    <FlagIcon aria-hidden className="size-[14px]" />
                    {LEVEL_NUM[task.priority]}
                  </span>
                  <span className={`tasks-card-badge is-d-${task.difficulty}`} title={`难度：${DIFFICULTY_LABEL[task.difficulty]}`}>
                    <ChartBarIcon aria-hidden className="size-[14px]" />
                    {LEVEL_NUM[task.difficulty]}
                  </span>
                </div>
                {(task.project || task.tags?.length) ? (
                  <div className="tasks-card-tags">
                    {task.project ? <span className="tasks-proj-tag">{task.project}</span> : null}
                    <TagChips tags={task.tags} />
                  </div>
                ) : null}
              </button>
            ))}
            {!byStatus[col.key]?.length ? <div className="tasks-board-empty">空</div> : null}
          </div>
        </section>
      ))}
    </div>
  )
}

// ---- DAG 依赖图视图（ReactFlow）----
const GNODE_W = 248
const GNODE_H = 112
const GLAYER_GAP_X = 88
const GLAYER_GAP_Y = 40

function buildGraph(tasks: Task[]): { nodes: RFNode[]; edges: Edge[] } {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const layerOf = new Map<string, number>()
  const visit = (id: string, visited: Set<string>): number => {
    if (layerOf.has(id)) return layerOf.get(id)!
    if (visited.has(id)) return 0
    visited.add(id)
    const t = byId.get(id)
    let layer = 0
    for (const d of t?.dependsOn ?? []) {
      if (byId.has(d)) layer = Math.max(layer, visit(d, visited) + 1)
      else layer = Math.max(layer, 1)
    }
    layerOf.set(id, layer)
    return layer
  }
  const layerGroups: Task[][] = []
  for (const t of tasks) {
    const layer = visit(t.id, new Set())
    ;(layerGroups[layer] ??= []).push(t)
  }
  for (const g of layerGroups) {
    if (g) {
      g.sort((a, b) => {
        const order = { doing: 0, todo: 1, done: 2 } as Record<TaskStatus, number>
        return order[a.status] - order[b.status] || a.sort - b.sort
      })
    }
  }
  const nodes: RFNode[] = []
  layerGroups.forEach((group, li) => {
    const totalW = group.length * (GNODE_W + GLAYER_GAP_X) - GLAYER_GAP_X
    let x = -totalW / 2
    const y = li * (GNODE_H + GLAYER_GAP_Y)
    group.forEach((t) => {
      nodes.push({ id: t.id, position: { x, y }, width: GNODE_W, height: GNODE_H, data: { task: t } } as RFNode)
      x += GNODE_W + GLAYER_GAP_X
    })
  })
  const edges: Edge[] = []
  for (const group of layerGroups) {
    for (const t of group) {
      for (const depId of t.dependsOn ?? []) {
        if (!byId.has(depId)) continue
        const dep = byId.get(depId)!
        const blocked = dep.status !== 'done'
        edges.push({
          id: `${depId}->${t.id}`,
          source: depId,
          target: t.id,
          animated: blocked,
          style: { stroke: blocked ? '#d9822b' : '#3b6fd9', strokeWidth: 2.2 },
          markerEnd: { type: 'arrowclosed', color: blocked ? '#d9822b' : '#3b6fd9' },
        })
      }
    }
  }
  return { nodes, edges }
}

function GraphTaskNode({ data }: NodeProps) {
  const { task } = data as { task: Task }
  const blocked = task.blocked
  const statusLabel = blocked ? '阻塞' : (STATUS_META.find((s) => s.id === task.status)?.label ?? task.status)
  return (
    <div className="tasks-graph-node-wrap">
      <button
        type="button"
        className={`tasks-graph-node is-p-${task.priority}${blocked ? ' is-blocked' : ''}`}
      >
        <span className="tasks-graph-node-title" title={task.title}>{task.title}</span>
        <span className="tasks-graph-node-meta">
          <span className={`tasks-graph-status is-${blocked ? 'blocked' : task.status}`}>{statusLabel}</span>
          <span className={`tasks-card-badge is-p-${task.priority}`} title={`优先级：${PRIORITY_LABEL[task.priority]}`}>
            <FlagIcon aria-hidden className="size-[14px]" />
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span className={`tasks-card-badge is-d-${task.difficulty}`} title={`难度：${DIFFICULTY_LABEL[task.difficulty]}`}>
            <ChartBarIcon aria-hidden className="size-[14px]" />
            {DIFFICULTY_LABEL[task.difficulty]}
          </span>
        </span>
      </button>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function TasksEmpty({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`tasks-empty${compact ? ' is-compact' : ''}`}>
      暂无任务，可让 AI 助手为你创建
    </div>
  )
}

function TasksGraph({
  tasks,
  onOpenDetail,
  detailId,
  compact,
}: {
  tasks: Task[]
  onOpenDetail: (id: string) => void
  detailId: string | null
  compact: boolean
}) {
  const tree = useMemo(() => buildGraph(tasks), [tasks])
  const nodeTypes = useMemo(() => ({ task: GraphTaskNode }), [])
  const usedNodes = useMemo(() => tree.nodes.map((n) => ({ ...n, type: 'task' as const })), [tree])

  if (tasks.length === 0) return <TasksEmpty compact={compact} />
  return (
    <div className={`tasks-graph${compact ? ' is-compact' : ''}`}>
      <ReactFlow
        nodes={usedNodes}
        edges={tree.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={3}
        nodesDraggable
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onOpenDetail(node.id)}
        className="tasks-graph-rf"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} color="color-mix(in srgb, var(--dsw-border) 45%, transparent)" />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  )
}

function TasksQueue({
  tasks,
  detailId,
  onOpenDetail,
  onUpdate,
  compact,
  agents,
  agentsLoading,
}: {
  tasks: Task[]
  detailId: string | null
  onOpenDetail: (id: string) => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  compact: boolean
  agents: AgentOption[]
  agentsLoading: boolean
}) {
  // 叶节点集合：用于识别并选中当前叶任务
  const childSet = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) if (t.parentId) s.add(t.parentId)
    return s
  }, [tasks])
  const colOf = (t: Task): QueueKey => (isOverdue(t) ? 'overdue' : t.blocked ? 'blocked' : (t.status === 'done' ? 'done' : (t.status === 'doing' ? 'doing' : 'todo')))

  // 父链构建：按 id 索引，向上回溯出一串祖先（根 … 直接父），用「根 / 父 / …」拼接展示
  const byId = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of tasks) m.set(t.id, t)
    return m
  }, [tasks])
  // 拼接叶任务所在父链：形如「根节点 / 中间节点」（不含当前叶任务自身标题）
  const chainOf = useCallback(
    (task: Task): string => {
      const parts: string[] = []
      let cur: Task | undefined = task
      for (let guard = 0; guard < 16 && cur?.parentId; guard++) {
        const parent = byId.get(cur.parentId)
        if (!parent) break
        parts.unshift(parent.title)
        cur = parent
      }
      return parts.join(' / ')
    },
    [byId],
  )

  // 分组（仅叶节点）
  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = { overdue: [], doing: [], todo: [], blocked: [], done: [] }
    for (const t of tasks) {
      if (childSet.has(t.id)) continue // 有子任务 → 父节点，不展示
      const k = colOf(t)
      ;(map[k] ??= []).push(t)
    }
    // 组内保持传入顺序（tasks 已是按视图排序后的 sortedTasks），仅按状态分组。
    return map
  }, [tasks, childSet])

  const total = QUEUE_GROUPS.reduce((acc, g) => acc + (grouped[g.key]?.length ?? 0), 0)
  if (total === 0) return <TasksEmpty compact={compact} />

  return (
    <div className={`tasks-queue${compact ? ' is-compact' : ''}`}>
      {QUEUE_GROUPS.map((group) => {
        const items = grouped[group.key] ?? []
        if (!items.length) return null
        return (
          <section key={group.key} className={`tasks-queue-group is-${group.key}`}>
            <header className={`tasks-queue-ghead is-${group.key}`}>
              {group.icon}
              <span className="tasks-queue-glabel">{group.label}</span>
              <span className="tasks-queue-count">{items.length}</span>
            </header>
            <ul className="tasks-queue-list">
              {items.map((task) => {
                const isActive = detailId === task.id
                return (
                  <li
                    key={task.id}
                    className={`tasks-queue-item${isActive ? ' is-active' : ''} is-${colOf(task)} is-p-${task.priority}`}
                    data-biu-kind="task"
                    data-biu-id={task.id}
                    data-biu-label={task.title}
                  >
                    <button
                      type="button"
                      className="tasks-queue-item-main"
                      onClick={() => onOpenDetail(task.id)}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span className="tasks-queue-item-title">
                        {chainOf(task) ? <span className="tasks-queue-chain">{chainOf(task)} / </span> : null}
                        {task.title}
                      </span>
                      <span className={`tasks-queue-pill is-p-${task.priority}`} title={`优先级：${PRIORITY_LABEL[task.priority]}`}>
                        <FlagIcon aria-hidden className="size-[14px]" />
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {task.status !== 'done' && task.dueAt && task.dueAt <= Date.now() ? (
                        <span className="tasks-queue-overdue" title="已过截止时间"><ClockIcon aria-hidden className="size-[14px]" />逾期</span>
                      ) : null}
                      {task.blocked ? (
                        <span className="tasks-queue-lock" title="被依赖任务阻塞"><LockClosedIcon aria-hidden className="size-[14px]" /></span>
                      ) : null}
                      <UsageCapsule usage={task.usage ?? ZERO_USAGE} aggregate={false} />
                      <span className="tasks-queue-meta">
                        {task.assignee?.name ? <span className="tasks-queue-assignee">{task.assignee.name}</span> : null}
                        {task.project ? <span className="tasks-proj-tag">{task.project}</span> : null}
                        <TagChips tags={task.tags} />
                        {task.createdAt ? <TimeLabel ts={task.createdAt} /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** 任务结束时间 = 最后一次 report done 的时间；进行中无 done 返回 null */
function eventEndOf(t: Task): number | null {
  const reports = t.reports
  if (!reports?.length) return null
  for (let i = reports.length - 1; i >= 0; i--) {
    if (reports[i].status === 'done') return reports[i].ts
  }
  return null
}

/** 消耗：与 thread/trajectory 对齐——绿色 cache 圆环 + in→out，数字在悬浮 title。 */
function UsageCapsule({ usage, aggregate }: { usage: SumUsage; aggregate: boolean }) {
  if (usage.totalTokens <= 0) return <span className="traj-usage-empty">—</span>
  const pct =
    usage.inputTokens && usage.cacheReadTokens ? Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100)) : null
  const cacheTitle =
    pct != null
      ? `input ${formatTokens(usage.inputTokens)} · cache hit ${pct}% (${formatTokens(usage.cacheReadTokens)})`
      : `input ${formatTokens(usage.inputTokens)}`
  return (
    <span
      className={`traj-usage tasks-usage-capsule${aggregate ? ' is-agg' : ''}`}
      title={
        aggregate
          ? `子树聚合：in ${formatTokens(usage.inputTokens)} / out ${formatTokens(usage.outputTokens)}`
          : `本任务各回合消耗：in ${formatTokens(usage.inputTokens)} / out ${formatTokens(usage.outputTokens)}${usage.cacheReadTokens ? ` / cache ${formatTokens(usage.cacheReadTokens)}` : ''}`
      }
    >
      <span className="traj-usage-in-pair" title={cacheTitle}>
        <span className="traj-usage-in">{formatTokens(usage.inputTokens)}</span>
        <svg className="traj-usage-ring is-cache" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="#0a3d28" strokeWidth="2.5" />
          {(pct ?? 0) > 0 ? (
            <circle
              cx="6"
              cy="6"
              r="4.5"
              fill="none"
              stroke="#00c972"
              strokeWidth="2.5"
              strokeDasharray={`${((pct ?? 0) / 100) * 2 * Math.PI * 4.5} ${2 * Math.PI * 4.5}`}
              transform="rotate(-90 6 6)"
            />
          ) : null}
        </svg>
      </span>
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title={`output ${formatTokens(usage.outputTokens)}`}>
        {formatTokens(usage.outputTokens)}
      </span>
    </span>
  )
}

function TasksTable({
  tasks,
  detailId,
  onOpenDetail,
  onUpdate,
  onDelete,
  compact,
  agents,
  agentsLoading,
}: {
  tasks: Task[]
  detailId: string | null
  onOpenDetail: (id: string) => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  compact: boolean
  agents: AgentOption[]
  agentsLoading: boolean
}) {
  // 树形：父在前、子缩进随后；支持折叠
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const rows = useMemo(() => {
    const children = new Map<string, Task[]>()
    for (const t of tasks) {
      const p = t.parentId ?? ''
      if (!children.has(p)) children.set(p, [])
      children.get(p)!.push(t)
    }
    const out: Task[] = []
    // parentKey: 父任务 id（'' = 根）。
    // 父被折叠时：它的整棵子树（含直接子）都不渲染，只保留父自身。
    // 同级兄弟保持传入顺序（tasks 已是按视图排序后的 sortedTasks），树结构不变。
    const visit = (parentKey: string) => {
      const list = children.get(parentKey) ?? []
      for (const t of list) {
        out.push(t)
        // 只有该子节点自身没被折叠，才继续深入它的子树
        if (!collapsed[t.id]) visit(t.id)
      }
    }
    visit('')
    return out
  }, [tasks, collapsed])

  // 树折叠图标逻辑：只有真正有子任务才显示折叠箭头
  const hasChildren = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) if (t.parentId) s.add(t.parentId)
    return s
  }, [tasks])

  // usage 消耗列：只有叶节点才具有真实 usage（来自本任务各 report 的 turn-stats 求和），
  // 上层节点仅做子树聚合。明细(input/output/cacheRead/total)各自累加，供胶囊展示。
  const [leafUsage, setLeafUsage] = useState<Record<string, SumUsage>>({})
  useEffect(() => {
    let cancelled = false
    const keys = new Set<string>()
    for (const t of tasks) {
      // 已有持久 usage 的任务不再实时回退 query（持久字段为准）；仅对缺失的旧数据做兜底。
      if (t.usage) continue
      for (const r of t.reports ?? []) {
        if (r.sessionId && r.turn != null) keys.add(`${r.sessionId}:${r.turn}`)
      }
    }
    if (keys.size === 0) {
      setLeafUsage({})
      return
    }
    Promise.all(
      [...keys].map(async (key) => {
        const sep = key.indexOf(':')
        const sid = key.slice(0, sep)
        const turn = Number(key.slice(sep + 1))
        const stats = await fetchTurnStats(sid, Number.isFinite(turn) ? turn : null)
        return [
          key,
          stats
            ? {
                inputTokens: stats.inputTokens,
                outputTokens: stats.outputTokens,
                cacheReadTokens: stats.cacheReadTokens,
                totalTokens: stats.totalTokens,
              }
            : ZERO_USAGE,
        ] as const
      }),
    ).then((results) => {
      if (cancelled) return
      const byKey: Record<string, SumUsage> = {}
      for (const [key, v] of results) byKey[key] = v
      const leaf: Record<string, SumUsage> = {}
      for (const t of tasks) {
        const seen = new Set<string>()
        const parts: SumUsage[] = []
        for (const r of t.reports ?? []) {
          if (!r.sessionId || r.turn == null) continue
          const key = `${r.sessionId}:${r.turn}`
          if (seen.has(key)) continue
          seen.add(key)
          parts.push(byKey[key] ?? ZERO_USAGE)
        }
        leaf[t.id] = sumUsage(...parts)
      }
      setLeafUsage(leaf)
    })
    return () => {
      cancelled = true
    }
  }, [tasks])

  // 本任务"自己"的消耗（不含子树）：优先读 task 持久字段 usage（删 session 也不丢），
  // 仅当 usage 缺失（存量旧数据）时 fallback 到实时 query 的 leafUsage。
  const selfUsage = useMemo(() => {
    const m: Record<string, SumUsage> = {}
    for (const t of tasks) {
      m[t.id] = t.usage ?? leafUsage[t.id] ?? ZERO_USAGE
    }
    return m
  }, [tasks, leafUsage])

  // 聚合消耗：叶节点=自身消耗（持久 usage 优先）；上层=子树全部节点消耗之和。
  const usageByTask = useMemo(() => {
    const childMap = new Map<string, Task[]>()
    for (const t of tasks) {
      const p = t.parentId ?? ''
      if (!childMap.has(p)) childMap.set(p, [])
      childMap.get(p)!.push(t)
    }
    const memo = new Map<string, SumUsage>()
    const compute = (id: string): SumUsage => {
      const hit = memo.get(id)
      if (hit) return hit
      const kids = childMap.get(id) ?? []
      const total = sumUsage(selfUsage[id] ?? ZERO_USAGE, ...kids.map((k) => compute(k.id)))
      memo.set(id, total)
      return total
    }
    for (const t of tasks) compute(t.id)
    return memo
  }, [tasks, selfUsage])

  if (rows.length === 0) {
    return <TasksEmpty compact={compact} />
  }
  return (
    <div className="tasks-table-wrap">
      <table className="tasks-table">
        <thead>
          <tr>
            <ThIcon icon={<Squares2X2Icon aria-hidden className="size-[14px]" />}>项目</ThIcon>
            <ThIcon icon={<Bars3BottomLeftIcon aria-hidden className="size-[14px]" />}>标题</ThIcon>
            <ThIcon icon={<MinusCircleIcon aria-hidden className="size-[14px]" />}>状态</ThIcon>
            <ThIcon icon={<FlagIcon aria-hidden className="size-[14px]" />}>优先级</ThIcon>
            <ThIcon icon={<ChartBarIcon aria-hidden className="size-[14px]" />}>难度</ThIcon>
            <ThIcon icon={<CircleStackIcon aria-hidden className="size-[14px]" />}>消耗</ThIcon>
            {!compact ? <ThIcon icon={<UserIcon aria-hidden className="size-[14px]" />}>创建人</ThIcon> : null}
            {!compact ? <ThIcon icon={<ClockIcon aria-hidden className="size-[14px]" />}>创建时间</ThIcon> : null}
            <ThIcon icon={<UserIcon aria-hidden className="size-[14px]" />}>实施人</ThIcon>
            {!compact ? <ThIcon icon={<ClockIcon aria-hidden className="size-[14px]" />}>分配时间</ThIcon> : null}
            {!compact ? <ThIcon icon={<TagIcon aria-hidden className="size-[14px]" />}>标签</ThIcon> : null}
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <tr
              key={task.id}
              className={`${detailId === task.id ? 'is-active' : ''}`}
              data-biu-kind="task"
              data-biu-id={task.id}
              data-biu-label={task.title}
              onClick={() => onOpenDetail(task.id)}
            >
              <td className="tasks-col-project">
                {task.project ? <span className="tasks-proj-tag">{task.project}</span> : <span className="tasks-proj-empty">—</span>}
              </td>
              <td className="tasks-col-title" onClick={(e) => e.stopPropagation()}>
                <div className="tasks-title-cell" style={{ paddingLeft: Math.max(0, task.depth) * 16 }}>
                  {hasChildren.has(task.id) ? (
                    <button
                      type="button"
                      className="tasks-tree-toggle"
                      aria-label={collapsed[task.id] ? '展开子任务' : '收起子任务'}
                      onClick={() => setCollapsed((c) => ({ ...c, [task.id]: !c[task.id] }))}
                    >
                      {collapsed[task.id] ? <ChevronRightIcon aria-hidden className="size-[14px]" /> : <ChevronDownIcon aria-hidden className="size-[14px]" />}
                    </button>
                  ) : null}
                  <input
                    className="tasks-cell-input"
                    defaultValue={task.title}
                    key={`${task.id}-${task.updatedAt}-title`}
                    aria-label="标题"
                    title={task.title}
                    onBlur={(event) => {
                      const title = event.target.value.trim()
                      if (title && title !== task.title) void onUpdate(task.id, { title })
                    }}
                  />
                  <button
                    type="button"
                    className="tasks-title-open"
                    aria-label="查看详情"
                    title="查看详情"
                    onClick={() => onOpenDetail(task.id)}
                  >
                    <ArrowsPointingOutIcon aria-hidden className="size-[14px]" />
                  </button>
                </div>
              </td>
              <td className="tasks-col-status">
                <div className="tasks-status-cell">
                  <StatusPill status={task.status} reportCount={task.reports?.length ?? 0} blocked={task.blocked} dueAt={task.dueAt} />
                  {triggerSourceCount(task.trigger) > 0 ? <TriggerToggle task={task} onUpdate={onUpdate} /> : null}
                </div>
              </td>
              <td className="tasks-col-priority" onClick={(e) => e.stopPropagation()}>
                <CellSelect<TaskPriority>
                  value={task.priority}
                  options={(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((k) => ({
                    value: k,
                    label: PRIORITY_LABEL[k],
                    icon: <FlagIcon aria-hidden className="size-[14px]" />,
                  }))}
                  onSelect={(priority) => void onUpdate(task.id, { priority })}
                  valueClass={`is-p-${task.priority}`}
                  renderValue={(cur) => (
                    <>
                      <FlagIcon aria-hidden className="size-[14px]" />
                      <span className="tasks-chip-text">{cur?.label ?? task.priority}</span>
                    </>
                  )}
                />
              </td>
              <td className="tasks-col-priority" onClick={(e) => e.stopPropagation()}>
                <CellSelect<TaskDifficulty>
                  value={task.difficulty}
                  options={(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((k) => ({
                    value: k,
                    label: DIFFICULTY_LABEL[k],
                    icon: <ChartBarIcon aria-hidden className="size-[14px]" />,
                  }))}
                  onSelect={(difficulty) => void onUpdate(task.id, { difficulty })}
                  valueClass={`is-d-${task.difficulty}`}
                  renderValue={(cur) => (
                    <>
                      <ChartBarIcon aria-hidden className="size-[14px]" />
                      <span className="tasks-chip-text">{cur?.label ?? task.difficulty}</span>
                    </>
                  )}
                />
              </td>
              <td className="tasks-col-usage">
                {(() => {
                  const usage = usageByTask.get(task.id)
                  return usage && usage.totalTokens > 0 ? (
                    <UsageCapsule usage={usage} aggregate={hasChildren.has(task.id)} />
                  ) : (
                    <span className="traj-usage-empty">—</span>
                  )
                })()}
              </td>
              {!compact ? (
                <td className="tasks-col-actor">
                  <ActorChip actor={task.creator} empty="—" />
                </td>
              ) : null}
              {!compact ? (
                <td className="tasks-col-time">
                  <TimeLabel ts={task.createdAt} />
                </td>
              ) : null}
              <td className="tasks-col-actor" onClick={(e) => e.stopPropagation()}>
                <div className="tasks-assignee-inline">
                  <AssigneePicker
                    actor={task.assignee}
                    agents={agents}
                    loading={agentsLoading}
                    onPick={(sessionId) => void onUpdate(task.id, { assigneeSessionId: sessionId })}
                    onClear={() => void onUpdate(task.id, { assignee: null })}
                  />
                </div>
              </td>
              {!compact ? (
                <td className="tasks-col-time">
                  <TimeLabel ts={task.assignedAt} />
                </td>
              ) : null}
              {!compact ? (
                <td className="tasks-col-tags">
                  <TagChips tags={task.tags} />
                </td>
              ) : null}

              <td className="tasks-col-action" onClick={(e) => e.stopPropagation()}>
                <div className="tasks-row-actions">
                  <button type="button" className="tasks-icon-btn is-danger" title="删除" aria-label="删除任务" onClick={() => void onDelete(task.id)}>
                    <TrashIcon aria-hidden className="size-[14px]" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskDetailPanel({
  task,
  onClose,
  onPrev,
  onNext,
  onUpdate,
  onDelete,
  agents,
  agentsLoading,
  allTasks,
}: {
  task: Task
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  agents: AgentOption[]
  agentsLoading: boolean
  allTasks: Task[]
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [due, setDue] = useState(formatDueInput(task.dueAt))
  const [project, setProject] = useState(task.project ?? '')
  const [tags, setTags] = useState<string[]>(task.tags ?? [])
  // trigger 配置
  const [triggerEnabled, setTriggerEnabled] = useState(task.trigger?.enabled ?? false)
  const [triggerCron, setTriggerCron] = useState(task.trigger?.cron ?? '')
  const [triggerAt, setTriggerAt] = useState(task.trigger?.at ? formatDueInput(task.trigger.at) : '')
  const [triggerOn, setTriggerOn] = useState<string[]>(task.trigger?.on ?? [])
  // 预设模式：根据 cron 推断；不可识别则自定义。
  const [triggerMode, setTriggerMode] = useState<string>(() => inferTriggerMode(task.trigger?.cron ?? ''))
  // 7 个 cron 字段编辑（秒/分/时/日/月/周）
  const [cronFields, setCronFields] = useState<{ s: string; m: string; h: string; d: string; mo: string; w: string }>(() =>
    spawnCronFields(task.trigger?.cron ?? '')
  )
  // 「添加触发条件」选择器是否展开
  const [condAddOpen, setCondAddOpen] = useState(false)
  // 跨 session：每个 report 定位到其 agent 所属 session 的该 turn 统计（step 数 / 耗时 / 额度消耗）。
  const [turnStats, setTurnStats] = useState<Record<string, TurnStats | null | undefined>>({})
  const [pane, setPane] = useState<'overview' | 'auto' | 'run'>('overview')

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDue(formatDueInput(task.dueAt))
    setProject(task.project ?? '')
    setTags(task.tags ?? [])
  }, [task.id, task.updatedAt])

  // trigger 本地编辑状态只在切换任务时初始化，不随 updatedAt 回写，
  // 避免 PATCH 引发的 updatedAt 变化覆盖正在编辑/刚开启的调度（否则配置区块会「出现又消失」）。
  useEffect(() => {
    setTriggerEnabled(task.trigger?.enabled ?? false)
    setTriggerCron(task.trigger?.cron ?? '')
    setTriggerAt(task.trigger?.at ? formatDueInput(task.trigger.at) : '')
    setTriggerOn(task.trigger?.on ?? [])
    setTriggerMode(inferTriggerMode(task.trigger?.cron ?? ''))
    setCronFields(spawnCronFields(task.trigger?.cron ?? ''))
    setCondAddOpen(false)
    setPane('overview')
  }, [task.id])

  const reports = useMemo(() => (task.reports ?? []).filter((r) => r.sessionId && r.turn != null), [task.reports])

  useEffect(() => {
    let cancelled = false
    const cache: Record<string, TurnStats | null | undefined> = {}
    // 只有缺少持久 usage 的 report 才回退回实时 session turn-stats（session 已删则跳过，展示 task 表持久值）。
    const pending = reports
      .filter((r) => !r.usage)
      .map((r) => ({ key: `${r.sessionId}:${r.turn}`, sessionId: r.sessionId, turn: r.turn as number }))
      .filter((entry, i, arr) => arr.findIndex((e) => e.key === entry.key) === i)
    if (!pending.length) {
      setTurnStats(cache)
      return
    }
    Promise.all(
      pending.map(async (entry) => {
        const stats = await fetchTurnStats(entry.sessionId, entry.turn)
        cache[entry.key] = stats
      }),
    ).then(() => {
      if (!cancelled) setTurnStats(cache)
    })
    return () => {
      cancelled = true
    }
  }, [reports])

  return (
    <div className="tasks-detail-modal" aria-label="任务详情" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <header className="tasks-detail-head">
        <div className="tasks-detail-pager">
          <button type="button" className="tasks-icon-btn" title="上一页" aria-label="上一页" disabled={!onPrev} onClick={onPrev}>
            <ChevronLeftIcon aria-hidden className="size-[14px]" />
          </button>
          <button type="button" className="tasks-icon-btn" title="下一页" aria-label="下一页" disabled={!onNext} onClick={onNext}>
            <ChevronRightIcon aria-hidden className="size-[14px]" />
          </button>
        </div>
        <nav className="tasks-detail-tabs" aria-label="详情分区">
          <button type="button" className={pane === 'overview' ? 'is-active' : ''} onClick={() => setPane('overview')}>
            概况
          </button>
          <button type="button" className={pane === 'auto' ? 'is-active' : ''} onClick={() => setPane('auto')}>
            自动化
            {triggerEnabled || task.trigger?.cron || task.trigger?.at || task.trigger?.on?.length ? <span className="tasks-detail-tab-dot" /> : null}
          </button>
          <button type="button" className={pane === 'run' ? 'is-active' : ''} onClick={() => setPane('run')}>
            执行
            {task.reports?.length ? <span className="tasks-detail-tab-count">{task.reports.length}</span> : null}
          </button>
        </nav>
        <div className="tasks-detail-head-actions">
          <button
            type="button"
            className="tasks-icon-btn is-danger"
            title="删除任务"
            aria-label="删除任务"
            onClick={() => {
              if (window.confirm('删除这个任务？')) void onDelete(task.id)
            }}
          >
            <TrashIcon aria-hidden className="size-[14px]" />
          </button>
          <button type="button" className="tasks-icon-btn" title="关闭 (Esc)" onClick={onClose} aria-label="关闭">
            <XMarkIcon aria-hidden className="size-[14px]" />
          </button>
        </div>
      </header>

      {pane === 'overview' ? (
        <div className="tasks-detail-split">
          <div className="tasks-detail-main">
            <textarea
              className="tasks-detail-title-input"
              value={title}
              rows={title.length > 48 ? 2 : 1}
              placeholder="任务标题"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                const next = title.trim()
                if (next && next !== task.title) void onUpdate(task.id, { title: next })
              }}
            />
            <aside className="tasks-detail-aside">
            <div className="tasks-prop">
              <span>
                <HashtagIcon aria-hidden className="size-[14px]" />
                ID
              </span>
              <span className="tasks-detail-id" title={task.id}>{task.id}</span>
            </div>
            <label className="tasks-prop">
              <span>
                <StatusIcon status={task.status} />
                状态
              </span>
              <CellSelect<TaskStatus>
                value={task.status}
                options={STATUS_META.map((m) => ({ value: m.id, label: m.label, icon: m.icon }))}
                onSelect={(status) => void onUpdate(task.id, { status })}
                valueClass={`is-${task.status}`}
                renderValue={(cur) => <span className="tasks-chip-text">{cur?.label ?? task.status}</span>}
              />
            </label>
            <label className="tasks-prop">
              <span>
                <FlagIcon aria-hidden className="size-[14px]" />
                优先级
              </span>
              <CellSelect<TaskPriority>
                value={task.priority}
                options={(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((k) => ({
                  value: k,
                  label: PRIORITY_LABEL[k],
                  icon: <FlagIcon aria-hidden className="size-[14px]" />,
                }))}
                onSelect={(priority) => void onUpdate(task.id, { priority })}
                valueClass={`is-p-${task.priority}`}
                renderValue={(cur) => <span className="tasks-chip-text">{cur?.label ?? task.priority}</span>}
              />
            </label>
            <label className="tasks-prop">
              <span>
                <ChartBarIcon aria-hidden className="size-[14px]" />
                难度
              </span>
              <CellSelect<TaskDifficulty>
                value={task.difficulty}
                options={(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((k) => ({
                  value: k,
                  label: DIFFICULTY_LABEL[k],
                  icon: <ChartBarIcon aria-hidden className="size-[14px]" />,
                }))}
                onSelect={(difficulty) => void onUpdate(task.id, { difficulty })}
                valueClass={`is-d-${task.difficulty}`}
                renderValue={(cur) => <span className="tasks-chip-text">{cur?.label ?? task.difficulty}</span>}
              />
            </label>
            <label className="tasks-prop">
              <span>
                <UserIcon aria-hidden className="size-[14px]" />
                分配
              </span>
              <AssigneePicker
                actor={task.assignee}
                agents={agents}
                loading={agentsLoading}
                onPick={(sessionId) => void onUpdate(task.id, { assigneeSessionId: sessionId })}
                onClear={() => void onUpdate(task.id, { assignee: null })}
              />
            </label>
            <label className="tasks-prop">
              <span>
                <CalendarDaysIcon aria-hidden className="size-[14px]" />
                截止
              </span>
              <input
                className="tasks-field-input"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
                onBlur={() => {
                  const next = due.trim() ? new Date(`${due}T00:00:00`).getTime() : null
                  const prev = task.dueAt
                  if (next !== prev) void onUpdate(task.id, { dueAt: next })
                }}
              />
            </label>
            <label className="tasks-prop">
              <span>
                <FolderIcon aria-hidden className="size-[14px]" />
                项目
              </span>
              <input
                className="tasks-field-input"
                value={project}
                placeholder="可选"
                onChange={(event) => setProject(event.target.value)}
                onBlur={() => {
                  if (project !== (task.project ?? '')) void onUpdate(task.id, { project: project.trim() || null })
                }}
              />
            </label>
            <div className="tasks-prop">
              <span>
                <TagIcon aria-hidden className="size-[14px]" />
                标签
              </span>
              <TagMultiSelect
                tags={tags}
                options={[...new Set(allTasks.flatMap((t) => t.tags ?? []))]}
                onChange={(next) => {
                  setTags(next)
                  void onUpdate(task.id, { tags: next })
                }}
              />
            </div>
            </aside>
            <textarea
              className="tasks-detail-doc"
              value={description}
              placeholder="要做什么、怎么算完成。"
              rows={8}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => {
                if (description !== (task.description ?? '')) void onUpdate(task.id, { description })
              }}
            />
          </div>
        </div>
      ) : pane === 'auto' ? (
        <div className="tasks-detail-pane">
<div className="tasks-field tasks-l-field tasks-automation">
          <div className="tasks-auto-head">
            <span className="tasks-auto-title"><ClockIcon aria-hidden className="size-[14px]" /> 自动触发</span>
            <label className={`tasks-auto-switch${triggerEnabled ? ' is-on' : ''}`} title={triggerEnabled ? '点击关闭此规则' : '点击开启此规则'}>
              <input
                type="checkbox"
                checked={triggerEnabled}
                onChange={(event) => {
                  const next = event.target.checked
                  setTriggerEnabled(next)
                  void onUpdate(task.id, { trigger: { enabled: next } })
                }}
              />
              <span className="tasks-auto-switch-track"><span className="tasks-auto-switch-knob" /></span>
            </label>
          </div>
          {(() => {
            const hasAuto = !!(task.trigger?.cron || task.trigger?.at || task.trigger?.on?.length)
            const showConfig = triggerEnabled || hasAuto
            return showConfig ? (
            <>
              {/* 一句话规则摘要 */}
              <div className="tasks-auto-summary">
                <span className="tasks-auto-summary-dot" />
                <span>{triggerSummary(triggerCron, task.trigger?.at, triggerOn)}</span>
              </div>

              {/* Trigger 区 */}
              <div className="tasks-auto-sec-head"><CursorArrowRippleIcon aria-hidden className="size-[14px]" /> Trigger · 触发</div>
              <div className="tasks-auto-sec">
                <div className="tasks-auto-cond-list">
                  {/* 定时 cron 条件 */}
                  {triggerCron ? (
                    <div className="tasks-auto-cond">
                      <div className="tasks-auto-cond-head">
                        <span className="tasks-auto-cond-type"><CalendarDaysIcon aria-hidden className="size-[14px]" /> 定时</span>
                        <button type="button" className="tasks-auto-cond-del" title="删除定时条件"
                          onClick={() => {
                            setTriggerCron('')
                            setTriggerMode('min')
                            setCronFields(spawnCronFields(''))
                            if (task.trigger?.cron) void onUpdate(task.id, { trigger: { cron: null } })
                          }}><XMarkIcon aria-hidden className="size-[14px]" /></button>
                      </div>
                      <div className="tasks-auto-cond-body">
                        <div className="tasks-trigger-field">
                          <span>频率</span>
                          <div className="tasks-auto-seg tasks-auto-preset">
                            {(
                              [
                                ['sec', '每N秒'], ['min', '每N分钟'], ['hour', '每小时'],
                                ['day', '每天'], ['week', '每周'], ['custom', '自定义'],
                              ] as const
                            ).map(([m, label]) => (
                              <button key={m} type="button" className={triggerMode === m ? 'is-active' : ''} onClick={() => {
                                setTriggerMode(m)
                                const cronStr = presetCron(m, cronFields, '5', '10', '0', '1')
                                const cron = cronStr || null
                                setTriggerCron(cronStr)
                                setCronFields(spawnCronFields(cronStr))
                                if (cron !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron } })
                              }}>{label}</button>
                            ))}
                          </div>
                        </div>
                        {triggerMode === 'sec' ? (
                          <label className="tasks-trigger-field">
                            <span>间隔（秒）</span>
                            <input
                              className="tasks-field-input tasks-cron-num"
                              type="number"
                              min={1}
                              defaultValue={inferN(triggerCron, 5)}
                              onChange={(event) => {
                                const n = event.target.value || '5'
                                const cronStr = `*/${n} * * * * *`
                                setTriggerCron(cronStr)
                                setCronFields(spawnCronFields(cronStr))
                                if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                              }}
                            />
                          </label>
                        ) : triggerMode === 'min' ? (
                          <label className="tasks-trigger-field">
                            <span>间隔（分钟）</span>
                            <input
                              className="tasks-field-input tasks-cron-num"
                              type="number"
                              min={1}
                              defaultValue={inferN(triggerCron, 5)}
                              onChange={(event) => {
                                const n = event.target.value || '5'
                                const cronStr = `*/${n} * * * *`
                                setTriggerCron(cronStr)
                                if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                              }}
                            />
                          </label>
                        ) : triggerMode === 'hour' ? (
                          <label className="tasks-trigger-field">
                            <span>每 N 小时</span>
                            <input
                              className="tasks-field-input tasks-cron-num"
                              type="number"
                              min={1}
                              defaultValue={inferN(triggerCron, 1)}
                              onChange={(event) => {
                                const n = event.target.value || '1'
                                const cronStr = `0 */${n} * * *`
                                setTriggerCron(cronStr)
                                if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                              }}
                            />
                          </label>
                        ) : triggerMode === 'day' ? (
                          <div className="tasks-trigger-field">
                            <span>每天时间</span>
                            <div className="tasks-trigger-time">
                              <input
                                className="tasks-field-input tasks-cron-num"
                                type="number"
                                min={0} max={23}
                                defaultValue={inferH(triggerCron, 10)}
                                onChange={(event) => {
                                  const n = event.target.value || '0'
                                  const cronStr = `${inferM(triggerCron)} ${n} * * *`
                                  setTriggerCron(cronStr)
                                  if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                                }}
                              />
                              <span className="tasks-trigger-time-sep">:</span>
                              <input
                                className="tasks-field-input tasks-cron-num"
                                type="number"
                                min={0} max={59}
                                defaultValue={inferM(triggerCron, 0)}
                                onChange={(event) => {
                                  const n = event.target.value || '0'
                                  const cronStr = `${n} ${inferH(triggerCron)} * * *`
                                  setTriggerCron(cronStr)
                                  if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                                }}
                              />
                            </div>
                          </div>
                        ) : triggerMode === 'week' ? (
                          <label className="tasks-trigger-field">
                            <span>星期几</span>
                            <select
                              className="tasks-trigger-mode tasks-cron-week"
                              value={inferW(triggerCron, '1')}
                              onChange={(event) => {
                                const w = event.target.value
                                const cronStr = `0 0 * * ${w}`
                                setTriggerCron(cronStr)
                                if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                              }}
                            >
                              {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
                                <option key={i} value={String(i)}>周{w}</option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <div className="tasks-trigger-field">
                            <span>高级 cron（秒 分 时 日 月 周）</span>
                            <div className="tasks-trigger-cronfield">
                              {(
                                [
                                  ['s', cronFields.s, '秒'], ['m', cronFields.m, '分'], ['h', cronFields.h, '时'],
                                  ['d', cronFields.d, '日'], ['mo', cronFields.mo, '月'], ['w', cronFields.w, '周'],
                                ] as const
                              ).map(([key, val, label]) => (
                                <label key={key} className={`tasks-cron-field${val && !cronFieldValid(val) ? ' is-invalid' : ''}`} title={val && !cronFieldValid(val) ? `「${val}」非法：仅支持 *、*/N、N、N-M` : `${label}字段`}>
                                  <span>{label}</span>
                                  <input
                                    className="tasks-field-input"
                                    value={val}
                                    placeholder="*"
                                    onChange={(event) => {
                                      const nextVal = event.target.value
                                      const next = { ...cronFields, [key]: nextVal }
                                      setCronFields(next)
                                      const cronStr = composeCron(next.s, next.m, next.h, next.d, next.mo, next.w)
                                      const invalid = Object.values(next).some((f) => f && !cronFieldValid(f))
                                      setTriggerCron(invalid ? '' : (cronStr ?? ''))
                                      if (!invalid && cronStr && cronStr !== (task.trigger?.cron ?? null)) {
                                        void onUpdate(task.id, { trigger: { cron: cronStr } })
                                      }
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className={`tasks-trigger-field${triggerMode === 'custom' ? ' tasks-trigger-preview-wrap' : ''}`}>
                          <span>解读</span>
                          <span className="tasks-trigger-preview">{cronPreview(triggerCron)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {/* 特定时间 at 条件 */}
                  {triggerAt ? (
                    <div className="tasks-auto-cond">
                      <div className="tasks-auto-cond-head">
                        <span className="tasks-auto-cond-type"><ClockIcon aria-hidden className="size-[14px]" /> 特定时间</span>
                        <button type="button" className="tasks-auto-cond-del" title="删除特定时间条件"
                          onClick={() => {
                            setTriggerAt('')
                            if (task.trigger?.at) void onUpdate(task.id, { trigger: { at: null } })
                          }}><XMarkIcon aria-hidden className="size-[14px]" /></button>
                      </div>
                      <div className="tasks-auto-cond-body">
                        <label className="tasks-trigger-field">
                          <span>日期</span>
                          <input
                            className="tasks-field-input"
                            type="date"
                            value={triggerAt}
                            onChange={(event) => setTriggerAt(event.target.value)}
                            onBlur={() => {
                              const at = triggerAt.trim() ? new Date(`${triggerAt}T00:00:00`).getTime() : null
                              const prev = task.trigger?.at ?? null
                              if (at !== prev) void onUpdate(task.id, { trigger: { at } })
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                  {/* on 事件条件（每事件一行） */}
                  {triggerOn.map((ev) => (
                    <div key={ev} className="tasks-auto-cond">
                      <div className="tasks-auto-cond-head">
                        <span className="tasks-auto-cond-type"><BoltIcon aria-hidden className="size-[14px]" /> {ev === 'dep:done' ? '依赖完成' : '回合结束'}</span>
                        <button type="button" className="tasks-auto-cond-del" title="删除该事件条件"
                          onClick={() => {
                            const next = triggerOn.filter((e) => e !== ev)
                            setTriggerOn(next)
                            void onUpdate(task.id, { trigger: { on: next } })
                          }}><XMarkIcon aria-hidden className="size-[14px]" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 添加触发条件 */}
                <div className="tasks-auto-add">
                  {condAddOpen ? (
                    <div className="tasks-auto-seg">
                      <button type="button" onClick={() => {
                        const cronStr = '*/5 * * * * *'
                        setTriggerMode('sec')
                        setCronFields(spawnCronFields(cronStr))
                        setTriggerCron(cronStr)
                        setCondAddOpen(false)
                        if (cronStr !== (task.trigger?.cron ?? null)) void onUpdate(task.id, { trigger: { cron: cronStr } })
                      }}><CalendarDaysIcon aria-hidden className="size-[14px]" /> 定时</button>
                      <button type="button" onClick={() => {
                        const atStr = formatDueInput(Date.now())
                        setTriggerAt(atStr)
                        setCondAddOpen(false)
                        const atMs = atStr.trim() ? new Date(`${atStr}T00:00:00`).getTime() : null
                        if (atMs !== (task.trigger?.at ?? null)) void onUpdate(task.id, { trigger: { at: atMs } })
                      }}><ClockIcon aria-hidden className="size-[14px]" /> 特定时间</button>
                      <button type="button" onClick={() => {
                        const next = triggerOn.includes('dep:done') ? triggerOn : [...triggerOn, 'dep:done']
                        setTriggerOn(next)
                        setCondAddOpen(false)
                        void onUpdate(task.id, { trigger: { on: next } })
                      }}>依赖完成</button>
                      <button type="button" onClick={() => {
                        const next = triggerOn.includes('turn:end') ? triggerOn : [...triggerOn, 'turn:end']
                        setTriggerOn(next)
                        setCondAddOpen(false)
                        void onUpdate(task.id, { trigger: { on: next } })
                      }}>回合结束</button>
                    </div>
                  ) : (
                    <button type="button" className="tasks-auto-add-btn" onClick={() => setCondAddOpen(true)}><PlusIcon aria-hidden className="size-[14px]" /> 触发条件</button>
                  )}
                </div>
              </div>

              {/* Then 区 */}
              <div className="tasks-auto-sec-head"><PlayIcon aria-hidden className="size-[14px]" /> Then · 执行</div>
              <div className="tasks-auto-sec tasks-auto-then">
                <span className="tasks-auto-then-arrow"><PlayIcon aria-hidden className="size-[14px]" /></span>
                <span className="tasks-auto-then-text">自动派工给承担者并开始执行任务</span>
              </div>

              {/* 调度状态 */}
              <div className="tasks-trigger-status">
                <span className={`tasks-trigger-state-pill is-${task.trigger?.state ?? 'idle'}`}>
                  <span className="tasks-trigger-state-dot" />
                  {task.trigger?.state ?? 'idle'}
                </span>
                <div className="tasks-trigger-times">
                  {task.nextTriggerAt ? (
                    <span className="tasks-trigger-next">
                      <span className="tasks-trigger-tk">下次触发</span>
                      <span className="tasks-trigger-tv">{timeUntilLabel(task.nextTriggerAt)}</span>
                      <span className="tasks-trigger-ts">{new Date(task.nextTriggerAt).toLocaleString()}</span>
                    </span>
                  ) : null}
                  {task.trigger?.lastRun ? (
                    <span className="tasks-trigger-last">
                      <span className="tasks-trigger-tk">上次触发</span>
                      <span className="tasks-trigger-tv">{formatWhen(task.trigger.lastRun)}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </>
            ) : null
          })()}
        </div>
        </div>
      ) : (
        <div className="tasks-detail-pane">
        <div className="tasks-detail-meta">
          <div className="tasks-exec-stats">
            <div className="tasks-exec-stat">
              <span className="tasks-exec-stat-label"><UserIcon aria-hidden className="size-[14px]" /> 创建人</span>
              <span className="tasks-exec-stat-value">
                <ActorChip actor={task.creator} empty="—" />
              </span>
            </div>
            {task.createdAt ? (
              <div className="tasks-exec-stat">
                <span className="tasks-exec-stat-label"><ClockIcon aria-hidden className="size-[14px]" /> 创建时间</span>
                <span className="tasks-exec-stat-value"><TimeLabel ts={task.createdAt} /></span>
              </div>
            ) : null}
            {task.assignedAt ? (
              <div className="tasks-exec-stat">
                <span className="tasks-exec-stat-label"><ClockIcon aria-hidden className="size-[14px]" /> 实施时间</span>
                <span className="tasks-exec-stat-value"><TimeLabel ts={task.assignedAt} /></span>
              </div>
            ) : null}
            {task.blocked && task.blockedBy?.length ? (
              <div className="tasks-exec-stat">
                <span className="tasks-exec-stat-label"><LockClosedIcon aria-hidden className="size-[14px]" /> 阻塞</span>
                <span className="tasks-exec-stat-value">
                  <span className="tasks-blocked-head">被 {task.blockedBy.length} 个前置任务阻塞</span>
                  <ul className="tasks-blocked-list">
                    {task.blockedBy.map((id) => {
                      const src = allTasks.find((t) => t.id === id)
                      return (
                        <li key={id} className="tasks-blocked-item">
                          <span className="tasks-blocked-dot" aria-hidden />
                          {src?.title ?? id.slice(0, 10)}
                        </li>
                      )
                    })}
                  </ul>
                </span>
              </div>
            ) : null}
            {task.usage && task.usage.totalTokens > 0 ? (
              <div className="tasks-exec-stat">
                <span className="tasks-exec-stat-label"><CircleStackIcon aria-hidden className="size-[14px]" /> 消耗</span>
                <span className="tasks-exec-stat-value">
                  <UsageCapsule usage={task.usage} aggregate={false} />
                </span>
              </div>
            ) : null}
          </div>
          {task.reports?.length ? (
            <>
              <div className="tasks-exec-timeline-head">执行报告</div>
              <ul className="tasks-report-timeline">
                {[...task.reports].reverse().map((r, i) => {
                  // 优先读该 report 固化的持久 usage（删 session 不丢）；缺失则 fallback 实时 turn-stats。
                  const persistUsage = r.usage ?? null
                  const realtimeStat =
                    !persistUsage && r.sessionId && r.turn != null
                      ? turnStats[`${r.sessionId}:${r.turn}`] ?? null
                      : null
                  const usage = persistUsage ?? (realtimeStat && realtimeStat.totalTokens > 0 ? realtimeStat : null)
                  const consumed = !!usage && usage.totalTokens > 0
                  return (
                    <li key={`${r.ts}-${i}`} className={`tasks-report-item is-${r.status}`}>
                      <span className="tasks-report-node">{r.status === 'done' ? <CheckCircleIcon aria-hidden className="size-[14px]" /> : <ArrowPathIcon aria-hidden className="size-[14px]" />}</span>
                      <span className="tasks-report-rail" />
                      <div className="tasks-report-content">
                        {r.note ? <div className="tasks-report-note">{r.note}</div> : null}
                        <div className="tasks-report-usage">
                          <span className="tasks-report-time">{formatWhen(r.ts)}</span>
                          {consumed ? <UsageCapsule usage={usage} aggregate={false} /> : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </div>
        </div>
      )}

    </div>
  )
}

function TasksModulePage(props: SlotProps) {
  return (
    <div className="tasks-module-page">
      <TasksWorkspace tasksView={props.tasksView as TasksViewService | undefined} />
    </div>
  )
}

function TasksInspectorPanel(props: SlotProps) {
  return (
    <div className="tasks-inspector-panel">
      <TasksWorkspace compact tasksView={props.tasksView as TasksViewService | undefined} />
    </div>
  )
}

function formatClock(iso?: string) {
  if (!iso) return 'waiting…'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function ClockBadge(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const iso = useSnapshot((state: Snapshot) => state.clockIso)
  return (
    <article className="space-y-1 rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-3 py-3">
      <h2 className="text-sm font-medium">Heartbeat</h2>
      <time className="font-mono text-sm tracking-wide text-[var(--dsw-label-3)]" dateTime={iso}>
        {formatClock(iso)}
      </time>
    </article>
  )
}

export const name = 'tasks-ui'
export const inject = ['slots', 'appModules', 'snapshot']

const tasksModuleProps = { moduleId: 'tasks' }
const tasksInspectorProps = { tabId: 'tasks', tabLabel: '任务', tabIcon: ClipboardDocumentListIcon }

type AppModulesService = {
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: (props: { className?: string }) => unknown
  }) => unknown
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  const appModules = ctx.get('appModules') as AppModulesService | undefined
  if (!slots) throw new Error('slots service required')
  if (!appModules) throw new Error('appModules service required')
  appModules.register({
    id: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    description: 'Task table and board',
    order: 20,
    Icon: ClipboardDocumentCheckIcon,
  })
  const tasksView = new TasksViewService(ctx)
  // 依赖 snapshot 总线：注册本插件关心的 'tasks' 消息（Agent 远程切换看板事件），由总线转发
  const snapshot = ctx.get('snapshot') as SnapshotService | undefined
  const off = snapshot?.onMessage?.('tasks', (payload) => {
    tasksView.handleTasksEvent(payload)
  })
  if (off) ctx.effect(() => off)
  slots.place('app-modules', TasksModulePage, {
    key: 'tasks-module',
    order: 20,
    props: () => ({ ...tasksModuleProps, tasksView }),
  })
  slots.place('inspector-panels', TasksInspectorPanel, {
    key: 'tasks-inspector',
    order: 10,
    props: () => ({ ...tasksInspectorProps, tasksView }),
  })
  slots.place('demos', ClockBadge, {
    key: 'clock',
    order: 5,
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}

if (typeof document !== 'undefined') {
  const id = 'biu-tasks-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.tasks-module-page { display:flex; flex:1; min-width:0; min-height:0; flex-direction:column; overflow:hidden; background:
  radial-gradient(900px 360px at 10% -12%, color-mix(in srgb, var(--dsw-business) 8%, transparent), transparent 58%),
  linear-gradient(180deg, color-mix(in srgb, var(--dsw-surface) 55%, var(--dsw-bg)), var(--dsw-bg));
  color:var(--dsw-label); }
.tasks-inspector-panel { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; background:var(--dsw-bg); }
.tasks-root { display:flex; min-width:0; min-height:0; flex:1; gap:0; overflow:hidden; }
.tasks-root.is-compact { flex-direction:column; }
.tasks-main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; gap:10px; padding:12px 14px 14px; overflow-x:hidden; overflow-y:auto; }
.tasks-root.is-compact .tasks-main { padding:8px 10px 10px; gap:8px; }
.tasks-toolbar { display:flex; gap:12px; align-items:center; justify-content:space-between; min-width:0; }
.tasks-toolbar-left { display:flex; align-items:center; gap:6px; flex:none; min-width:0; }
.tasks-toolbar-right { display:flex; align-items:center; gap:6px; flex:none; margin-left:auto; }
.tasks-search { min-width:0; border:0; border-radius:8px; padding:6px 8px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; outline:none; }
.tasks-search-wrap { flex:0 1 180px; display:flex; align-items:center; gap:6px; border:0; border-radius:8px; padding:0 8px; background:transparent; color:var(--dsw-label-3); min-width:0; }
.tasks-search-wrap:hover, .tasks-search-wrap:focus-within { background:var(--dsw-hover); }
.tasks-refresh { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:26px; border:0; border-radius:8px; padding:0; background:transparent; color:var(--dsw-label-2); font:inherit; cursor:pointer; }
.tasks-refresh:hover { background:var(--dsw-hover); }
.tasks-refresh.is-active { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 10%, var(--dsw-input)); }
.tasks-filter-btn-wrap { position:relative; display:inline-flex; flex:none; }
.tasks-filter-btn-wrap .tasks-refresh { position:relative; }
.tasks-filter-dot, .tasks-sort-dot { position:absolute; top:4px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--dsw-business); box-shadow:0 0 0 1px var(--dsw-surface); }
.tasks-filter-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:180px; padding:8px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:8px; }
.tasks-filter-menu-label { display:flex; flex-direction:column; gap:4px; font-size:10.5px; font-weight:600; color:var(--dsw-label-3); }
.tasks-filter-menu-label .tasks-filter { width:100%; max-width:none; }
.tasks-filter-clear { width:100%; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-danger); font:inherit; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
.tasks-filter-clear:hover { background:var(--dsw-danger-soft); }
.tasks-search-wrap .tasks-search { flex:1; border:0; padding-left:0; background:transparent; }
.tasks-filter { flex:0 0 auto; border:1px solid var(--dsw-border); border-radius:7px; padding:5px 7px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:11px; outline:none; max-width:140px; }
.tasks-viewtabs { display:flex; gap:2px; padding:2px; border:1px solid var(--dsw-border); border-radius:8px; background:var(--dsw-input); }
.tasks-viewtab { display:inline-flex; align-items:center; gap:4px; border:0; border-radius:6px; padding:4px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:11px; font-weight:600; cursor:pointer; }
.tasks-viewtab:hover { background:var(--dsw-hover); }
.tasks-viewtab.is-active { background:var(--dsw-business); color:var(--dsw-bg); }

/* ---- 视图下拉（Notion 数据库左上角风格）---- */
.tasks-viewdd-wrap { position:relative; display:inline-flex; align-items:center; gap:6px; flex:none; }
.tasks-viewdd-btn { display:inline-flex; align-items:center; gap:6px; border:0; border-radius:8px; padding:5px 9px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; font-weight:650; cursor:pointer; }
.tasks-viewdd-btn:hover { background:var(--dsw-hover); }
.tasks-viewdd-btn.is-active { background:color-mix(in srgb, var(--dsw-business) 10%, transparent); }
.tasks-viewdd-name { max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-viewdd-menu { position:absolute; top:calc(100% + 6px); left:0; z-index:40; min-width:230px; padding:6px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:2px; }
.tasks-viewdd-head { padding:5px 8px 3px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--dsw-label-3); }
.tasks-viewdd-empty { padding:8px; font-size:11.5px; color:var(--dsw-label-3); }
.tasks-viewdd-item { display:flex; align-items:center; gap:2px; border-radius:7px; }
.tasks-viewdd-item:hover { background:var(--dsw-hover); }
.tasks-viewdd-item.is-active { background:color-mix(in srgb, var(--dsw-business) 10%, transparent); }
.tasks-viewdd-item-main { flex:1; display:inline-flex; align-items:center; gap:7px; min-width:0; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label); font:inherit; font-size:12px; font-weight:550; cursor:pointer; text-align:left; }
.tasks-viewdd-item.is-active .tasks-viewdd-item-main { color:var(--dsw-business); font-weight:650; }
.tasks-viewdd-item-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-viewdd-check { flex:none; color:var(--dsw-business); }
.tasks-viewdd-item-actions { display:none; align-items:center; gap:2px; flex:none; padding-right:4px; }
.tasks-viewdd-item:hover .tasks-viewdd-item-actions { display:inline-flex; }
.tasks-viewdd-act { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border:0; border-radius:6px; background:transparent; color:var(--dsw-label-3); cursor:pointer; }
.tasks-viewdd-act:hover { background:color-mix(in srgb, var(--dsw-muted-fill) 80%, transparent); color:var(--dsw-label); }
.tasks-viewdd-act.is-danger:hover { background:color-mix(in srgb, var(--dsw-danger) 16%, transparent); color:var(--dsw-danger); }
.tasks-viewdd-foot { border-top:1px solid var(--dsw-border); margin-top:4px; padding-top:4px; }
.tasks-viewdd-saveas { width:100%; display:inline-flex; align-items:center; gap:6px; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; }
.tasks-viewdd-saveas:hover { background:var(--dsw-hover); color:var(--dsw-label); }

/* ---- 视图对话框（另存为 / 重命名 / 删除确认，自绘模态）---- */
.tasks-viewdlg-backdrop { position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); animation:tasks-fade-in .12s ease; }
.tasks-viewdlg { width:min(360px, calc(100vw - 32px)); background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,.25); padding:16px; display:flex; flex-direction:column; gap:12px; }
.tasks-viewdlg-title { font-size:14px; font-weight:700; color:var(--dsw-label); }
.tasks-viewdlg-body { display:flex; flex-direction:column; gap:8px; }
.tasks-viewdlg-body p { margin:0; font-size:12.5px; line-height:1.6; color:var(--dsw-label-2); }
.tasks-viewdlg-input { width:100%; box-sizing:border-box; border:1px solid var(--dsw-border); border-radius:8px; padding:8px 10px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:13px; outline:none; }
.tasks-viewdlg-input:focus { border-color:var(--dsw-business); }
.tasks-viewdlg-error { font-size:11.5px; color:var(--dsw-danger); }
.tasks-viewdlg-actions { display:flex; justify-content:flex-end; gap:8px; }
.tasks-viewdlg-cancel, .tasks-viewdlg-ok { border:1px solid var(--dsw-border); border-radius:8px; padding:6px 14px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.tasks-viewdlg-cancel:hover { background:var(--dsw-hover); }
.tasks-viewdlg-ok { border-color:var(--dsw-business); background:var(--dsw-business); color:var(--dsw-bg); }
.tasks-viewdlg-ok.is-danger { border-color:var(--dsw-danger); background:var(--dsw-danger); color:var(--dsw-bg); }
.tasks-viewdlg-ok:disabled, .tasks-viewdlg-cancel:disabled { opacity:.6; cursor:default; }
@keyframes tasks-fade-in { from { opacity:0 } to { opacity:1 } }

/* ---- 排序按钮 + 菜单 ---- */
.tasks-sort-wrap { position:relative; display:inline-flex; flex:none; }
.tasks-sort-btn { position:relative; display:inline-flex; align-items:center; justify-content:center; width:28px; height:26px; border:0; border-radius:8px; padding:0; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; }
.tasks-sort-btn:hover { background:var(--dsw-hover); }
.tasks-sort-btn.is-custom { color:var(--dsw-business); }
.tasks-sort-btn.is-active { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 10%, var(--dsw-input)); }
/* 与筛选菜单 tasks-filter-menu 完全对齐 */
.tasks-sort-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:180px; padding:8px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:8px; }
.tasks-sort-head { font-size:10.5px; font-weight:600; color:var(--dsw-label-3); }
.tasks-sort-item { display:inline-flex; align-items:center; justify-content:space-between; gap:8px; border:0; border-radius:7px; padding:6px 8px; background:transparent; color:var(--dsw-label-2); font:inherit; font-size:12px; font-weight:550; cursor:pointer; text-align:left; }
.tasks-sort-item-label { display:inline-flex; align-items:center; min-width:0; }
.tasks-sort-item:hover { background:var(--dsw-hover); }
.tasks-sort-item.is-active { color:var(--dsw-business); font-weight:650; }
.tasks-sort-item-icon { display:inline-flex; align-items:center; justify-content:center; width:16px; flex:none; color:var(--dsw-label-3); }
.tasks-sort-item-icon.is-on { color:var(--dsw-business); }
.tasks-mode-item-ico { display:inline-flex; align-items:center; margin-right:6px; }

/* ---- 看板视图（Notion 风格：极轻边框、无重色、悬浮轻阴影）---- */
.tasks-board { display:grid; grid-template-columns:repeat(5, minmax(240px, 1fr)); gap:12px; margin-top:10px; align-items:start; min-width:0; width:100%; max-width:100%; overflow-x:auto; }
.tasks-board.is-compact { gap:10px; grid-template-columns:repeat(5, minmax(220px, 1fr)); }
.tasks-board-col { display:flex; flex-direction:column; min-width:0; min-height:148px; background:color-mix(in srgb, var(--dsw-muted-fill) 38%, transparent); border-radius:10px; padding:10px; }
.tasks-board-colhead { display:flex; align-items:center; gap:6px; padding:4px 6px 10px; color:var(--dsw-label-2); font-size:14px; font-weight:600; }
.tasks-board-col.is-overdue .tasks-board-colhead { color:var(--dsw-danger); font-weight:700; }
.tasks-board-col.is-blocked .tasks-board-colhead { color:#9a6700; }
.tasks-board-col.is-doing .tasks-board-colhead { color:var(--dsw-business); }
.tasks-board-col.is-done .tasks-board-colhead { color:#2f7d4c; }
.tasks-board-count { margin-left:auto; color:var(--dsw-label-3); font-size:14px; font-weight:600; background:var(--dsw-muted-fill); border-radius:8px; padding:1px 6px; }
.tasks-board-list { display:flex; flex-direction:column; gap:8px; }
.tasks-card { display:flex; flex-direction:column; gap:8px; width:100%; min-width:0; overflow:hidden; text-align:left; border:0; border-radius:8px; padding:12px 14px; background:var(--dsw-surface); color:var(--dsw-label); font:inherit; cursor:pointer; box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-border) 65%, transparent); transition:box-shadow .12s ease, transform .08s ease; }
.tasks-card:hover { box-shadow:0 1px 3px rgba(0,0,0,.08), 0 0 0 1px color-mix(in srgb, var(--dsw-border) 85%, transparent); transform:translateY(-1px); }
.tasks-card.is-active { background:color-mix(in srgb, var(--dsw-business) 6%, var(--dsw-surface)); }
.tasks-card-title { display:flex; align-items:flex-start; gap:8px; font-size:14px; font-weight:620; line-height:1.4; }
.tasks-card-titletext { flex:1; min-width:0; word-break:break-word; }
.tasks-card-blocked { flex:none; display:inline-flex; position:relative; top:3px; color:#9a6700; }
/* ---- 优先级 / 难度 徽标（icon + 文字，配色）---- */
.tasks-card-badge { flex:none; display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:3px 8px; font-size:14px; font-weight:700; line-height:1.4; white-space:nowrap; }
.tasks-card-badge.is-p-high { color:var(--dsw-danger); background:color-mix(in srgb, var(--dsw-danger) 12%, transparent); }
.tasks-card-badge.is-p-med { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.tasks-card-badge.is-p-low { color:var(--dsw-label-3); background:color-mix(in srgb, var(--dsw-label-3) 12%, transparent); }
.tasks-card-badge.is-reports { color:var(--dsw-label-2); background:color-mix(in srgb, var(--dsw-border) 45%, transparent); }
/* ---- 难度（高红 / 中橙 / 低绿）---- */
.tasks-card-badge.is-d-high { color:#d64545; background:color-mix(in srgb, #d64545 12%, transparent); }
.tasks-card-badge.is-d-med { color:#e07a2f; background:color-mix(in srgb, #e07a2f 12%, transparent); }
.tasks-card-badge.is-d-low { color:#3d9a5f; background:color-mix(in srgb, #3d9a5f 12%, transparent); }
.tasks-card-desc { min-width:0; max-width:100%; font-size:14px; color:var(--dsw-label-2); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; word-break:break-word; }
.tasks-card-meta { display:flex; align-items:center; gap:8px; font-size:14px; color:var(--dsw-label-3); margin-top:2px; }
.tasks-card-assignee { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-card-reports { margin-left:auto; color:var(--dsw-label-2); }
.tasks-card-badges { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.tasks-card-tags { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding-top:8px; border-top:1px solid color-mix(in srgb, var(--dsw-border) 60%, transparent); }
.tasks-card-due.is-overdue { color:var(--dsw-danger); font-weight:650; }
.tasks-board-empty { color:var(--dsw-label-3); font-size:14px; padding:14px 6px; text-align:center; }

.tasks-error { border-radius:7px; padding:6px 8px; background:var(--dsw-danger-soft); color:var(--dsw-danger); font-size:11px; }
.tasks-empty { color:var(--dsw-label-3); font-size:14px; line-height:1.45; padding:28px 16px; text-align:center; }
.tasks-empty.is-compact { padding:16px 10px; }
.tasks-table-wrap { min-width:0; width:100%; max-width:100%; overflow:auto; border:1px solid var(--dsw-border); border-radius:10px; background:color-mix(in srgb, var(--dsw-surface) 92%, transparent); }
.tasks-table { width:max-content; min-width:100%; border-collapse:collapse; table-layout:auto; font-size:14px; white-space:nowrap; }
.tasks-table th { padding:6px 6px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-3); font-weight:600; text-align:left; white-space:nowrap; position:sticky; top:0; background:var(--dsw-surface); z-index:1; }
.tasks-th { display:inline-flex; align-items:center; gap:4px; }
.tasks-table td { padding:4px 6px; border-bottom:1px solid color-mix(in srgb, var(--dsw-border) 80%, transparent); vertical-align:middle; }
.tasks-table tr:last-child td { border-bottom:0; }
.tasks-table tr:hover td { background:color-mix(in srgb, var(--dsw-hover) 55%, transparent); }
.tasks-table tr.is-active td { background:color-mix(in srgb, var(--dsw-business) 8%, transparent); }
.tasks-col-title { width:267px; min-width:267px; }
.tasks-col-status { width:92px; }
.tasks-status-pill { display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:2px 8px; font-size:14px; font-weight:600; }
.tasks-status-pill.is-todo { color:var(--dsw-label-3); background:color-mix(in srgb, var(--dsw-label-3) 10%, transparent); }
.tasks-status-pill.is-doing { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.tasks-status-pill.is-done { color:#2f7d4c; background:color-mix(in srgb, #2f7d4c 12%, transparent); }
.tasks-status-pill.is-blocked { color:#9a6700; background:color-mix(in srgb, #9a6700 12%, transparent); }
.tasks-status-pill.is-overdue { color:var(--dsw-danger); background:color-mix(in srgb, var(--dsw-danger) 12%, transparent); font-weight:700; }
.tasks-status-label { white-space:nowrap; }
.tasks-status-reports { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 4px; border-radius:999px; background:color-mix(in srgb, var(--dsw-border) 50%, transparent); font-size:14px; font-weight:700; color:var(--dsw-label-2); }
.tasks-col-priority { width:76px; }
.tasks-col-usage { width:96px; min-width:96px; color:var(--dsw-label-2); font-variant-numeric:tabular-nums; }
.tasks-table .traj-usage, .tasks-table .traj-usage-empty { font-size:14px; }
.tasks-col-actor { width:130px; }
.tasks-col-time { width:130px; }
.tasks-col-action { width:56px; }
.tasks-title-cell { display:flex; align-items:center; gap:2px; min-width:0; }
.tasks-title-open { flex:none; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:var(--dsw-label-3); border-radius:4px; cursor:pointer; padding:0; opacity:0; }
.tasks-title-cell:hover .tasks-title-open { opacity:1; }
.tasks-title-open:hover { opacity:1; color:var(--dsw-label); background:var(--dsw-hover); }
.tasks-tree-toggle { width:20px; height:20px; flex:none; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:var(--dsw-label-3); border-radius:4px; cursor:pointer; padding:0; }
.tasks-tree-toggle:hover { background:var(--dsw-hover); }
.tasks-tree-toggle.is-empty { cursor:default; }
.tasks-col-tags { width:130px; }
.tasks-col-project { width:150px; min-width:150px; }
.tasks-col-project .tasks-proj-tag { max-width:100%; overflow:hidden; text-overflow:ellipsis; display:inline-block; }
.tasks-proj-tag { display:inline-block; padding:1px 8px; border-radius:999px; font-size:14px; font-weight:600; color:var(--dsw-label-2); background:color-mix(in srgb, var(--dsw-border) 55%, transparent); white-space:nowrap; margin-right:0; }
.tasks-proj-empty { color:var(--dsw-label-3); font-size:14px; }
.tasks-tags { display:inline-flex; flex-wrap:wrap; gap:3px; vertical-align:middle; }
.tasks-tag { display:inline-flex; align-items:center; padding:1px 8px; border-radius:999px; font-size:14px; font-weight:600; color:var(--tag, #3b6fd9); background:color-mix(in srgb, var(--tag, #3b6fd9) 12%, transparent); white-space:nowrap; max-width:110px; overflow:hidden; text-overflow:ellipsis; }
.tasks-proj-tag { display:inline-block; padding:1px 8px; border-radius:999px; font-size:14px; font-weight:600; color:var(--dsw-label-2); background:color-mix(in srgb, var(--dsw-border) 55%, transparent); white-space:nowrap; margin-right:4px; }
.tasks-tag-editor { display:flex; flex-direction:column; gap:5px; }
.tasks-tag-select-wrap { position:relative; min-width:0; width:100%; }
.tasks-tag-select { display:flex; flex-wrap:nowrap; align-items:center; gap:4px; min-width:0; width:100%; overflow-x:auto; scrollbar-width:thin; }
.tasks-tag-select .tasks-tag { gap:2px; padding-right:4px; flex:none; }
.tasks-tag-x { border:0; background:transparent; padding:0; margin:0; color:inherit; opacity:.55; cursor:pointer; display:inline-flex; align-items:center; line-height:0; }
.tasks-tag-x:hover { opacity:1; }
.tasks-tag-select-input { flex:1; min-width:64px; border:0; background:transparent; color:var(--dsw-label); font:inherit; font-size:14px; outline:none; padding:2px 0; }
.tasks-tag-select-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:40; min-width:180px; max-width:100%; max-height:220px; overflow:auto; padding:4px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:1px; }
.tasks-tag-select-option { display:flex; align-items:center; gap:6px; width:100%; border:0; background:transparent; padding:5px 6px; border-radius:5px; font:inherit; color:var(--dsw-label); cursor:pointer; text-align:left; font-size:13px; }
.tasks-tag-select-option:hover, .tasks-tag-select-option.is-active { background:var(--dsw-hover); }
.tasks-tag-select-empty { padding:8px 6px; color:var(--dsw-label-3); font-size:12px; }
.tasks-col-title .tasks-cell-input { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-cell-input { width:100%; border:0; border-radius:5px; padding:2px 4px; background:transparent; color:var(--dsw-label); font:inherit; outline:none; }
.tasks-cell-input:focus { background:var(--dsw-hover); }
.tasks-cellselect { position:relative; display:inline-flex; min-width:0; width:100%; }
.tasks-cellselect-trigger { display:inline-flex; align-items:center; gap:5px; width:100%; min-width:0; border:0; border-radius:6px; padding:3px 7px; background:transparent; color:var(--dsw-label); font:inherit; font-size:14px; font-weight:600; cursor:pointer; text-align:left; }
.tasks-cellselect-trigger:hover, .tasks-cellselect-trigger[data-open] { background:var(--dsw-hover); }
.tasks-chip-text { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tasks-cellselect-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:40; min-width:110px; padding:3px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.16); display:flex; flex-direction:column; gap:1px; }
.tasks-cellselect-option { display:flex; align-items:center; gap:6px; width:100%; border:0; background:transparent; padding:5px 8px; border-radius:5px; font:inherit; font-size:14px; font-weight:600; color:var(--dsw-label); cursor:pointer; text-align:left; white-space:nowrap; }
.tasks-cellselect-option:hover { background:var(--dsw-hover); }
.tasks-cellselect-option.is-selected { background:color-mix(in srgb, var(--dsw-business) 14%, transparent); }
.tasks-cellselect-trigger.is-todo { color:var(--dsw-label-3); }
.tasks-cellselect-trigger.is-doing { color:var(--dsw-business); }
.tasks-cellselect-trigger.is-done { color:#2f7d4c; }
.tasks-cellselect-trigger.is-p-high { color:var(--dsw-danger); }
.tasks-cellselect-trigger.is-p-med { color:var(--dsw-business); }
.tasks-cellselect-trigger.is-p-low { color:var(--dsw-label-3); }
.tasks-cellselect-trigger.is-d-high { color:#d64545; }
.tasks-cellselect-trigger.is-d-med { color:#e07a2f; }
.tasks-cellselect-trigger.is-d-low { color:#3d9a5f; }
.tasks-status-cell { display:flex; align-items:center; gap:4px; min-width:0; }
.tasks-status-icon { display:inline-flex; color:var(--dsw-label-3); flex:none; }
.tasks-status-icon.is-doing { color:var(--dsw-business); }
.tasks-status-icon.is-done { color:#2f7d4c; }
.tasks-assignee-inline { display:flex; align-items:center; gap:4px; min-width:0; }
.tasks-assignee-picker { position:relative; display:inline-flex; min-width:0; width:100%; }
.tasks-assignee-trigger { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:100%; border:0; background:transparent; padding:2px 4px; border-radius:5px; color:inherit; font:inherit; cursor:pointer; text-align:left; }
.tasks-assignee-trigger:hover, .tasks-assignee-trigger[data-open] { background:var(--dsw-hover); }
.tasks-assignee-trigger .tasks-actor { max-width:none; }
.tasks-assignee-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:30; min-width:180px; max-width:260px; max-height:260px; overflow:auto; padding:4px; background:var(--dsw-sidebar); border:1px solid var(--dsw-border); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.18); display:flex; flex-direction:column; gap:1px; }
.tasks-assignee-option { display:flex; align-items:center; gap:6px; width:100%; border:0; background:transparent; padding:5px 6px; border-radius:5px; font:inherit; color:var(--dsw-label); cursor:pointer; text-align:left; }
.tasks-assignee-option:hover { background:var(--dsw-hover); }
.tasks-assignee-option.is-selected { background:color-mix(in srgb, var(--dsw-business) 14%, transparent); }
.tasks-assignee-option .tasks-actor-name { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tasks-avatar-clear { background:var(--dsw-muted-fill); }
.tasks-assignee-loading { display:flex; align-items:center; gap:6px; padding:6px; color:var(--dsw-label-3); font-size:11px; }
.tasks-time { display:inline-flex; align-items:center; gap:3px; color:var(--dsw-label-3); font-size:14px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.tasks-time.is-empty { opacity:.7; }
.tasks-actor { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:140px; }
.tasks-actor.is-empty { color:var(--dsw-label-3); }
.tasks-avatar { width:16px; height:16px; border-radius:5px; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:700; flex:none; box-shadow:inset 0 0 0 1px color-mix(in srgb, #000 18%, transparent); }
.tasks-mascot { position:relative; }
.tasks-mascot-busy { position:absolute; right:-1px; bottom:-1px; width:5px; height:5px; border-radius:50%; background:#35c17a; box-shadow:0 0 0 1.5px #fff; }
.tasks-actor-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; color:var(--dsw-label-2); }
.tasks-actor-kind { font-size:14px; color:var(--dsw-label-3); border:1px solid var(--dsw-border); border-radius:3px; padding:0 3px; line-height:1.3; }
.tasks-exec { display:inline-flex; align-items:center; gap:3px; border-radius:999px; padding:1px 6px; font-size:14px; font-weight:650; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
.tasks-exec.is-running { background:color-mix(in srgb, var(--dsw-business) 16%, transparent); color:var(--dsw-business); }
.tasks-exec.is-idle { background:color-mix(in srgb, #3d9a5f 14%, transparent); color:#2f7d4c; }
.tasks-exec.is-muted { background:var(--dsw-muted-fill); color:var(--dsw-label-3); }
.tasks-spin { animation: tasks-spin 1s linear infinite; }
@keyframes tasks-spin { to { transform: rotate(360deg); } }
.tasks-row-actions { display:inline-flex; align-items:center; gap:2px; }
.tasks-icon-btn { border:0; border-radius:5px; padding:3px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; display:inline-flex; align-items:center; justify-content:center; }
.tasks-icon-btn:hover, .tasks-icon-btn.is-active { background:var(--dsw-hover); color:var(--dsw-label); }
.tasks-modal-backdrop { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45); padding:28px; }
.tasks-detail-modal { width:min(880px, 94vw); height:min(720px, 88vh); display:flex; flex-direction:column; min-height:0; border-radius:10px; border:1px solid var(--dsw-border); background:var(--dsw-sidebar); box-shadow:var(--dsw-shadow-lv2); overflow:hidden; }
.tasks-detail-head { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px; padding:8px 10px 8px 12px; border:0; }
.tasks-detail-pager { display:inline-flex; align-items:center; gap:1px; flex:none; justify-self:start; }
.tasks-detail-pager .tasks-icon-btn:disabled { opacity:.35; cursor:default; }
.tasks-detail-tabs { display:inline-flex; align-items:center; gap:2px; padding:2px; border-radius:8px; background:var(--dsw-muted-fill); justify-self:center; }
.tasks-detail-head-actions { display:inline-flex; align-items:center; gap:2px; justify-self:end; }
.tasks-icon-btn.is-danger { color:var(--dsw-danger); }
.tasks-icon-btn.is-danger:hover { background:var(--dsw-danger-soft); color:var(--dsw-danger); }
.tasks-detail-tabs button { border:0; background:transparent; color:var(--dsw-label-3); padding:5px 10px; border-radius:6px; font:inherit; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.tasks-detail-tabs button:hover { color:var(--dsw-label-2); }
.tasks-detail-tabs button.is-active { background:var(--dsw-surface); color:var(--dsw-label); box-shadow:none; }
.tasks-detail-tab-dot { width:6px; height:6px; border-radius:50%; background:var(--dsw-ok); }
.tasks-detail-tab-count { min-width:16px; height:16px; padding:0 5px; border-radius:999px; background:var(--dsw-hover-strong); color:var(--dsw-label-2); font-size:10px; font-weight:700; line-height:16px; text-align:center; }
.tasks-detail-split { display:flex; flex-direction:column; flex:1; min-height:0; overflow:auto; }
.tasks-detail-main { display:flex; flex-direction:column; gap:8px; padding:20px 22px 24px; overflow:visible; min-width:0; }
.tasks-detail-aside { display:flex; flex-direction:column; gap:2px; padding:8px 0 12px; overflow:visible; border:0; background:transparent; }
.tasks-detail-pane { flex:1; min-height:0; overflow:auto; padding:16px 18px 20px; }
.tasks-detail-pane .tasks-automation { border:0; background:transparent; padding:0; }
.tasks-prop { display:grid; grid-template-columns:108px minmax(0,1fr); align-items:center; gap:8px; min-height:32px; font-size:14px; color:var(--dsw-label-3); }
.tasks-prop > span { font-size:14px; font-weight:600; color:var(--dsw-label-3); display:inline-flex; align-items:center; gap:6px; min-width:0; }
.tasks-prop > span svg { flex:none; opacity:.85; }
.tasks-prop.is-stack { align-items:start; padding-top:8px; }
.tasks-prop .tasks-field-input { padding:4px 0; font-size:14px; background:transparent; border:0; border-radius:0; box-shadow:none; }
.tasks-prop .tasks-field-input:focus { border:0; box-shadow:none; }
.tasks-prop .tasks-cellselect-trigger { padding:4px 0; font-size:14px; }
.tasks-prop .tasks-actor-name { font-size:14px; }
.tasks-detail-title-input { width:100%; border:0; background:transparent; color:var(--dsw-label); font:inherit; font-size:22px; font-weight:700; line-height:1.35; outline:none; padding:0; resize:none; }
.tasks-detail-id { font-size:14px; font-weight:400; color:var(--dsw-label-2); font-family:var(--font-mono); letter-spacing:.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-detail-doc { width:100%; flex:none; min-height:180px; field-sizing:content; border:0; background:transparent; color:var(--dsw-label); font:inherit; font-size:16px; line-height:1.65; outline:none; resize:none; overflow:hidden; padding:8px 0 0; }
@media (max-width: 720px) {
  .tasks-detail-modal { width:min(94vw, 880px); height:min(90vh, 720px); }
}
.tasks-field { display:flex; flex-direction:column; gap:5px; font-size:11px; color:var(--dsw-label-3); }
.tasks-field > span { display:inline-flex; align-items:center; gap:5px; font-weight:600; font-size:10.5px; letter-spacing:.02em; }
.tasks-field-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.tasks-field-input, .tasks-field-textarea { width:100%; border:1px solid color-mix(in srgb, var(--dsw-border) 85%, transparent); border-radius:7px; padding:7px 10px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:14px; outline:none; resize:vertical; transition:border-color .12s, box-shadow .12s; }
.tasks-field-input:focus, .tasks-field-textarea:focus { border-color:color-mix(in srgb, var(--dsw-business) 55%, transparent); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.tasks-field-textarea { min-height:80px; line-height:1.55; }
.tasks-detail-actor { display:flex; flex-direction:column; gap:6px; }
.tasks-detail-meta { display:flex; flex-direction:column; gap:14px; }
/* 键值 stat 列表 */
.tasks-exec-stats { display:flex; flex-direction:column; gap:8px; }
.tasks-exec-stat { display:flex; align-items:flex-start; gap:12px; font-size:14px; color:var(--dsw-label-2); }
.tasks-exec-stat-label { flex:none; width:88px; display:inline-flex; align-items:center; gap:5px; color:var(--dsw-label-3); font-size:14px; font-weight:600; padding-top:1px; }
.tasks-exec-stat-value { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; font-size:14px; }
.tasks-exec-stat-value .tasks-actor-name { font-size:14px; font-weight:600; color:var(--dsw-label); }
.tasks-exec-stat .tasks-time { display:inline-flex; align-items:center; gap:4px; font-size:14px; color:var(--dsw-label-2); }
.tasks-exec-stat .traj-usage { font-size:14px; }
.tasks-detail-usage-total-capsule { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:2px 10px; background:color-mix(in srgb, var(--dsw-business) 12%, transparent); color:var(--dsw-label); font-weight:650; white-space:nowrap; width:fit-content; }
.tasks-detail-usage-total-capsule svg { color:var(--dsw-business); }
.tasks-detail-usage-breakdown { color:var(--dsw-label-3); font-weight:500; }
.tasks-blocked-head { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:650; color:#9a6700; }
.tasks-blocked-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:5px; border:1px solid color-mix(in srgb, #9a6700 26%, transparent); border-radius:8px; padding:8px 10px; background:color-mix(in srgb, #9a6700 5%, transparent); }
.tasks-blocked-item { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--dsw-label-2); line-height:1.4; }
.tasks-blocked-dot { flex:none; width:6px; height:6px; border-radius:50%; background:#9a6700; }
/* 报告 timeline */
.tasks-exec-timeline-head { display:flex; align-items:center; gap:6px; margin-top:2px; padding-top:12px; border-top:1px solid var(--dsw-border); font-size:10.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--dsw-label-3); }
.tasks-report-timeline { margin:8px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; }
.tasks-report-item { position:relative; display:flex; gap:12px; padding-bottom:16px; }
.tasks-report-item:last-child { padding-bottom:0; }
.tasks-report-node { flex:none; position:relative; z-index:1; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
.tasks-report-item.is-done .tasks-report-node { color:#2f7d4c; background:color-mix(in srgb, #2f7d4c 18%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, #2f7d4c 32%, transparent); }
.tasks-report-item.is-doing .tasks-report-node { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 16%, transparent); box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-business) 30%, transparent); }
.tasks-report-rail { position:absolute; left:9px; top:22px; bottom:-2px; width:2px; background:var(--dsw-border); }
.tasks-report-item:last-child .tasks-report-rail { display:none; }
.tasks-report-content { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
.tasks-report-head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.tasks-report-status { display:inline-flex; align-items:center; gap:4px; font-weight:650; font-size:11px; color:var(--dsw-label); }
.tasks-report-item.is-done .tasks-report-status { color:#2f7d4c; }
.tasks-report-item.is-doing .tasks-report-status { color:var(--dsw-business); }
.tasks-report-turn { color:var(--dsw-label-2); font-weight:600; font-size:10.5px; }
.tasks-report-stats { color:var(--dsw-label-3); font-size:10.5px; }
.tasks-report-time { color:var(--dsw-label-3); font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.tasks-report-note { color:var(--dsw-label-2); font-size:11px; line-height:1.5; white-space:normal; word-break:break-word; padding:8px 10px; border:1px solid var(--dsw-border); border-radius:8px; background:color-mix(in srgb, var(--dsw-muted-fill) 50%, transparent); }
.tasks-report-usage { display:flex; align-items:center; justify-content:space-between; gap:12px; color:var(--dsw-label-3); font-size:12px; font-variant-numeric:tabular-nums; }
.tasks-report-usage .traj-usage, .tasks-report-usage .traj-usage-empty { font-size:12px; }

/* ---- 依赖（DAG）视图 ---- */
/* ---- DAG 依赖图（自绘 SVG + 缩放）---- */
.tasks-graph { margin-top:8px; border:1px solid color-mix(in srgb, var(--dsw-border) 80%, transparent); border-radius:10px; background:color-mix(in srgb, var(--dsw-muted-fill) 26%, transparent); overflow:hidden; flex:1; min-width:0; min-height:320px; display:flex; flex-direction:column; }
.tasks-graph.is-compact { min-height:200px; }
.tasks-graph-rf { width:100%; flex:1; min-height:0; }
.tasks-graph .react-flow__attribution { display:none; }
.tasks-graph .react-flow__controls { overflow:hidden; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,.14); }
.tasks-graph .react-flow__control-button { background:var(--dsw-surface); color:var(--dsw-label-2); border-bottom:1px solid color-mix(in srgb, var(--dsw-border) 60%, transparent); }
.tasks-graph-node-wrap { position:relative; width:100%; height:100%; }
.tasks-graph-node-wrap .react-flow__handle { width:10px; height:10px; border:2px solid var(--dsw-surface); border-radius:50%; background:var(--dsw-border); }
.tasks-graph-node-wrap .react-flow__handle-left { left:-6px; }
.tasks-graph-node-wrap .react-flow__handle-right { right:-6px; }
.tasks-graph-node { display:flex; flex-direction:column; gap:8px; width:100%; height:100%; text-align:left; border:1px solid color-mix(in srgb, var(--dsw-border) 78%, transparent); border-radius:10px; padding:10px 12px; background:var(--dsw-surface); color:var(--dsw-label); font:inherit; cursor:pointer; box-sizing:border-box; box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-border) 60%, transparent); }
.tasks-graph-node:hover { border-color:color-mix(in srgb, var(--dsw-business) 55%, transparent); }
.tasks-graph-node.is-active { outline:2px solid color-mix(in srgb, var(--dsw-business) 65%, transparent); background:color-mix(in srgb, var(--dsw-business) 8%, var(--dsw-surface)); }
.tasks-graph-node.is-blocked { box-shadow:0 0 0 1px #d9822b; }
.tasks-graph-node-title { font-size:14px; font-weight:620; line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; word-break:break-word; padding-right:12px; }
.tasks-graph-node-meta { margin-top:auto; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.tasks-graph-status { font-size:14px; font-weight:650; color:var(--dsw-label-3); }
.tasks-graph-status.is-todo { color:var(--dsw-label-3); }
.tasks-graph-status.is-doing { color:var(--dsw-business); }
.tasks-graph-status.is-done { color:#2f7d4c; }
.tasks-graph-status.is-blocked { color:#d9822b; }
.tasks-graph-node-meta .tasks-card-badge { font-size:14px; padding:3px 8px; }

/* ---- 队列视图（清单风格：只展示叶节点，按状态分组）---- */
.tasks-queue { display:flex; flex-direction:column; gap:14px; margin-top:10px; overflow:auto; flex:1; min-width:0; width:100%; max-width:100%; min-height:0; padding-bottom:4px; }
.tasks-queue.is-compact { gap:10px; margin-top:6px; }
.tasks-queue-group { display:flex; flex-direction:column; gap:6px; }
.tasks-queue-ghead { display:flex; align-items:center; gap:6px; padding:4px 6px; color:var(--dsw-label-2); font-size:14px; font-weight:650; letter-spacing:.01em; }
.tasks-queue-ghead.is-overdue { color:var(--dsw-danger); font-weight:700; }
.tasks-queue-ghead.is-doing { color:var(--dsw-business); }
.tasks-queue-ghead.is-blocked { color:#9a6700; }
.tasks-queue-ghead.is-done { color:#2f7d4c; }
.tasks-queue-glabel { font-weight:650; }
.tasks-queue-count { margin-left:auto; color:var(--dsw-label-3); font-size:14px; font-weight:600; background:var(--dsw-muted-fill); border-radius:8px; padding:1px 7px; }
.tasks-queue-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.tasks-queue-item { display:flex; min-width:0; border:0; border-radius:0; }
.tasks-queue-item-main { display:flex; align-items:center; gap:8px; width:100%; min-width:0; box-sizing:border-box; overflow:hidden; text-align:left; border:0; border-radius:6px; padding:7px 8px; background:transparent; color:var(--dsw-label); font:inherit; cursor:pointer; box-shadow:none; }
.tasks-queue-item-main:hover { background:var(--dsw-hover); }
.tasks-queue-item.is-active .tasks-queue-item-main { background:color-mix(in srgb, var(--dsw-hover) 85%, transparent); }
.tasks-queue-item-title { flex:1; min-width:0; font-size:14px; font-weight:600; line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-queue-chain { color:var(--dsw-label-3); font-weight:500; }
.tasks-queue-item.is-done .tasks-queue-item-title { text-decoration:line-through; color:var(--dsw-label-3); }
.tasks-queue-pill { flex:none; display:inline-flex; align-items:center; gap:3px; border-radius:999px; padding:1px 6px; font-size:14px; font-weight:700; white-space:nowrap; }
.tasks-queue-pill.is-p-high { color:var(--dsw-danger); background:color-mix(in srgb, var(--dsw-danger) 12%, transparent); }
.tasks-queue-pill.is-p-med { color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.tasks-queue-pill.is-p-low { color:var(--dsw-label-3); background:color-mix(in srgb, var(--dsw-label-3) 12%, transparent); }
.tasks-queue-lock { flex:none; display:inline-flex; color:#9a6700; }
.tasks-queue-overdue { flex:none; display:inline-flex; align-items:center; gap:3px; border-radius:999px; padding:1px 6px; font-size:14px; font-weight:700; white-space:nowrap; color:var(--dsw-danger); background:color-mix(in srgb, var(--dsw-danger) 12%, transparent); }
.tasks-queue-meta { flex:none; display:flex; align-items:center; gap:8px; color:var(--dsw-label-3); font-size:14px; min-width:0; overflow:hidden; }
.tasks-queue-assignee { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; color:var(--dsw-label-2); }
.tasks-queue-meta .tasks-time { font-size:14px; }
.tasks-queue-item-main .traj-usage { font-size:14px; }
/* ---- Trigger 自动触发 ---- */
.tasks-status-cell { display:flex; align-items:center; gap:5px; min-width:0; }
.tasks-trigger-mark { flex:none; display:inline-flex; align-items:center; gap:3px; border-radius:999px; padding:1px 6px; font-size:14px; font-weight:700; white-space:nowrap; color:var(--dsw-business); background:color-mix(in srgb, var(--dsw-business) 12%, transparent); }
.tasks-trigger-mark.is-pending { color:#d9822b; background:color-mix(in srgb, #d9822b 14%, transparent); }
.tasks-trigger-mark.is-delivered { color:#2f7d4c; background:color-mix(in srgb, #2f7d4c 14%, transparent); }
.tasks-trigger-mark.is-done { color:#3d9a5f; background:color-mix(in srgb, #3d9a5f 12%, transparent); }
.tasks-trigger-mark.is-cancelled { color:var(--dsw-label-3); background:var(--dsw-muted-fill); }
/* 未启用但有配置 → 弱化灰 */
.tasks-trigger-mark.is-off { color:var(--dsw-label-3); background:var(--dsw-muted-fill); border:1px dashed color-mix(in srgb, var(--dsw-border) 70%, transparent); }
.tasks-trigger-mark-state { line-height:1; }
.tasks-trigger-count { display:inline-flex; align-items:center; justify-content:center; min-width:13px; height:13px; padding:0 3px; border-radius:999px; font-size:8.5px; font-weight:800; line-height:1; color:#fff; background:color-mix(in srgb, #9a6700 78%, transparent); }
.tasks-trigger-mark.is-off .tasks-trigger-count { background:var(--dsw-label-3); }
/* ---- 自动触发开关（紧凑 Notion 风格，icon + 触发源数量）---- */
.tasks-trigger-toggle { flex:none; display:inline-flex; align-items:center; gap:2px; border-radius:999px; padding:2px 6px; border:0; cursor:pointer; white-space:nowrap; line-height:1.3; font-family:inherit; color:var(--dsw-label-3); background:var(--dsw-muted-fill); box-shadow:inset 0 0 0 1px var(--dsw-border); transition:background .15s ease, color .15s ease; }
.tasks-trigger-toggle:hover { background:var(--dsw-hover); }
.tasks-trigger-toggle.is-on { color:var(--dsw-ok); background:color-mix(in srgb, var(--dsw-ok) 18%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-ok) 30%, transparent); }
.tasks-trigger-toggle.is-on:hover { background:color-mix(in srgb, var(--dsw-ok) 28%, transparent); }
.tasks-trigger-toggle .tasks-trigger-count { min-width:15px; height:14px; padding:0 4px; font-size:9.5px; background:transparent; color:var(--dsw-label-3); }
.tasks-trigger-toggle.is-on .tasks-trigger-count { color:var(--dsw-ok); }
.tasks-status-cell .tasks-trigger-toggle { margin-left:4px; }
.tasks-trigger-field { display:flex; flex-direction:column; gap:4px; font-size:10.5px; color:var(--dsw-label-3); font-weight:600; }
.tasks-trigger-field > span { color:var(--dsw-label-3); letter-spacing:.02em; }
.tasks-trigger-status { display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--dsw-border); padding-top:10px; }
.tasks-trigger-state-pill { align-self:flex-start; display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:3px 10px; font-size:10.5px; font-weight:650; background:var(--dsw-muted-fill); color:var(--dsw-label-2); box-shadow:inset 0 0 0 1px var(--dsw-border); }
.tasks-trigger-state-dot { width:7px; height:7px; border-radius:50%; background:var(--dsw-label-3); }
.tasks-trigger-state-pill.is-pending .tasks-trigger-state-dot { background:#d9822b; }
.tasks-trigger-state-pill.is-delivered .tasks-trigger-state-dot { background:#2f7d4c; }
.tasks-trigger-state-pill.is-done .tasks-trigger-state-dot { background:#3d9a5f; }
.tasks-trigger-state-pill.is-pending { color:#d9822b; }
.tasks-trigger-state-pill.is-delivered { color:#2f7d4c; }
.tasks-trigger-state-pill.is-done { color:#3d9a5f; }
.tasks-trigger-times { display:flex; flex-direction:column; gap:4px; }
.tasks-trigger-next, .tasks-trigger-last { display:flex; align-items:baseline; gap:8px; font-size:10.5px; color:var(--dsw-label-2); }
.tasks-trigger-tk { flex:none; width:48px; color:var(--dsw-label-3); font-weight:600; }
.tasks-trigger-tv { font-variant-numeric:tabular-nums; font-weight:650; color:var(--dsw-label); }
.tasks-trigger-ts { color:var(--dsw-label-3); font-variant-numeric:tabular-nums; font-weight:400; margin-left:auto; }

/* ---- Notion Automation 风格规则卡片 ---- */
.tasks-automation { flex:none; width:100%; box-sizing:border-box; display:flex; flex-direction:column; gap:10px; padding:12px; border:1px solid var(--dsw-border); border-radius:10px; background:var(--dsw-surface); }
.tasks-auto-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.tasks-auto-title { display:inline-flex; align-items:center; gap:6px; font-weight:650; font-size:11.5px; color:var(--dsw-label); letter-spacing:.01em; }
.tasks-auto-switch { flex:none; position:relative; display:inline-flex; align-items:center; height:22px; cursor:pointer; }
.tasks-auto-switch input { position:absolute; opacity:0; width:100%; height:100%; margin:0; cursor:pointer; }
.tasks-auto-switch-track { position:relative; width:34px; height:20px; border-radius:999px; background:color-mix(in srgb, var(--dsw-label-3) 24%, transparent); box-shadow:inset 0 0 0 1px var(--dsw-border); transition:background .2s ease; pointer-events:none; }
.tasks-auto-switch-knob { position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:left .2s cubic-bezier(.4,0,.2,1); }
.tasks-auto-switch.is-on .tasks-auto-switch-track { background:var(--dsw-ok); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-ok) 30%, transparent); }
.tasks-auto-switch.is-on .tasks-auto-switch-knob { left:17px; }
.tasks-auto-summary { display:flex; align-items:flex-start; gap:7px; padding:8px 10px; border-radius:8px; background:color-mix(in srgb, var(--dsw-muted-fill) 60%, transparent); border:1px solid var(--dsw-border); font-size:11.5px; line-height:1.5; color:var(--dsw-label); font-weight:500; }
.tasks-auto-summary-dot { flex:none; margin-top:5px; width:6px; height:6px; border-radius:50%; background:var(--dsw-business); box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-business) 22%, transparent); }
.tasks-auto-sec-head { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--dsw-label-3); margin-top:2px; }
.tasks-auto-sec { display:flex; flex-direction:column; gap:9px; padding:10px 11px; border:1px solid var(--dsw-border); border-radius:8px; background:color-mix(in srgb, var(--dsw-muted-fill) 35%, transparent); }
.tasks-auto-seg { display:inline-flex; gap:2px; padding:2px; border-radius:8px; background:color-mix(in srgb, var(--dsw-muted-fill) 70%, transparent); box-shadow:inset 0 0 0 1px var(--dsw-border); }
.tasks-auto-seg button { border:0; background:transparent; color:var(--dsw-label-3); padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; font-family:inherit; transition:background .15s ease, color .15s ease; }
.tasks-auto-seg button:hover { color:var(--dsw-label); }
.tasks-auto-seg button.is-active { background:var(--dsw-surface); color:var(--dsw-label); box-shadow:0 1px 2px rgba(0,0,0,.3); }
.tasks-auto-preset { flex-wrap:wrap; }
.tasks-auto-then { flex-direction:row; align-items:center; gap:8px; }
.tasks-auto-then-arrow { display:inline-flex; color:var(--dsw-ok); }
.tasks-auto-then-text { font-size:11.5px; color:var(--dsw-label-2); font-weight:500; }

/* ---- 触发条件列表（每条件一行，可删除）---- */
.tasks-auto-cond-list { display:flex; flex-direction:column; gap:8px; }
.tasks-auto-cond { border:1px solid var(--dsw-border); border-radius:8px; background:color-mix(in srgb, var(--dsw-muted-fill) 45%, transparent); overflow:hidden; }
.tasks-auto-cond-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; background:color-mix(in srgb, var(--dsw-muted-fill) 60%, transparent); }
.tasks-auto-cond-type { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:650; color:var(--dsw-label); }
.tasks-auto-cond-del { flex:none; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:6px; border:0; cursor:pointer; color:var(--dsw-label-3); background:transparent; transition:background .12s ease, color .12s ease; }
.tasks-auto-cond-del:hover { background:color-mix(in srgb, var(--dsw-danger) 16%, transparent); color:var(--dsw-danger); }
.tasks-auto-cond-body { display:flex; flex-direction:column; gap:8px; padding:8px 10px; }
.tasks-auto-add { margin-top:2px; }
.tasks-auto-add-btn { display:inline-flex; align-items:center; gap:5px; border:1px dashed var(--dsw-border); border-radius:8px; padding:5px 10px; background:transparent; color:var(--dsw-label-3); font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .12s ease, color .12s ease, border-color .12s ease; }
.tasks-auto-add-btn:hover { color:var(--dsw-label); border-color:color-mix(in srgb, var(--dsw-border) 160%, transparent); background:var(--dsw-hover); }



/* ---- Notion 风格 trigger 友好配置 ---- */
.tasks-trigger-mode, .tasks-cron-week { appearance:none; -webkit-appearance:none; border:1px solid var(--dsw-border); border-radius:6px; padding:4px 8px; font-size:12px; color:var(--dsw-label); background:var(--dsw-muted-fill); cursor:pointer; width:auto; max-width:100%; font-family:inherit; }
.tasks-trigger-mode:hover, .tasks-cron-week:hover { background:var(--dsw-hover); }
.tasks-cron-num { width:72px; }
.tasks-trigger-time { display:flex; align-items:center; gap:4px; }
.tasks-trigger-time .tasks-cron-num { width:56px; }
.tasks-trigger-time-sep { color:var(--dsw-label-3); font-weight:700; font-size:13px; }
.tasks-trigger-preview-wrap { gap:6px; }
.tasks-trigger-preview { color:var(--dsw-label-2); font-size:11.5px; font-weight:650; font-variant-numeric:tabular-nums; padding:3px 8px; border-radius:6px; background:color-mix(in srgb, var(--dsw-business) 8%, transparent); border:1px solid color-mix(in srgb, var(--dsw-border) 60%, transparent); display:inline-flex; align-items:center; gap:4px; }
.tasks-trigger-cronfield { display:flex; gap:6px; flex-wrap:wrap; }
.tasks-cron-field { display:flex; flex-direction:column; gap:3px; }
.tasks-cron-field > span { font-size:10px; color:var(--dsw-label-3); font-weight:600; }
.tasks-cron-field .tasks-field-input { width:44px; padding:3px 5px; text-align:center; font-size:11.5px; font-variant-numeric:tabular-nums; }
.tasks-cron-field:hover .tasks-field-input { border-color:var(--dsw-business); }
.tasks-cron-field.is-invalid .tasks-field-input { border-color:var(--dsw-danger); box-shadow:0 0 0 1px color-mix(in srgb, var(--dsw-danger) 30%, transparent); }
`
  if (!style.parentNode) document.head.appendChild(style)
}
