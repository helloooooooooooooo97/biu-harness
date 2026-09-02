import { mkdir, readFile, stat, unlink } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { DbRecord, SchemaFieldValue } from '@biu/type-file-system'
import { emptySchemaValue, normalizeSchemaValue } from '@biu/type-file-system'
import { dumpMarkdown, splitMarkdown } from './markdown.ts'

export const PAGE_ROOT = '.page'
export const PAGE_ASSETS = '.page/assets'
/** 正文不再引用后，附件再留一天，避免撤销/未落盘指针误删。 */
export const ASSET_GC_GRACE_MS = 24 * 60 * 60 * 1000

const ID_RE = /^[A-Za-z0-9._-]+$/
const ASSET_FILE_RE = /^[\p{L}\p{N}._-]+$/u
const ASSET_REF_RE = /(?:(?:\.page\/)?assets\/|\/api\/page\/file\/)([\p{L}\p{N}._-]+)/gu

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
  cover: string
  pack: { name: string; href: string; bytes: number }
  notes: string
  score: number
  parentId: string | null
  schema: SchemaFieldValue
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

function asPack(value: unknown): { name: string; href: string; bytes: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rec = value as Record<string, unknown>
  return {
    name: String(rec.name ?? ''),
    href: String(rec.href ?? rec.url ?? ''),
    bytes: Number(rec.bytes) || 0,
  }
}

function assetName(ref: string) {
  const trimmed = ref.trim()
  if (!trimmed) return ''
  const cleaned = trimmed.replace(/^\/+/, '')
  if (cleaned.startsWith(`${PAGE_ASSETS}/`)) return basename(cleaned)
  if (cleaned.startsWith('assets/')) return basename(cleaned)
  if (!cleaned.includes('/') && !cleaned.includes('\\')) return cleaned
  return ''
}

export function fileUrl(name: string) {
  return `/api/page/file/${encodeURIComponent(name)}`
}

function publicCover(stored: string) {
  const name = assetName(stored)
  if (name) return fileUrl(name)
  return stored
}

function publicPack(pack: { name: string; href: string; bytes: number }) {
  const name = assetName(pack.href) || (pack.name && assetName(pack.name) ? pack.name : '')
  if (!name) return pack
  return { ...pack, href: fileUrl(basename(name)) }
}

function storedCover(value: unknown, fallback: string) {
  if (value == null) return fallback
  const text = String(value)
  const name = assetName(text)
  if (name) return `assets/${name}`
  if (text.startsWith('/api/page/file/')) {
    const file = decodeURIComponent(text.slice('/api/page/file/'.length).split(/[?#]/)[0] ?? '')
    return file ? `assets/${basename(file)}` : fallback
  }
  return text
}

function storedPackHref(href: string) {
  const name = assetName(href)
  if (name) return `assets/${name}`
  if (href.startsWith('/api/page/file/')) {
    const file = decodeURIComponent(href.slice('/api/page/file/'.length).split(/[?#]/)[0] ?? '')
    return file ? `assets/${basename(file)}` : href
  }
  return href
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
    cover: storedCover(row.cover, ''),
    pack: {
      name: row.pack.name,
      href: storedPackHref(row.pack.href),
      bytes: row.pack.bytes,
    },
    score: row.score,
    parentId: row.parentId,
    schema: row.schema,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

function rowFromFile(id: string, raw: string): PageRow {
  const { matter, body } = splitMarkdown(raw)
  const now = Date.now()
  const pack = asPack(matter.pack) ?? { name: '', href: '', bytes: 0 }
  const status = STATUS.includes(matter.status as (typeof STATUS)[number])
    ? (matter.status as (typeof STATUS)[number])
    : 'draft'
  const createdAt = asTime(matter.createdAt, now)
  const updatedAt = asTime(matter.updatedAt, createdAt)
  const cover = String(matter.cover ?? '')
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
    cover: publicCover(cover),
    pack: publicPack(pack),
    notes: body,
    score: Number(matter.score) || 0,
    parentId: matter.parentId == null || matter.parentId === '' ? null : String(matter.parentId),
    schema: normalizeSchemaValue(matter.schema),
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
    schema: emptySchemaValue(),
    createdAt: ts,
    updatedAt: ts,
  }
}

function applyPatch(current: PageRow, patch: Record<string, unknown>): PageRow {
  const notes = asNotes(patch.notes)
  const pack = patch.pack !== undefined ? asPack(patch.pack) ?? current.pack : current.pack
  const next: PageRow = {
    ...current,
    ...patch,
    id: current.id,
    title:
      typeof patch.title === 'string' && patch.title.trim()
        ? patch.title.trim()
        : current.title,
    notes: notes ?? current.notes,
    pack: {
      name: pack.name,
      href: storedPackHref(pack.href),
      bytes: pack.bytes,
    },
    cover: storedCover(patch.cover !== undefined ? patch.cover : current.cover, ''),
    parentId: 'parentId' in patch
      ? patch.parentId == null || patch.parentId === '' ? null : String(patch.parentId)
      : current.parentId,
    schema: 'schema' in patch ? normalizeSchemaValue(patch.schema) : current.schema,
    score: current.score,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  }
  return next
}

export class PagesStore {
  constructor(private fs: WorkspaceFs) {}

  private async ensureDirs() {
    await mkdir(dirname(this.fs.resolve(`${PAGE_ROOT}/x.md`)), { recursive: true })
    await mkdir(this.fs.resolve(PAGE_ASSETS), { recursive: true })
  }

  async list(ids?: string[]): Promise<PageRow[]> {
    await this.ensureDirs()
    if (ids) {
      const rows: PageRow[] = []
      for (const id of ids) {
        if (!ID_RE.test(id)) continue
        const row = await this.get(id)
        if (row) rows.push(row)
      }
      return rows
    }
    let names: string[] = []
    try {
      names = await this.fs.list(PAGE_ROOT)
    } catch {
      return []
    }
    const rows: PageRow[] = []
    for (const name of names) {
      if (!name.endsWith('.md')) continue
      const id = name.slice(0, -3)
      if (!ID_RE.test(id)) continue
      const row = await this.get(id)
      if (row) rows.push(row)
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id))
  }

  async get(id: string): Promise<PageRow | null> {
    if (!ID_RE.test(id)) return null
    try {
      const raw = await this.fs.read(pageRel(id))
      return rowFromFile(id, raw)
    } catch {
      return null
    }
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
    await this.ensureDirs()
    const existing = new Set((await this.list()).map((row) => row.id))
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
    const full = this.fs.resolve(pageRel(id))
    try {
      await unlink(full)
    } catch {
      throw new Error(`unknown page: ${id}`)
    }
    await this.gcAssets()
  }

  async writeAsset(name: string, content: string) {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/') || !isPageAssetFileName(file)) throw new Error('invalid asset')
    await this.ensureDirs()
    await this.fs.write(`${PAGE_ASSETS}/${file}`, content)
    return { name: file, href: fileUrl(file) }
  }

  async readAsset(name: string): Promise<{ bytes: Buffer; type: string }> {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/')) throw new Error('invalid asset')
    const bytes = await readFile(this.fs.resolve(`${PAGE_ASSETS}/${file}`))
    return { bytes, type: mimeOf(file) }
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
    const live = new Set<string>()
    for (const row of await this.list()) {
      for (const name of collectPageAssetNames(dumpMarkdown(matterOf(row), row.notes ?? ''))) live.add(name)
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
    await this.ensureDirs()
    const body = row.notes ?? ''
    await this.fs.write(pageRel(row.id), dumpMarkdown(matterOf(row), body))
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
