import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  LockClosedIcon,
  MinusCircleIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import type { DbRecord } from '@biu/type-file-system'
import type { CollectionChrome, FsCellProps } from '@biu/type-file-system/ui'
import { ReportsPane, ScriptPane } from './detail-panes.tsx'

const STATUS_LABEL: Record<string, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: '低',
  med: '中',
  high: '高',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  low: '低',
  med: '中',
  high: '高',
}

type ChatPerson = {
  id: string
  name: string
  mascot?: { shape: string; color: string; eye?: number }
}

type ActorBits = {
  name?: string
  kind?: string
  sessionId?: string
  mascot?: { shape: string; color: string; eye?: number }
}

type ChipOption = { value: string; label: string; icon?: ReactNode }

function tagColor(tag: string) {
  const palette = ['#3b6fd9', '#8a5fd3', '#2f9e8f', '#d9822b', '#c94f4f', '#4b8f4b', '#b15b8e', '#5b6fb1', '#a07b3f', '#3f8fb1']
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return palette[h % palette.length]!
}

function asTags(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function actorFrom(record: DbRecord, which: 'creator' | 'assignee'): ActorBits | null {
  const raw = which === 'creator' ? record.creatorActor : record.assigneeActor
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as ActorBits
  const name = String(record[which] ?? '').trim()
  const sessionId = String(record[`${which}SessionId`] ?? '').trim()
  if (!name && !sessionId) return which === 'creator' ? { kind: 'user', name: '用户' } : null
  return { name: name || sessionId.slice(0, 8), kind: sessionId ? 'agent' : 'user', sessionId: sessionId || undefined }
}

async function loadChatPeople(): Promise<ChatPerson[]> {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as {
    sessions?: Array<{ id?: string; title?: string; mascot?: ChatPerson['mascot'] }>
  }
  if (!Array.isArray(body.sessions)) return []
  return body.sessions
    .filter((item) => typeof item?.id === 'string' && item.id)
    .map((item) => ({
      id: item.id as string,
      name: item.title?.trim() || (item.id as string).slice(0, 8),
      ...(item.mascot ? { mascot: item.mascot } : {}),
    }))
}

async function patchTask(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = (await res.json()) as { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  window.dispatchEvent(new Event('fsdb:change'))
}

async function patchRecord(id: string, content: Record<string, unknown>) {
  const res = await fetch('/api/db/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: `/tasks/${id}`, content }),
  })
  const body = (await res.json()) as { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  window.dispatchEvent(new Event('fsdb:change'))
}

function FloatMenu({
  anchor,
  children,
  onClose,
  minWidth = 160,
}: {
  anchor: HTMLElement | null
  children: ReactNode
  onClose: () => void
  minWidth?: number
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, left: 0, width: minWidth })

  useLayoutEffect(() => {
    if (!anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.max(minWidth, rect.width)
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
      const top = rect.bottom + 4
      setBox({ top, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, minWidth])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [anchor, onClose])

  if (!anchor) return null
  return createPortal(
    <div
      ref={menuRef}
      className="tasks-float-menu"
      role="listbox"
      style={{ position: 'fixed', top: box.top, left: box.left, minWidth: box.width, zIndex: 80 }}
    >
      {children}
    </div>,
    document.body,
  )
}

function ChipSelect({
  value,
  options,
  valueClass,
  onSelect,
}: {
  value: string
  options: ChipOption[]
  valueClass?: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const current = options.find((item) => item.value === value)
  return (
    <div className="tasks-cellselect" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={`tasks-cellselect-trigger ${valueClass ?? ''}`}
        data-open={open || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {current?.icon}
        <span className="tasks-chip-text">{current?.label ?? value}</span>
      </button>
      {open ? (
        <FloatMenu anchor={triggerRef.current} onClose={() => setOpen(false)}>
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`tasks-cellselect-option${item.value === value ? ' is-selected' : ''}`}
              role="option"
              onClick={() => {
                if (item.value !== value) onSelect(item.value)
                setOpen(false)
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </FloatMenu>
      ) : null}
    </div>
  )
}

function SessionFace({
  sessionId,
  mascot,
  name,
  size = 18,
}: {
  sessionId: string
  mascot?: ActorBits['mascot']
  name: string
  size?: number
}) {
  const identity = resolveSessionMascot(sessionId, mascot)
  return (
    <SidebarMascot
      size={size}
      sessionId={sessionId}
      identity={identity}
      animate={false}
      title={`${name} · ${identity.shape} · ${identity.color}`}
    />
  )
}

function ActorFace({ actor, empty }: { actor: ActorBits | null; empty: string }) {
  if (!actor) {
    return (
      <span className="tasks-actor is-empty">
        <UserIcon aria-hidden className="size-[14px]" />
        {empty}
      </span>
    )
  }
  return (
    <span className="tasks-actor" title={actor.sessionId ? `${actor.name} · ${actor.sessionId.slice(0, 8)}` : actor.name}>
      {actor.sessionId ? (
        <SessionFace sessionId={actor.sessionId} mascot={actor.mascot} name={actor.name || empty} />
      ) : (
        <span className="tasks-avatar" aria-hidden>
          <UserIcon className="size-[14px]" />
        </span>
      )}
      <span className="tasks-actor-name">{actor.name || empty}</span>
    </span>
  )
}

function PersonPicker({
  record,
  which,
  empty,
  allowClear,
}: {
  record: DbRecord
  which: 'creator' | 'assignee'
  empty: string
  allowClear: boolean
}) {
  const actor = actorFrom(record, which)
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<ChatPerson[]>([])
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void loadChatPeople()
      .then((rows) => {
        if (!cancelled) setPeople(rows)
      })
      .catch(() => {
        if (!cancelled) setPeople([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const key = which === 'creator' ? 'creatorSessionId' : 'assigneeSessionId'
  const pick = (sessionId: string | null) => {
    void patchTask(record.id, { [key]: sessionId })
    setOpen(false)
  }

  return (
    <div className="tasks-assignee-picker" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="tasks-assignee-trigger"
        data-open={open || undefined}
        title={which === 'creator' ? '选择创建人' : '选择承担者'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ActorFace actor={actor} empty={empty} />
      </button>
      {open ? (
        <FloatMenu anchor={triggerRef.current} onClose={() => setOpen(false)} minWidth={180}>
          {allowClear ? (
            <button
              type="button"
              className={`tasks-assignee-option${(which === 'assignee' ? !actor : !actor?.sessionId) ? ' is-selected' : ''}`}
              role="option"
              onClick={() => pick(null)}
            >
              <span className="tasks-avatar tasks-avatar-clear" aria-hidden>
                {which === 'creator' ? <UserIcon className="size-[14px]" /> : <XMarkIcon className="size-[14px]" />}
              </span>
              <span className="tasks-actor-name">{which === 'creator' ? '用户' : '未分配'}</span>
            </button>
          ) : null}
          {people.map((person) => (
            <button
              type="button"
              key={person.id}
              className={`tasks-assignee-option${actor?.sessionId === person.id ? ' is-selected' : ''}`}
              role="option"
              onClick={() => {
                if (actor?.sessionId !== person.id) pick(person.id)
                else setOpen(false)
              }}
            >
              <span className="tasks-session-face" aria-hidden>
                <SessionFace sessionId={person.id} mascot={person.mascot} name={person.name} />
              </span>
              <span className="tasks-actor-name">{person.name}</span>
            </button>
          ))}
          {loading ? (
            <div className="tasks-assignee-loading">
              <ArrowPathIcon className="size-[14px] fsdb-spin" aria-hidden />
              加载会话…
            </div>
          ) : null}
        </FloatMenu>
      ) : null}
    </div>
  )
}

function TaskTitle({ record, label }: { record: DbRecord; label: string }) {
  const chain = String(record.parentChain ?? '')
  return (
    <span className={`tasks2-title${record.status === 'done' ? ' is-done' : ''}`}>
      {chain ? <span className="tasks-queue-chain">{chain} / </span> : null}
      {label}
      {record.blocked ? (
        <span className="tasks-queue-lock" title="被依赖任务阻塞">
          <LockClosedIcon aria-hidden className="size-[14px]" />
        </span>
      ) : null}
    </span>
  )
}

function StatusGlyph({ status }: { status: string }) {
  if (status === 'doing') return <ArrowPathIcon aria-hidden className="size-[14px]" />
  if (status === 'done') return <CheckCircleIcon aria-hidden className="size-[14px]" />
  return <MinusCircleIcon aria-hidden className="size-[14px]" />
}

function StatusCell({ record, value }: FsCellProps) {
  const key = String(value ?? 'todo')
  return (
    <ChipSelect
      value={key}
      valueClass={`is-${key}`}
      options={Object.entries(STATUS_LABEL).map(([item, label]) => ({
        value: item,
        label,
        icon: <StatusGlyph status={item} />,
      }))}
      onSelect={(next) => void patchRecord(record.id, { status: next })}
    />
  )
}

function PriorityCell({ record, value }: FsCellProps) {
  const key = String(value ?? 'med')
  return (
    <ChipSelect
      value={key}
      valueClass={`is-p-${key}`}
      options={Object.entries(PRIORITY_LABEL).map(([item, label]) => ({
        value: item,
        label,
        icon: <FlagIcon aria-hidden className="size-[14px]" />,
      }))}
      onSelect={(next) => void patchRecord(record.id, { priority: next })}
    />
  )
}

function DifficultyCell({ record, value }: FsCellProps) {
  const key = String(value ?? 'med')
  return (
    <ChipSelect
      value={key}
      valueClass={`is-d-${key}`}
      options={Object.entries(DIFFICULTY_LABEL).map(([item, label]) => ({
        value: item,
        label,
        icon: <ChartBarIcon aria-hidden className="size-[14px]" />,
      }))}
      onSelect={(next) => void patchRecord(record.id, { difficulty: next })}
    />
  )
}

function TagsCell({ record, value }: FsCellProps) {
  const tags = asTags(value)
  const [draft, setDraft] = useState('')
  return (
    <span className="tasks-tags" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tasks-tag"
          style={{ '--tag': tagColor(tag) } as CSSProperties}
          title={`移除 ${tag}`}
          onClick={() => void patchRecord(record.id, { tags: tags.filter((item) => item !== tag) })}
        >
          {tag}
        </button>
      ))}
      <input
        className="tasks-tag-input"
        value={draft}
        placeholder={tags.length ? '+' : '添加标签'}
        aria-label="添加标签"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const next = draft.trim()
          if (!next || tags.includes(next)) return
          setDraft('')
          void patchRecord(record.id, { tags: [...tags, next] })
        }}
        onBlur={() => {
          const next = draft.trim()
          if (!next || tags.includes(next)) return
          setDraft('')
          void patchRecord(record.id, { tags: [...tags, next] })
        }}
      />
    </span>
  )
}

function ProjectCell({ record, value }: FsCellProps) {
  const text = String(value ?? '')
  return (
    <input
      className="tasks-cell-input"
      defaultValue={text}
      key={`${record.id}-${record.updatedAt ?? ''}-project`}
      aria-label="项目"
      placeholder="项目"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const next = event.target.value.trim()
        if (next !== text.trim()) void patchRecord(record.id, { project: next })
      }}
    />
  )
}

function toDatetimeLocal(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  const d = new Date(n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function DueCell({ record, value }: FsCellProps) {
  const due = Number(value)
  const overdue = Number.isFinite(due) && due > 0 && record.status !== 'done' && due <= Date.now()
  return (
    <label className={`tasks-due-edit${overdue ? ' is-overdue' : ''}`} onClick={(event) => event.stopPropagation()}>
      {overdue ? <ClockIcon aria-hidden className="size-[14px]" /> : <CalendarDaysIcon aria-hidden className="size-[14px]" />}
      <input
        type="datetime-local"
        className="tasks-cell-input"
        defaultValue={toDatetimeLocal(value)}
        key={`${record.id}-${record.updatedAt ?? ''}-due`}
        aria-label="截止"
        onChange={(event) => {
          const raw = event.target.value
          const next = raw ? new Date(raw).getTime() : null
          void patchRecord(record.id, { dueAt: Number.isFinite(next) ? next : null })
        }}
      />
    </label>
  )
}

function formatTokens(n: number) {
  if (!n) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function UsageCell({ record, value }: FsCellProps) {
  const parts = record.usageParts
  const usage =
    parts && typeof parts === 'object' && !Array.isArray(parts)
      ? {
          inputTokens: Number((parts as { inputTokens?: unknown }).inputTokens) || 0,
          outputTokens: Number((parts as { outputTokens?: unknown }).outputTokens) || 0,
          cacheReadTokens: Number((parts as { cacheReadTokens?: unknown }).cacheReadTokens) || 0,
          totalTokens: Number((parts as { totalTokens?: unknown }).totalTokens) || Number(value) || 0,
          aggregate: Boolean((parts as { aggregate?: unknown }).aggregate),
        }
      : {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          totalTokens: Number(value) || 0,
          aggregate: false,
        }
  if (usage.totalTokens <= 0) return <span className="traj-usage-empty">—</span>
  const pct =
    usage.inputTokens && usage.cacheReadTokens ? Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100)) : null
  return (
    <span
      className={`traj-usage${usage.aggregate ? ' is-agg' : ''}`}
      title={
        usage.aggregate
          ? `子树聚合：in ${formatTokens(usage.inputTokens)} / out ${formatTokens(usage.outputTokens)}`
          : `本任务：in ${formatTokens(usage.inputTokens)} / out ${formatTokens(usage.outputTokens)}${usage.cacheReadTokens ? ` / cache ${formatTokens(usage.cacheReadTokens)}` : ''}`
      }
    >
      <span className="traj-usage-in-pair">
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
      <span className="traj-usage-out">{formatTokens(usage.outputTokens)}</span>
    </span>
  )
}

function CreatorCell({ record }: FsCellProps) {
  return <PersonPicker record={record} which="creator" empty="用户" allowClear />
}

function AssigneeCell({ record }: FsCellProps) {
  return <PersonPicker record={record} which="assignee" empty="未分配" allowClear />
}

export const tasksChrome: CollectionChrome = {
  Title: TaskTitle,
  cells: {
    status: StatusCell,
    priority: PriorityCell,
    difficulty: DifficultyCell,
    tags: TagsCell,
    project: ProjectCell,
    dueAt: DueCell,
    usage: UsageCell,
    creator: CreatorCell,
    assignee: AssigneeCell,
  },
  panes: [
    {
      id: 'script',
      label: '脚本',
      badge: (record) => {
        const trigger = record.trigger as { cron?: string; at?: number; on?: string[]; enabled?: boolean } | undefined
        if (!trigger) return undefined
        const n = (trigger.cron ? 1 : 0) + (trigger.at ? 1 : 0) + (trigger.on?.length ?? 0)
        return n || undefined
      },
      Pane: ScriptPane,
    },
    {
      id: 'reports',
      label: '进度汇报',
      badge: (record) => (Array.isArray(record.reports) && record.reports.length ? record.reports.length : undefined),
      Pane: ReportsPane,
    },
  ],
}
