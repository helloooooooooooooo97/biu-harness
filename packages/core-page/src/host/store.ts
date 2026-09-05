import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import type { AttachmentValue, DbRecord, SchemaFieldValue } from '@biu/type-file-system'
import { asAttachmentList, emptySchemaValue, normalizeSchemaValue } from '@biu/type-file-system'
import { dataPath } from '@biu/host-plugin-loader/data-dir'
import { splitMarkdown } from './markdown.ts'

export const PAGE_ROOT = '.page'
export const PAGE_DB = '.page/pages.sqlite'
export const PAGE_ASSETS = '.page/assets'
/** 正文不再引用后，附件再留一天，避免撤销/未落盘指针误删。 */
export const ASSET_GC_GRACE_MS = 24 * 60 * 60 * 1000

const ID_RE = /^[A-Za-z0-9._-]+$/
const ASSET_FILE_RE = /^[\p{L}\p{N}._-]+$/u
const ASSET_REF_RE = /(?:(?:\.page\/)?assets\/|\/api\/(?:page|db)\/file\/)([\p{L}\p{N}._-]+)/gu

export function isPageAssetFileName(name: string) {
  return Boolean(name) && name === basename(name) && name !== '.gitkeep' && ASSET_FILE_RE.test(name)
}

export function collectPageAssetNames(...chunks: unknown[]): Set<string> {
  const names = new Set<string>()
  const eat = (text: string) => {
    for (const match of text.matchAll(ASSET_REF_RE)) {
      const name = basename(match[1] ?? '')
      if (isPageAssetFileName(name)) names.add(name)
    }
  }
  for (const chunk of chunks) {
    if (chunk == null) continue
    if (typeof chunk === 'string') eat(chunk)
    else eat(JSON.stringify(chunk))
  }
  return names
}

const STATUS = ['draft', 'live', 'archived'] as const

export type PageRow = DbRecord & {
  title: string
  blurb: string
  count: number
  enabled: boolean
  status: (typeof STATUS)[number]
  tags: string[]
  aliases: string[]
  publishedAt: number
  size: number
  homepage: string
  cover: string | string[]
  pack: AttachmentValue | AttachmentValue[]
  notes: string
  score: number
  parentId: string | null
  dependsOn: string[]
  facet: SchemaFieldValue
  emoji: string
  createdAt: number
  updatedAt: number
}

export type WorkspaceFs = {
  resolve: (rel: string) => string
  read: (rel: string) => Promise<string>
  write: (rel: string, content: string) => Promise<unknown>
  list: (rel?: string) => Promise<string[]>
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

function asTime(value: unknown, fallback: number): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const asNum = Number(value)
    if (Number.isFinite(asNum) && /^\d+(\.\d+)?$/.test(value.trim())) return asNum
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asNotes(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>
    if (typeof rec.body === 'string') return rec.body
    if (typeof rec.body === 'object') return JSON.stringify(rec.body, null, 2)
  }
  return String(value)
}

function emptyPack(): AttachmentValue {
  return { name: '', href: '', bytes: 0 }
}

function storedPack(file: AttachmentValue): AttachmentValue {
  return { name: file.name, href: storedPackHref(file.href), bytes: file.bytes ?? 0 }
}

function publicPackValue(value: unknown): AttachmentValue | AttachmentValue[] {
  const files = asAttachmentList(value).map((file) => publicPack(storedPack(file)))
  if (!files.length) return emptyPack()
  if (files.length === 1) return files[0]!
  return files
}

