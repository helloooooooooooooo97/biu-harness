import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ATOMIC_FIELD_TYPES,
  normalizeSchemaValue,
  type AtomicFieldType,
  type CollectionSchemaPack,
  type FieldSpec,
  type SchemaFieldValue,
  type SchemaPackField,
} from '@biu/type-file-system'
import { ChevronDownIcon, PlusIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { asStringList } from './fields.ts'
import { FieldEditor, FieldGlyph, parseFieldValue } from './fsdb-cells.tsx'
import { loadSchemaTags, persistSchemaTags, fieldKeyFromLabel, slugTagId, subscribeSchemaTags } from './schema-tags.ts'

const TYPE_LABEL: Record<AtomicFieldType, string> = {
  string: '文本',
  number: '数字',
  boolean: '是/否',
  select: '单选',
  'multi-select': '多选',
  datetime: '时间',
  bytes: '体积',
  url: '链接',
  image: '图片',
  attachment: '附件',
  file: '正文',
}

const TAG_TONES = ['#5b9fd6', '#9a6dd7', '#d9730d', '#448361', '#c4554d', '#e255a1', '#c2920a', '#787774']

export function schemaTagTone(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0
  return TAG_TONES[hash % TAG_TONES.length]!
}

function asDraft(value: unknown, field: FieldSpec): string {
  const kind = field.type
  if (kind === 'multi-select') return asStringList(value).join(', ')
  if (kind === 'boolean') return value === true || value === 'true' ? 'true' : 'false'
  if (value == null) return ''
  return String(value)
}

export function SchemaChip({
  id,
  label,
  onRemove,
  onClick,
  active,
}: {
  id: string
  label: string
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}) {
  const chip = (
    <span
      className={`fsdb-ntag${active ? ' is-on' : ''}${onClick ? ' is-btn' : ''}`}
      style={{ ['--ntag' as string]: schemaTagTone(id) }}
      title={label}
    >
      <span className="fsdb-ntag-label">{label}</span>
      {onRemove ? (
        <button type="button" className="fsdb-token-x" aria-label={`移除 ${label}`} onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}>
          <XMarkIcon aria-hidden className="size-3" />
        </button>
      ) : null}
    </span>
  )
  if (!onClick) return chip
  return (
    <button type="button" className="fsdb-ntag-wrap" onClick={onClick}>
      {chip}
    </button>
  )
}

export function SchemaChips({ value, tags }: { value: unknown; tags: CollectionSchemaPack[] }) {
  const parsed = normalizeSchemaValue(value)
  if (!parsed.tags.length) return <span className="fsdb-muted">空</span>
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  return (
    <span className="fsdb-tags">
      {parsed.tags.map((id) => (
        <SchemaChip key={id} id={id} label={byId.get(id)?.label ?? id} />
      ))}
    </span>
  )
}

