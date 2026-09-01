import { normalizeSchemaPack, type CollectionSchemaPack } from '@biu/type-file-system'

export const SUPER_TAGS_KEY = 'fsdb.superTags'

let memory: CollectionSchemaPack[] | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function parseTags(raw: unknown): CollectionSchemaPack[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
}

function mergeLegacyLocal(): CollectionSchemaPack[] {
  const byId = new Map<string, CollectionSchemaPack>()
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fsdb.schemaTags:')) continue
      for (const tag of parseTags(JSON.parse(localStorage.getItem(key) ?? '[]'))) byId.set(tag.id, tag)
    }
  } catch {
    /* ignore */
  }
  return [...byId.values()]
}

export function subscribeSchemaTags(_collectionPath: string | undefined, fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function loadSchemaTags(_collectionPath?: string): CollectionSchemaPack[] {
  if (memory) return memory
  try {
    const stored = parseTags(JSON.parse(localStorage.getItem(SUPER_TAGS_KEY) ?? '[]'))
    const tags = stored.length ? stored : mergeLegacyLocal()
    memory = tags
    return tags
  } catch {
    memory = []
    return memory
  }
}

export function persistSchemaTags(tags: CollectionSchemaPack[], _collectionPath?: string) {
  const next = parseTags(tags)
  memory = next
  try {
    localStorage.setItem(SUPER_TAGS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  void fetch('/api/db/schema-tags', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tags: next }),
  }).catch(() => undefined)
  emit()
}

export async function pullSchemaTags(_collectionPath?: string) {
  try {
    const res = await fetch('/api/db/schema-tags')
    const body = (await res.json()) as { tags?: unknown[] }
    if (!res.ok || !Array.isArray(body.tags)) return loadSchemaTags()
    const tags = parseTags(body.tags)
    memory = tags
    try {
      localStorage.setItem(SUPER_TAGS_KEY, JSON.stringify(tags))
    } catch {
      /* ignore */
    }
    emit()
    return tags
  } catch {
    /* ignore */
  }
  return loadSchemaTags()
}

export function slugTagId(label: string, used: Set<string>) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'tag'
  let id = /^[a-z]/.test(base) ? base : `t-${base}`
  let n = 2
  while (used.has(id) || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) {
    id = `${base.slice(0, 20)}-${n}`
    if (!/^[a-z]/.test(id)) id = `t-${id}`
    n += 1
  }
  return id
}
