import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ATOMIC_FIELD_TYPES,
  normalizeSchemaValue,
  type AtomicFieldType,
  type CollectionSchemaPack,
  type DbRecord,
  type FieldSpec,
  type FieldType,
  type SchemaFieldValue,
  type SchemaPackField,
} from '@biu/type-file-system'
import { ChevronDownIcon, PlusIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { TagChip, TagChips, tagTone, listenOutsideDismiss } from '@biu/public-ui'
import { CellMulti } from '@biu/database-ui'
import { asStringList } from './fields.ts'
import { FieldEditor, FieldGlyph, parseFieldValue } from './fsdb-cells.tsx'
import { loadFacets, persistFacets, fieldKeyFromLabel, slugFacetId, subscribeFacets } from './facet-catalog.ts'

const TYPE_LABEL: Partial<Record<FieldType, string>> = {
  string: '文本',
  number: '数字',
  boolean: '是/否',
  select: '单选',
  'multi-select': '多选',
  datetime: '时间',
  url: '链接',
  image: '图片',
  attachment: '附件',
  file: '正文',
  action: '动作',
  facet: '类型',
}

export const schemaTagTone = tagTone

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
  return <TagChip id={id} label={label} onRemove={onRemove} onClick={onClick} active={active} />
}

export function SchemaChips({ value, tags }: { value: unknown; tags: CollectionSchemaPack[] }) {
  const parsed = normalizeSchemaValue(value)
  if (!parsed.tags.length) return <span className="fsdb-muted">空</span>
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  return (
    <TagChips>
      {parsed.tags.map((id) => (
        <SchemaChip key={id} id={id} label={byId.get(id)?.label ?? id} />
      ))}
    </TagChips>
  )
}

function TypeMenu({ value, onChange }: { value: AtomicFieldType; onChange: (next: AtomicFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    return listenOutsideDismiss(
      () => setOpen(false),
      (target) => Boolean(ref.current?.contains(target)),
    )
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
        placeholder=""
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

export function FacetPackEditor({ facetId }: { facetId: string }) {
  const [catalog, setCatalog] = useState(() => loadFacets())
  useEffect(() => subscribeFacets(undefined, () => setCatalog(loadFacets())), [])
  const tag = catalog.find((item) => item.id === facetId)

  function saveCatalog(next: CollectionSchemaPack[]) {
    persistFacets(next)
    setCatalog(next)
  }

  if (!tag) return <p className="fsdb-muted">这条类型已不在目录里。</p>
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
  compact,
}: {
  collectionPath: string
  record: DbRecord
  value: unknown
  writable?: boolean
  onChange: (next: SchemaFieldValue) => void
  /** Table cells: chips only — pack fields flatten as their own columns. */
  compact?: boolean
}) {
  const parsed = normalizeSchemaValue(value)
  const [catalog, setCatalog] = useState(() => loadFacets())

  useEffect(() => subscribeFacets(undefined, () => setCatalog(loadFacets())), [])

  const selected = useMemo(
    () =>
      parsed.tags.map((id) => catalog.find((tag) => tag.id === id) ?? { id, label: id, fields: [] }),
    [catalog, parsed.tags],
  )

  function saveCatalog(next: CollectionSchemaPack[]) {
    persistFacets(next)
    setCatalog(next)
  }

  function patchValue(next: SchemaFieldValue) {
    onChange(next)
  }

  function applyTags(nextIds: string[]) {
    let packs = catalog
    const used = new Set(packs.map((tag) => tag.id))
    const resolved: string[] = []
    for (const item of nextIds) {
      if (used.has(item)) {
        resolved.push(item)
        continue
      }
      const hit = packs.find((tag) => tag.label === item)
      if (hit) {
        resolved.push(hit.id)
        continue
      }
      const id = slugFacetId(item, used)
      packs = [...packs, { id, label: item, fields: [] }]
      used.add(id)
      resolved.push(id)
    }
    if (packs !== catalog) saveCatalog(packs)
    patchValue({ tags: resolved, values: parsed.values })
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
      <CellMulti
        values={parsed.tags}
        options={catalog.map((tag) => ({ value: tag.id, label: tag.label }))}
        onChange={applyTags}
        multiple
      />
      {compact
        ? null
        : selected.map((tag) => {
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
