/** 列类型：登记时声明，Core-File System 按类型渲染。string[] 视为 multi-select。 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'datetime'
  | 'url'
  | 'image'
  | 'attachment'
  | 'file'
  | 'string[]'
  | 'facet'
  | 'action'

export type FieldSpec = {
  type: FieldType
  label?: string
  writable?: boolean
  sortable?: boolean
  format?: 'datetime' | 'url' | 'image' | 'attachment' | 'file'
  /** select / multi-select 的选项 */
  enum?: string[]
  /** action 字段绑定的动作 id，缺省为字段 key */
  action?: string
  /** 由 list/get 计算写入记录，不能 PATCH。例如任务消耗。 */
  computed?: boolean
}

export type AttachmentValue = { name: string; href: string; bytes?: number }

function hrefFromRecord(value: Record<string, unknown>) {
  return value.href ?? value.url ?? value.src
}

/** http(s) 链接；对象取 href / url。其它协议（javascript: 等）一律空。 */
export function asHttpHref(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return asHttpHref(hrefFromRecord(value as Record<string, unknown>))
  }
  const text = String(value ?? '').trim()
  return /^https?:\/\//i.test(text) ? text : ''
}

const SAME_ORIGIN_IMAGE = /^\/(?!\/)[^\s]*\.(?:png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#][^\s]*)?$/i

/** 图片地址：http(s)、data:image，或同源相对路径（如 /page-covers/red.svg）。 */
export function asImageSrc(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return asImageSrc(hrefFromRecord(value as Record<string, unknown>))
  }
  const text = String(value ?? '').trim()
  if (/^https?:\/\//i.test(text)) return text
  if (/^data:image\//i.test(text)) return text
  if (SAME_ORIGIN_IMAGE.test(text)) return text
  return ''
}

export function asAttachment(value: unknown): AttachmentValue | null {
  if (value == null || value === '') return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>
    const href = asHttpHref(rec.href ?? rec.url)
    if (!href) return null
    const name = String(rec.name ?? rec.filename ?? '').trim()
    const bytes = Number(rec.bytes)
    return {
      name: name || href.split('/').filter(Boolean).pop() || href,
      href,
      bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : undefined,
    }
  }
  const href = asHttpHref(value)
  if (!href) return null
  return { name: href.split('/').filter(Boolean).pop() || href, href }
}

/** 每张表都有。id / 时间列默认不可写，表格默认不展开 id 与时间列。标题列始终存在。 */
export const BUILTIN_FIELDS = {
  id: { type: 'string', label: 'ID' },
  title: { type: 'string', label: '标题', writable: true },
  createdAt: { type: 'datetime', label: '创建时间' },
  updatedAt: { type: 'datetime', label: '更新时间' },
  content: { type: 'file', label: '内容' },
  emoji: { type: 'string', label: '图标', writable: true },
  tags: { type: 'multi-select', label: '标签', writable: true },
  facet: { type: 'facet', label: '合集', writable: true },
} as const satisfies Record<string, FieldSpec>

/** 登记 CollectionSpec.schema.fields 必须声明：图标、标签、创建/更新时间、分面。由登记方自己存。 */
export const REQUIRED_RECORD_FIELD_KEYS = ['createdAt', 'updatedAt', 'emoji', 'tags', 'facet'] as const

export type RequiredRecordFieldKey = (typeof REQUIRED_RECORD_FIELD_KEYS)[number]

export type RequiredRecordFields = { [K in RequiredRecordFieldKey]: FieldSpec }

export type CollectionFields = RequiredRecordFields & Record<string, FieldSpec>

export const REQUIRED_RECORD_FIELDS: RequiredRecordFields = {
  createdAt: BUILTIN_FIELDS.createdAt,
  updatedAt: BUILTIN_FIELDS.updatedAt,
  emoji: BUILTIN_FIELDS.emoji,
  tags: BUILTIN_FIELDS.tags,
  facet: BUILTIN_FIELDS.facet,
}

/** 表格默认不展开这些内置列（标题除外）。分面作为默认业务列留下。 */
export const BUILTIN_FIELD_KEYS = ['id', 'createdAt', 'updatedAt', 'content', 'emoji'] as const

export const RESERVED_SCHEMA_FIELD_KEYS = Object.keys(BUILTIN_FIELDS)

export function isReservedSchemaFieldKey(key: string) {
  return Object.prototype.hasOwnProperty.call(BUILTIN_FIELDS, String(key ?? '').trim())
}

export function isReservedSchemaFieldLabel(label: string) {
  const want = String(label ?? '').trim().toLowerCase()
  if (!want) return false
  if (isReservedSchemaFieldKey(want)) return true
  return Object.values(BUILTIN_FIELDS).some((field) => String(field.label ?? '').trim().toLowerCase() === want)
}

/** 分面包内允许的原子类型；不能再套一层分面。 */
export const ATOMIC_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'select',
  'multi-select',
  'datetime',
  'url',
  'image',
  'attachment',
  'file',
  'action',
] as const satisfies readonly FieldType[]

