import type { CollectionInfo, CollectionListQuery, CollectionSpec, DbRecord } from '@biu/type-file-system'
import { recordBuiltinValues, REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { FacetStore, slugFacetId } from './facets-store.ts'
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

export function facetsCollection(
  store: FacetStore,
  tables: () => Array<Pick<CollectionInfo, 'path' | 'label' | 'id'>> = () => [],
): CollectionSpec {
  const asFacet = (id: string, label: string, fields: unknown[], stampCount: number): DbRecord => ({
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

  const facetRows = () => {
    const counts = store.stampCounts()
    return store.list().map((facet) => asFacet(facet.id, facet.label, facet.fields, counts[facet.id] ?? 0))
  }

  const stampRows = (facetId: string) => {
    const found = store.collect(facetId)
    const id = found.facet?.id ?? facetId
    return found.items.map((item) => ({
      id: stampRecordId(item.collection, item.id),
      title: item.title || item.id,
      table: tableLabel(item.collection),
      tablePath: item.collection,
      sourceId: item.id,
      facetId: id,
      ...recordBuiltinValues(),
    }))
  }

  return {
    id: 'facets',
    path: '/facets',
    label: '合集',
    view: {
      moduleId: 'facets-db',
      route: '/db-facets',
      title: '合集',
      inspector: true,
      blurb: '工作区全局合集，谁都可以改属性和贴到任意表的记录上（含插件）。新建用 db_create，改名/属性用 db_update（fields 为属性 JSON 数组）。',
      order: 31,
      icon: 'rectangle-stack',
    },
    records: { update: true, create: true, delete: true },
    schema: {
      labelField: 'title',
      contentField: 'none',
      columns: ['title', 'fieldCount', 'stampCount'],
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string', label: '合集', writable: true },
        fieldCount: { type: 'number', label: '字段', computed: true },
        stampCount: { type: 'number', label: '收集', computed: true, sortable: true },
        fields: { type: 'string', label: '属性', writable: true },
        table: { type: 'string', label: '来源表', computed: true },
        tablePath: { type: 'string', label: '表路径', computed: true },
        sourceId: { type: 'string', label: '记录', computed: true },
        facetId: { type: 'string', label: '合集', computed: true },
      },
    },
    list: (query?: CollectionListQuery) => {
      const facetFilter = String(query?.filter?.facetId ?? '').trim()
      let listed = facetFilter ? stampRows(facetFilter) : facetRows()
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
        for (const facet of store.list()) {
          const hit = stampRows(facet.id).find((row) => row.id === id)
          if (hit) return hit
        }
        return null
      }
      return facetRows().find((row) => row.id === id) ?? null
    },
    create: (rows) =>
      rows.map((fields = {}) => {
        const title = String(fields.title ?? '').trim() || '未命名合集'
        const id = slugFacetId(title, new Set(store.list().map((facet) => facet.id)))
        const pack = store.upsert({ id, label: title, fields: parseFields(fields.fields) })
        return asFacet(pack.id, pack.label, pack.fields, 0)
      }),
    update: (id, patch) => {
      if (parseStampRecordId(id)) throw new Error(`cannot update collected row: ${id}`)
      const current = store.get(id)
      if (!current) throw new Error(`unknown 合集: ${id}`)
      const label = patch.title != null ? String(patch.title).trim() || current.label : current.label
      const fields = patch.fields != null ? parseFields(patch.fields) : current.fields
      const pack = store.upsert({ id: current.id, label, fields })
      return asFacet(pack.id, pack.label, pack.fields, store.stampCounts()[pack.id] ?? 0)
    },
    remove: (query) => {
      const ids = query.ids ?? []
      for (const id of ids) {
        if (parseStampRecordId(id)) throw new Error(`cannot delete collected row: ${id}`)
        if (!store.removeFacet(id)) throw new Error(`unknown 合集: ${id}`)
      }
      return ids
    },
  }
}
