import type { CollectionListQuery, CollectionSpec, DbRecord } from '@biu/type-file-system'
import { SchemaTagsStore, slugSuperTagId } from './schema-tags.ts'

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

export function superTagsCollection(store: SchemaTagsStore): CollectionSpec {
  const asRecord = (id: string, label: string, fields: unknown[], stampCount: number): DbRecord => ({
    id,
    title: label,
    fieldCount: fields.length,
    stampCount,
  })

  const rows = () => {
    const counts = store.stampCounts()
    return store.list().map((tag) => asRecord(tag.id, tag.label, tag.fields, counts[tag.id] ?? 0))
  }

  return {
    id: 'supertags',
    path: '/supertags',
    label: '超级标签',
    view: {
      moduleId: 'supertags-db',
      route: '/db-supertags',
      title: '超级标签',
      inspector: true,
      blurb: '工作区全局 SuperTag：字段定义与跨表收集。可保存自己的表格、看板视图。',
      order: 18,
      icon: 'tag',
    },
    records: { update: true, create: true, delete: true },
    schema: {
      labelField: 'title',
      contentField: 'none',
      columns: ['title', 'fieldCount', 'stampCount'],
      fields: {
        title: { type: 'string', label: 'SuperTag', writable: true },
        fieldCount: { type: 'number', label: '字段', computed: true },
        stampCount: { type: 'number', label: '收集', computed: true, sortable: true },
        schema: { type: 'schema', label: 'SuperTag', writable: false, computed: true },
      },
    },
    list: (query?: CollectionListQuery) => {
      let listed = rows()
      if (query?.ids?.length) {
        const want = new Set(query.ids)
        listed = listed.filter((row) => want.has(row.id))
      }
      const q = query?.q?.trim().toLowerCase() ?? ''
      if (q) {
        listed = listed.filter((row) => `${row.id} ${row.title}`.toLowerCase().includes(q))
      }
      return listed
    },
    get: (id) => rows().find((row) => row.id === id) ?? null,
    create: (fields = {}) => {
      const title = String(fields.title ?? '').trim() || '未命名 SuperTag'
      const id = slugSuperTagId(title, new Set(store.list().map((tag) => tag.id)))
      const pack = store.upsert({ id, label: title, fields: parseFields(fields.fields) })
      return asRecord(pack.id, pack.label, pack.fields, 0)
    },
    update: (id, patch) => {
      const current = store.get(id)
      if (!current) throw new Error(`unknown SuperTag: ${id}`)
      const label = patch.title != null ? String(patch.title).trim() || current.label : current.label
      const fields = patch.fields != null ? parseFields(patch.fields) : current.fields
      const pack = store.upsert({ id: current.id, label, fields })
      return asRecord(pack.id, pack.label, pack.fields, store.stampCounts()[pack.id] ?? 0)
    },
    remove: (id) => {
      if (!store.removeTag(id)) throw new Error(`unknown SuperTag: ${id}`)
    },
  }
}
