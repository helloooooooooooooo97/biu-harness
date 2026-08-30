import { Service, type Context } from 'cordis'
import {
  DATABASE_CHANNEL,
  asAttachment,
  asHttpHref,
  asImageSrc,
  withBuiltinFields,
  type CollectionAction,
  type CollectionActionInfo,
  type CollectionInfo,
  type CollectionSchema,
  type CollectionSpec,
  type Database,
  type DbRecord,
  type FieldSpec,
  type ListPage,
} from '@biu/type-file-system'
import { SavedViewsStore, viewsCollection, type StoredView } from './saved-views.ts'
import { normalizeCollectionPath } from '../paths.ts'

function publicAction(action: CollectionAction): CollectionActionInfo {
  const { run: _run, ...info } = action
  return info
}

function schemaFor(spec: CollectionSpec): CollectionSchema {
  const contentField = spec.schema.contentField ?? 'content'
  const labelField = spec.schema.labelField ?? 'title'
  const raw = withBuiltinFields(spec.schema.fields, contentField, labelField)
  const fields: Record<string, FieldSpec> = {}
  for (const [key, field] of Object.entries(raw)) {
    fields[key] = field.computed ? { ...field, writable: false } : field
  }
  return {
    ...spec.schema,
    labelField,
    contentField,
    fields,
    actions: (spec.actions ?? []).map(publicAction),
    records: {
      update: Boolean(spec.records?.update),
      create: Boolean(spec.records?.create),
      delete: Boolean(spec.records?.delete),
    },
  }
}

function assertRecordCaps(spec: CollectionSpec) {
  if (spec.records?.update && !spec.update) throw new Error(`collection ${spec.id}: records.update 为 true 时必须提供 update`)
  if (spec.records?.create && !spec.create) throw new Error(`collection ${spec.id}: records.create 为 true 时必须提供 create`)
  if (spec.records?.delete && !spec.remove) throw new Error(`collection ${spec.id}: records.delete 为 true 时必须提供 remove`)
  if (spec.update && !spec.records?.update) throw new Error(`collection ${spec.id}: 提供了 update 但未声明 records.update`)
  if (spec.create && !spec.records?.create) throw new Error(`collection ${spec.id}: 提供了 create 但未声明 records.create`)
  if (spec.remove && !spec.records?.delete) throw new Error(`collection ${spec.id}: 提供了 remove 但未声明 records.delete`)
}

function collectionCaps(spec: CollectionSpec) {
  return [
    'list',
    'read',
    spec.records?.update && spec.update ? 'update' : null,
    spec.records?.create && spec.create ? 'create' : null,
    spec.records?.delete && spec.remove ? 'delete' : null,
    spec.actions?.length ? 'action' : null,
    'content',
  ].filter(Boolean)
}

function contentKey(spec: CollectionSpec) {
  return schemaFor(spec).contentField ?? 'content'
}