export function isFacetFieldType(type: unknown): boolean {
  return type === 'facet'
}

export type AtomicFieldType = (typeof ATOMIC_FIELD_TYPES)[number]

export function isAtomicFieldType(type: unknown): type is AtomicFieldType {
  return typeof type === 'string' && (ATOMIC_FIELD_TYPES as readonly string[]).includes(type)
}

export type SchemaPackField = FieldSpec & {
  key: string
  type: AtomicFieldType
}

export type CollectionSchemaPack = {
  id: string
  label: string
  fields: SchemaPackField[]
}

export function normalizeSchemaPack(raw: unknown): CollectionSchemaPack | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const id = String(rec.id ?? '').trim()
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) return null
  const label = String(rec.label ?? id).trim() || id
  const fields: SchemaPackField[] = []
  const seen = new Set<string>()
  const seenLabels = new Set<string>()
  const listed = Array.isArray(rec.fields) ? rec.fields : []
  for (const item of listed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const key = String(row.key ?? '').trim()
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || seen.has(key) || isReservedSchemaFieldKey(key)) continue
    if (isFacetFieldType(row.type) || !isAtomicFieldType(row.type)) continue
    const fieldLabel = String(row.label ?? key).trim() || key
    if (isReservedSchemaFieldLabel(fieldLabel) || seenLabels.has(fieldLabel.toLowerCase())) continue
    seen.add(key)
    seenLabels.add(fieldLabel.toLowerCase())
    const field: SchemaPackField = {
      key,
      type: row.type,
      label: fieldLabel,
      writable: row.writable !== false,
    }
    if (Array.isArray(row.enum)) field.enum = row.enum.map((option) => String(option)).filter(Boolean)
    fields.push(field)
  }
  return { id, label, fields }
}

export type SchemaFieldValue = {
  tags: string[]
  values: Record<string, Record<string, unknown>>
}

export function emptySchemaValue(): SchemaFieldValue {
  return { tags: [], values: {} }
}

export function normalizeSchemaValue(raw: unknown): SchemaFieldValue {
  if (raw == null || raw === '') return emptySchemaValue()
  if (typeof raw === 'string') {
    try {
      return normalizeSchemaValue(JSON.parse(raw) as unknown)
    } catch {
      return emptySchemaValue()
    }
  }
  if (Array.isArray(raw)) {
    return { tags: [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))], values: {} }
  }
  if (typeof raw !== 'object') return emptySchemaValue()
  const rec = raw as Record<string, unknown>
  const tags = Array.isArray(rec.tags)
    ? [...new Set(rec.tags.map((item) => String(item).trim()).filter(Boolean))]
    : []
  const values: Record<string, Record<string, unknown>> = {}
  if (rec.values && typeof rec.values === 'object' && !Array.isArray(rec.values)) {
    for (const [key, item] of Object.entries(rec.values as Record<string, unknown>)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      values[key] = { ...(item as Record<string, unknown>) }
    }
  }
  return { tags, values }
}

export function recordBuiltinValues(row: Record<string, unknown> = {}) {
  const createdAt = Number(row.createdAt)
  const updatedAt = Number(row.updatedAt)
  const created = Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0
  const updated = Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : created
  const tags = Array.isArray(row.tags)
    ? [...new Set(row.tags.map((item) => String(item).trim()).filter(Boolean))]
    : []
  return {
    createdAt: created,
    updatedAt: updated,
    emoji: String(row.emoji ?? ''),
    tags,
    facet: normalizeSchemaValue(row.facet),
  }
}

