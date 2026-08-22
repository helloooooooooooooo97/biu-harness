import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Context } from 'cordis'
import {
  LuActivity,
  LuBot,
  LuCalendarClock,
  LuCircleCheck,
  LuCircleDashed,
  LuClock,
  LuFlag,
  LuListChecks,
  LuLoaderCircle,
  LuNotebookPen,
  LuPanelRight,
  LuPlus,
  LuSearch,
  LuStickyNote,
  LuText,
  LuTrash2,
  LuUserRound,
  LuX,
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
  description: string
  notes: string
  sort: number
  createdAt: number
  updatedAt: number
  creator: TaskActor
  assignee: TaskActor | null
  assignedAt: number | null
  execution?: TaskExecution
}

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

function StatusIcon({ status }: { status: TaskStatus }) {
  const meta = STATUS_META.find((item) => item.id === status)
  return <span className={`tasks-status-icon is-${status}`}>{meta?.icon}</span>
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

function TasksWorkspace({ compact = false }: { compact?: boolean }) {
  const { tasks, setTasks, error, loading, refresh, query, setQuery } = useTasks(compact ? 3000 : 2500)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = { todo: 0, doing: 0, done: 0, total: tasks.length }
    for (const task of tasks) map[task.status] += 1
    return map
  }, [tasks])

  const detailTask = useMemo(
    () => (detailId ? tasks.find((item) => item.id === detailId) ?? null : null),
    [detailId, tasks],
  )

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      const task = await createTask(title)
      setTasks((prev) => [task, ...prev.filter((item) => item.id !== task.id)])
      setDraft('')
      setDetailId(task.id)
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
        <header className="tasks-head">
          <div className="tasks-head-left">
            <h1 className="tasks-title">
              <LuListChecks size={compact ? 16 : 18} aria-hidden />
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
              placeholder="搜索标题 / 人 / 描述"
              aria-label="搜索任务"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {error ? <div className="tasks-error">{error}</div> : null}
        {loading && tasks.length === 0 ? <div className="tasks-empty">加载中…</div> : null}

        <TasksTable
          tasks={tasks}
          detailId={detailId}
          onOpenDetail={setDetailId}
          onUpdate={onUpdate}
          onDelete={onDelete}
          compact={compact}
        />
      </div>

      {detailTask ? (
        <TaskDetailPanel
          task={detailTask}
          onClose={() => setDetailId(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  )
}

function TasksTable({
  tasks,
  detailId,
  onOpenDetail,
  onUpdate,
  onDelete,
  compact,
}: {
  tasks: Task[]
  detailId: string | null
  onOpenDetail: (id: string) => void
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
            <tr key={task.id} className={detailId === task.id ? 'is-active' : undefined}>
              <td className="tasks-col-title">
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
                <div className="tasks-row-actions">
                  <button
                    type="button"
                    className={`tasks-icon-btn${detailId === task.id ? ' is-active' : ''}`}
                    title="详情"
                    aria-label="打开详情"
                    onClick={() => onOpenDetail(task.id)}
                  >
                    <LuPanelRight size={14} aria-hidden />
                  </button>
                  <button type="button" className="tasks-icon-btn" title="删除" onClick={() => void onDelete(task.id)}>
                    <LuTrash2 size={14} aria-hidden />
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
  onUpdate,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [due, setDue] = useState(formatDueInput(task.dueAt))
  const [assigneeDraft, setAssigneeDraft] = useState(task.assignee?.sessionId || task.assignee?.name || '')

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setNotes(task.notes ?? '')
    setDue(formatDueInput(task.dueAt))
    setAssigneeDraft(task.assignee?.sessionId || task.assignee?.name || '')
  }, [task.id, task.updatedAt])

  return (
    <aside className="tasks-detail" aria-label="任务详情">
      <header className="tasks-detail-head">
        <div className="tasks-detail-head-title">
          <LuPanelRight size={14} aria-hidden />
          任务详情
        </div>
        <button type="button" className="tasks-icon-btn" title="关闭" onClick={onClose}>
          <LuX size={14} aria-hidden />
        </button>
      </header>

      <div className="tasks-detail-body">
        <label className="tasks-field">
          <span>标题</span>
          <input
            className="tasks-field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim()
              if (next && next !== task.title) void onUpdate(task.id, { title: next })
            }}
          />
        </label>

        <div className="tasks-field-row">
          <label className="tasks-field">
            <span>状态</span>
            <select
              className="tasks-field-input"
              value={task.status}
              onChange={(event) => void onUpdate(task.id, { status: event.target.value as TaskStatus })}
            >
              {STATUS_META.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tasks-field">
            <span>优先级</span>
            <select
              className="tasks-field-input"
              value={task.priority}
              onChange={(event) => void onUpdate(task.id, { priority: event.target.value as TaskPriority })}
            >
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="tasks-field">
          <span>
            <LuStickyNote size={12} aria-hidden />
            描述
          </span>
          <textarea
            className="tasks-field-textarea"
            value={description}
            placeholder="任务要做什么、验收标准…"
            rows={5}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== (task.description ?? '')) void onUpdate(task.id, { description })
            }}
          />
        </label>

        <label className="tasks-field">
          <span>
            <LuNotebookPen size={12} aria-hidden />
            备忘
          </span>
          <textarea
            className="tasks-field-textarea"
            value={notes}
            placeholder="临时笔记、链接、提醒…"
            rows={4}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes !== (task.notes ?? '')) void onUpdate(task.id, { notes })
            }}
          />
        </label>

        <label className="tasks-field">
          <span>
            <LuCalendarClock size={12} aria-hidden />
            截止日期
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

        <label className="tasks-field">
          <span>
            <LuBot size={12} aria-hidden />
            分配人
          </span>
          <div className="tasks-detail-actor">
            <ActorChip actor={task.assignee} />
            <input
              className="tasks-field-input"
              value={assigneeDraft}
              placeholder="sessionId 或人名"
              onChange={(event) => setAssigneeDraft(event.target.value)}
              onBlur={() => {
                const raw = assigneeDraft.trim()
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
        </label>

        <div className="tasks-detail-meta">
          <div>
            <span className="tasks-detail-meta-label">创建人</span>
            <ActorChip actor={task.creator} empty="—" />
            <TimeLabel ts={task.createdAt} />
          </div>
          <div>
            <span className="tasks-detail-meta-label">分配时间</span>
            <TimeLabel ts={task.assignedAt} />
          </div>
          <div>
            <span className="tasks-detail-meta-label">执行</span>
            <ExecBadge execution={task.execution} />
          </div>
          {task.execution?.assistantText ? (
            <div className="tasks-detail-exec-text" title={task.execution.assistantText}>
              {task.execution.assistantText}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="tasks-detail-foot">
        <button
          type="button"
          className="tasks-danger-btn"
          onClick={() => {
            if (window.confirm('删除这个任务？')) void onDelete(task.id)
          }}
        >
          <LuTrash2 size={13} aria-hidden />
          删除任务
        </button>
      </footer>
    </aside>
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
.tasks-root { display:flex; min-height:0; flex:1; gap:0; overflow:hidden; }
.tasks-root.is-compact { flex-direction:column; }
.tasks-main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; gap:10px; padding:12px 14px 14px; overflow:auto; }
.tasks-root.is-compact .tasks-main { padding:8px 10px 10px; gap:8px; }
.tasks-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.tasks-title { margin:0; display:inline-flex; align-items:center; gap:6px; font-size:16px; font-weight:700; letter-spacing:-0.02em; }
.tasks-root.is-compact .tasks-title { font-size:13px; }
.tasks-stats { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; color:var(--dsw-label-3); font-size:11px; font-variant-numeric:tabular-nums; }
.tasks-stats > span { display:inline-flex; align-items:center; gap:3px; }
.tasks-stats .is-todo { color:var(--dsw-label-2); }
.tasks-stats .is-doing { color:var(--dsw-business); }
.tasks-stats .is-done { color:color-mix(in srgb, #3d9a5f 80%, var(--dsw-label-3)); }
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
.tasks-table tr.is-active td { background:color-mix(in srgb, var(--dsw-business) 8%, transparent); }
.tasks-col-title { width:18%; max-width:180px; }
.tasks-col-status { width:9%; }
.tasks-col-priority { width:7%; }
.tasks-col-actor { width:12%; }
.tasks-col-time { width:11%; }
.tasks-col-exec { width:10%; }
.tasks-col-action { width:56px; }
.tasks-col-title .tasks-cell-input { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tasks-cell-input, .tasks-cell-select { width:100%; border:0; border-radius:5px; padding:2px 4px; background:transparent; color:var(--dsw-label); font:inherit; outline:none; }
.tasks-cell-input:focus, .tasks-cell-select:focus { background:var(--dsw-hover); }
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
.tasks-actor { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:140px; }
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
.tasks-priority { display:inline-flex; align-items:center; color:var(--dsw-label-3); flex:none; }
.tasks-priority.is-med { color:#c48a2a; }
.tasks-priority.is-high { color:#d64545; }
.tasks-row-actions { display:inline-flex; align-items:center; gap:2px; }
.tasks-icon-btn { border:0; border-radius:5px; padding:3px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; display:inline-flex; align-items:center; justify-content:center; }
.tasks-icon-btn:hover, .tasks-icon-btn.is-active { background:var(--dsw-hover); color:var(--dsw-label); }
.tasks-detail { width:min(340px, 42vw); flex:none; display:flex; flex-direction:column; min-height:0; border-left:1px solid var(--dsw-border); background:var(--dsw-sidebar); }
.tasks-root.is-compact .tasks-detail { width:auto; border-left:0; border-top:1px solid var(--dsw-border); max-height:55%; }
.tasks-detail-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-bottom:1px solid var(--dsw-border); }
.tasks-detail-head-title { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:650; color:var(--dsw-label-2); }
.tasks-detail-body { display:flex; flex:1; flex-direction:column; gap:10px; padding:12px; overflow:auto; }
.tasks-field { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--dsw-label-3); }
.tasks-field > span { display:inline-flex; align-items:center; gap:4px; font-weight:600; }
.tasks-field-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.tasks-field-input, .tasks-field-textarea { width:100%; border:1px solid var(--dsw-border); border-radius:8px; padding:7px 8px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:12px; outline:none; resize:vertical; }
.tasks-field-textarea { min-height:72px; line-height:1.45; }
.tasks-detail-actor { display:flex; flex-direction:column; gap:6px; }
.tasks-detail-meta { display:flex; flex-direction:column; gap:8px; padding-top:4px; border-top:1px solid var(--dsw-border); }
.tasks-detail-meta > div { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.tasks-detail-meta-label { width:52px; color:var(--dsw-label-3); font-size:10px; font-weight:600; }
.tasks-detail-exec-text { color:var(--dsw-label-3); font-size:11px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.tasks-detail-foot { padding:10px 12px; border-top:1px solid var(--dsw-border); }
.tasks-danger-btn { border:1px solid color-mix(in srgb, var(--dsw-danger) 35%, var(--dsw-border)); border-radius:8px; padding:6px 10px; background:transparent; color:var(--dsw-danger); cursor:pointer; font:inherit; font-size:11px; font-weight:650; display:inline-flex; align-items:center; gap:5px; }
.tasks-danger-btn:hover { background:var(--dsw-danger-soft); }
`
  if (!style.parentNode) document.head.appendChild(style)
}