function withoutContent(spec: CollectionSpec, row: DbRecord): DbRecord {
  const key = contentKey(spec)
  if (!Object.prototype.hasOwnProperty.call(row, key)) return row
  const next = { ...row }
  delete next[key]
  return next
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

function publicCollection(item: CollectionSpec): CollectionInfo {
  return {
    id: item.id,
    path: item.path,
    kind: 'collection',
    label: item.label ?? item.id,
    view: item.view ?? null,
  }
}

function splitPath(path: string): string[] {
  const normalized = normalizeCollectionPath(path)
  if (normalized === '/') return []
  return normalized.slice(1).split('/').filter(Boolean)
}

function coerceList(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  throw new Error('expected string list')
}

function coerce(field: FieldSpec, value: unknown) {
  const kind = field.type === 'string[]' ? 'multi-select' : field.format && field.type === 'string' ? field.format : field.type
  if (kind === 'boolean') return value === true || value === 'true'
  if (kind === 'multi-select') return coerceList(value)
  if (kind === 'number' || kind === 'datetime' || kind === 'bytes') {
    if (value == null || value === '') return null
    const n = Number(value)
    if (!Number.isFinite(n)) throw new Error(`expected ${kind}`)
    return n
  }
  if (kind === 'url') {
    const text = String(value ?? '').trim()
    if (!text) return ''
    if (!asHttpHref(text)) throw new Error('expected url')
    return text
  }
  if (kind === 'image') {
    if (value == null || value === '') return ''
    const src = asImageSrc(value)
    if (!src) throw new Error('expected image')
    return typeof value === 'string' ? String(value).trim() : src
  }
  if (kind === 'attachment') {
    if (value == null || value === '') return ''
    const file = asAttachment(value)
    if (!file) throw new Error('expected attachment')
    return typeof value === 'object' ? file : file.href
  }
  if (kind === 'file') {
    if (value == null || value === '') return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'object') return value
    throw new Error('expected file')
  }
  const text = String(value ?? '')
  if ((kind === 'select' || field.enum) && field.enum && !field.enum.includes(text)) {
    throw new Error(`expected one of ${field.enum.join(', ')}`)
  }
  return text
}

function pickWritablePatch(schema: CollectionSchema, patch: Record<string, unknown>) {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'id') throw new Error('field not writable: id')
    const field = schema.fields[key]
    if (!field) throw new Error(`unknown field: ${key}`)
    if (!field.writable || field.computed) throw new Error(`field not writable: ${key}`)
    next[key] = coerce(field, value)
  }
  return next
}

function navPath(path: string) {
  return normalizeCollectionPath(path)
}

function navTitle(spec: CollectionSpec) {
  return (spec.view?.title ?? spec.label ?? spec.id).trim()
}

function assertViewAvailable(entry: CollectionSpec, others: CollectionSpec[]) {
  const view = entry.view
  if (!view) return
  const route = navPath(view.route || '')
  if (!view.route?.trim()) throw new Error('view.route 必填：导航路由由登记方自己选定')
  if (route === '/' || route === '/s') throw new Error(`view.route 与内置路由冲突：${view.route}`)
  const title = navTitle(entry)
  if (!title) throw new Error('view.title / label 不能为空')
  for (const other of others) {
    if (!other.view || other.id === entry.id) continue
    const otherRoute = navPath(other.view.route)
    const otherTitle = navTitle(other)
    if (other.view.moduleId === view.moduleId) {
      throw new Error(`导航 id 重复：${view.moduleId}`)
    }
    if (otherRoute === route) {
      throw new Error(`路由重复：${route} 已被「${otherTitle}」占用`)
    }
    if (otherTitle === title) {
      throw new Error(`名称重复：导航栏已有「${title}」`)
    }
  }
}

function matchQuery(record: DbRecord, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (String(record.id).toLowerCase().includes(needle)) return true
  for (const value of Object.values(record)) {
    if (value == null || value === '') continue
    const text = Array.isArray(value) ? value.map(String).join(' ') : typeof value === 'object' ? '' : String(value)
    if (text.toLowerCase().includes(needle)) return true
  }
  return false
}

function matchListFilter(record: DbRecord, filter: Record<string, unknown> | undefined, schema: CollectionSchema) {
  if (!filter) return true
  for (const [key, expected] of Object.entries(filter)) {
    if (expected == null || expected === '') continue
    const want = String(expected)
    const actual = record[key]
    const field = schema.fields[key]
    if (field?.type === 'datetime' && ['1h', '24h', '7d', '30d'].includes(want)) {
      const n = Number(actual)
      if (!Number.isFinite(n) || n <= 0) return false
      const span = want === '1h' ? 3600e3 : want === '24h' ? 86400e3 : want === '7d' ? 7 * 86400e3 : 30 * 86400e3
      if (Date.now() - n > span) return false
      continue
    }
    if (Array.isArray(actual)) {
      if (!actual.map(String).includes(want)) return false
      continue
    }
    if (field?.type === 'boolean') {
      const on = actual === true || actual === 'true' ? 'true' : 'false'
      if (on !== want) return false
      continue
    }
    if (String(actual ?? '') !== want) return false
  }
  return true
}