/** 全文检索：Tag id、显示名、以及包内已填的值。 */
export function schemaSearchHaystack(raw: unknown, packs: CollectionSchemaPack[] = []): string {
  const parsed = normalizeSchemaValue(raw)
  const labelOf = (id: string) => packs.find((pack) => pack.id === id)?.label ?? id
  const parts: string[] = []
  for (const id of parsed.tags) {
    parts.push(id, labelOf(id))
  }
  for (const [tagId, bag] of Object.entries(parsed.values)) {
    parts.push(tagId, labelOf(tagId))
    for (const [key, item] of Object.entries(bag)) {
      parts.push(key)
      if (item == null || item === '') continue
      if (Array.isArray(item)) parts.push(...item.map(String))
      else if (typeof item === 'object') parts.push(JSON.stringify(item))
      else parts.push(String(item))
    }
  }
  return parts.join(' ')
}

export function withBuiltinFields(
  fields: Record<string, FieldSpec>,
  contentField = 'content',
  labelField = 'title',
): CollectionFields {
  const next = { ...fields }
  next.id = { ...BUILTIN_FIELDS.id, ...next.id, writable: false }
  if (!next[labelField]) next[labelField] = { ...BUILTIN_FIELDS.title, label: labelField === 'title' ? '标题' : labelField }
  if (!next.createdAt) next.createdAt = BUILTIN_FIELDS.createdAt
  if (!next.updatedAt) next.updatedAt = BUILTIN_FIELDS.updatedAt
  if (!next.emoji) next.emoji = BUILTIN_FIELDS.emoji
  else if (!next.emoji.computed) next.emoji = { ...BUILTIN_FIELDS.emoji, ...next.emoji, writable: true }
  if (!next.tags) next.tags = BUILTIN_FIELDS.tags
  else if (!next.tags.computed) next.tags = { ...BUILTIN_FIELDS.tags, ...next.tags, type: 'multi-select', writable: true }
  if (!next.facet) next.facet = BUILTIN_FIELDS.facet
  if (contentField === 'content' && !next.content) next.content = BUILTIN_FIELDS.content
  const ordered: Record<string, FieldSpec> = {
    id: next.id,
    [labelField]: next[labelField]!,
  }
  for (const [key, field] of Object.entries(next)) {
    if (key === 'id' || key === labelField) continue
    ordered[key] = field
  }
  return ordered as CollectionFields
}

/** 登记方可序列化的动作声明。图标与按钮长什么样由前端 decorate，不进这份契约。 */
export type CollectionActionAudience = 'both' | 'agent' | 'user'

export type CollectionActionInfo = {
  id: string
  label: string
  /** 给 Agent 看：这个动作何时用、args 怎么填、不要用错成别的动作。db_stat schema.actions 会带上。 */
  description?: string
  tone?: 'danger'
  /** 谁能用。缺省 both。前端只画 user 与 both。 */
  for?: CollectionActionAudience
  placement?: Array<'row' | 'detail'>
  confirm?: string
  /** 记录字段等值时才显示，例如 { enabled: false } */
  when?: Record<string, unknown>
  /** 给 db_action 的 args；不进按钮 UI。 */
  parameters?: Record<string, unknown>
  /** 记录还不存在时也能跑（例如新建插件）。 */
  allowMissing?: boolean
}

export function actionVisibleToUser(action: { for?: CollectionActionAudience }) {
  const audience = action.for ?? 'both'
  return audience === 'both' || audience === 'user'
}

export type CollectionSchema = {
  /** 标题列。缺省为 `title`；Core-File System 会补上该字段，且界面不可隐藏。 */
  labelField?: string
  /** 记录正文：真正存的文件内容。默认 `content`。结构由登记方自定。 */
  contentField?: string
  /** 必须包含图标、创建/更新时间、分面；登记方自己持久化。 */
  fields: CollectionFields
  /** 表格默认可见列（须为 fields 的键）。不写则列出全部列表列。详情仍显示全部字段。 */
  columns?: string[]
  /** 指向本表另一条记录 id 的字段。有则表格可按树展示；不写则按 parentId / parent 或数据里的父子引用推断。 */
  parentField?: string
  actions?: CollectionActionInfo[]
  /** 记录权限，来自登记时的 records。list/get 始终有；update/create/delete 缺省为 false。 */
  records?: CollectionRecordCaps
}

