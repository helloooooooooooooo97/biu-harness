import type { CollectionSchema, DbRecord, FieldSpec, FieldType } from '@biu/type-file-system'
import { asAttachment, asHttpHref, asImageSrc, BUILTIN_FIELD_KEYS } from '@biu/type-file-system'

export type ViewMode = 'queue' | 'table' | 'cards' | 'board'

export function resolveFieldType(field: FieldSpec): FieldType {
  if (field.type === 'string[]') return 'multi-select'
  if (field.type === 'string' && field.enum?.length) return 'select'
  if (field.type === 'number' && field.format === 'datetime') return 'datetime'
  if (field.type === 'number' && field.format === 'bytes') return 'bytes'
  if (field.type === 'string' && (field.format === 'url' || field.format === 'image' || field.format === 'attachment' || field.format === 'file')) {
    return field.format
  }
  return field.type
}

export function fieldEntries(schema: CollectionSchema | undefined) {
  if (!schema) return []
  return Object.entries(schema.fields).map(([key, field]) => ({ key, field, kind: resolveFieldType(field) }))
}

function declaredParentField(schema: CollectionSchema | undefined) {
  if (schema?.parentField && schema.fields[schema.parentField]) return schema.parentField
  if (schema?.fields.parentId) return 'parentId'
  if (schema?.fields.parent) return 'parent'
  return null
}

/** 推断父子字段：schema 声明优先，否则看数据里是否有指向其它记录 id 的 string 列。 */
export function parentFieldKey(schema: CollectionSchema | undefined, rows: DbRecord[] = []): string | null {
  const declared = declaredParentField(schema)
  if (declared) return declared
  const ids = new Set(rows.map((row) => row.id))
  for (const item of fieldEntries(schema)) {
    if (item.kind !== 'string' || item.key === schema?.labelField) continue
    const linked = rows.some((row) => {
      const value = String(row[item.key] ?? '')
      return Boolean(value) && value !== row.id && ids.has(value)
    })
    if (linked) return item.key
  }
  return null
}

export type TreeRow = { row: DbRecord; depth: number; hasKids: boolean }

export function flattenTree(rows: DbRecord[], parentKey: string, collapsed: Record<string, boolean> = {}): TreeRow[] {
  const ids = new Set(rows.map((row) => row.id))
  const children = new Map<string, DbRecord[]>()
  const hasKids = new Set<string>()
  for (const row of rows) {
    const raw = String(row[parentKey] ?? '')
    const parent = raw && raw !== row.id && ids.has(raw) ? raw : ''
    if (parent) hasKids.add(parent)
    children.set(parent, [...(children.get(parent) ?? []), row])
  }
  const out: TreeRow[] = []
  const seen = new Set<string>()
  const skip = (parent: string) => {
    for (const row of children.get(parent) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      skip(row.id)
    }
  }
  const visit = (parent: string, depth: number) => {
    for (const row of children.get(parent) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push({ row, depth, hasKids: hasKids.has(row.id) })
      if (collapsed[row.id]) skip(row.id)
      else visit(row.id, depth + 1)
    }
  }
  visit('', 0)
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push({ row, depth: 0, hasKids: hasKids.has(row.id) })
    if (!collapsed[row.id]) visit(row.id, 1)
  }
  return out
}

/** 表格默认列：schema.columns 与现有列求交；没有声明则展开业务列（不含 id、内置时间列与父级字段）。标题列始终排在最前。 */
export function pinLabelColumn(schema: CollectionSchema | undefined, keys: string[]): string[] {
  const label = schema?.labelField
  if (!label) return keys
  return [label, ...keys.filter((key) => key !== label)]
}

export function defaultColumnKeys(schema: CollectionSchema | undefined, allKeys: string[]): string[] {
  const listed = schema?.columns?.filter((key) => allKeys.includes(key)) ?? []
  const parent = declaredParentField(schema)
  const raw = listed.length
    ? listed
    : allKeys.filter((key) => !(BUILTIN_FIELD_KEYS as readonly string[]).includes(key) && key !== parent)
  const keys = raw.length ? raw : allKeys
  return pinLabelColumn(schema, keys)
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function asTime(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function formatField(field: FieldSpec | undefined, value: unknown): string {
  if (!field) return value == null || value === '' ? '—' : String(value)
  const kind = resolveFieldType(field)
  if (value == null || value === '') return '—'
  if (kind === 'datetime') {
    const n = asTime(value)
    if (!n) return '—'
    return new Date(n).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
  if (kind === 'bytes') {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }
  if (kind === 'boolean') return value === true || value === 'true' ? '是' : '否'
  if (kind === 'url') return asHttpHref(value) || '—'
  if (kind === 'image') return asImageSrc(value) || '—'
  if (kind === 'attachment') {
    const file = asAttachment(value)
    return file ? file.name : '—'
  }
  if (kind === 'file') {
    if (value == null || value === '') return '—'
    const img = asImageSrc(value)
    if (img) return img
    const file = asAttachment(value)
    if (file) return file.name
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value)
    } catch {
      return '—'
    }
  }
  if (kind === 'multi-select') {
    const tags = asStringList(value)
    return tags.length ? tags.join(', ') : '—'
  }
  return String(value)
}

export function contentFieldKey(schema: CollectionSchema | undefined) {
  if (!schema) return null
  const preferred = schema.contentField ?? 'content'
  if (preferred !== schema.labelField && schema.fields[preferred]) return preferred
  const label = schema.labelField
  for (const key of ['description', 'notes', 'body']) {
    if (key === label) continue
    const field = schema.fields[key]
    if (field && (resolveFieldType(field) === 'string' || resolveFieldType(field) === 'file')) return key
  }
  return null
}

/** @deprecated 用 contentFieldKey */
export function bodyFieldKey(schema: CollectionSchema | undefined) {
  return contentFieldKey(schema)
}

export function detailsFieldKey(schema: CollectionSchema | undefined) {
  return contentFieldKey(schema)
}

export function matchesQuery(row: DbRecord, query: string, schema: CollectionSchema) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (String(row.id).toLowerCase().includes(q)) return true
  for (const [key, field] of Object.entries(schema.fields)) {
    const text = formatField(field, row[key]).toLowerCase()
    if (text.includes(q)) return true
  }
  return false
}

