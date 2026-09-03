import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import {
  normalizeSchemaPack,
  normalizeSchemaValue,
  type CollectionSchemaPack,
  type SchemaFieldValue,
} from '@biu/type-file-system'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export const SUPER_TAGS_SQLITE = '.cordis/file-system.sqlite'

export type SuperTagStamp = {
  collection: string
  id: string
  path: string
  title: string
}

type TagRow = { id: string; label: string; fields_json: string; updated_at?: number }
type StampRow = { tag_id: string; collection: string; record_id: string; title: string }

export function slugSuperTagId(label: string, used: Set<string>) {
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

function packFromRow(row: TagRow): CollectionSchemaPack | null {
  let fields: unknown = []
  try {
    fields = JSON.parse(row.fields_json || '[]')
  } catch {
    fields = []
  }
  return normalizeSchemaPack({ id: row.id, label: row.label, fields })
}

/** SuperTag 由 File System 用 SQLite 管：目录 + 跨表倒排，查询不扫全表。 */
export class SchemaTagsStore {
  private db: DatabaseSync | null = null

  open(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS super_tags (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        fields_json TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS super_tags_label ON super_tags(label);
      CREATE TABLE IF NOT EXISTS super_tag_stamps (
        tag_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        record_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (tag_id, collection, record_id)
      );
      CREATE INDEX IF NOT EXISTS super_tag_stamps_tag ON super_tag_stamps(tag_id);
      CREATE INDEX IF NOT EXISTS super_tag_stamps_record ON super_tag_stamps(collection, record_id);
      CREATE TABLE IF NOT EXISTS super_tag_record_schema (
        collection TEXT NOT NULL,
        record_id TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        PRIMARY KEY (collection, record_id)
      );
    `)
    return this
  }

  private ensure() {
    if (!this.db) this.open(':memory:')
    return this.db!
  }

  list(query = ''): CollectionSchemaPack[] {
    const db = this.ensure()
    const q = query.trim().toLowerCase()
    const rows = (
      q
        ? (db
            .prepare(
              `SELECT id, label, fields_json, updated_at FROM super_tags
               WHERE instr(lower(id), ?) > 0 OR instr(lower(label), ?) > 0
               ORDER BY label`,
            )
            .all(q, q) as TagRow[])
        : (db.prepare('SELECT id, label, fields_json, updated_at FROM super_tags ORDER BY label').all() as TagRow[])
    )
    return rows.map((row) => packFromRow(row)).filter((item): item is CollectionSchemaPack => Boolean(item))
  }

  get(idOrLabel: string): CollectionSchemaPack | null {
    const want = String(idOrLabel ?? '').trim()
    if (!want) return null
    const db = this.ensure()
    const row = db
      .prepare('SELECT id, label, fields_json, updated_at FROM super_tags WHERE id = ? OR label = ? LIMIT 1')
      .get(want, want) as TagRow | undefined
    return row ? packFromRow(row) : null
  }

  replace(tags: unknown[]): CollectionSchemaPack[] {
    const db = this.ensure()
    const next = tags.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
    const keep = new Set(next.map((tag) => tag.id))
    const upsert = db.prepare(
      `INSERT INTO super_tags (id, label, fields_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, fields_json = excluded.fields_json, updated_at = excluded.updated_at`,
    )
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const tag of next) {
        upsert.run(tag.id, tag.label, JSON.stringify(tag.fields), Date.now())
      }
      const existing = db.prepare('SELECT id FROM super_tags').all() as Array<{ id: string }>
      for (const row of existing) {
        if (keep.has(row.id)) continue
        db.prepare('DELETE FROM super_tag_stamps WHERE tag_id = ?').run(row.id)
        db.prepare('DELETE FROM super_tags WHERE id = ?').run(row.id)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    return this.list()
  }

  upsert(raw: unknown): CollectionSchemaPack {
    const pack = normalizeSchemaPack(raw)
    if (!pack) throw new Error('invalid SuperTag')
    this.ensure()
      .prepare(
        `INSERT INTO super_tags (id, label, fields_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, fields_json = excluded.fields_json, updated_at = excluded.updated_at`,
      )
      .run(pack.id, pack.label, JSON.stringify(pack.fields), Date.now())
    return pack
  }

  removeTag(id: string): boolean {
    const db = this.ensure()
    const want = String(id ?? '').trim()
    if (!want) return false
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('DELETE FROM super_tag_stamps WHERE tag_id = ?').run(want)
      const result = db.prepare('DELETE FROM super_tags WHERE id = ?').run(want)
      db.exec('COMMIT')
      return Number(result.changes) > 0
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  stampCounts(): Record<string, number> {
    const rows = this.ensure()
      .prepare('SELECT tag_id, COUNT(*) AS n FROM super_tag_stamps GROUP BY tag_id')
      .all() as Array<{ tag_id: string; n: number | bigint }>
    const out: Record<string, number> = {}
    for (const row of rows) out[row.tag_id] = Number(row.n)
    return out
  }

  indexRecord(collection: string, recordId: string, title: string, tagIds: string[]) {
    const db = this.ensure()
    const ids = [...new Set(tagIds.map((id) => String(id).trim()).filter(Boolean))]
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('DELETE FROM super_tag_stamps WHERE collection = ? AND record_id = ?').run(collection, recordId)
      const insert = db.prepare(
        'INSERT INTO super_tag_stamps (tag_id, collection, record_id, title) VALUES (?, ?, ?, ?)',
      )
      for (const tagId of ids) insert.run(tagId, collection, recordId, title)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  recordSchema(collection: string, recordId: string): SchemaFieldValue | null {
    const row = this.ensure()
      .prepare('SELECT schema_json FROM super_tag_record_schema WHERE collection = ? AND record_id = ?')
      .get(collection, recordId) as { schema_json: string } | undefined
    if (!row) return null
    return normalizeSchemaValue(row.schema_json)
  }

  writeRecordSchema(collection: string, recordId: string, schema: unknown, title: string) {
    const value = normalizeSchemaValue(schema)
    this.ensure()
      .prepare(
        `INSERT INTO super_tag_record_schema (collection, record_id, schema_json)
         VALUES (?, ?, ?)
         ON CONFLICT(collection, record_id) DO UPDATE SET schema_json = excluded.schema_json`,
      )
      .run(collection, recordId, JSON.stringify(value))
    this.indexRecord(collection, recordId, title, value.tags)
    return value
  }

  removeRecord(collection: string, recordId: string) {
    const db = this.ensure()
    db.prepare('DELETE FROM super_tag_stamps WHERE collection = ? AND record_id = ?').run(collection, recordId)
    db.prepare('DELETE FROM super_tag_record_schema WHERE collection = ? AND record_id = ?').run(collection, recordId)
  }

  stampedIds(collection: string, tagIdOrLabel: string): Set<string> {
    const tag = this.get(tagIdOrLabel)
    const tagId = tag?.id ?? tagIdOrLabel
    const rows = this.ensure()
      .prepare('SELECT record_id FROM super_tag_stamps WHERE collection = ? AND tag_id = ?')
      .all(collection, tagId) as Array<{ record_id: string }>
    return new Set(rows.map((row) => row.record_id))
  }

  collect(idOrLabel: string): { tag: CollectionSchemaPack | null; items: SuperTagStamp[] } {
    const tag = this.get(idOrLabel)
    const tagId = tag?.id ?? String(idOrLabel ?? '').trim()
    if (!tagId) return { tag: null, items: [] }
    const rows = this.ensure()
      .prepare(
        'SELECT tag_id, collection, record_id, title FROM super_tag_stamps WHERE tag_id = ? ORDER BY collection, record_id',
      )
      .all(tagId) as StampRow[]
    return {
      tag,
      items: rows.map((row) => ({
        collection: row.collection,
        id: row.record_id,
        path: `${row.collection}/${row.record_id}`,
        title: row.title,
      })),
    }
  }
}
