import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import type { Context } from 'cordis'
import {
  LuActivity,
  LuBot,
  LuCalendarClock,
  LuCircleCheck,
  LuCircleDashed,
  LuClock,
  LuColumns3,
  LuFlag,
  LuListChecks,
  LuLoaderCircle,
  LuPlus,
  LuSearch,
  LuTable2,
  LuText,
  LuTrash2,
  LuUserRound,
} from 'react-icons/lu'

export type SlotProps = Record<string, unknown> & {
  renderSlot?: (name: string) => unknown
}

type SlotsService = {
  place: (slot: string, view: unknown, opts: { key: string; order: number }) => unknown
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'

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

export type Task = {
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
  execution?: TaskExecution
}

type ViewMode = 'table' | 'board'

const STATUS_META: Array<{ id: TaskStatus; label: string; icon: ReactNode }> = [
  { id: 'todo', label: '待办', icon: <LuCircleDashed size={13} aria-hidden /> },
  { id: 'doing', label: '进行中', icon: <LuLoaderCircle size={13} aria-hidden /> },
  { id: 'done', label: '已完成', icon: <LuCircleCheck size={13} aria-hidden /> },
]

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: '低',
  med: '中',
  high: '高',
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

async function fetchTasks(q = ''): Promise<Task[]> {
  const url = q.trim() ? `/api/tasks?q=${encodeURIComponent(q.trim())}` : '/api/tasks'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { tasks?: Task[] }
  return Array.isArray(body.tasks) ? body.tasks : []
}

async function createTask(title: string): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  const body = (await res.json()) as { task?: Task; error?: string }
  if (!res.ok || !body.task) throw new Error(body.error || `HTTP ${res.status}`)
  return body.task
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

function formatDue(ts: number | null): string {
  if (!ts) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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

function TimeLabel({ ts, empty = '—' }: { ts: number | null | undefined; empty?: string }) {
  if (!ts) {
    return (
      <span className="tasks-time is-empty">
        <LuClock size={12} aria-hidden />
        {empty}
      </span>
    )
  }
  return (
    <span className="tasks-time" title={new Date(ts).toLocaleString()}>
      <LuClock size={12} aria-hidden />
      {formatWhen(ts)}
    </span>
  )
}

function ActorChip({ actor, empty = '未分配' }: { actor: TaskActor | null | undefined; empty?: string }) {
  if (!actor) {
    return (
      <span className="tasks-actor is-empty">
        <LuUserRound size={13} aria-hidden />
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
      <span className="tasks-avatar" style={{ background: color }} aria-hidden>
        {actor.kind === 'agent' ? <LuBot size={11} /> : initial}
      </span>
      <span className="tasks-actor-name">{actor.name}</span>
      {actor.kind === 'agent' ? <span className="tasks-actor-kind">Agent</span> : null}
    </span>
  )
}

function ExecBadge({ execution }: { execution?: TaskExecution }) {
  if (!execution || execution.status === 'unassigned') {
    return (
      <span className="tasks-exec is-muted">
        <LuCircleDashed size={12} aria-hidden />
        未派工
      </span>
    )
  }
  if (execution.status === 'running') {
    return (
      <span className="tasks-exec is-running" title={execution.assistantText || execution.reason || ''}>
        <LuLoaderCircle size={12} className="tasks-spin" aria-hidden />
        执行中{execution.turn != null ? ` · T${execution.turn}` : ''}
      </span>
    )
  }
  const doneHint = execution.reason === 'stop' || execution.reason === 'end' || Boolean(execution.assistantText)
  return (
    <span
      className={`tasks-exec ${doneHint ? 'is-idle' : 'is-muted'}`}
      title={execution.assistantText || execution.reason || ''}
    >
      {doneHint ? <LuCircleCheck size={12} aria-hidden /> : <LuActivity size={12} aria-hidden />}
      {doneHint ? '已响应' : '空闲'}
      {execution.turn != null ? ` · T${execution.turn}` : ''}
    </span>
  )
}

function PriorityMark({ value }: { value: TaskPriority }) {
  return (
    <span className={`tasks-priority is-${value}`} title={`优先级 ${PRIORITY_LABEL[value]}`}>
      <LuFlag size={12} aria-hidden />
      <span>{PRIORITY_LABEL[value]}</span>
    </span>
  )
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const meta = STATUS_META.find((item) => item.id === status)
  return <span className={`tasks-status-icon is-${status}`}>{meta?.icon}</span>
}

function TasksWorkspace({ compact = false }: { compact?: boolean }) {
  const { tasks, setTasks, error, loading, refresh, query, setQuery } = useTasks(compact ? 3000 : 2500)
  const [view, setView] = useState<ViewMode>(compact ? 'board' : 'table')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => {
    const map = { todo: 0, doing: 0, done: 0, total: tasks.length }
    for (const task of tasks) map[task.status] += 1
    return map
  }, [tasks])

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
    for (const task of tasks) map[task.status].push(task)
    for (const key of Object.keys(map) as TaskStatus[]) {
      map[key].sort((a, b) => a.sort - b.sort || b.updatedAt - a.updatedAt)
    }
    return map
  }, [tasks])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      const task = await createTask(title)
      setTasks((prev) => [task, ...prev.filter((item) => item.id !== task.id)])
      setDraft('')
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  async function onUpdate(id: string, patch: Record<string, unknown>) {
    setTasks((prev) => prev.map((item) => (item.id === id ? ({ ...item, ...patch } as Task) : item)))
    try {
      const task = await patchTask(id, patch)
      setTasks((prev) => prev.map((item) => (item.id === id ? task : item)))
    } catch {
      void refresh()
    }
  }

  async function onDelete(id: string) {
    setTasks((prev) => prev.filter((item) => item.id !== id))
    try {
      await removeTask(id)
    } catch {
      void refresh()
    }
  }

  async function onDropStatus(taskId: string, status: TaskStatus) {
    const hit = tasks.find((item) => item.id === taskId)
    if (!hit || hit.status === status) return
    await onUpdate(taskId, { status })
  }

  return (
    <div className={`tasks-root${compact ? ' is-compact' : ''}`}>
      <header className="tasks-head">
        <div className="tasks-head-left">
          <h1 className="tasks-title">
            <LuListChecks size={compact ? 16 : 22} aria-hidden />
            任务
          </h1>
          <div className="tasks-stats" aria-label="任务统计">
            <span className="is-todo">
              <LuCircleDashed size={12} aria-hidden />
              {counts.todo} 待办
            </span>
            <span className="is-doing">
              <LuLoaderCircle size={12} aria-hidden />
              {counts.doing} 进行
            </span>
            <span className="is-done">
              <LuCircleCheck size={12} aria-hidden />
              {counts.done} 完成
            </span>
          </div>
        </div>
        <div className="tasks-view-switch" role="tablist" aria-label="视图">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            className={`tasks-view-btn${view === 'table' ? ' is-active' : ''}`}
            onClick={() => setView('table')}
          >
            <LuTable2 size={13} aria-hidden />
            表格
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'board'}
            className={`tasks-view-btn${view === 'board' ? ' is-active' : ''}`}
            onClick={() => setView('board')}
          >
            <LuColumns3 size={13} aria-hidden />
            看板
          </button>
        </div>
      </header>

      <div className="tasks-toolbar">
        <form className="tasks-create" onSubmit={onCreate}>
          <input
            className="tasks-create-input"
            value={draft}
            placeholder="新建任务，回车添加"
            aria-label="新建任务"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="tasks-create-btn" disabled={busy || !draft.trim()}>
            <LuPlus size={14} aria-hidden />
            添加
          </button>
        </form>
        <label className="tasks-search-wrap">
          <LuSearch size={14} aria-hidden />
          <input
            className="tasks-search"
            value={query}
            placeholder="搜索标题 / 人 / 备注"
            aria-label="搜索任务"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {error ? <div className="tasks-error">{error}</div> : null}
      {loading && tasks.length === 0 ? <div className="tasks-empty">加载中…</div> : null}

      {view === 'table' ? (
        <TasksTable tasks={tasks} onUpdate={onUpdate} onDelete={onDelete} compact={compact} />
      ) : (
        <TasksBoard columns={byStatus} onDropStatus={onDropStatus} onUpdate={onUpdate} onDelete={onDelete} />
      )}
    </div>
  )
}

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

