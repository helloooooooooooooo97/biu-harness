import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TagChip, TagChips, ensureTagChipStyle } from './tag-chip.tsx'

const STYLE_ID = 'biu-public-ui-schema-pack'
const CSS = `
.biu-schema{display:flex;flex-direction:column;gap:2px;min-width:0;width:100%}
.biu-schema-tokens{position:relative;min-width:0}
.biu-schema-tokens-box{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:28px;border-radius:6px;padding:2px 4px;cursor:text}
.biu-schema-tokens-box:hover,.biu-schema-tokens-box:focus-within{background:var(--dsw-hover)}
.biu-schema-tokens-input{flex:1;min-width:72px;border:0;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;outline:none;padding:2px 0}
.biu-schema-tokens-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:60;max-height:240px;overflow:auto;padding:4px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.biu-schema-tokens-option{display:flex;width:100%;min-width:0;align-items:center;justify-content:space-between;gap:8px;border:0;border-radius:6px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.biu-schema-tokens-option:hover,.biu-schema-tokens-option.is-create{background:var(--dsw-hover)}
.biu-schema-tokens-hint,.biu-schema-tokens-empty{color:var(--dsw-label-3);font-size:12px}
.biu-schema-pack{display:flex;flex-direction:column;gap:0;min-width:0;padding:4px 0 8px}
.biu-schema-pack-head{display:flex;align-items:center;min-height:24px;padding:0 4px 4px}
.biu-schema-prop{display:grid;grid-template-columns:108px minmax(0,1fr);align-items:center;gap:8px;min-height:32px;border-radius:6px;padding:0 4px}
.biu-schema-prop:hover{background:var(--dsw-hover)}
.biu-schema-prop-k{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;color:var(--dsw-label-3)}
.biu-schema-prop-v{display:flex;align-items:center;gap:4px;min-width:0}
.biu-schema-prop-v .fsdb-plain-input,.biu-schema-prop-v .fsdb-cellselect{flex:1;min-width:0}
.biu-schema-prop-del{opacity:0;display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-label-3);cursor:pointer}
.biu-schema-prop:hover .biu-schema-prop-del{opacity:1}
.biu-schema-prop-del:hover{color:var(--dsw-danger);background:color-mix(in srgb,var(--dsw-danger) 12%,transparent)}
.biu-schema-addprop{display:inline-flex;align-items:center;gap:4px;margin:2px 4px 0;height:28px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-label-3);font:inherit;font-size:14px;cursor:pointer}
.biu-schema-addprop:hover{background:var(--dsw-hover);color:var(--dsw-label)}
.biu-schema-addprop-form{display:flex;align-items:center;gap:6px;margin:2px 4px 0;min-width:0}
.biu-schema-addprop-input{flex:1;min-width:0;border:0;border-radius:6px;padding:4px 6px;background:var(--dsw-hover);color:var(--dsw-label);font:inherit;font-size:14px;outline:none}
.biu-schema-addprop-ok{border:0;border-radius:6px;padding:4px 8px;background:transparent;color:var(--dsw-label-2);font:inherit;font-size:13px;font-weight:650;cursor:pointer}
.biu-schema-type{position:relative;flex:none}
.biu-schema-type-btn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-label-2);font:inherit;font-size:13px;cursor:pointer}
.biu-schema-type-btn:hover{background:var(--dsw-hover);color:var(--dsw-label)}
.biu-schema-type-caret{opacity:.55}
.biu-schema-type-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:70;display:flex;flex-direction:column;min-width:160px;max-height:240px;overflow:auto;padding:4px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.biu-schema-type-option{display:flex;align-items:center;gap:6px;width:100%;border:0;border-radius:6px;padding:6px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.biu-schema-type-option:hover,.biu-schema-type-option.is-on{background:var(--dsw-hover)}
.biu-schema-muted{color:var(--dsw-label-3)}
`

export function ensureSchemaPackStyle() {
  if (typeof document === 'undefined') return
  ensureTagChipStyle()
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  if (style.textContent !== CSS) style.textContent = CSS
}

function PlusMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5z" />
    </svg>
  )
}

function CloseMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
    </svg>
  )
}

function CaretMark() {
  return (
    <svg aria-hidden className="biu-schema-type-caret" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" />
    </svg>
  )
}

export type SchemaTagOption = {
  id: string
  label: string
  hint?: string
}

export function SchemaChips({ tags }: { tags: SchemaTagOption[] }) {
  ensureSchemaPackStyle()
  if (!tags.length) return <span className="biu-schema-muted">空</span>
  return (
    <TagChips>
      {tags.map((tag) => (
        <TagChip key={tag.id} id={tag.id} label={tag.label} />
      ))}
    </TagChips>
  )
}