function sortRecords(rows: DbRecord[], field: string, dir: 'asc' | 'desc') {
  if (!field) return rows
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    const an = Number(av)
    const bn = Number(bv)
    const numeric = Number.isFinite(an) && Number.isFinite(bn) && String(av).trim() !== '' && String(bv).trim() !== ''
    const c = numeric ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''), 'zh')
    if (c !== 0) return c * sign
    return String(a.id).localeCompare(String(b.id))
  })
}

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export function clampPage(limit?: number, offset?: number) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : DEFAULT_PAGE_SIZE))
  const start = Math.max(0, Number.isFinite(Number(offset)) ? Math.floor(Number(offset)) : 0)
  return { limit: size, offset: start }
}

export class DatabaseService extends Service implements Database {
  private collections = new Map<string, CollectionSpec>()

  private bumpQueued = false

  constructor(ctx: Context) {
    super(ctx, 'database')
  }

  register(spec: CollectionSpec) {
    const path = normalizeCollectionPath(spec.path || `/${spec.id}`)
    if (path === '/') throw new Error('collection path cannot be /')
    if (splitPath(path).length !== 1) throw new Error(`collection path must be one segment: ${path}`)
    let entry = { ...spec, path }
    return this.ctx.effect(() => {
      if (this.collections.has(entry.id)) throw new Error(`collection already registered: ${entry.id}`)
      if ([...this.collections.values()].some((item) => item.path === path && item.id !== entry.id)) {
        throw new Error(`collection path already registered: ${path}`)
      }
      assertViewAvailable(entry, [...this.collections.values()])
      assertRecordCaps(entry)
      const view = entry.view
      if (view) entry = { ...entry, view: { ...view, route: navPath(view.route) } }
      this.collections.set(entry.id, entry)
      this.bump()
      return () => {
        this.collections.delete(entry.id)
        this.bump()
      }
    }, `database.register ${entry.id}`)
  }

  collection(pathOrId: string) {
    const path = normalizeCollectionPath(pathOrId)
    return (
      this.collections.get(pathOrId) ??
      [...this.collections.values()].find((item) => item.path === path || item.id === pathOrId)
    )
  }

  collectionsList() {
    return [...this.collections.values()].sort((a, b) => a.path.localeCompare(b.path))
  }

  private bump() {
    this.ctx.emit('database/change')
    if (this.bumpQueued) return
    this.bumpQueued = true
    queueMicrotask(() => {
      this.bumpQueued = false
      const http = this.ctx.get('http') as { broadcast?: (type: string, payload: unknown) => void } | undefined
      http?.broadcast?.(DATABASE_CHANNEL, { ts: Date.now() })
    })
  }

  async stat(path: string) {
    const parts = splitPath(path)
    if (parts.length === 0) {
      return {
        kind: 'root' as const,
        path: '/',
        collections: this.collectionsList().map(publicCollection),
      }
    }
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    const caps = collectionCaps(spec)
    if (parts.length === 1) {
      return { kind: 'collection' as const, path: spec.path, id: spec.id, label: spec.label ?? spec.id, schema: schemaFor(spec), caps }
    }
    if (parts.length === 2) {
      const record = await spec.get(parts[1]!)
      if (!record) throw new Error(`unknown record: ${spec.path}/${parts[1]}`)
      return {
        kind: 'record' as const,
        path: `${spec.path}/${record.id}`,
        id: spec.id,
        label: spec.label ?? spec.id,
        schema: schemaFor(spec),
        caps,
        value: withoutContent(spec, record),
      }
    }
    throw new Error(`path too deep: ${normalizeCollectionPath(path)}`)
  }

