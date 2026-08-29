import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircleIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/16/solid'

function useDismiss(open: boolean, onClose: () => void, ref: { current: HTMLElement | null }) {
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose, ref])
}

function SelectMenu({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, left: 0, width: 200 })

  useLayoutEffect(() => {
    if (!anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.max(220, rect.width)
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
  }, [anchor])

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
      className="fsdb-cellselect-menu"
      role="listbox"
      style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex: 80 }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function CellSelect({
  value,
  options,
  onSelect,
  placeholder = '选择',
  variant = 'cell',
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onSelect: (value: string) => void
  placeholder?: string
  variant?: 'cell' | 'field'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const current = options.find((item) => item.value === value)
  const q = query.trim().toLowerCase()
  const filtered = options.filter((item) => !q || item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q))

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  const close = () => setOpen(false)

  return (
    <div
      className={`fsdb-cellselect is-${variant}${open ? ' is-open' : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`fsdb-cellselect-trigger${current ? '' : ' is-empty'}`}
        data-open={open || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className={`fsdb-cellselect-label${current ? '' : ' is-empty'}`}>{current?.label ?? placeholder}</span>
        {variant === 'field' ? <ChevronDownIcon aria-hidden className="size-[14px] fsdb-cellselect-caret" /> : null}
      </button>
      {open ? (
        <SelectMenu anchor={triggerRef.current} onClose={close}>
          <label className="fsdb-cellselect-search">
            <MagnifyingGlassIcon aria-hidden className="size-[14px]" />
            <input
              ref={searchRef}
              value={query}
              placeholder="搜索"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') close()
                if (event.key === 'Enter' && filtered[0]) {
                  event.preventDefault()
                  onSelect(filtered[0].value)
                  close()
                }
              }}
            />
          </label>
          <div className="fsdb-cellselect-options">
            {filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`fsdb-cellselect-option${item.value === value ? ' is-selected' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(item.value)
                  close()
                }}
              >
                <span className="fsdb-tag">{item.label}</span>
                {item.value === value ? <CheckCircleIcon aria-hidden className="size-[14px]" /> : null}
              </button>
            ))}
            {!filtered.length ? <div className="fsdb-cellselect-empty">没有匹配项</div> : null}
          </div>
        </SelectMenu>
      ) : null}
    </div>
  )
}

export function TokenMultiSelect({
  values,
  options,
  onChange,
  allowCreate = true,
}: {
  values: string[]
  options: string[]
  onChange: (next: string[]) => void
  allowCreate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, () => setOpen(false), ref)
  const q = draft.trim().toLowerCase()
  const available = options.filter((item) => !values.includes(item) && (!q || item.toLowerCase().includes(q)))
  const canCreate = allowCreate && draft.trim() && !values.includes(draft.trim()) && !options.includes(draft.trim())
  return (
    <div className="fsdb-tokens" ref={ref}>
      <div
        className="fsdb-tokens-box"
        onClick={() => {
          setOpen(true)
          ref.current?.querySelector('input')?.focus()
        }}
      >
        {values.map((tag) => (
          <span key={tag} className="fsdb-token">
            {tag}
            <button
              type="button"
              className="fsdb-token-x"
              aria-label={`移除 ${tag}`}
              onClick={(event) => {
                event.stopPropagation()
                onChange(values.filter((item) => item !== tag))
              }}
            >
              <XMarkIcon aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          className="fsdb-tokens-input"
          value={draft}
          placeholder={values.length ? '搜索' : '搜索或添加'}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              const next = draft.trim()
              if (!next) return
              if (!values.includes(next)) onChange([...values, next])
              setDraft('')
            } else if (event.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1))
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>
      {open ? (
        <div className="fsdb-tokens-menu" role="listbox">
          {available.map((item) => (
            <button
              key={item}
              type="button"
              className="fsdb-tokens-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange([...values, item])
                setDraft('')
              }}
            >
              {item}
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className="fsdb-tokens-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange([...values, draft.trim()])
                setDraft('')
              }}
            >
              添加「{draft.trim()}」
            </button>
          ) : null}
          {!available.length && !canCreate ? <div className="fsdb-tokens-empty">没有匹配项</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function CheckRow({
  label,
  icon,
  on,
  onToggle,
  locked,
}: {
  label: ReactNode
  icon?: ReactNode
  on: boolean
  onToggle: () => void
  locked?: boolean
}) {
  return (
    <button
      type="button"
      className={`fsdb-checkrow${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
      role="menuitemcheckbox"
      aria-checked={on}
      disabled={locked}
      title={locked ? '始终显示' : undefined}
      onClick={onToggle}
    >
      <span className="fsdb-checkrow-label">
        {icon ? <span className="fsdb-checkrow-icon">{icon}</span> : null}
        {label}
      </span>
      {on ? <CheckCircleIcon aria-hidden className="size-[14px]" /> : <span className="fsdb-checkrow-gap" aria-hidden />}
    </button>
  )
}

export function AppDialog({
  title,
  body,
  confirm,
  danger,
  disabled,
  onCancel,
  onConfirm,
  input,
  error,
  onClearError,
}: {
  title: string
  body?: ReactNode
  confirm: string
  danger?: boolean
  disabled?: boolean
  onCancel: () => void
  onConfirm: (name?: string) => void
  input?: {
    defaultValue: string
    placeholder?: string
    maxLength?: number
  }
  error?: string
  onClearError?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const named = Boolean(input)

  useEffect(() => {
    if (!named) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [named])

  function submit() {
    onConfirm(input ? inputRef.current?.value : undefined)
  }

  const dialog = (
    <div
      className="fsdb-dlg-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disabled) onCancel()
      }}
    >
      <div className="fsdb-dlg" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="fsdb-dlg-title">{title}</div>
        <div className="fsdb-dlg-body">
          {input ? (
            <input
              ref={inputRef}
              className="fsdb-dlg-input"
              defaultValue={input.defaultValue}
              placeholder={input.placeholder}
              maxLength={input.maxLength}
              onInput={() => {
                if (error) onClearError?.()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          ) : null}
          {body}
          {error ? <div className="fsdb-dlg-error">{error}</div> : null}
        </div>
        <div className="fsdb-dlg-actions">
          <button type="button" className="fsdb-dlg-cancel" disabled={disabled} onClick={onCancel}>
            取消
          </button>
          <button type="button" className={`fsdb-dlg-ok${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={submit}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  )
  return createPortal(dialog, document.body)
}
