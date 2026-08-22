import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react'
import type { Context } from 'cordis'

export type SlotProps = Record<string, unknown> & {
  renderSlot?: (name: string) => unknown
}

type SlotsService = {
  place: (slot: string, view: unknown, opts: { key: string; order: number }) => unknown
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'

export type Task = {
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

type ViewMode = 'table' | 'board'

const STATUS_META: Array<{ id: TaskStatus; label: string }> = [
  { id: 'todo', label: 'Todo' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: '低',
  med: '中',
  high: '高',
}

async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks')
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

async function patchTask(id: string, patch: Partial<Task>): Promise<Task> {
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

function useTasks(pollMs = 2500) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchTasks()
      setTasks(next)
      setError('')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [refresh, pollMs])

  return { tasks, setTasks, error, loading, refresh }
}

function TasksWorkspace({ compact = false }: { compact?: boolean }) {
  const { tasks, setTasks, error, loading, refresh } = useTasks(compact ? 3000 : 2500)
  const [view, setView] = useState<ViewMode>('table')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

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
      setTasks((prev) => prev)
      console.error(err)
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  async function onUpdate(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
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
          <h1 className="tasks-title">任务</h1>
          {!compact ? <p className="tasks-sub">Table / Board · Agent 可用 tools · SQLite</p> : null}
        </div>
        <div className="tasks-view-switch" role="tablist" aria-label="视图">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            className={`tasks-view-btn${view === 'table' ? ' is-active' : ''}`}
            onClick={() => setView('table')}
          >
            表格
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'board'}
            className={`tasks-view-btn${view === 'board' ? ' is-active' : ''}`}
            onClick={() => setView('board')}
          >
            看板
          </button>
        </div>
      </header>

      <form className="tasks-create" onSubmit={onCreate}>
        <input
          className="tasks-create-input"
          value={draft}
          placeholder="新建任务，回车添加"
          aria-label="新建任务"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="tasks-create-btn" disabled={busy || !draft.trim()}>
          添加
        </button>
      </form>

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

function TasksTable({
  tasks,
  onUpdate,
  onDelete,
  compact,
}: {
  tasks: Task[]
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>
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
            <th>标题</th>
            <th>状态</th>
            {!compact ? <th>优先级</th> : null}
            {!compact ? <th>负责人</th> : null}
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <input
                  className="tasks-cell-input"
                  defaultValue={task.title}
                  key={`${task.id}-${task.updatedAt}-title`}
                  aria-label="标题"
                  onBlur={(event) => {
                    const title = event.target.value.trim()
                    if (title && title !== task.title) void onUpdate(task.id, { title })
                  }}
                />
              </td>
              <td>
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
              </td>
              {!compact ? (
                <td>
                  <select
                    className="tasks-cell-select"
                    value={task.priority}
                    aria-label="优先级"
                    onChange={(event) =>
                      void onUpdate(task.id, { priority: event.target.value as TaskPriority })
                    }
                  >
                    {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => (
                      <option key={key} value={key}>
                        {PRIORITY_LABEL[key]}
                      </option>
                    ))}
                  </select>
                </td>
              ) : null}
              {!compact ? (
                <td>
                  <input
                    className="tasks-cell-input"
                    defaultValue={task.assignee}
                    key={`${task.id}-${task.updatedAt}-assignee`}
                    placeholder="—"
                    aria-label="负责人"
                    onBlur={(event) => {
                      const assignee = event.target.value.trim()
                      if (assignee !== task.assignee) void onUpdate(task.id, { assignee })
                    }}
                  />
                </td>
              ) : null}
              <td>
                <button type="button" className="tasks-icon-btn" title="删除" onClick={() => void onDelete(task.id)}>
                  ×
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
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>
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
            <span>{column.label}</span>
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
                <input
                  className="tasks-card-title"
                  defaultValue={task.title}
                  key={`${task.id}-${task.updatedAt}-card`}
                  aria-label="标题"
                  onBlur={(event) => {
                    const title = event.target.value.trim()
                    if (title && title !== task.title) void onUpdate(task.id, { title })
                  }}
                />
                <div className="tasks-card-meta">
                  <span>{PRIORITY_LABEL[task.priority]}</span>
                  {task.assignee ? <span>{task.assignee}</span> : null}
                  <button type="button" className="tasks-icon-btn" title="删除" onClick={() => void onDelete(task.id)}>
                    ×
                  </button>
                </div>
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

/** 注入一点插件样式（挂在 document，避免改主仓 css）。 */
if (typeof document !== 'undefined') {
  const id = 'hmr-tasks-ui-style'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
.tasks-module-page { display:flex; flex:1; min-height:0; flex-direction:column; overflow:hidden; background:var(--dsw-bg); color:var(--dsw-label); }
.tasks-inspector-panel { display:flex; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.tasks-root { display:flex; min-height:0; flex:1; flex-direction:column; gap:12px; padding:16px 18px 20px; overflow:auto; }
.tasks-root.is-compact { padding:10px 12px 14px; gap:8px; }
.tasks-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.tasks-title { margin:0; font-size:18px; font-weight:650; letter-spacing:-0.02em; }
.tasks-root.is-compact .tasks-title { font-size:14px; }
.tasks-sub { margin:4px 0 0; color:var(--dsw-label-3); font-size:12px; }
.tasks-view-switch { display:inline-flex; gap:2px; padding:2px; border:1px solid var(--dsw-border); border-radius:8px; background:var(--dsw-muted-fill); }
.tasks-view-btn { border:0; border-radius:6px; padding:4px 10px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; font-size:12px; font-weight:600; }
.tasks-view-btn.is-active { background:var(--dsw-surface); color:var(--dsw-label); }
.tasks-create { display:flex; gap:8px; }
.tasks-create-input { flex:1; min-width:0; border:1px solid var(--dsw-border); border-radius:10px; padding:8px 10px; background:var(--dsw-input); color:var(--dsw-label); font:inherit; font-size:13px; outline:none; }
.tasks-create-btn { border:0; border-radius:10px; padding:8px 12px; background:var(--dsw-business); color:var(--dsw-bg); cursor:pointer; font:inherit; font-size:12px; font-weight:650; }
.tasks-create-btn:disabled { opacity:.35; cursor:default; }
.tasks-error { border-radius:8px; padding:8px 10px; background:var(--dsw-danger-soft); color:var(--dsw-danger); font-size:12px; }
.tasks-empty { color:var(--dsw-label-3); font-size:12px; line-height:1.5; }
.tasks-table-wrap { overflow:auto; border:1px solid var(--dsw-border); border-radius:12px; background:var(--dsw-surface); }
.tasks-table { width:100%; border-collapse:collapse; font-size:12px; }
.tasks-table th { padding:8px 10px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-3); font-weight:600; text-align:left; }
.tasks-table td { padding:6px 8px; border-bottom:1px solid var(--dsw-border); vertical-align:middle; }
.tasks-table tr:last-child td { border-bottom:0; }
.tasks-cell-input, .tasks-cell-select, .tasks-card-title { width:100%; border:0; border-radius:6px; padding:4px 6px; background:transparent; color:var(--dsw-label); font:inherit; outline:none; }
.tasks-cell-input:focus, .tasks-cell-select:focus, .tasks-card-title:focus { background:var(--dsw-hover); }
.tasks-icon-btn { border:0; border-radius:6px; padding:2px 6px; background:transparent; color:var(--dsw-label-3); cursor:pointer; font:inherit; }
.tasks-icon-btn:hover { background:var(--dsw-hover); color:var(--dsw-label); }
.tasks-board { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; min-height:280px; }
.tasks-root.is-compact .tasks-board { grid-template-columns:1fr; }
.tasks-column { display:flex; min-height:0; flex-direction:column; border:1px solid var(--dsw-border); border-radius:12px; background:var(--dsw-surface); overflow:hidden; }
.tasks-column-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-bottom:1px solid var(--dsw-border); color:var(--dsw-label-2); font-size:12px; font-weight:650; }
.tasks-column-count { color:var(--dsw-label-3); font-variant-numeric:tabular-nums; }
.tasks-column-list { display:flex; flex:1; flex-direction:column; gap:8px; margin:0; padding:8px; list-style:none; overflow:auto; min-height:120px; }
.tasks-card { border:1px solid var(--dsw-border); border-radius:10px; padding:8px; background:var(--dsw-muted-fill); cursor:grab; }
.tasks-card:active { cursor:grabbing; }
.tasks-card-meta { display:flex; align-items:center; gap:8px; margin-top:6px; color:var(--dsw-label-3); font-size:11px; }
.tasks-card-meta .tasks-icon-btn { margin-left:auto; }
`
    document.head.appendChild(style)
  }
}