  async list(path: string, filter?: Record<string, unknown>, page?: ListPage) {
    const parts = splitPath(path)
    if (parts.length === 0) {
      return {
        kind: 'root' as const,
        path: '/',
        items: this.collectionsList().map(publicCollection),
      }
    }
    if (parts.length !== 1) throw new Error(`cannot list: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    const schema = schemaFor(spec)
    const { limit, offset } = clampPage(page?.limit, page?.offset)
    const q = page?.q ?? ''
    const sortField = page?.sortField ?? ''
    const sortDir = page?.sortDir === 'desc' ? 'desc' : 'asc'
    const matched = (await spec.list()).filter(
      (row) => matchListFilter(row, filter, schema) && matchQuery(row, q),
    )
    const sorted = sortRecords(matched, sortField, sortDir)
    const total = sorted.length
    const slice = sorted.slice(offset, offset + limit)
    return {
      kind: 'collection' as const,
      path: spec.path,
      id: spec.id,
      label: spec.label ?? spec.id,
      schema,
      total,
      offset,
      limit,
      items: slice.map((row): DbRecord & { path: string; kind: 'record' } => ({
        ...withoutContent(spec, row),
        path: `${spec.path}/${row.id}`,
        kind: 'record',
      })),
    }
  }

  async read(path: string) {
    const parts = splitPath(path)
    if (parts.length === 0) return this.stat('/')
    if (parts.length === 1) return this.list(`/${parts[0]}`)
    if (parts.length !== 2) throw new Error(`cannot read: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    const record = await spec.get(parts[1]!)
    if (!record) throw new Error(`unknown record: ${spec.path}/${parts[1]}`)
    return { kind: 'record' as const, path: `${spec.path}/${record.id}`, schema: schemaFor(spec), value: withoutContent(spec, record) }
  }

  async update(path: string, content: unknown) {
    const parts = splitPath(path)
    if (parts.length !== 2) throw new Error(`cannot update: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    if (!spec.records?.update || !spec.update) throw new Error(`collection cannot update: ${spec.path}`)
    const patch = pickWritablePatch(schemaFor(spec), parseContent(content))
    const record = await spec.update(parts[1]!, patch)
    this.bump()
    return { kind: 'record' as const, path: `${spec.path}/${record.id}`, value: withoutContent(spec, record) }
  }

  async create(path: string, content?: unknown) {
    const parts = splitPath(path)
    if (parts.length !== 1) throw new Error(`cannot create: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    if (!spec.records?.create || !spec.create) throw new Error(`collection cannot create: ${spec.path}`)
    const fields = content == null || content === '' ? {} : pickWritablePatch(schemaFor(spec), parseContent(content))
    const record = await spec.create(fields)
    this.bump()
    return { kind: 'record' as const, path: `${spec.path}/${record.id}`, value: withoutContent(spec, record) }
  }

  async remove(path: string) {
    const parts = splitPath(path)
    if (parts.length !== 2) throw new Error(`cannot delete: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    if (!spec.records?.delete || !spec.remove) throw new Error(`collection cannot delete: ${spec.path}`)
    const record = await spec.get(parts[1]!)
    if (!record) throw new Error(`unknown record: ${spec.path}/${parts[1]}`)
    await spec.remove(parts[1]!)
    this.bump()
    return { kind: 'deleted' as const, path: `${spec.path}/${parts[1]}`, id: parts[1] }
  }

  async action(path: string, actionId: string) {
    const parts = splitPath(path)
    if (parts.length !== 2) throw new Error(`cannot action: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    const record = await spec.get(parts[1]!)
    if (!record) throw new Error(`unknown record: ${spec.path}/${parts[1]}`)
    const action = spec.actions?.find((item) => item.id === actionId)
    if (!action) throw new Error(`unknown action: ${actionId}`)
    if (!matchActionWhen(record, action.when)) throw new Error(`action not available: ${actionId}`)
    await action.run(parts[1]!, record)
    const next = (await spec.get(parts[1]!)) ?? record
    this.bump()
    return { kind: 'record' as const, path: `${spec.path}/${next.id}`, value: withoutContent(spec, next) }
  }

  async content(path: string) {
    const parts = splitPath(path)
    if (parts.length !== 2) throw new Error(`cannot content: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    const schema = schemaFor(spec)
    const field = schema.contentField ?? 'content'
    if (!schema.fields[field]) throw new Error(`no content field: ${field}`)
    const record = await spec.get(parts[1]!)
    if (!record) throw new Error(`unknown record: ${spec.path}/${parts[1]}`)
    return {
      kind: 'content' as const,
      path: `${spec.path}/${record.id}`,
      field,
      value: record[field] ?? null,
    }
  }

  async writeContent(path: string, value: unknown) {
    const parts = splitPath(path)
    if (parts.length !== 2) throw new Error(`cannot write content: ${normalizeCollectionPath(path)}`)
    const spec = this.collection(`/${parts[0]}`)
    if (!spec) throw new Error(`unknown collection: /${parts[0]}`)
    if (!spec.records?.update || !spec.update) throw new Error(`collection cannot update: ${spec.path}`)
    const schema = schemaFor(spec)
    const field = schema.contentField ?? 'content'
    if (!schema.fields[field]) throw new Error(`no content field: ${field}`)
    const patch = pickWritablePatch(schema, { [field]: value })
    const record = await spec.update(parts[1]!, patch)
    this.bump()
    return {
      kind: 'content' as const,
      path: `${spec.path}/${record.id}`,
      field,
      value: record[field] ?? null,
    }
  }
}

function parseContent(content: unknown): Record<string, unknown> {
  if (typeof content === 'string') {
    const trimmed = content.trim()
    if (!trimmed) return {}
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('content must be an object')
    return parsed as Record<string, unknown>
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('content must be an object')
  return content as Record<string, unknown>
}

const PATH_PARAM = { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } as const

function asFilter(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export const name = 'core-file-system'
export const inject = ['tools', 'http']

export function apply(ctx: Context) {
  const db = new DatabaseService(ctx)
  const savedViews = new SavedViewsStore()
  db.register(viewsCollection(savedViews, () => db.collectionsList().map((item) => ({
    id: item.id,
    path: item.path,
    kind: 'collection' as const,
    label: item.label ?? item.id,
    view: item.view ?? null,
  }))))
  ctx.tools.register({
    name: 'db_list',
    description: '列出 File System 路径：/ 为已登记表，/<表> 为该表记录（不含 content 正文）。默认每页 50 条，最多 200。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        filter: { type: 'object', description: '可选，按列等值过滤' },
        q: { type: 'string', description: '可选，全文搜索' },
        sortField: { type: 'string' },
        sortDir: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: '每页条数，默认 50，最大 200' },
        offset: { type: 'number' },
      },
      required: ['path'],
    },
    execute: (args) =>
      db.list(String(args.path), asFilter(args.filter), {
        q: args.q != null ? String(args.q) : '',
        sortField: args.sortField != null ? String(args.sortField) : '',
        sortDir: args.sortDir === 'desc' ? 'desc' : 'asc',
        limit: args.limit != null ? Number(args.limit) : undefined,
        offset: args.offset != null ? Number(args.offset) : undefined,
      }),
  })
  ctx.tools.register({
    name: 'db_read',
    description: '读取 File System 路径：表返回列表，记录返回该行 JSON（不含 content 正文，正文用 db_content）。',
    parameters: PATH_PARAM,
    execute: (args) => db.read(String(args.path)),
  })
  ctx.tools.register({
    name: 'db_update',
    description: '按 schema 可写字段更新一条已有记录，路径为 /<表>/<id>。新建用 db_create，正文用 db_content。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { description: '要更新的字段（对象或 JSON 字符串）' },
      },
      required: ['path', 'content'],
    },
    execute: (args) => db.update(String(args.path), args.content),
  })
  ctx.tools.register({
    name: 'db_create',
    description: '在已登记且允许新建的表中新增一条记录。路径为 /<表>。能否新建看 db_stat 的 caps 与 schema.records。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { description: '可选，按 schema 可写字段给出初值（对象或 JSON 字符串）' },
      },
      required: ['path'],
    },
    execute: (args) => db.create(String(args.path), args.content),
  })
  ctx.tools.register({
    name: 'db_delete',
    description: '删除一条记录，路径为 /<表>/<id>。能否删除看 db_stat 的 caps 与 schema.records；未声明 delete 的表会失败。',
    parameters: PATH_PARAM,
    execute: (args) => db.remove(String(args.path)),
  })
  ctx.tools.register({
    name: 'db_action',
    description: '对一条记录执行登记方声明的动作，路径为 /<表>/<id>，action 为动作 id（如 start、stop）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        action: { type: 'string' },
      },
      required: ['path', 'action'],
    },
    execute: (args) => db.action(String(args.path), String(args.action)),
  })
  ctx.tools.register({
    name: 'db_stat',
    description: '查看路径元数据：根目录看有哪些表，表路径返回 schema。',
    parameters: PATH_PARAM,
    execute: (args) => db.stat(String(args.path)),
  })
  ctx.tools.register({
    name: 'db_content',
    description: '读写一条记录的正文（content 字段）。list/read 不含正文。path 为 /<表>/<id>，写时传 value。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        value: { description: '要写入的正文；不传则只读' },
      },
      required: ['path'],
    },
    execute: (args) =>
      args.value !== undefined ? db.writeContent(String(args.path), args.value) : db.content(String(args.path)),
  })

  const send = async (route: { query: URLSearchParams; send: (status: number, body: unknown) => void }, op: () => unknown) => {
    try {
      route.send(200, await op())
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  }
  ctx.http.route('GET', '/api/db/list', (route) =>
    send(route, () => {
      let filter: Record<string, unknown> | undefined
      const raw = route.query.get('filter')
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) filter = parsed as Record<string, unknown>
        } catch {
          filter = undefined
        }
      }
      return db.list(route.query.get('path') || '/', filter, {
        q: route.query.get('q') || '',
        sortField: route.query.get('sort') || '',
        sortDir: route.query.get('dir') === 'desc' ? 'desc' : 'asc',
        limit: route.query.get('limit') ? Number(route.query.get('limit')) : undefined,
        offset: route.query.get('offset') ? Number(route.query.get('offset')) : undefined,
      })
    }),
  )
  ctx.http.route('GET', '/api/db/read', (route) => send(route, () => db.read(route.query.get('path') || '/')))
  ctx.http.route('GET', '/api/db/stat', (route) => send(route, () => db.stat(route.query.get('path') || '/')))
  ctx.http.route('GET', '/api/db/content', (route) => send(route, () => db.content(route.query.get('path') || '/')))
  ctx.http.route('POST', '/api/db/content', async (route) => {
    try {
      const body = (await route.json()) as { path?: string; value?: unknown }
      route.send(200, await db.writeContent(String(body?.path ?? ''), body?.value))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/db/update', async (route) => {
    try {
      const body = (await route.json()) as { path?: string; content?: unknown }
      route.send(200, await db.update(String(body?.path ?? ''), body?.content))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/db/create', async (route) => {
    try {
      const body = (await route.json()) as { path?: string; content?: unknown }
      route.send(200, await db.create(String(body?.path ?? ''), body?.content))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/db/delete', async (route) => {
    try {
      const body = (await route.json()) as { path?: string }
      route.send(200, await db.remove(String(body?.path ?? '')))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/db/saved-views', async (route) => {
    try {
      const body = (await route.json()) as { path?: string; views?: StoredView[] }
      savedViews.replace(String(body?.path ?? ''), Array.isArray(body?.views) ? body.views : [])
      ctx.emit('database/change')
      route.send(200, { ok: true })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/db/action', async (route) => {
    try {
      const body = (await route.json()) as { path?: string; action?: string }
      route.send(200, await db.action(String(body?.path ?? ''), String(body?.action ?? '')))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
}
