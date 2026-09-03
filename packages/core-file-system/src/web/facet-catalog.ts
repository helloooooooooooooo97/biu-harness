import { isAtomicFieldType, normalizeSchemaPack, type AtomicFieldType, type CollectionSchemaPack } from '@biu/type-file-system'

export const FACETS_KEY = 'fsdb.facets'

let memory: CollectionSchemaPack[] | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function parseFacets(raw: unknown): CollectionSchemaPack[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
}

export function subscribeFacets(_collectionPath: string | undefined, fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function loadFacets(_collectionPath?: string): CollectionSchemaPack[] {
  if (memory) return memory
  try {
    memory = parseFacets(JSON.parse(localStorage.getItem(FACETS_KEY) ?? '[]'))
    return memory
  } catch {
    memory = []
    return memory
  }
}

export function persistFacets(facets: CollectionSchemaPack[], _collectionPath?: string) {
  const next = parseFacets(facets)
  memory = next
  try {
    localStorage.setItem(FACETS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  void fetch('/api/db/facets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facets: next }),
  }).catch(() => undefined)
  emit()
  try {
    window.dispatchEvent(new Event('fsdb:change'))
  } catch {
    /* ignore */
  }
}

export async function pullFacets(_collectionPath?: string) {
  try {
    const res = await fetch('/api/db/facets')
    const body = (await res.json()) as { facets?: unknown[] }
    if (!res.ok || !Array.isArray(body.facets)) return loadFacets()
    const facets = parseFacets(body.facets)
    const prev = JSON.stringify(memory ?? [])
    const next = JSON.stringify(facets)
    memory = facets
    try {
      localStorage.setItem(FACETS_KEY, JSON.stringify(facets))
    } catch {
      /* ignore */
    }
    if (prev !== next) emit()
    return facets
  } catch {
    /* ignore */
  }
  return loadFacets()
}

export function slugFacetId(label: string, used: Set<string>) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'facet'
  let id = /^[a-z]/.test(base) ? base : `f-${base}`
  let n = 2
  while (used.has(id) || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) {
    id = `${base.slice(0, 20)}-${n}`
    if (!/^[a-z]/.test(id)) id = `f-${id}`
    n += 1
  }
  return id
}

export function fieldKeyFromLabel(label: string, used: Set<string>) {
  const slug = slugFacetId(label || 'field', new Set()).replace(/-/g, '_')
  let key = /^[A-Za-z]/.test(slug) ? slug : `f_${slug.replace(/^f_?/, '') || 'field'}`
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) key = 'field'
  let n = 2
  let next = key
  while (used.has(next)) {
    next = `${key}_${n}`
    n += 1
  }
  return next
}

export function addFacetField(facetId: string, name: string, type: AtomicFieldType) {
  if (!isAtomicFieldType(type)) return false
  const label = name.trim()
  if (!label) return false
  const catalog = loadFacets()
  const facet = catalog.find((item) => item.id === facetId)
  if (!facet) return false
  const key = fieldKeyFromLabel(label, new Set(facet.fields.map((item) => item.key)))
  persistFacets(
    catalog.map((item) =>
      item.id === facet.id ? { ...item, fields: [...item.fields, { key, type, label, writable: true }] } : item,
    ),
  )
  return true
}