function fromAssetApi(text: string) {
  for (const prefix of ['/api/page/file/', '/api/db/file/'] as const) {
    if (text.startsWith(prefix)) {
      return decodeURIComponent(text.slice(prefix.length).split(/[?#]/)[0] ?? '')
    }
  }
  return ''
}

function assetName(ref: string) {
  const trimmed = ref.trim()
  if (!trimmed) return ''
  const fromApi = fromAssetApi(trimmed)
  if (fromApi) return basename(fromApi)
  const cleaned = trimmed.replace(/^\/+/, '')
  if (cleaned.startsWith(`${PAGE_ASSETS}/`)) return basename(cleaned)
  if (cleaned.startsWith('assets/')) return basename(cleaned)
  if (!cleaned.includes('/') && !cleaned.includes('\\')) return cleaned
  return ''
}

export function fileUrl(name: string) {
  return `/api/page/file/${encodeURIComponent(name)}`
}

function publicCover(stored: unknown): string | string[] {
  const pubs = coverList(stored).map((item) => {
    const name = assetName(item)
    return name ? fileUrl(name) : item
  })
  if (!pubs.length) return ''
  if (pubs.length === 1) return pubs[0]!
  return pubs
}

function publicPack(pack: { name: string; href: string; bytes: number }) {
  const name = assetName(pack.href) || (pack.name && assetName(pack.name) ? pack.name : '')
  if (!name) return pack
  return { ...pack, href: fileUrl(basename(name)) }
}

function storedCoverItem(value: unknown): string {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  const name = assetName(text)
  if (name) return `assets/${name}`
  const file = fromAssetApi(text)
  return file ? `assets/${basename(file)}` : text
}

function coverList(value: unknown): string[] {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.flatMap(coverList).filter(Boolean)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (Array.isArray(parsed)) return coverList(parsed)
      } catch {
        /* one path */
      }
    }
    const one = storedCoverItem(trimmed)
    return one ? [one] : []
  }
  const one = storedCoverItem(value)
  return one ? [one] : []
}

function storedCover(value: unknown, fallback: string) {
  const list = coverList(value)
  if (!list.length) return fallback
  if (list.length === 1) return list[0]!
  return JSON.stringify(list)
}

function storedCoverMatter(value: unknown, fallback: string) {
  const list = coverList(value)
  if (!list.length) return fallback
  if (list.length === 1) return list[0]!
  return list
}

function storedPackHref(href: string) {
  const name = assetName(href)
  if (name) return `assets/${name}`
  const file = fromAssetApi(href)
  return file ? `assets/${basename(file)}` : href
}

function storedPackJson(value: unknown) {
  const files = asAttachmentList(value).map((file) => storedPack(file))
  if (!files.length) return emptyPack()
  if (files.length === 1) return files[0]!
  return files
}

function pageRel(id: string) {
  if (!ID_RE.test(id)) throw new Error(`invalid page id: ${id}`)
  return `${PAGE_ROOT}/${id}.md`
}

