/** 列类型：登记时声明，Core-File System 按类型渲染。string[] 视为 multi-select。 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'datetime'
  | 'bytes'
  | 'url'
  | 'image'
  | 'attachment'
  | 'file'
  | 'string[]'

export type FieldSpec = {
  type: FieldType
  label?: string
  writable?: boolean
  sortable?: boolean
  format?: 'datetime' | 'bytes' | 'url' | 'image' | 'attachment' | 'file'
  /** select / multi-select 的选项 */
  enum?: string[]
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

/** 每张表都有：登记方不必再写。可覆盖 label；id / 时间列默认不可写，表格默认不展开 id 与时间列。标题列始终存在。 */
export const BUILTIN_FIELDS = {
  id: { type: 'string', label: 'ID' },
  title: { type: 'string', label: '标题', writable: true },
  createdAt: { type: 'datetime', label: '创建时间' },
  updatedAt: { type: 'datetime', label: '更新时间' },
  content: { type: 'file', label: '内容' },
  emoji: { type: 'string', label: '图标', writable: true },
} as const satisfies Record<string, FieldSpec>

export const BUILTIN_FIELD_KEYS = ['id', 'createdAt', 'updatedAt', 'content', 'emoji'] as const

export function withBuiltinFields(
  fields: Record<string, FieldSpec>,
  contentField = 'content',
  labelField = 'title',
): Record<string, FieldSpec> {
  const next = { ...fields }
  next.id = { ...BUILTIN_FIELDS.id, ...next.id, writable: false }
  if (!next[labelField]) next[labelField] = { ...BUILTIN_FIELDS.title, label: labelField === 'title' ? '标题' : labelField }
  if (!next.createdAt) next.createdAt = BUILTIN_FIELDS.createdAt
  if (!next.updatedAt) next.updatedAt = BUILTIN_FIELDS.updatedAt
  if (!next.emoji) next.emoji = BUILTIN_FIELDS.emoji
  if (contentField === 'content' && !next.content) next.content = BUILTIN_FIELDS.content
  const ordered: Record<string, FieldSpec> = {
    id: next.id,
    [labelField]: next[labelField]!,
  }
  for (const [key, field] of Object.entries(next)) {
    if (key === 'id' || key === labelField) continue
    ordered[key] = field
  }
  return ordered
}

/** 登记方可序列化的动作声明。图标与按钮长什么样由前端 decorate，不进这份契约。 */
export type CollectionActionInfo = {
  id: string
  label: string
  tone?: 'danger'
  placement?: Array<'row' | 'detail'>
  confirm?: string
  /** 记录字段等值时才显示，例如 { enabled: false } */
  when?: Record<string, unknown>
}

export type CollectionSchema = {
  /** 标题列。缺省为 `title`；Core-File System 会补上该字段，且界面不可隐藏。 */
  labelField?: string
  /** 记录正文：真正存的文件内容。默认 `content`。结构由登记方自定。 */
  contentField?: string
  fields: Record<string, FieldSpec>
  /** 表格默认可见列（须为 fields 的键）。不写则列出全部列表列。详情仍显示全部字段。 */
  columns?: string[]
  /** 指向本表另一条记录 id 的字段。有则表格可按树展示；不写则按 parentId / parent 或数据里的父子引用推断。 */
  parentField?: string
  actions?: CollectionActionInfo[]
  /** 记录增删权限，来自登记时的 records。缺省都不能增删。 */
  records?: CollectionRecordCaps
}

/** 登记时显式声明：这张表能不能由 UI / Agent 新建、删除记录。不写则都不能。 */
export type CollectionRecordCaps = {
  create?: boolean
  delete?: boolean
}

export type DbRecord = { id: string } & Record<string, unknown>

export type CollectionAction = CollectionActionInfo & {
  run: (id: string, record: DbRecord) => unknown | Promise<unknown>
}

/** 登记方自己选定的前端导航：路由、图标、显示名。Core-File System 按此在最左导航栏挂入口，不代为生成路由。 */
export type CollectionView = {
  moduleId: string
  /** 调用方选定的前端路由，例如 /tasks-2；不得与已有导航冲突。 */
  route: string
  title?: string
  blurb?: string
  order?: number
  /** 导航图标名（实现侧映射），例如 clipboard-document-list、puzzle-piece、document。 */
  icon?: string
  /** 登记后出现在 Session 检查器加号里，用 title 作为「添加××」。 */
  inspector?: boolean
}

export type CollectionSpec = {
  id: string
  path: string
  label?: string
  schema: CollectionSchema
  view?: CollectionView
  /** 记录增删权限。不写则 UI 和 db_create / db_delete 都不能增删。为 true 时必须提供对应实现。 */
  records?: CollectionRecordCaps
  list: () => DbRecord[] | Promise<DbRecord[]>
  get: (id: string) => DbRecord | null | undefined | Promise<DbRecord | null | undefined>
  write?: (id: string, patch: Record<string, unknown>) => DbRecord | Promise<DbRecord>
  create?: (fields?: Record<string, unknown>) => DbRecord | Promise<DbRecord>
  remove?: (id: string) => void | boolean | Promise<void | boolean>
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
  write(path: string, content: unknown): Promise<unknown>
  create(path: string, content?: unknown): Promise<unknown>
  remove(path: string): Promise<unknown>
  action(path: string, actionId: string): Promise<unknown>
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