function TasksTable({
  tasks,
  onUpdate,
  onDelete,
  compact,
}: {
  tasks: Task[]
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  compact: boolean
}) {
  if (tasks.length === 0) {
    return <div className="tasks-empty">还没有任务。上面输入一条，或让 Agent 调用 tasks_create。</div>
  }
  return (
    <div className="tasks-table-wrap">
      <table className="tasks-table">
        <thead>
          <tr>
            <ThIcon icon={<LuText size={12} aria-hidden />}>标题</ThIcon>
            <ThIcon icon={<LuCircleDashed size={12} aria-hidden />}>状态</ThIcon>
            <ThIcon icon={<LuFlag size={12} aria-hidden />}>优先级</ThIcon>
            {!compact ? <ThIcon icon={<LuUserRound size={12} aria-hidden />}>创建人</ThIcon> : null}
            {!compact ? <ThIcon icon={<LuClock size={12} aria-hidden />}>创建时间</ThIcon> : null}
            <ThIcon icon={<LuBot size={12} aria-hidden />}>分配人</ThIcon>
            {!compact ? <ThIcon icon={<LuClock size={12} aria-hidden />}>分配时间</ThIcon> : null}
            <ThIcon icon={<LuActivity size={12} aria-hidden />}>执行</ThIcon>
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="tasks-col-title">
                <div className="tasks-title-cell">
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
                  {task.dueAt ? (
                    <span className="tasks-due" title={`截止 ${formatDue(task.dueAt)}`}>
                      <LuCalendarClock size={11} aria-hidden />
                      {formatDue(task.dueAt)}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="tasks-col-status">
                <div className="tasks-status-cell">
                  <StatusIcon status={task.status} />
                  <select
                    className="tasks-cell-select"
                    value={task.status}
                    aria-label="状态"
                    onChange={(event) => void onUpdate(task.id, { status: event.target.value as TaskStatus })}
                  >
                    {STATUS_META.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="tasks-col-priority">
                <div className="tasks-status-cell">
                  <span className={`tasks-priority is-${task.priority}`} aria-hidden>
                    <LuFlag size={12} />
                  </span>
                  <select
                    className="tasks-cell-select tasks-priority-select"
                    value={task.priority}
                    aria-label="优先级"
                    onChange={(event) => void onUpdate(task.id, { priority: event.target.value as TaskPriority })}
                  >
                    {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => (
                      <option key={key} value={key}>
                        {PRIORITY_LABEL[key]}
                      </option>
                    ))}
                  </select>
                </div>
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
              <td className="tasks-col-actor">
                <div className="tasks-assignee-inline">
                  <ActorChip actor={task.assignee} />
                  <input
                    className="tasks-cell-input tasks-assignee-edit"
                    defaultValue={task.assignee?.sessionId || task.assignee?.name || ''}
                    key={`${task.id}-${task.updatedAt}-assignee`}
                    placeholder="分配…"
                    aria-label="分配人"
                    title={task.assignee?.sessionId || task.assignee?.name || '分配 sessionId 或人名'}
                    onBlur={(event) => {
                      const raw = event.target.value.trim()
                      const prev = task.assignee?.sessionId || task.assignee?.name || ''
                      if (raw === prev) return
                      if (!raw) {
                        void onUpdate(task.id, { assignee: null })
                        return
                      }
                      if (/^[0-9a-f-]{8,}$/i.test(raw) || raw.length >= 20) {
                        void onUpdate(task.id, { assigneeSessionId: raw })
                      } else {
                        void onUpdate(task.id, { assignee: raw })
                      }
                    }}
                  />
                </div>
              </td>
              {!compact ? (
                <td className="tasks-col-time">
                  <TimeLabel ts={task.assignedAt} />
                </td>
              ) : null}
              <td className="tasks-col-exec">
                <ExecBadge execution={task.execution} />
              </td>
              <td className="tasks-col-action">
                <button type="button" className="tasks-icon-btn" title="删除" onClick={() => void onDelete(task.id)}>
                  <LuTrash2 size={14} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TasksBoard({
  columns,
  onDropStatus,
  onUpdate,
  onDelete,
}: {
  columns: Record<TaskStatus, Task[]>
  onDropStatus: (taskId: string, status: TaskStatus) => Promise<void>
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  function onDragStart(event: DragEvent, id: string) {
    event.dataTransfer.setData('text/task-id', id)
    event.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="tasks-board">
      {STATUS_META.map((column) => (
        <section
          key={column.id}
          className="tasks-column"
          onDragOver={onDragOver}
          onDrop={(event) => {
            event.preventDefault()
            const id = event.dataTransfer.getData('text/task-id')
            if (id) void onDropStatus(id, column.id)
          }}
        >
          <header className="tasks-column-head">
            <span className="tasks-column-title">
              <StatusIcon status={column.id} />
              {column.label}
            </span>
            <span className="tasks-column-count">{columns[column.id].length}</span>
          </header>
          <ul className="tasks-column-list">
            {columns[column.id].map((task) => (
              <li
                key={task.id}
                className="tasks-card"
                draggable
                onDragStart={(event) => onDragStart(event, task.id)}
              >
                <div className="tasks-card-top">
                  <PriorityMark value={task.priority} />
                  <ExecBadge execution={task.execution} />
                  <button type="button" className="tasks-icon-btn" title="删除" onClick={() => void onDelete(task.id)}>
                    <LuTrash2 size={13} aria-hidden />
                  </button>
                </div>
                <input
                  className="tasks-card-title"
                  defaultValue={task.title}
                  key={`${task.id}-${task.updatedAt}-card`}
                  aria-label="标题"
                  title={task.title}
                  onBlur={(event) => {
                    const title = event.target.value.trim()
                    if (title && title !== task.title) void onUpdate(task.id, { title })
                  }}
                />
                <div className="tasks-card-people">
                  <div className="tasks-card-person">
                    <span className="tasks-card-label">
                      <LuUserRound size={11} aria-hidden />
                      创建
                    </span>
                    <ActorChip actor={task.creator} empty="—" />
                    <TimeLabel ts={task.createdAt} />
                  </div>
                  <div className="tasks-card-person">
                    <span className="tasks-card-label">
                      <LuBot size={11} aria-hidden />
                      分配
                    </span>
                    <ActorChip actor={task.assignee} />
                    <TimeLabel ts={task.assignedAt} />
                  </div>
                </div>
                {task.dueAt ? (
                  <div className="tasks-due">
                    <LuCalendarClock size={11} aria-hidden />
                    {formatDue(task.dueAt)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function TasksModulePage(_props: SlotProps) {
  return (
    <div className="tasks-module-page">
      <TasksWorkspace />
    </div>
  )
}

function TasksInspectorPanel(_props: SlotProps) {
  return (
    <div className="tasks-inspector-panel">
      <TasksWorkspace compact />
    </div>
  )
}

export const name = 'tasks-ui'
export const inject = ['slots']

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  if (!slots) throw new Error('slots service required')
  slots.place('tasks', TasksModulePage, { key: 'tasks-module', order: 10 })
  slots.place('inspector-tasks', TasksInspectorPanel, { key: 'tasks-inspector', order: 10 })
}

if (typeof document !== 'undefined') {
  const id = 'hmr-tasks-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.tasks-module-page { display:flex; flex:1; min-height:0; flex-direction:column; overflow:hidden; background:
  radial-gradient(900px 360px at 10% -12%, color-mix(in srgb, var(--dsw-business) 8%, transparent), transparent 58%),
  linear-gradient(180deg, color-mix(in srgb, var(--dsw-surface) 55%, var(--dsw-bg)), var(--dsw-bg));
  color:var(--dsw-label); }
.tasks-inspector-panel { display:flex; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.tasks-root { display:flex; min-height:0; flex:1; flex-direction:column; gap:10px; padding:12px 14px 14px; overflow:auto; }
.tasks-root.is-compact { padding:8px 10px 10px; gap:8px; }
.tasks-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.tasks-title { margin:0; display:inline-flex; align-items:center; gap:6px; font-size:16px; font-weight:700; letter-spacing:-0.02em; }
.tasks-root.is-compact .tasks-title { font-size:13px; gap:5px; }
.tasks-stats { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; color:var(--dsw-label-3); font-size:11px; font-variant-numeric:tabular-nums; }
.tasks-stats > span { display:inline-flex; align-items:center; gap:3px; }
.tasks-stats .is-todo { color:var(--dsw-label-2); }
.tasks-stats .is-doing { color:var(--dsw-business); }
.tasks-stats .is-done { color:color-mix(in srgb, #3d9a5f 80%, var(--dsw-label-3)); }
.tasks-view-switch { display:inline-flex; gap:2px; padding:2px; border:1px solid var(--dsw-border); border-radius:7px; background:var(--dsw-muted-fill); }
.tasks-view-btn { border:0; border-radius:5px; padding:3px 8px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; font-size:11px; font-weight:600; display:inline-flex; align-items:center; gap:4px; }
.tasks-view-btn.is-active { background:var(--dsw-surface); color:var(--dsw-label); }
.tasks-toolbar { display:flex; gap:6px; align-items:stretch; flex-wrap:wrap; }
.tasks-create { display:flex; gap:6px; flex:1 1 240px; min-width:0; }
.tasks-create-input, .tasks-search { min-width:0; border:1px solid var(--dsw-border); border-radius:8px; padding:6px 8px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:12px; outline:none; }
.tasks-create-input { flex:1; }
.tasks-search-wrap { flex:0 1 180px; display:flex; align-items:center; gap:6px; border:1px solid var(--dsw-border); border-radius:8px; padding:0 8px; background:var(--dsw-input); color:var(--dsw-label-3); min-width:0; }
.tasks-search-wrap .tasks-search { flex:1; border:0; padding-left:0; background:transparent; }
.tasks-create-btn { border:0; border-radius:8px; padding:6px 10px; background:var(--dsw-business); color:var(--dsw-bg); cursor:pointer; font:inherit; font-size:11px; font-weight:650; display:inline-flex; align-items:center; gap:4px; }
.tasks-create-btn:disabled { opacity:.35; cursor:default; }
.tasks-error { border-radius:7px; padding:6px 8px; background:var(--dsw-danger-soft); color:var(--dsw-danger); font-size:11px; }
.tasks-empty { color:var(--dsw-label-3); font-size:12px; line-height:1.45; }
.tasks-table-wrap { overflow:auto; border:1px solid var(--dsw-border); border-radius:10px; background:color-mix(in srgb, var(--dsw-surface) 92%, transparent); }
.tasks-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; }
.tasks-table th { padding:6px 6px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-3); font-weight:600; text-align:left; white-space:nowrap; position:sticky; top:0; background:var(--dsw-surface); z-index:1; }
.tasks-th { display:inline-flex; align-items:center; gap:4px; }
.tasks-table td { padding:4px 6px; border-bottom:1px solid color-mix(in srgb, var(--dsw-border) 80%, transparent); vertical-align:middle; }
.tasks-table tr:last-child td { border-bottom:0; }
.tasks-table tr:hover td { background:color-mix(in srgb, var(--dsw-hover) 55%, transparent); }
.tasks-col-title { width:18%; max-width:180px; }
.tasks-col-status { width:9%; }
.tasks-col-priority { width:7%; }
.tasks-col-actor { width:12%; }
.tasks-col-time { width:11%; }
.tasks-col-exec { width:10%; }
.tasks-col-action { width:32px; }
.tasks-title-cell { display:flex; align-items:center; gap:6px; min-width:0; }
.tasks-title-cell .tasks-cell-input { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-due { display:inline-flex; align-items:center; gap:3px; color:var(--dsw-label-3); font-size:10px; white-space:nowrap; flex:none; }
.tasks-cell-input, .tasks-cell-select, .tasks-card-title { width:100%; border:0; border-radius:5px; padding:2px 4px; background:transparent; color:var(--dsw-label); font:inherit; outline:none; }
.tasks-cell-input:focus, .tasks-cell-select:focus, .tasks-card-title:focus { background:var(--dsw-hover); }
.tasks-status-cell { display:flex; align-items:center; gap:4px; min-width:0; }
.tasks-status-cell .tasks-cell-select { flex:1; min-width:0; }
.tasks-priority-select { max-width:3.5rem; }
.tasks-status-icon { display:inline-flex; color:var(--dsw-label-3); flex:none; }
.tasks-status-icon.is-doing { color:var(--dsw-business); }
.tasks-status-icon.is-done { color:#2f7d4c; }
.tasks-assignee-inline { display:flex; align-items:center; gap:4px; min-width:0; }
.tasks-assignee-inline .tasks-actor { max-width:64px; }
.tasks-assignee-inline .tasks-actor-name,
.tasks-assignee-inline .tasks-actor-kind { display:none; }
.tasks-assignee-edit { flex:1; min-width:0; font-size:11px; color:var(--dsw-label-2); }
.tasks-time { display:inline-flex; align-items:center; gap:3px; color:var(--dsw-label-3); font-size:10px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.tasks-time.is-empty { opacity:.7; }
.tasks-actor { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:120px; }
.tasks-actor.is-empty { color:var(--dsw-label-3); }
.tasks-avatar { width:16px; height:16px; border-radius:5px; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:700; flex:none; box-shadow:inset 0 0 0 1px color-mix(in srgb, #000 18%, transparent); }
.tasks-actor-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; color:var(--dsw-label-2); }
.tasks-actor-kind { font-size:9px; color:var(--dsw-label-3); border:1px solid var(--dsw-border); border-radius:3px; padding:0 3px; line-height:1.3; }
.tasks-exec { display:inline-flex; align-items:center; gap:3px; border-radius:999px; padding:1px 6px; font-size:10px; font-weight:650; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
.tasks-exec.is-running { background:color-mix(in srgb, var(--dsw-business) 16%, transparent); color:var(--dsw-business); }
.tasks-exec.is-idle { background:color-mix(in srgb, #3d9a5f 14%, transparent); color:#2f7d4c; }
.tasks-exec.is-muted { background:var(--dsw-muted-fill); color:var(--dsw-label-3); }
.tasks-spin { animation: tasks-spin 1s linear infinite; }
@keyframes tasks-spin { to { transform: rotate(360deg); } }
.tasks-priority { display:inline-flex; align-items:center; gap:3px; color:var(--dsw-label-3); font-size:10px; font-weight:650; flex:none; }
.tasks-priority.is-med { color:#c48a2a; }
.tasks-priority.is-high { color:#d64545; }
.tasks-icon-btn { border:0; border-radius:5px; padding:3px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; display:inline-flex; align-items:center; justify-content:center; }
.tasks-icon-btn:hover { background:var(--dsw-hover); color:var(--dsw-label); }
.tasks-board { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; min-height:220px; align-items:start; }
.tasks-root.is-compact .tasks-board { grid-template-columns:1fr; }
.tasks-column { display:flex; min-height:0; flex-direction:column; border:1px solid var(--dsw-border); border-radius:10px; background:color-mix(in srgb, var(--dsw-surface) 88%, transparent); overflow:hidden; }
.tasks-column-head { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:7px 9px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-2); font-size:11px; font-weight:650; }
.tasks-column-title { display:inline-flex; align-items:center; gap:5px; }
.tasks-column-count { min-width:1.4em; text-align:center; border-radius:999px; padding:0 5px; background:var(--dsw-muted-fill); color:var(--dsw-label-3); font-variant-numeric:tabular-nums; }
.tasks-column-list { display:flex; flex:1; flex-direction:column; gap:6px; margin:0; padding:8px; list-style:none; overflow:auto; min-height:96px; }
.tasks-card { border:1px solid color-mix(in srgb, var(--dsw-border) 90%, transparent); border-radius:9px; padding:8px; background:var(--dsw-muted-fill); cursor:grab; display:flex; flex-direction:column; gap:6px; }
.tasks-card:hover { border-color:color-mix(in srgb, var(--dsw-business) 35%, var(--dsw-border)); }
.tasks-card:active { cursor:grabbing; }
.tasks-card-top { display:flex; align-items:center; gap:5px; }
.tasks-card-top .tasks-icon-btn { margin-left:auto; }
.tasks-card-title { font-size:12px; font-weight:650; padding:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-card-people { display:flex; flex-direction:column; gap:4px; }
.tasks-card-person { display:grid; grid-template-columns:42px minmax(0,1fr) auto; gap:4px; align-items:center; }
.tasks-card-label { display:inline-flex; align-items:center; gap:2px; color:var(--dsw-label-3); font-size:10px; }
`
  if (!style.parentNode) document.head.appendChild(style)
}
