import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TagChip } from '@biu/public-ui'
import { DbSearchMenu, DbSearchOption, ensureDbSearchStyle } from './search-menu.tsx'

function CheckMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0Z" />
    </svg>
  )
}

function CaretMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="db-cell-select-caret">
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  )
}

export type CellSelectOption = { value: string; label: string; icon?: ReactNode }

export function CellSelect({
  value,
  options,
  onSelect,
  placeholder = '',
  variant = 'cell',
  triggerClassName,
  className,
  allowCreate = false,
  chips = false,
}: {
  value: string
  options: CellSelectOption[]
  onSelect: (value: string) => void
  placeholder?: string
  variant?: 'cell' | 'field'
  triggerClassName?: string
  className?: string
  allowCreate?: boolean
  chips?: boolean
}) {
  ensureDbSearchStyle()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const current = options.find((item) => item.value === value)
  const q = query.trim().toLowerCase()
  const filtered = options.filter(
    (item) => !q || item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q),
  )
  const draft = query.trim()
  const canCreate =
    allowCreate &&
    Boolean(draft) &&
    draft !== value &&
    !options.some((item) => item.value === draft || item.label === draft)
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])
  const close = () => setOpen(false)
  const pick = (next: string) => {
    onSelect(next)
    close()
  }
  return (
    <div
      className={`db-cell-select fsdb-cellselect is-${variant}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`db-cell-select-trigger fsdb-cellselect-trigger${current ? '' : ' is-empty'}${chips && current?.value ? ' is-chip' : ''}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        data-open={open || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {chips && current?.value ? (
          <TagChip id={current.value} label={current.label} />
        ) : (
          <>
            {current?.icon}
            <span className={`db-cell-select-label fsdb-cellselect-label${current ? '' : ' is-empty'}`}>{current?.label ?? placeholder}</span>
          </>
        )}
        {variant === 'field' ? <CaretMark /> : null}
      </button>
      {open ? (
        <DbSearchMenu
          anchor={triggerRef.current}
          onClose={close}
          query={query}
          onQuery={setQuery}
          onEnter={() => {
            if (filtered[0]) pick(filtered[0].value)
            else if (canCreate) pick(draft)
          }}
          empty={!filtered.length && !canCreate ? <div className="db-search-empty">没有匹配项</div> : null}
        >
          {filtered.map((item) => (
            <DbSearchOption
              key={item.value}
              selected={item.value === value}
              mark={item.value === value ? <CheckMark /> : null}
              onClick={() => pick(item.value)}
            >
              {chips && item.value ? <TagChip id={item.value} label={item.label} /> : (
                <>
                  {item.icon}
                  {item.label}
                </>
              )}
            </DbSearchOption>
          ))}
          {canCreate ? (
            <DbSearchOption onClick={() => pick(draft)}>
              添加 <TagChip id={draft} label={draft} />
            </DbSearchOption>
          ) : null}
        </DbSearchMenu>
      ) : null}
    </div>
  )
}