export function matchesFilters(row: DbRecord, filters: Record<string, string>, schema: CollectionSchema) {
  for (const [key, expected] of Object.entries(filters)) {
    if (!expected) continue
    const field = schema.fields[key]
    if (!field) continue
    const kind = resolveFieldType(field)
    if (kind === 'datetime' && ['1h', '24h', '7d', '30d'].includes(expected)) {
      const n = asTime(row[key])
      if (!n) return false
      const span =
        expected === '1h' ? 3600e3 : expected === '24h' ? 86400e3 : expected === '7d' ? 7 * 86400e3 : 30 * 86400e3
      if (Date.now() - n > span) return false
      continue
    }
    if (kind === 'multi-select') {
      if (!asStringList(row[key]).includes(expected)) return false
      continue
    }
    if (kind === 'boolean') {
      const actual = row[key] === true || row[key] === 'true' ? 'true' : 'false'
      if (actual !== expected) return false
      continue
    }
    if (String(row[key] ?? '') !== expected) return false
  }
  return true
}

function compareValues(field: FieldSpec, a: unknown, b: unknown): number {
  const kind = resolveFieldType(field)
  if (kind === 'number' || kind === 'datetime' || kind === 'bytes') return asTime(a) - asTime(b) || Number(a ?? 0) - Number(b ?? 0)
  if (kind === 'boolean') return Number(a === true || a === 'true') - Number(b === true || b === 'true')
  if (kind === 'select' && field.enum?.length) {
    return field.enum.indexOf(String(a ?? '')) - field.enum.indexOf(String(b ?? ''))
  }
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh')
}

export function sortRows(rows: DbRecord[], schema: CollectionSchema, field: string, dir: 'asc' | 'desc') {
  const spec = schema.fields[field]
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const c = spec ? compareValues(spec, a[field], b[field]) : String(a[field] ?? '').localeCompare(String(b[field] ?? ''))
    if (c !== 0) return c * sign
    return String(a.id).localeCompare(String(b.id))
  })
}

export function uniqueValues(rows: DbRecord[], key: string, field: FieldSpec): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    if (resolveFieldType(field) === 'multi-select') {
      for (const item of asStringList(row[key])) set.add(item)
    } else if (row[key] != null && row[key] !== '') {
      set.add(String(row[key]))
    }
  }
  if (field.enum?.length) return [...field.enum]
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'))
}

export function isGroupableKind(kind: FieldType) {
  return kind === 'select' || kind === 'multi-select'
}

export function groupableFields(schema: CollectionSchema | undefined) {
  return fieldEntries(schema).filter((item) => isGroupableKind(item.kind) && item.key !== schema?.labelField)
}

export function groupField(schema: CollectionSchema | undefined, preferred?: string): { key: string; field: FieldSpec } | null {
  if (!preferred) return null
  const match = groupableFields(schema).find((item) => item.key === preferred)
  return match ? { key: match.key, field: match.field } : null
}

function groupBucketLabel(kind: FieldType, key: string) {
  if (kind === 'boolean') return key === 'true' ? '是' : '否'
  return key
}

export function groupRecords(rows: DbRecord[], schema: CollectionSchema | undefined, preferred?: string) {
  const group = groupField(schema, preferred)
  if (!group) return [{ key: '', label: '全部', rows }]
  const kind = resolveFieldType(group.field)
  const known =
    kind === 'boolean'
      ? ['true', 'false']
      : [...new Set([...(group.field.enum ?? []), ...uniqueValues(rows, group.key, group.field)])]
  const buckets = new Map<string, DbRecord[]>(known.map((key) => [key, []]))
  const unset: DbRecord[] = []
  for (const row of rows) {
    if (kind === 'boolean') {
      const flag = row[group.key] === true || row[group.key] === 'true'
      buckets.set(flag ? 'true' : 'false', [...(buckets.get(flag ? 'true' : 'false') ?? []), row])
      continue
    }
    if (kind === 'multi-select') {
      const tags = asStringList(row[group.key])
      if (!tags.length) {
        unset.push(row)
        continue
      }
      for (const tag of tags) {
        buckets.set(tag, [...(buckets.get(tag) ?? []), row])
      }
      continue
    }
    const key = String(row[group.key] ?? '')
    if (!key) unset.push(row)
    else buckets.set(key, [...(buckets.get(key) ?? []), row])
  }
  const listed = [...buckets.entries()].map(([key, grouped]) => ({
    key,
    label: groupBucketLabel(kind, key),
    rows: grouped,
  }))
  if (unset.length) listed.push({ key: '', label: '未填', rows: unset })
  return listed
}

export function matchActionWhen(record: DbRecord, when?: Record<string, unknown>) {
  if (!when) return true
  for (const [key, expected] of Object.entries(when)) {
    const actual = record[key]
    if (expected === true || expected === false) {
      const flag = actual === true || actual === 'true'
      if (flag !== expected) return false
      continue
    }
    if (String(actual ?? '') !== String(expected)) return false
  }
  return true
}
