import { useEffect, useMemo, useState } from 'react'
import {
  ATOMIC_FIELD_TYPES,
  emptySchemaValue,
  normalizeSchemaValue,
  type AtomicFieldType,
  type CollectionSchemaPack,
  type DbRecord,
  type FieldSpec,
  type SchemaFieldValue,
  type SchemaPackField,
} from '@biu/type-file-system'
import { PlusIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { CellSelect } from './controls.tsx'
import { asStringList } from './fields.ts'
import { FieldEditor, FieldGlyph, parseFieldValue } from './fsdb-cells.tsx'
import { loadSchemaTags, persistSchemaTags, slugTagId, subscribeSchemaTags } from './schema-tags.ts'

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

function asDraft(value: unknown, field: FieldSpec): string {
  const kind = field.type
  if (kind === 'multi-select') return asStringList(value).join(', ')
  if (kind === 'boolean') return value === true || value === 'true' ? 'true' : 'false'
  if (value == null) return ''
  return String(value)
}

export function SchemaChips({ value, tags }: { value: unknown; tags: CollectionSchemaPack[] }) {
  const parsed = normalizeSchemaValue(value)
  if (!parsed.tags.length) return <span className="fsdb-muted">—</span>
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  return (
    <span className="fsdb-tags">
      {parsed.tags.map((id) => (
        <span key={id} className="fsdb-tag">
          {byId.get(id)?.label ?? id}
        </span>
      ))}
    </span>
  )
}

export function SchemaFieldEditor({
  collectionPath,
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
  const [catalog, setCatalog] = useState(() => loadSchemaTags(collectionPath))
  const [openTag, setOpenTag] = useState<string | null>(parsed.tags[0] ?? null)
  const [creating, setCreating] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [fieldDraft, setFieldDraft] = useState({ key: '', label: '', type: 'string' as AtomicFieldType })

  useEffect(() => subscribeSchemaTags(collectionPath, () => setCatalog(loadSchemaTags(collectionPath))), [collectionPath])

  const selected = useMemo(
    () => parsed.tags.map((id) => catalog.find((tag) => tag.id === id)).filter(Boolean) as CollectionSchemaPack[],
    [catalog, parsed.tags],
  )
  const unused = catalog.filter((tag) => !parsed.tags.includes(tag.id))
  const current = selected.find((tag) => tag.id === openTag) ?? selected[0]

  function saveCatalog(next: CollectionSchemaPack[]) {
    persistSchemaTags(collectionPath, next)
    setCatalog(next)
  }

  function patchValue(next: SchemaFieldValue) {
    onChange(next)
  }

  function addExisting(id: string) {
    if (parsed.tags.includes(id)) return
    patchValue({ tags: [...parsed.tags, id], values: parsed.values })
    setOpenTag(id)
  }

  function createTag(label: string) {
    const name = label.trim()
    if (!name) {
      setCreating(false)
      setNameDraft('')
      return
    }
    const id = slugTagId(name, new Set(catalog.map((tag) => tag.id)))
    const tag: CollectionSchemaPack = { id, label: name, fields: [] }
    saveCatalog([...catalog, tag])
    patchValue({ tags: [...parsed.tags, id], values: parsed.values })
    setOpenTag(id)
    setCreating(false)
    setNameDraft('')
  }

  function dropTag(id: string) {
    patchValue({ tags: parsed.tags.filter((item) => item !== id), values: parsed.values })
    if (openTag === id) setOpenTag(parsed.tags.find((item) => item !== id) ?? null)
  }

  function addField() {
    if (!current) return
    const key = fieldDraft.key.trim() || slugTagId(fieldDraft.label || 'field', new Set(current.fields.map((item) => item.key))).replace(/-/g, '_')
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) return
    if (current.fields.some((item) => item.key === key)) return
    const field: SchemaPackField = {
      key,
      type: fieldDraft.type,
      label: fieldDraft.label.trim() || key,
      writable: true,
    }
    saveCatalog(catalog.map((tag) => (tag.id === current.id ? { ...tag, fields: [...tag.fields, field] } : tag)))
    setFieldDraft({ key: '', label: '', type: 'string' })
  }

  function removeField(key: string) {
    if (!current) return
    saveCatalog(
      catalog.map((tag) => (tag.id === current.id ? { ...tag, fields: tag.fields.filter((item) => item.key !== key) } : tag)),
    )
  }

  function writeField(field: SchemaPackField, raw: string) {
    if (!current) return
    const bag = { ...(parsed.values[current.id] ?? {}) }
    bag[field.key] = parseFieldValue(field, raw)
    patchValue({ tags: parsed.tags, values: { ...parsed.values, [current.id]: bag } })
  }

  if (!writable) return <SchemaChips value={value} tags={catalog} />

  return (
    <div className="fsdb-schema" data-testid="fsdb-schema">
      <div className="fsdb-schema-chips">
        {selected.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`fsdb-tag fsdb-schema-chip${current?.id === tag.id ? ' is-on' : ''}`}
            onClick={() => setOpenTag(tag.id)}
          >
            {tag.label}
            <span
              role="button"
              tabIndex={0}
              className="fsdb-token-x"
              aria-label={`移除 ${tag.label}`}
              onClick={(event) => {
                event.stopPropagation()
                dropTag(tag.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') dropTag(tag.id)
              }}
            >
              <XMarkIcon aria-hidden className="size-3" />
            </span>
          </button>
        ))}
        {unused.map((tag) => (
          <button key={tag.id} type="button" className="fsdb-schema-add" onClick={() => addExisting(tag.id)}>
            + {tag.label}
          </button>
        ))}
        {creating ? (
          <span className="fsdb-schema-new">
            <input
              className="fsdb-plain-input"
              value={nameDraft}
              autoFocus
              placeholder="Tag 名称"
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => createTag(nameDraft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createTag(nameDraft)
                if (event.key === 'Escape') {
                  setCreating(false)
                  setNameDraft('')
                }
              }}
            />
          </span>
        ) : (
          <button type="button" className="fsdb-schema-add" onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden className="size-3" />
            新建 Tag
          </button>
        )}
      </div>
      {current ? (
        <div className="fsdb-schema-body">
          <div className="fsdb-schema-head">{current.label} 的属性</div>
          {current.fields.map((field) => {
            const bag = parsed.values[current.id] ?? {}
            return (
              <div key={field.key} className="fsdb-schema-row">
                <span>
                  <FieldGlyph kind={field.type} />
                  {field.label ?? field.key}
                </span>
                <div className="fsdb-schema-row-val">
                  <FieldEditor
                    fieldKey={`${record.id}:${current.id}:${field.key}`}
                    field={field}
                    value={asDraft(bag[field.key], field)}
                    onChange={(next) => writeField(field, next)}
                  />
                  <button type="button" className="fsdb-schema-del" aria-label={`删除 ${field.label ?? field.key}`} onClick={() => removeField(field.key)}>
                    <XMarkIcon aria-hidden className="size-3" />
                  </button>
                </div>
              </div>
            )
          })}
          <div className="fsdb-schema-newfield">
            <input
              className="fsdb-plain-input"
              value={fieldDraft.label}
              placeholder="属性名"
              onChange={(event) => {
                const label = event.target.value
                setFieldDraft((prev) => ({
                  ...prev,
                  label,
                  key: prev.key || slugTagId(label, new Set()).replace(/-/g, '_'),
                }))
              }}
            />
            <CellSelect
              value={fieldDraft.type}
              options={ATOMIC_FIELD_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
              onSelect={(next) => setFieldDraft((prev) => ({ ...prev, type: next as AtomicFieldType }))}
            />
            <button type="button" className="fsdb-schema-add" onClick={addField}>
              添加属性
            </button>
          </div>
        </div>
      ) : (
        <p className="fsdb-muted">新建或选择一个 Tag，再往里面加现有类型的属性。</p>
      )}
    </div>
  )
}

export function formatSchemaCell(value: unknown) {
  const parsed = normalizeSchemaValue(value)
  return parsed.tags.length ? parsed.tags.join(', ') : '—'
}
