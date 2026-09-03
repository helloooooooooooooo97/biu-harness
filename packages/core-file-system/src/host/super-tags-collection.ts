import type { CollectionInfo, CollectionListQuery, CollectionSpec, DbRecord } from '@biu/type-file-system'
import { recordBuiltinValues, REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { SchemaTagsStore, slugSuperTagId } from './schema-tags.ts'
import { normalizeCollectionPath } from '../paths.ts'

function parseFields(raw: unknown) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function stampRecordId(collection: string, recordId: string) {
  const table = normalizeCollectionPath(collection).replace(/^\//, '')
  return `${table}::${recordId}`
}

export function parseStampRecordId(id: string) {
  const raw = String(id ?? '')
  const at = raw.indexOf('::')
  if (at <= 0) return null
  const table = raw.slice(0, at).trim()
  const recordId = raw.slice(at + 2).trim()
  if (!table || !recordId) return null
  return { collection: `/${table}`, recordId }
}

export function superTagsCollection(
  store: SchemaTagsStore,
  tables: () => Array<Pick<CollectionInfo, 'path' | 'label' | 'id'>> = () => [],
): CollectionSpec {
  const asTag = (id: string, label: string, fields: unknown[], stampCount: number): DbRecord => ({
    id,
    title: label,
    fieldCount: fields.length,
    stampCount,
    fields: JSON.stringify(fields),
    ...recordBuiltinValues(),
  })

  const tableLabel = (path: string) => {
    const hit = tables().find((item) => item.path === path)
    return hit?.label ?? hit?.id ?? path
  }

  const tagRows = () => {
    const counts = store.stampCounts()
    return store.list().map((tag) => asTag(tag.id, tag.label, tag.fields, counts[tag.id] ?? 0))
  }

  const stampRows = (tagId: string) => {
    const found = store.collect(tagId)
    const id = found.tag?.id ?? tagId
    return found.items.map((item) => ({
      id: stampRecordId(item.collection, item.id),
      title: item.title || item.id,
      table: tableLabel(item.collection),
      tablePath: item.collection,
      sourceId: item.id,
      tag: id,
      ...recordBuiltinValues(),
    }))
  }

  return {
    id: 'supertags',
    path: '/supertags',
    label: '模式',
    view: {
      moduleId: 'supertags-db',
      route: '/db-supertags',
      title: '模式',
      inspector: true,
      blurb: '工作区全局模式，谁都可以改属性和贴到任意表的记录上（含插件）。新建用 db_create，改名/属性用 db_update（fields 为属性 JSON 数组）。',
      order: 31,
      icon: 'tag',
    },
    records: { update: true, create: true, delete: true },
    schema: {
      labelField: 'title',
      contentField: 'none',
      columns: ['title', 'fieldCount', 'stampCount'],
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string', label: '模式', writable: true },
        fieldCount: { type: 'number', label: '字段', computed: true },
        stampCount: { type: 'number', label: '收集', computed: true, sortable: true },
        fields: { type: 'string', label: '属性', writable: true },
        table: { type: 'string', label: '来源表', computed: true },
        tablePath: { type: 'string', label: '表路径', computed: true },
        sourceId: { type: 'string', label: '记录', computed: true },
        tag: { type: 'string', label: '模式' },
        schema: { type: 'schema', label: '模式', writable: false, computed: true },
      },
    },
    list: (query?: CollectionListQuery) => {
      const tagFilter = String(query?.filter?.tag ?? '').trim()
      let listed = tagFilter ? stampRows(tagFilter) : tagRows()
      if (query?.ids?.length) {
        const want = new Set(query.ids)
        listed = listed.filter((row) => want.has(row.id))
      }
      const q = query?.q?.trim().toLowerCase() ?? ''
      if (q) {
        listed = listed.filter((row) => `${row.id} ${row.title} ${row.table ?? ''}`.toLowerCase().includes(q))
      }
      return listed
    },
    get: (id) => {
      const stamp = parseStampRecordId(id)
      if (stamp) {
        for (const tag of store.list()) {
          const hit = stampRows(tag.id).find((row) => row.id === id)
          if (hit) return hit
        }
        return null
      }
      return tagRows().find((row) => row.id === id) ?? null
    },
    create: (rows) =>
      rows.map((fields = {}) => {
        const title = String(fields.title ?? '').trim() || '未命名模式'
        const id = slugSuperTagId(title, new Set(store.list().map((tag) => tag.id)))
        const pack = store.upsert({ id, label: title, fields: parseFields(fields.fields) })
        return asTag(pack.id, pack.label, pack.fields, 0)
      }),
    update: (id, patch) => {
      if (parseStampRecordId(id)) throw new Error(`cannot update collected row: ${id}`)
      const current = store.get(id)
      if (!current) throw new Error(`unknown 模式: ${id}`)
      const label = patch.title != null ? String(patch.title).trim() || current.label : current.label
      const fields = patch.fields != null ? parseFields(patch.fields) : current.fields
      const pack = store.upsert({ id: current.id, label, fields })
      return asTag(pack.id, pack.label, pack.fields, store.stampCounts()[pack.id] ?? 0)
    },
    remove: (query) => {
      const ids = query.ids ?? []
      for (const id of ids) {
        if (parseStampRecordId(id)) throw new Error(`cannot delete collected row: ${id}`)
        if (!store.removeTag(id)) throw new Error(`unknown 模式: ${id}`)
      }
      return ids
    },
  }
}
