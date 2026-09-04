import { useEffect, useRef, useState } from 'react'
import type { DbRecord, FieldSpec } from '@biu/type-file-system'
import { TagChip, TagChips } from '@biu/public-ui'
import { DbSearchOption, ensureDbSearchStyle } from '@biu/database-ui'
import { FieldEditor, fieldDraftValue, parseFieldValue } from './fsdb-cells.tsx'
import { SchemaFieldEditor } from './schema-field.tsx'
import { asStringList, parseFacetFlatColumnKey, resolveFieldType } from './fields.ts'

function TagPickPanel({
  values,
  options,
  multiple,
  onChange,
  onPicked,
}: {
  values: string[]
  options: string[]
  multiple: boolean
  onChange: (next: string[]) => void
  onPicked?: () => void
}) {
  ensureDbSearchStyle()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const available = options.filter(
    (item) => Boolean(item) && !values.includes(item) && (!q || item.toLowerCase().includes(q)),
  )
  const draft = query.trim()
  const canCreate = Boolean(draft) && !values.includes(draft) && !options.includes(draft)
  function add(value: string) {
    if (!value) return
    if (multiple) {
      if (!values.includes(value)) onChange([...values, value])
    } else {
      onChange([value])
      onPicked?.()
    }
    setQuery('')
  }
  return (
    <div className="fsdb-cell-pop-tags">
      {values.length ? (
        <div className="fsdb-cell-pop-picked">
          <TagChips>
            {values.map((value) => (
              <TagChip key={value} id={value} label={value} onRemove={() => onChange(values.filter((item) => item !== value))} />
            ))}
          </TagChips>
        </div>
      ) : null}
      <label className="db-search-field">
        <input
          value={query}
          autoFocus
          placeholder=""
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (available[0]) add(available[0])
              else if (canCreate) add(draft)
            }
          }}
        />
      </label>
      <div className="db-search-list">
        {available.map((item) => (
          <DbSearchOption key={item} onClick={() => add(item)}>
            <TagChip id={item} label={item} />
          </DbSearchOption>
        ))}
        {canCreate ? (
          <DbSearchOption onClick={() => add(draft)}>
            添加 <TagChip id={draft} label={draft} />
          </DbSearchOption>
        ) : null}
      </div>
    </div>
  )
}

export function CellPopDraft({
  record,
  fieldKey,
  field,
  initial,
  options,
  collectionPath,
  onClose,
  onSubmit,
}: {
  record: DbRecord
  fieldKey: string
  field: FieldSpec
  initial: unknown
  options: string[]
  collectionPath: string
  onClose: () => void
  onSubmit: (raw: unknown) => void
}) {
  const kind = resolveFieldType(field)
  const flat = parseFacetFlatColumnKey(fieldKey)
  const [text, setText] = useState(() => fieldDraftValue(field, initial))
  const [raw, setRaw] = useState<unknown>(initial)
  const rawRef = useRef(initial)
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  const live = kind === 'select' || kind === 'multi-select' || kind === 'datetime' || kind === 'image' || kind === 'attachment' || kind === 'facet'

  function put(next: unknown, nextText?: string) {
    rawRef.current = next
    setRaw(next)
    if (nextText != null) setText(nextText)
    if (live) onSubmitRef.current(next)
  }

  useEffect(
    () => () => {
      onSubmitRef.current(rawRef.current)
    },
    [],
  )

  if (kind === 'select' || kind === 'multi-select') {
    const selected = kind === 'multi-select' ? asStringList(raw) : text ? [text] : asStringList(raw)
    const list = [...new Set([...options, ...selected])].filter(Boolean)
    return (
      <TagPickPanel
        values={selected}
        options={list}
        multiple={kind === 'multi-select'}
        onChange={(next) => {
          const value = kind === 'multi-select' ? next : next[0] ?? ''
          setText(kind === 'multi-select' ? next.join(', ') : value)
          put(kind === 'multi-select' ? next : value)
        }}
        onPicked={kind === 'select' ? onClose : undefined}
      />
    )
  }

  if (kind === 'facet') {
    return (
      <SchemaFieldEditor collectionPath={collectionPath} record={record} value={raw} writable autoOpen onChange={(next) => put(next)} />
    )
  }

  if (kind === 'datetime' || kind === 'image' || kind === 'attachment' || kind === 'url') {
    return (
      <FieldEditor
        fieldKey={flat ? field.label ?? flat.fieldKey : fieldKey}
        field={field}
        value={text}
        source={raw}
        collectionPath={collectionPath}
        autoOpen
        options={options}
        onChange={(next) => {
          setText(next)
          put(parseFieldValue(field, next))
        }}
        onCommit={(next) => put(next, fieldDraftValue(field, next))}
      />
    )
  }

  return (
    <textarea
      className="fsdb-cell-pop-text"
      rows={3}
      autoFocus
      value={text}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        rawRef.current = next
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          onClose()
        }
      }}
    />
  )
}