export function TypeMenu({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ id: string; label: string; icon?: ReactNode }>
  onChange: (next: string) => void
}) {
  ensureSchemaPackStyle()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((item) => item.id === value) ?? options[0]
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="biu-schema-type" ref={ref}>
      <button type="button" className="biu-schema-type-btn" onClick={() => setOpen((prev) => !prev)}>
        {current?.icon}
        <span>{current?.label ?? value}</span>
        <CaretMark />
      </button>
      {open ? (
        <div className="biu-schema-type-menu" role="listbox">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`biu-schema-type-option${item.id === value ? ' is-on' : ''}`}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TagPicker({
  catalog,
  selectedIds,
  onToggle,
  onCreate,
  createLabel = '创建',
  emptyLabel = '没有匹配项',
}: {
  catalog: SchemaTagOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onCreate: (label: string) => void
  createLabel?: string
  emptyLabel?: string
}) {
  ensureSchemaPackStyle()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = draft.trim().toLowerCase()
  const selected = catalog.filter((tag) => selectedIds.includes(tag.id))
  const available = catalog.filter(
    (tag) => !selectedIds.includes(tag.id) && (!q || tag.label.toLowerCase().includes(q) || tag.id.includes(q)),
  )
  const canCreate = Boolean(draft.trim()) && !catalog.some((tag) => tag.label === draft.trim())

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="biu-schema-tokens" ref={boxRef}>
      <div
        className="biu-schema-tokens-box"
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selected.map((tag) => (
          <TagChip key={tag.id} id={tag.id} label={tag.label} onRemove={() => onToggle(tag.id)} />
        ))}
        <input
          ref={inputRef}
          className="biu-schema-tokens-input"
          value={draft}
          placeholder=""
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (available[0]) {
                onToggle(available[0].id)
                setDraft('')
              } else if (canCreate) {
                onCreate(draft)
                setDraft('')
              }
            } else if (event.key === 'Backspace' && !draft && selected.length) {
              onToggle(selected[selected.length - 1]!.id)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>
      {open ? (
        <div className="biu-schema-tokens-menu" role="listbox">
          {available.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="biu-schema-tokens-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onToggle(tag.id)
                setDraft('')
                inputRef.current?.focus()
              }}
            >
              <TagChip id={tag.id} label={tag.label} />
              {tag.hint ? <span className="biu-schema-tokens-hint">{tag.hint}</span> : null}
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className="biu-schema-tokens-option is-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(draft)
                setDraft('')
              }}
            >
              <PlusMark />
              {createLabel} <TagChip id={draft.trim()} label={draft.trim()} />
            </button>
          ) : null}
          {!available.length && !canCreate ? <div className="biu-schema-tokens-empty">{emptyLabel}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function AddProperty({
  typeOptions,
  defaultType,
  onAdd,
}: {
  typeOptions: Array<{ id: string; label: string; icon?: ReactNode }>
  defaultType?: string
  onAdd: (label: string, type: string) => void
}) {
  ensureSchemaPackStyle()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState(defaultType ?? typeOptions[0]?.id ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function commit() {
    const name = label.trim()
    if (!name) {
      setOpen(false)
      return
    }
    onAdd(name, type)
    setLabel('')
    setType(defaultType ?? typeOptions[0]?.id ?? '')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="biu-schema-addprop" onClick={() => setOpen(true)}>
        <PlusMark />
        添加属性
      </button>
    )
  }

  return (
    <div className="biu-schema-addprop-form">
      <input
        ref={inputRef}
        className="biu-schema-addprop-input"
        value={label}
        placeholder="属性名"
        onChange={(event) => setLabel(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            setOpen(false)
            setLabel('')
          }
        }}
        onBlur={(event) => {
          if (event.relatedTarget && event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) return
          if (!label.trim()) setOpen(false)
        }}
      />
      <TypeMenu value={type} options={typeOptions} onChange={setType} />
      <button type="button" className="biu-schema-addprop-ok" disabled={!label.trim()} onClick={commit}>
        添加
      </button>
    </div>
  )
}

export function SchemaPack({ children }: { children: ReactNode }) {
  ensureSchemaPackStyle()
  return <div className="biu-schema-pack">{children}</div>
}

export function SchemaPackHead({ children }: { children: ReactNode }) {
  return <div className="biu-schema-pack-head">{children}</div>
}

export function SchemaProp({
  label,
  icon,
  onRemove,
  children,
}: {
  label: string
  icon?: ReactNode
  onRemove?: () => void
  children?: ReactNode
}) {
  ensureSchemaPackStyle()
  return (
    <div className="biu-schema-prop">
      <span className="biu-schema-prop-k" title={label}>
        {icon}
        {label}
      </span>
      <div className="biu-schema-prop-v">
        {children}
        {onRemove ? (
          <button type="button" className="biu-schema-prop-del" aria-label={`删除 ${label}`} onClick={onRemove}>
            <CloseMark />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function SchemaFieldShell({ children }: { children: ReactNode }) {
  ensureSchemaPackStyle()
  return (
    <div className="biu-schema" data-testid="fsdb-schema">
      {children}
    </div>
  )
}
