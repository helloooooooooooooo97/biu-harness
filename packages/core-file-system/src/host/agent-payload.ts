import {
  withBuiltinFields,
  type CollectionActionInfo,
  type CollectionSchema,
  type FieldSpec,
} from '@biu/type-file-system'

function specsMatch(field: FieldSpec, builtin: FieldSpec) {
  const label = field.label ?? builtin.label
  if (field.type !== builtin.type) return false
  if (label !== (builtin.label ?? field.label)) return false
  if (field.writable !== builtin.writable) return false
  if (Boolean(field.sortable) !== Boolean(builtin.sortable)) return false
  if ((field.format ?? '') !== (builtin.format ?? '')) return false
  if (JSON.stringify(field.enum ?? null) !== JSON.stringify(builtin.enum ?? null)) return false
  if ((field.action ?? '') !== (builtin.action ?? '')) return false
  if (Boolean(field.computed) !== Boolean(builtin.computed)) return false
  return true
}

function defaultFields(schema: CollectionSchema) {
  const labelField = schema.labelField ?? 'title'
  const contentField = schema.contentField ?? 'content'
  const raw = withBuiltinFields({}, contentField, labelField)
  const fields = { ...raw }
  for (const [key, field] of Object.entries(raw)) {
    fields[key] = field.computed ? { ...field, writable: false } : field
  }
  return fields
}

function compactField(key: string, field: FieldSpec) {
  const out: Record<string, unknown> = { type: field.type }
  if (field.label && field.label !== key) out.label = field.label
  if (field.writable === false) out.writable = false
  if (field.sortable) out.sortable = true
  if (field.format) out.format = field.format
  if (field.enum?.length) out.enum = field.enum
  if (field.action) out.action = field.action
  if (field.computed) out.computed = true
  return out
}

function compactAction(action: CollectionActionInfo) {
  if ((action.for ?? 'both') === 'user') return null
  const out: Record<string, unknown> = { id: action.id }
  if (action.description) out.description = action.description
  else if (action.label && action.label !== action.id) out.label = action.label
  if (action.when) out.when = action.when
  if (action.parameters) out.parameters = action.parameters
  if (action.allowMissing) out.allowMissing = true
  if (action.confirm) out.confirm = action.confirm
  return out
}

export function compactAgentSchema(schema: CollectionSchema) {
  const defaults = defaultFields(schema)
  const fields: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(schema.fields)) {
    const builtin = defaults[key]
    if (builtin && specsMatch(field, builtin)) continue
    fields[key] = compactField(key, field)
  }
  const actions = (schema.actions ?? []).map(compactAction).filter(Boolean)
  const out: Record<string, unknown> = {}
  if (schema.labelField && schema.labelField !== 'title') out.labelField = schema.labelField
  if (schema.contentField && schema.contentField !== 'content') out.contentField = schema.contentField
  if (schema.parentField) out.parentField = schema.parentField
  if (schema.columns?.length) out.columns = schema.columns
  if (Object.keys(fields).length) out.fields = fields
  if (actions.length) out.actions = actions
  return out
}

function omitRedundantId(path: string, id: unknown) {
  if (typeof id !== 'string' || !id) return undefined
  return `/${id}` === path ? undefined : id
}

function isEmptyCell(value: unknown) {
  if (value == null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true
  return false
}

/** 列名只出现一次；path/kind 可从表路径+id 推出，空列整列丢掉。 */
export function recordsToColumnar(items: unknown[]) {
  const rowsIn = items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  const order: string[] = []
  const seen = new Set<string>()
  for (const row of rowsIn) {
    for (const key of Object.keys(row)) {
      if (key === 'path' || key === 'kind' || seen.has(key)) continue
      seen.add(key)
      order.push(key)
    }
  }
  const columns = order.filter((key) => key === 'id' || rowsIn.some((row) => !isEmptyCell(row[key])))
  const rows = rowsIn.map((row) => columns.map((key) => (isEmptyCell(row[key]) ? null : row[key])))
  return { columns, rows }
}

function compactRecordValue(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const next: Record<string, unknown> = {}
  for (const [key, cell] of Object.entries(value as Record<string, unknown>)) {
    if (isEmptyCell(cell)) continue
    next[key] = cell
  }
  return next
}

export function compactAgentToolResult(result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result
  const rec = result as Record<string, unknown>
  const kind = rec.kind
  if (kind === 'root') return result
  if (kind === 'collection') {
    const path = String(rec.path ?? '')
    const next: Record<string, unknown> = { kind: 'collection', path }
    const id = omitRedundantId(path, rec.id)
    if (id) next.id = id
    if (typeof rec.label === 'string' && rec.label && rec.label !== path.slice(1)) next.label = rec.label
    if (Array.isArray(rec.caps)) next.caps = rec.caps
    if (Array.isArray(rec.items)) {
      if (typeof rec.total === 'number') next.total = rec.total
      if (typeof rec.offset === 'number') next.offset = rec.offset
      if (typeof rec.limit === 'number') next.limit = rec.limit
      const table = recordsToColumnar(rec.items)
      next.columns = table.columns
      next.rows = table.rows
      return next
    }
    if (rec.schema && typeof rec.schema === 'object') next.schema = compactAgentSchema(rec.schema as CollectionSchema)
    return next
  }
  if (kind === 'record') {
    const next: Record<string, unknown> = { kind: 'record', path: rec.path, value: compactRecordValue(rec.value) }
    if (rec.result !== undefined) next.result = rec.result
    return next
  }
  return result
}

export const AGENT_DB_STAT_BLURB =
  '查看路径元数据。根目录列出表。表路径返回相对默认的 schema：每张表都有 id、title（标题）、createdAt、updatedAt、emoji、tags、facet、parentId（父级）、dependsOn、createdBy、updatedBy；正文默认字段 content（file，用 db_content）。fields 只含本表多出来的列，或覆盖了这些默认的列。caps 表示能否 list/read/update/create/delete/action/content。'