function TypeMenu({ value, onChange }: { value: AtomicFieldType; onChange: (next: AtomicFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="fsdb-schema-type" ref={ref}>
      <button type="button" className="fsdb-schema-type-btn" onClick={() => setOpen((prev) => !prev)}>
        <FieldGlyph kind={value} />
        <span>{TYPE_LABEL[value]}</span>
        <ChevronDownIcon aria-hidden className="size-3 fsdb-schema-type-caret" />
      </button>
      {open ? (
        <div className="fsdb-schema-type-menu" role="listbox">
          {ATOMIC_FIELD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`fsdb-schema-type-option${type === value ? ' is-on' : ''}`}
              onClick={() => {
                onChange(type)
                setOpen(false)
              }}
            >
              <FieldGlyph kind={type} />
              {TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TagPicker({
  catalog,
  selectedIds,
  onToggle,
  onCreate,
}: {
  catalog: CollectionSchemaPack[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onCreate: (label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = draft.trim().toLowerCase()
  const selected = catalog.filter((tag) => selectedIds.includes(tag.id))
  const available = catalog.filter((tag) => !selectedIds.includes(tag.id) && (!q || tag.label.toLowerCase().includes(q) || tag.id.includes(q)))
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
    <div className="fsdb-schema-tokens" ref={boxRef}>
      <div
        className="fsdb-schema-tokens-box"
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selected.map((tag) => (
          <SchemaChip key={tag.id} id={tag.id} label={tag.label} onRemove={() => onToggle(tag.id)} />
        ))}
        <input
          ref={inputRef}
          className="fsdb-schema-tokens-input"
          value={draft}
          placeholder={selected.length ? '搜索' : '选择或新建'}
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
        <div className="fsdb-schema-tokens-menu" role="listbox">
          {available.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="fsdb-schema-tokens-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onToggle(tag.id)
                setDraft('')
                inputRef.current?.focus()
              }}
            >
              <SchemaChip id={tag.id} label={tag.label} />
              <span className="fsdb-schema-tokens-hint">{tag.fields.length ? `${tag.fields.length} 个属性` : '还没有属性'}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className="fsdb-schema-tokens-option is-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(draft)
                setDraft('')
              }}
            >
              <PlusIcon aria-hidden className="size-3.5" />
              创建 SuperTag <SchemaChip id={draft.trim()} label={draft.trim()} />
            </button>
          ) : null}
          {!available.length && !canCreate ? <div className="fsdb-schema-tokens-empty">没有匹配的 SuperTag</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function AddProperty({ onAdd }: { onAdd: (label: string, type: AtomicFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<AtomicFieldType>('string')
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
    setType('string')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="fsdb-schema-addprop" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden className="size-3.5" />
        添加属性
      </button>
    )
  }

  return (
    <div className="fsdb-schema-addprop-form">
      <input
        ref={inputRef}
        className="fsdb-schema-addprop-input"
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
      <TypeMenu value={type} onChange={setType} />
      <button type="button" className="fsdb-schema-addprop-ok" disabled={!label.trim()} onClick={commit}>
        添加
      </button>
    </div>
  )
}

export function SuperTagPackEditor({ tagId }: { tagId: string }) {
  const [catalog, setCatalog] = useState(() => loadSchemaTags())
  useEffect(() => subscribeSchemaTags(undefined, () => setCatalog(loadSchemaTags())), [])
  const tag = catalog.find((item) => item.id === tagId)

  function saveCatalog(next: CollectionSchemaPack[]) {
    persistSchemaTags(next)
    setCatalog(next)
  }

  if (!tag) return <p className="fsdb-muted">这枚 SuperTag 已不在目录里。</p>
  const pack = tag

  function addField(name: string, type: AtomicFieldType) {
    const key = fieldKeyFromLabel(name, new Set(pack.fields.map((item) => item.key)))
    if (pack.fields.some((item) => item.key === key)) return
    const field: SchemaPackField = { key, type, label: name, writable: true }
    saveCatalog(catalog.map((item) => (item.id === pack.id ? { ...item, fields: [...item.fields, field] } : item)))
  }

  function removeField(key: string) {
    saveCatalog(catalog.map((item) => (item.id === pack.id ? { ...item, fields: item.fields.filter((row) => row.key !== key) } : item)))
  }

  return (
    <div className="fsdb-schema-pack">
      {pack.fields.map((field) => (
        <div key={field.key} className="fsdb-schema-prop">
          <span className="fsdb-schema-prop-k" title={field.label ?? field.key}>
            <FieldGlyph kind={field.type} />
            {field.label ?? field.key}
          </span>
          <div className="fsdb-schema-prop-v">
            <span className="fsdb-muted">{TYPE_LABEL[field.type]}</span>
            <button type="button" className="fsdb-schema-prop-del" aria-label={`删除 ${field.label ?? field.key}`} onClick={() => removeField(field.key)}>
              <XMarkIcon aria-hidden className="size-3" />
            </button>
          </div>
        </div>
      ))}
      <AddProperty onAdd={addField} />
    </div>
  )
}

export function SchemaFieldEditor({
  collectionPath: _collectionPath,
  record,
  value,
  writable,
  onChange,
}: {
  collectionPath: string
  record: DbRecord
  value: unknown
  writable?: boolean
  onChange: (next: SchemaFieldValue) => void
}) {
  const parsed = normalizeSchemaValue(value)
  const [catalog, setCatalog] = useState(() => loadSchemaTags())

  useEffect(() => subscribeSchemaTags(undefined, () => setCatalog(loadSchemaTags())), [])

  const selected = useMemo(
    () =>
      parsed.tags.map((id) => catalog.find((tag) => tag.id === id) ?? { id, label: id, fields: [] }),
    [catalog, parsed.tags],
  )

  function saveCatalog(next: CollectionSchemaPack[]) {
    persistSchemaTags(next)
    setCatalog(next)
  }

  function patchValue(next: SchemaFieldValue) {
    onChange(next)
  }

  function toggleTag(id: string) {
    if (parsed.tags.includes(id)) {
      patchValue({ tags: parsed.tags.filter((item) => item !== id), values: parsed.values })
      return
    }
    patchValue({ tags: [...parsed.tags, id], values: parsed.values })
  }

  function createTag(label: string) {
    const name = label.trim()
    if (!name) return
    const id = slugTagId(name, new Set(catalog.map((tag) => tag.id)))
    saveCatalog([...catalog, { id, label: name, fields: [] }])
    patchValue({ tags: [...parsed.tags, id], values: parsed.values })
  }

  function addField(tag: CollectionSchemaPack, name: string, type: AtomicFieldType) {
    const key = fieldKeyFromLabel(name, new Set(tag.fields.map((item) => item.key)))
    if (tag.fields.some((item) => item.key === key)) return
    const field: SchemaPackField = { key, type, label: name, writable: true }
    saveCatalog(catalog.map((item) => (item.id === tag.id ? { ...item, fields: [...item.fields, field] } : item)))
  }

  function removeField(tagId: string, key: string) {
    saveCatalog(catalog.map((tag) => (tag.id === tagId ? { ...tag, fields: tag.fields.filter((item) => item.key !== key) } : tag)))
  }

  function writeField(tagId: string, field: SchemaPackField, raw: string) {
    const bag = { ...(parsed.values[tagId] ?? {}) }
    bag[field.key] = parseFieldValue(field, raw)
    patchValue({ tags: parsed.tags, values: { ...parsed.values, [tagId]: bag } })
  }

  if (!writable) return <SchemaChips value={value} tags={catalog} />

  return (
    <div className="fsdb-schema" data-testid="fsdb-schema">
      <TagPicker catalog={catalog} selectedIds={parsed.tags} onToggle={toggleTag} onCreate={createTag} />
      {selected.map((tag) => {
        const bag = parsed.values[tag.id] ?? {}
        return (
          <div key={tag.id} className="fsdb-schema-pack">
            <div className="fsdb-schema-pack-head">
              <SchemaChip id={tag.id} label={tag.label} />
            </div>
            {tag.fields.map((field) => (
              <div key={field.key} className="fsdb-schema-prop">
                <span className="fsdb-schema-prop-k" title={field.label ?? field.key}>
                  <FieldGlyph kind={field.type} />
                  {field.label ?? field.key}
                </span>
                <div className="fsdb-schema-prop-v">
                  <FieldEditor
                    fieldKey={field.label ?? field.key}
                    field={field}
                    value={asDraft(bag[field.key], field)}
                    onChange={(next) => writeField(tag.id, field, next)}
                  />
                  <button
                    type="button"
                    className="fsdb-schema-prop-del"
                    aria-label={`删除 ${field.label ?? field.key}`}
                    onClick={() => removeField(tag.id, field.key)}
                  >
                    <XMarkIcon aria-hidden className="size-3" />
                  </button>
                </div>
              </div>
            ))}
            <AddProperty onAdd={(name, type) => addField(tag, name, type)} />
          </div>
        )
      })}
    </div>
  )
}

export function formatSchemaCell(value: unknown) {
  const parsed = normalizeSchemaValue(value)
  return parsed.tags.length ? parsed.tags.join(', ') : '—'
}
