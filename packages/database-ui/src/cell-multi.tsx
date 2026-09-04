import { useRef, useState } from 'react'
import { TagChip, TagChips } from '@biu/public-ui'
import { DbSearchMenu, DbSearchOption, ensureDbSearchStyle } from './search-menu.tsx'

export function CellMulti({
  values,
  options,
  onChange,
  allowCreate = true,
  placeholder,
  multiple = true,
}: {
  values: string[]
  options: Array<{ value: string; label: string }>
  onChange: (next: string[]) => void
  allowCreate?: boolean
  placeholder?: string
  multiple?: boolean
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
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const add = (value: string) => {
    if (multiple) {
      if (!values.includes(value)) onChange([...values, value])
    } else {
      onChange([value])
      close()
    }
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={placeholder ?? '添加标签'}
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
      </div>
      {open ? (
        <DbSearchMenu
          anchor={boxRef.current}
          onClose={close}
          query={query}
          placeholder={placeholder ?? '添加标签'}
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
              <TagChip id={item.value} label={item.label} />
            </DbSearchOption>
          ))}
          {canCreate ? (
            <DbSearchOption onClick={() => add(query.trim())}>
              添加 <TagChip id={query.trim()} label={query.trim()} />
            </DbSearchOption>
          ) : null}
        </DbSearchMenu>
      ) : null}
    </div>
  )
}
