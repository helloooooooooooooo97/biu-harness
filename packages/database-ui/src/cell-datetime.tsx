import { useMemo, useRef, useState } from 'react'
import { DbMenu, ensureDbSearchStyle } from './search-menu.tsx'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function asStamp(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function formatDateTimeLabel(value: unknown) {
  const n = asStamp(value)
  if (!n) return ''
  return new Date(n).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const pad = (first.getDay() + 6) % 7
  const last = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < pad; i += 1) cells.push(null)
  for (let day = 1; day <= last; day += 1) cells.push(day)
  while (cells.length % 7) cells.push(null)
  return cells
}

function combine(year: number, month: number, day: number, hours: number, minutes: number) {
  return new Date(year, month, day, hours, minutes, 0, 0).getTime()
}

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      {dir === 'prev' ? (
        <path d="M9.78 4.22a.75.75 0 0 1 0 1.06L6.06 9l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" />
      ) : (
        <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L9.94 9 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
      )}
    </svg>
  )
}

function CalendarMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M5.75 1a.75.75 0 0 1 .75.75V3h3.5V1.75a.75.75 0 0 1 1.5 0V3H12.5A1.5 1.5 0 0 1 14 4.5v8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3H5V1.75A.75.75 0 0 1 5.75 1ZM3.5 6.5v6h9v-6h-9Z" />
    </svg>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

export function CellDateTime({
  value,
  onChange,
  empty = '选择时间',
  overdue = false,
}: {
  value: unknown
  onChange: (next: number | null) => void
  empty?: string
  overdue?: boolean
}) {
  ensureDbSearchStyle()
  const stamp = asStamp(value)
  const selected = stamp ? new Date(stamp) : null
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => selected ?? new Date())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hours = selected?.getHours() ?? 9
  const minutes = selected?.getMinutes() ?? 0
  const days = useMemo(() => monthCells(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const label = formatDateTimeLabel(stamp)
  const close = () => setOpen(false)
  const write = (next: number | null) => {
    onChange(next)
    if (next) setCursor(new Date(next))
  }
  const pickDay = (day: number) => {
    write(combine(cursor.getFullYear(), cursor.getMonth(), day, hours, minutes))
  }
  const pickTime = (nextHours: number, nextMinutes: number) => {
    const base = selected ?? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    write(combine(base.getFullYear(), base.getMonth(), base.getDate(), nextHours, nextMinutes))
  }
  return (
    <div
      className="db-datetime"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`db-datetime-trigger${label ? '' : ' is-empty'}${overdue ? ' is-overdue' : ''}`}
        data-open={open || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={empty}
        onClick={() => {
          setCursor(selected ?? new Date())
          setOpen((prev) => !prev)
        }}
      >
        <CalendarMark />
        <span className="db-datetime-label">{label || empty}</span>
      </button>
      {open ? (
        <DbMenu
          anchor={triggerRef.current}
          onClose={close}
          className="db-datetime-pop"
          role="dialog"
          minWidth={268}
        >
          <div className="db-datetime-head">
            <button
              type="button"
              className="db-datetime-nav"
              aria-label="上个月"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <Chevron dir="prev" />
            </button>
            <span className="db-datetime-month">
              {cursor.getFullYear()}年{cursor.getMonth() + 1}月
            </span>
            <button
              type="button"
              className="db-datetime-nav"
              aria-label="下个月"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <Chevron dir="next" />
            </button>
          </div>
          <div className="db-datetime-week">
            {WEEK.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="db-datetime-grid">
            {days.map((day, index) => {
              const on =
                day != null &&
                selected != null &&
                selected.getFullYear() === cursor.getFullYear() &&
                selected.getMonth() === cursor.getMonth() &&
                selected.getDate() === day
              return (
                <button
                  key={`${cursor.getFullYear()}-${cursor.getMonth()}-${index}`}
                  type="button"
                  className={`db-datetime-day${day == null ? ' is-empty' : ''}${on ? ' is-on' : ''}`}
                  disabled={day == null}
                  onClick={() => day != null && pickDay(day)}
                >
                  {day ?? ''}
                </button>
              )
            })}
          </div>
          <div className="db-datetime-time">
            <select
              aria-label="时"
              value={hours}
              onChange={(event) => pickTime(Number(event.target.value), minutes)}
            >
              {HOURS.map((item) => (
                <option key={item} value={item}>
                  {pad(item)} 时
                </option>
              ))}
            </select>
            <select
              aria-label="分"
              value={minutes}
              onChange={(event) => pickTime(hours, Number(event.target.value))}
            >
              {MINUTES.map((item) => (
                <option key={item} value={item}>
                  {pad(item)} 分
                </option>
              ))}
            </select>
          </div>
          <div className="db-datetime-foot">
            <button type="button" onClick={() => write(null)}>
              清除
            </button>
            <button type="button" onClick={() => write(Date.now())}>
              现在
            </button>
          </div>
        </DbMenu>
      ) : null}
    </div>
  )
}
