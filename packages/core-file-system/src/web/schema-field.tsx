import { useEffect, useMemo, useState } from 'react'
import {
  ATOMIC_FIELD_TYPES,
  isAtomicFieldType,
  normalizeSchemaValue,
  schemaSearchHaystack,
  type AtomicFieldType,
  type CollectionSchemaPack,
  type SchemaFieldValue,
  type SchemaPackField,
} from '@biu/type-file-system'
import type { FieldTypeUi, FsFieldCellProps, FsFieldEditorProps } from '@biu/type-file-system/ui'
import {
  AddProperty,
  SchemaChips,
  SchemaFieldShell,
  SchemaPack,
  SchemaPackHead,
  SchemaProp,
  TagChip,
  TagPicker,
} from '@biu/public-ui'
import { asStringList } from './fields.ts'
import { FieldEditor, FieldGlyph, parseFieldValue } from './fsdb-cells.tsx'
import { fieldKeyFromLabel, loadSchemaTags, persistSchemaTags, pullSchemaTags, slugTagId, subscribeSchemaTags } from './schema-tags.ts'

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

function typeOptions() {
  return ATOMIC_FIELD_TYPES.map((type) => ({
    id: type,
    label: TYPE_LABEL[type],
    icon: <FieldGlyph kind={type} />,
  }))
}

function asDraft(value: unknown, field: SchemaPackField): string {
  const kind = field.type
  if (kind === 'multi-select') return asStringList(value).join(', ')
  if (kind === 'boolean') return value === true || value === 'true' ? 'true' : 'false'
  if (value == null) return ''
  return String(value)
}

function useSchemaCatalog() {
  const [catalog, setCatalog] = useState(() => loadSchemaTags())
  useEffect(() => {
    void pullSchemaTags()
    return subscribeSchemaTags(undefined, () => setCatalog(loadSchemaTags()))
  }, [])
  return [catalog, (next: CollectionSchemaPack[]) => {
    persistSchemaTags(next)
    setCatalog(next)
  }] as const
}

function chipTags(value: unknown, catalog: CollectionSchemaPack[]) {
  const parsed = normalizeSchemaValue(value)
  const byId = new Map(catalog.map((tag) => [tag.id, tag]))
  return parsed.tags.map((id) => ({ id, label: byId.get(id)?.label ?? id }))
}

export function SchemaCell({ value }: FsFieldCellProps) {
  const [catalog] = useSchemaCatalog()
  return <SchemaChips tags={chipTags(value, catalog)} />
}

export function SuperTagPackEditor({ tagId }: { tagId: string }) {
  const [catalog, saveCatalog] = useSchemaCatalog()
  const tag = catalog.find((item) => item.id === tagId)
  if (!tag) return <p className="fsdb-muted">这枚 SuperTag 已不在目录里。</p>
  const pack = tag

  function addField(name: string, typeId: string) {
    if (!isAtomicFieldType(typeId)) return
    const key = fieldKeyFromLabel(name, new Set(pack.fields.map((item) => item.key)))
    if (pack.fields.some((item) => item.key === key)) return
    const field: SchemaPackField = { key, type: typeId, label: name, writable: true }
    saveCatalog(catalog.map((item) => (item.id === pack.id ? { ...item, fields: [...item.fields, field] } : item)))
  }

  function removeField(key: string) {
    saveCatalog(catalog.map((item) => (item.id === pack.id ? { ...item, fields: item.fields.filter((row) => row.key !== key) } : item)))
  }

  return (
    <SchemaPack>
      {pack.fields.map((field) => (
        <SchemaProp
          key={field.key}
          label={field.label ?? field.key}
          icon={<FieldGlyph kind={field.type} />}
          onRemove={() => removeField(field.key)}
        >
          <span className="fsdb-muted">{TYPE_LABEL[field.type]}</span>
        </SchemaProp>
      ))}
      <AddProperty typeOptions={typeOptions()} defaultType="string" onAdd={addField} />
    </SchemaPack>
  )
}

export function SchemaFieldEditor({
  collectionPath: _collectionPath,
  record: _record,
  value,
  writable,
  onChange,
}: {
  collectionPath: string
  record: { id: string }
  value: unknown
  writable?: boolean
  onChange: (next: SchemaFieldValue) => void
}) {
  const parsed = normalizeSchemaValue(value)
  const [catalog, saveCatalog] = useSchemaCatalog()
  const selected = useMemo(
    () => parsed.tags.map((id) => catalog.find((tag) => tag.id === id) ?? { id, label: id, fields: [] as SchemaPackField[] }),
    [catalog, parsed.tags],
  )

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

  function addField(tag: CollectionSchemaPack, name: string, typeId: string) {
    if (!isAtomicFieldType(typeId)) return
    const key = fieldKeyFromLabel(name, new Set(tag.fields.map((item) => item.key)))
    if (tag.fields.some((item) => item.key === key)) return
    const field: SchemaPackField = { key, type: typeId, label: name, writable: true }
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

  if (!writable) return <SchemaChips tags={chipTags(value, catalog)} />

  return (
    <SchemaFieldShell>
      <TagPicker
        catalog={catalog.map((tag) => ({
          id: tag.id,
          label: tag.label,
          hint: tag.fields.length ? `${tag.fields.length} 个属性` : '还没有属性',
        }))}
        selectedIds={parsed.tags}
        onToggle={toggleTag}
        onCreate={createTag}
        createLabel="创建 SuperTag"
        emptyLabel="没有匹配的 SuperTag"
      />
      {selected.map((tag) => {
        const bag = parsed.values[tag.id] ?? {}
        return (
          <SchemaPack key={tag.id}>
            <SchemaPackHead>
              <TagChip id={tag.id} label={tag.label} />
            </SchemaPackHead>
            {tag.fields.map((field) => (
              <SchemaProp
                key={field.key}
                label={field.label ?? field.key}
                icon={<FieldGlyph kind={field.type} />}
                onRemove={() => removeField(tag.id, field.key)}
              >
                <FieldEditor
                  fieldKey={field.label ?? field.key}
                  field={field}
                  value={asDraft(bag[field.key], field)}
                  onChange={(next) => writeField(tag.id, field, next)}
                />
              </SchemaProp>
            ))}
            <AddProperty typeOptions={typeOptions()} defaultType="string" onAdd={(name, type) => addField(tag, name, type)} />
          </SchemaPack>
        )
      })}
    </SchemaFieldShell>
  )
}

function SchemaEditor(props: FsFieldEditorProps) {
  return (
    <SchemaFieldEditor
      collectionPath={props.collectionPath}
      record={props.record}
      value={props.value}
      writable={props.writable}
      onChange={(next) => props.onChange(next)}
    />
  )
}

export const schemaFieldType: FieldTypeUi = {
  Cell: SchemaCell,
  Editor: SchemaEditor,
  hideReadOnlyDetail: true,
  stackDetail: true,
  filterLabel: (value) => loadSchemaTags().find((tag) => tag.id === value)?.label ?? value,
  searchText: (value) => schemaSearchHaystack(value, loadSchemaTags()),
  matchesFilter: (value, expected) => {
    const parsed = normalizeSchemaValue(value)
    if (parsed.tags.includes(expected)) return true
    return loadSchemaTags().some((tag) => parsed.tags.includes(tag.id) && tag.label === expected)
  },
}