/** 登记时显式声明。list / get 是表的基本能力；update / create 是改已有行和新建行，不要再用 write。 */
export type CollectionRecordCaps = {
  update?: boolean
  create?: boolean
  delete?: boolean
}

export type DbRecord = { id: string } & Record<string, unknown>

export type CollectionAction = CollectionActionInfo & {
  run: (id: string, record: DbRecord, args?: Record<string, unknown>) => unknown | Promise<unknown>
}

/** 登记方自己选定的前端导航：路由、图标、显示名。Core-File System 按此在 Dock 挂入口，不代为生成路由。 */
export type CollectionView = {
  moduleId: string
  /** 调用方选定的前端路由，例如 /tasks；不得与已有导航冲突。 */
  route: string
  title?: string
  /** 给 Agent 看的表说明书：这张表是什么、用哪条 db_*、下一步常见动作、不要做什么。会出现在 db_list / 的 items[].view.blurb。 */
  blurb?: string
  order?: number
  /** 导航图标名（实现侧映射），例如 clipboard-document-list、puzzle-piece、document。 */
  icon?: string
  /** 登记后出现在 Session 检查器加号里，用 title 作为「添加××」。 */
  inspector?: boolean
}

export type CollectionListQuery = {
  /** 只取这些 id。File System 在分面筛选时传入，避免整表 list。 */
  ids?: string[]
  q?: string
  filter?: Record<string, unknown>
}

export function hasCollectionDeleteQuery(query?: CollectionListQuery | null): boolean {
  if (!query) return false
  if (Array.isArray(query.ids) && query.ids.some((id) => String(id).trim())) return true
  if (String(query.q ?? '').trim()) return true
  if (query.filter && Object.keys(query.filter).some((key) => query.filter?.[key] != null && query.filter[key] !== '')) {
    return true
  }
  return false
}

export type CollectionSpec = {
  id: string
  path: string
  label?: string
  schema: CollectionSchema
  view?: CollectionView
  /**
   * 记录权限。list / get 始终可用。
   * update / create / delete 为 true 时必须提供对应实现；不写则不能改、不能新建、不能删。
   */
  records?: CollectionRecordCaps
  /** 可接收查询；不认 ids 时 File System 仍会在内存里收窄。 */
  list: (query?: CollectionListQuery) => DbRecord[] | Promise<DbRecord[]>
  get: (id: string) => DbRecord | null | undefined | Promise<DbRecord | null | undefined>
  /** 更新已有记录的可写字段。不要叫 write。 */
  update?: (id: string, patch: Record<string, unknown>) => DbRecord | Promise<DbRecord>
  create?: (rows: Record<string, unknown>[]) => DbRecord[] | Promise<DbRecord[]>
  remove?: (query: CollectionListQuery) => string[] | void | boolean | Promise<string[] | void | boolean>
  actions?: CollectionAction[]
}

export type CollectionInfo = {
  id: string
  path: string
  kind: 'collection'
  label: string
  view: CollectionView | null
}

export const DATABASE_CHANNEL = 'database' as const

export type ListPage = {
  q?: string
  sortField?: string
  sortDir?: 'asc' | 'desc'
  /** 缺省 50，最大 200；列表接口不会一次返回整表。 */
  limit?: number
  offset?: number
}

/** File System 实现必须满足的服务面。换实现时只要还叫 ctx.database 并遵守这套方法。 */
export interface Database {
  register(spec: CollectionSpec): unknown
  list(path: string, filter?: Record<string, unknown>, page?: ListPage): Promise<unknown>
  read(path: string): Promise<unknown>
  update(path: string, content: unknown): Promise<unknown>
  create(path: string, records: unknown): Promise<unknown>
  remove(path: string, query: CollectionListQuery): Promise<unknown>
  action(path: string, actionId: string, args?: Record<string, unknown>): Promise<unknown>
  stat(path: string): Promise<unknown>
  /** 单独读写记录正文（content 字段），不走 list/read。 */
  content(path: string): Promise<unknown>
  writeContent(path: string, value: unknown): Promise<unknown>
}

declare module 'cordis' {
  interface Context {
    database: Database
  }
  interface Events {
    'database/change'(): void
  }
}
