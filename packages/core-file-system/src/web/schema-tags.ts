import { normalizeSchemaPack, type CollectionSchemaPack } from '@biu/type-file-system'

export function schemaTagsKey(collectionPath: string) {
  return `fsdb.schemaTags:${collectionPath}`
}

const memory = new Map<string, CollectionSchemaPack[]>()
const listeners = new Map<string, Set<() => void>>()

function emit(collectionPath: string) {
  for (const fn of listeners.get(collectionPath) ?? []) fn()
}

export function subscribeSchemaTags(collectionPath: string, fn: () => void) {
  const set = listeners.get(collectionPath) ?? new Set<() => void>()
  set.add(fn)
  listeners.set(collectionPath, set)
  return () => {
    set.delete(fn)
  }
}

export function loadSchemaTags(collectionPath: string): CollectionSchemaPack[] {
  const hit = memory.get(collectionPath)
  if (hit) return hit
  try {
    const raw = localStorage.getItem(schemaTagsKey(collectionPath))
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : []
    const tags = Array.isArray(parsed)
      ? parsed.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
      : []
    memory.set(collectionPath, tags)
    return tags
  } catch {
    return []
  }
}

export function persistSchemaTags(collectionPath: string, tags: CollectionSchemaPack[]) {
  const next = tags.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
  memory.set(collectionPath, next)
  try {
    localStorage.setItem(schemaTagsKey(collectionPath), JSON.stringify(next))
  } catch {
    /* ignore */
  }
  void fetch('/api/db/schema-tags', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: collectionPath, tags: next }),
  }).catch(() => undefined)
  emit(collectionPath)
}

export async function pullSchemaTags(collectionPath: string) {
  try {
    const res = await fetch(`/api/db/schema-tags?path=${encodeURIComponent(collectionPath)}`)
    const body = (await res.json()) as { tags?: unknown[] }
    if (!res.ok || !Array.isArray(body.tags)) return loadSchemaTags(collectionPath)
    const tags = body.tags.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
    if (tags.length) {
      memory.set(collectionPath, tags)
      try {
        localStorage.setItem(schemaTagsKey(collectionPath), JSON.stringify(tags))
      } catch {
        /* ignore */
      }
      emit(collectionPath)
      return tags
    }
  } catch {
    /* ignore */
  }
  return loadSchemaTags(collectionPath)
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
