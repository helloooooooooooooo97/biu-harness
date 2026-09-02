import { useRef, useState } from 'react'
import { TagChip, TagChips } from '@biu/public-ui'
import { DbSearchMenu, DbSearchOption, ensureDbSearchStyle } from './search-menu.tsx'

export function CellMulti({
  values,
  options,
  onChange,
  allowCreate = true,
  placeholder,
}: {
  values: string[]
  options: Array<{ value: string; label: string }>
  onChange: (next: string[]) => void
  allowCreate?: boolean
  placeholder?: string
}) {
  ensureDbSearchStyle()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const q = query.trim().toLowerCase()
  const byValue = new Map(options.map((item) => [item.value, item]))
  const available = options.filter(
    (item) => !values.includes(item.value) && (!q || item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)),
  )
  const canCreate =
    allowCreate && Boolean(query.trim()) && !values.includes(query.trim()) && !options.some((item) => item.value === query.trim() || item.label === query.trim())
  const close = () => setOpen(false)
  const add = (value: string) => {
    if (!values.includes(value)) onChange([...values, value])
    setQuery('')
  }
  return (
    <div
      className="db-cell-multi fsdb-tokens"
      ref={boxRef}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="db-cell-multi-box fsdb-tokens-box"
        onClick={() => setOpen(true)}
      >
        <TagChips>
          {values.map((value) => (
            <TagChip
              key={value}
              id={value}
              label={byValue.get(value)?.label ?? value}
              onRemove={() => onChange(values.filter((item) => item !== value))}
            />
          ))}
        </TagChips>
        <input
          className="db-cell-multi-input fsdb-tokens-input"
          value={query}
          placeholder={placeholder ?? (values.length ? '' : '搜索或添加')}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (available[0]) add(available[0].value)
              else if (canCreate) add(query.trim())
            } else if (event.key === 'Backspace' && !query && values.length) {
              onChange(values.slice(0, -1))
            } else if (event.key === 'Escape') close()
          }}
        />
      </div>
      {open ? (
        <DbSearchMenu
          anchor={boxRef.current}
          onClose={close}
          query={query}
          onQuery={(next) => {
            setQuery(next)
            setOpen(true)
          }}
          onEnter={() => {
            if (available[0]) add(available[0].value)
            else if (canCreate) add(query.trim())
          }}
          empty={!available.length && !canCreate ? <div className="db-search-empty">没有匹配项</div> : null}
        >
          {available.map((item) => (
            <DbSearchOption key={item.value} onClick={() => add(item.value)}>
              {item.label}
            </DbSearchOption>
          ))}
          {canCreate ? (
            <DbSearchOption onClick={() => add(query.trim())}>添加「{query.trim()}」</DbSearchOption>
          ) : null}
        </DbSearchMenu>
      ) : null}
    </div>
  )
}