function matterOf(row: PageRow): Record<string, unknown> {
  return {
    title: row.title,
    blurb: row.blurb,
    count: row.count,
    enabled: row.enabled,
    status: row.status,
    tags: row.tags,
    aliases: row.aliases,
    publishedAt: new Date(row.publishedAt).toISOString(),
    size: row.size,
    homepage: row.homepage,
    cover: storedCoverMatter(row.cover, ''),
    pack: storedPackJson(row.pack),
    score: row.score,
    parentId: row.parentId,
    dependsOn: row.dependsOn,
    facet: row.facet,
    emoji: row.emoji,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

function rowFromFile(id: string, raw: string): PageRow {
  const { matter, body } = splitMarkdown(raw)
  const now = Date.now()
  const status = STATUS.includes(matter.status as (typeof STATUS)[number])
    ? (matter.status as (typeof STATUS)[number])
    : 'draft'
  const createdAt = asTime(matter.createdAt, now)
  const updatedAt = asTime(matter.updatedAt, createdAt)
  return {
    id,
    title: String(matter.title ?? id),
    blurb: String(matter.blurb ?? ''),
    count: Number(matter.count) || 0,
    enabled: matter.enabled !== false,
    status,
    tags: asStringList(matter.tags),
    aliases: asStringList(matter.aliases),
    publishedAt: asTime(matter.publishedAt, createdAt),
    size: Number(matter.size) || 0,
    homepage: String(matter.homepage ?? ''),
    cover: publicCover(matter.cover),
    pack: publicPackValue(matter.pack),
    notes: body,
    score: Number(matter.score) || 0,
    parentId: matter.parentId == null || matter.parentId === '' ? null : String(matter.parentId),
    dependsOn: asStringList(matter.dependsOn),
    facet: normalizeSchemaValue(matter.facet),
    emoji: String(matter.emoji ?? ''),
    createdAt,
    updatedAt,
  }
}

function emptyRow(id: string, ts: number): PageRow {
  return {
    id,
    title: '未命名页面',
    blurb: '',
    count: 0,
    enabled: true,
    status: 'draft',
    tags: [],
    aliases: [],
    publishedAt: ts,
    size: 0,
    homepage: '',
    cover: '',
    pack: { name: '', href: '', bytes: 0 },
    notes: '',
    score: 0,
    parentId: null,
    dependsOn: [],
    facet: emptySchemaValue(),
    emoji: '',
    createdAt: ts,
    updatedAt: ts,
  }
}

function applyPatch(current: PageRow, patch: Record<string, unknown>): PageRow {
  const notes = asNotes(patch.notes)
  const next: PageRow = {
    ...current,
    ...patch,
    id: current.id,
    title:
      typeof patch.title === 'string' && patch.title.trim()
        ? patch.title.trim()
        : current.title,
    notes: notes ?? current.notes,
    pack: patch.pack !== undefined ? publicPackValue(patch.pack) : current.pack,
    cover: publicCover(patch.cover !== undefined ? patch.cover : current.cover),
    parentId: 'parentId' in patch
      ? patch.parentId == null || patch.parentId === '' ? null : String(patch.parentId)
      : current.parentId,
    dependsOn: 'dependsOn' in patch ? asStringList(patch.dependsOn) : current.dependsOn,
    facet: 'facet' in patch ? normalizeSchemaValue(patch.facet) : current.facet,
    emoji: 'emoji' in patch ? String(patch.emoji ?? '') : current.emoji,
    score: current.score,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  }
  return next
}

export class PagesStore {
  constructor(
    private fs: WorkspaceFs,
    private assetsDir = dataPath(process.cwd(), 'assets'),
  ) {}

  private db: import('node:sqlite').DatabaseSync | null = null

  private async ensureDirs() {
    await mkdir(dirname(this.fs.resolve(`${PAGE_ROOT}/x.md`)), { recursive: true })
    await mkdir(this.fs.resolve(PAGE_ASSETS), { recursive: true })
    await mkdir(this.assetsDir, { recursive: true })
  }

  private async openDb() {
    await this.ensureDirs()
    if (this.db) return this.db
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
    const db = new DatabaseSync(this.fs.resolve(PAGE_DB))
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        blurb TEXT NOT NULL DEFAULT '',
        count REAL NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        tags_json TEXT NOT NULL DEFAULT '[]',
        aliases_json TEXT NOT NULL DEFAULT '[]',
        published_at INTEGER NOT NULL,
        size REAL NOT NULL DEFAULT 0,
        homepage TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        pack_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        score REAL NOT NULL DEFAULT 0,
        parent_id TEXT,
        depends_on_json TEXT NOT NULL DEFAULT '[]',
        facet_json TEXT NOT NULL DEFAULT '{}',
        emoji TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    const cols = db.prepare('PRAGMA table_info(pages)').all() as Array<{ name: string }>
    if (!cols.some((col) => col.name === 'depends_on_json')) {
      db.exec(`ALTER TABLE pages ADD COLUMN depends_on_json TEXT NOT NULL DEFAULT '[]'`)
    }
    this.db = db
    return db
  }

  private async migrateMarkdown() {
    if (!this.db) return
    let names: string[] = []
    try {
      names = await this.fs.list(PAGE_ROOT)
    } catch {
      return
    }
    const existing = new Set(
      (this.db.prepare('SELECT id FROM pages').all() as Array<{ id: string }>).map((row) => row.id),
    )
    for (const name of names) {
      if (!name.endsWith('.md')) continue
      const id = name.slice(0, -3)
      if (!ID_RE.test(id) || existing.has(id)) continue
      try {
        const row = rowFromFile(id, await this.fs.read(pageRel(id)))
        this.upsert(row)
        existing.add(id)
      } catch {
        /* skip unreadable */
      }
    }
  }

  private upsert(row: PageRow) {
    if (!this.db) return
    this.db.prepare(`
      INSERT INTO pages (
        id, title, blurb, count, enabled, status, tags_json, aliases_json,
        published_at, size, homepage, cover, pack_json, notes, score, parent_id,
        depends_on_json, facet_json, emoji, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, blurb=excluded.blurb, count=excluded.count, enabled=excluded.enabled,
        status=excluded.status, tags_json=excluded.tags_json, aliases_json=excluded.aliases_json,
        published_at=excluded.published_at, size=excluded.size, homepage=excluded.homepage,
        cover=excluded.cover, pack_json=excluded.pack_json, notes=excluded.notes, score=excluded.score,
        parent_id=excluded.parent_id, depends_on_json=excluded.depends_on_json, facet_json=excluded.facet_json, emoji=excluded.emoji,
        updated_at=excluded.updated_at
    `).run(...sqlValues(row))
  }

  async list(ids?: string[]): Promise<PageRow[]> {
    const db = await this.openDb()
    await this.migrateMarkdown()
    if (ids) {
      const rows: PageRow[] = []
      for (const id of ids) {
        if (!ID_RE.test(id)) continue
        const row = await this.get(id)
        if (row) rows.push(row)
      }
      return rows
    }
    const listed = db.prepare(`
      SELECT id, title, blurb, count, enabled, status, tags_json, aliases_json,
        published_at, size, homepage, cover, pack_json, '' AS notes, score, parent_id,
        depends_on_json, facet_json, emoji, created_at, updated_at
      FROM pages ORDER BY id
    `).all() as SqlPage[]
    return listed.map(rowFromSql)
  }

  async get(id: string): Promise<PageRow | null> {
    if (!ID_RE.test(id)) return null
    const db = await this.openDb()
    await this.migrateMarkdown()
    const hit = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as SqlPage | undefined
    return hit ? rowFromSql(hit) : null
  }

  async update(id: string, patch: Record<string, unknown>): Promise<PageRow> {
    const current = await this.get(id)
    if (!current) throw new Error(`unknown page: ${id}`)
    const next = applyPatch(current, patch)
    await this.write(next)
    await this.gcAssets()
    return (await this.get(id))!
  }

  async create(fields: Record<string, unknown> = {}): Promise<PageRow> {
    const db = await this.openDb()
    const existing = new Set((db.prepare('SELECT id FROM pages').all() as Array<{ id: string }>).map((row) => row.id))
    let n = existing.size
    let id = `p${String(n).padStart(3, '0')}`
    while (existing.has(id) || !ID_RE.test(id)) {
      n += 1
      id = `p${String(n).padStart(3, '0')}`
    }
    if (typeof fields.id === 'string' && ID_RE.test(fields.id) && !existing.has(fields.id)) id = fields.id
    const ts = Date.now()
    const row = applyPatch(emptyRow(id, ts), { ...fields, score: 0 })
    row.id = id
    row.createdAt = ts
    row.updatedAt = ts
    if (typeof fields.title === 'string' && fields.title.trim()) row.title = fields.title.trim()
    await this.write(row)
    await this.gcAssets()
    return (await this.get(id))!
  }

  async remove(id: string) {
    if (!ID_RE.test(id)) throw new Error(`unknown page: ${id}`)
    const db = await this.openDb()
    const info = db.prepare('DELETE FROM pages WHERE id = ?').run(id)
    if (!info.changes) throw new Error(`unknown page: ${id}`)
    try {
      await unlink(this.fs.resolve(pageRel(id)))
    } catch {
      /* markdown sidecar optional */
    }
    await this.gcAssets()
  }

  async writeAsset(name: string, content: string | Buffer | Uint8Array) {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/') || !isPageAssetFileName(file)) throw new Error('invalid asset')
    await mkdir(this.assetsDir, { recursive: true })
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content)
    await writeFile(join(this.assetsDir, file), bytes)
    return { name: file, href: fileUrl(file) }
  }

  async readAsset(name: string): Promise<{ bytes: Buffer; type: string }> {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/')) throw new Error('invalid asset')
    try {
      const bytes = await readFile(join(this.assetsDir, file))
      return { bytes, type: mimeOf(file) }
    } catch {
      const bytes = await readFile(this.fs.resolve(`${PAGE_ASSETS}/${file}`))
      return { bytes, type: mimeOf(file) }
    }
  }

  async gcAssets(opts?: { graceMs?: number; now?: number }) {
    const graceMs = opts?.graceMs ?? ASSET_GC_GRACE_MS
    const now = opts?.now ?? Date.now()
    let names: string[] = []
    try {
      names = await this.fs.list(PAGE_ASSETS)
    } catch {
      return
    }
    const db = await this.openDb()
    const live = new Set<string>()
    const bodies = db.prepare('SELECT cover, pack_json, notes FROM pages').all() as Array<{
      cover: string
      pack_json: string
      notes: string
    }>
    for (const body of bodies) {
      for (const name of collectPageAssetNames(body.cover, body.pack_json, body.notes)) live.add(name)
    }
    for (const name of names) {
      if (name === '.gitkeep' || live.has(name) || !isPageAssetFileName(name)) continue
      const full = this.fs.resolve(`${PAGE_ASSETS}/${name}`)
      try {
        const info = await stat(full)
        if (now - info.mtimeMs < graceMs) continue
        await unlink(full)
      } catch {
        // gone or unreadable
      }
    }
  }

  private async write(row: PageRow) {
    await this.openDb()
    this.upsert(row)
  }
}

type SqlPage = {
  id: string
  title: string
  blurb: string
  count: number
  enabled: number
  status: string
  tags_json: string
  aliases_json: string
  published_at: number
  size: number
  homepage: string
  cover: string
  pack_json: string
  notes: string
  score: number
  parent_id: string | null
  depends_on_json: string
  facet_json: string
  emoji: string
  created_at: number
  updated_at: number
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function sqlPayload(row: PageRow) {
  return {
    id: row.id,
    title: row.title,
    blurb: row.blurb,
    count: row.count,
    enabled: row.enabled ? 1 : 0,
    status: row.status,
    tags_json: JSON.stringify(row.tags),
    aliases_json: JSON.stringify(row.aliases),
    published_at: row.publishedAt,
    size: row.size,
    homepage: row.homepage,
    cover: storedCover(row.cover, ''),
    pack_json: JSON.stringify(storedPackJson(row.pack)),
    notes: row.notes ?? '',
    score: row.score,
    parent_id: row.parentId,
    depends_on_json: JSON.stringify(row.dependsOn),
    facet_json: JSON.stringify(row.facet),
    emoji: row.emoji,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function sqlValues(row: PageRow) {
  const payload = sqlPayload(row)
  return [
    payload.id,
    payload.title,
    payload.blurb,
    payload.count,
    payload.enabled,
    payload.status,
    payload.tags_json,
    payload.aliases_json,
    payload.published_at,
    payload.size,
    payload.homepage,
    payload.cover,
    payload.pack_json,
    payload.notes,
    payload.score,
    payload.parent_id,
    payload.depends_on_json,
    payload.facet_json,
    payload.emoji,
    payload.created_at,
    payload.updated_at,
  ]
}

function rowFromSql(row: SqlPage): PageRow {
  const status = STATUS.includes(row.status as (typeof STATUS)[number])
    ? (row.status as (typeof STATUS)[number])
    : 'draft'
  return {
    id: row.id,
    title: row.title,
    blurb: row.blurb,
    count: Number(row.count) || 0,
    enabled: row.enabled !== 0,
    status,
    tags: asStringList(parseJson(row.tags_json, [])),
    aliases: asStringList(parseJson(row.aliases_json, [])),
    publishedAt: Number(row.published_at) || 0,
    size: Number(row.size) || 0,
    homepage: row.homepage,
    cover: publicCover(row.cover),
    pack: publicPackValue(parseJson(row.pack_json, {})),
    notes: row.notes,
    score: Number(row.score) || 0,
    parentId: row.parent_id == null || row.parent_id === '' ? null : String(row.parent_id),
    dependsOn: asStringList(parseJson(row.depends_on_json ?? '[]', [])),
    facet: normalizeSchemaValue(parseJson(row.facet_json, emptySchemaValue())),
    emoji: row.emoji ?? '',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  }
}

function mimeOf(name: string) {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.avif') return 'image/avif'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.json' || ext === '.excalidraw') return 'application/json; charset=utf-8'
  if (ext === '.zip') return 'application/zip'
  if (ext === '.pdf') return 'application/pdf'
  return 'application/octet-stream'
}

export { STATUS }
