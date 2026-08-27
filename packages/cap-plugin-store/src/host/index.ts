import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Service, type Context, type Plugin } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import { compileStoreModule, registerPluginCreate, type PluginCreateInput } from './plugin-create.ts'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export const name = 'plugin-store'
export const inject = ['http', 'hub', 'tools']

export type StoreListing = {
  id: string
  name: string
  blurb: string
  installed: boolean
  running: boolean
}

type PluginRow = {
  id: string
  name: string
  blurb: string
  host_js: string
  web_js: string
  enabled: number
}

type StoreHub = {
  adopt(entry: CatalogEntry): Promise<unknown>
  drop(id: string): Promise<unknown>
  snapshot(): { plugins: Array<{ id: string; enabled?: boolean; state?: string }> }
}

const ALLOWED_FILES = new Set(['manifest.json', 'host.js', 'web.js'])

const HELLO_HOST_JS = `export const name = 'store-hello'
export const inject = ['http']

export function apply(ctx) {
  ctx.http.route('GET', '/api/store-hello', (route) => {
    route.send(200, { message: 'hello from store plugin', installed: true })
  })
}
`

const HELLO_WEB_JS = `const React = globalThis.React

export const name = 'store-hello-web'
export const inject = ['slots']

function HelloBanner() {
  return React.createElement(
    'div',
    {
      'data-testid': 'store-hello-banner',
      className:
        'rounded-[8px] border border-[var(--dsw-ok)]/40 bg-[var(--dsw-surface)] px-3 py-2 text-[13px] text-[var(--dsw-label)]',
    },
    'Hello 商店插件已运行',
  )
}

export function apply(ctx) {
  ctx.slots.place('plugin-store-extras', HelloBanner, {
    key: 'store-hello-banner',
    order: 10,
  })
}
`

export function storeWebUrl(id: string) {
  return `/api/plugin-store/files/${encodeURIComponent(id)}/web.js`
}

export function defaultDbPath() {
  return process.env.BIU_PLUGIN_DB || join(process.cwd(), '.cordis', 'plugins.sqlite')
}

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

function importHostModule(code: string) {
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
}

export class PluginStoreService extends Service {
  private db!: DatabaseSync

  constructor(ctx: Context, private readonly dbPath: string) {
    super(ctx, 'pluginStore')
  }

  open() {
    mkdirSync(dirname(this.dbPath), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        blurb TEXT NOT NULL DEFAULT '',
        host_js TEXT NOT NULL DEFAULT '',
        web_js TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
    return this
  }

  ensureHello() {
    const existing = this.getRow('store-hello')
    if (existing) return
    const now = Date.now()
    this.db
      .prepare(
        `INSERT INTO plugins (id, name, blurb, host_js, web_js, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        'store-hello',
        'Hello',
        '内置测试插件：安装后在本页显示横幅，并提供 GET /api/store-hello。',
        HELLO_HOST_JS,
        HELLO_WEB_JS,
        now,
        now,
      )
  }

  private hub(): StoreHub {
    return this.ctx.hub as unknown as StoreHub
  }

  private getRow(id: string) {
    return this.db.prepare('SELECT id, name, blurb, host_js, web_js, enabled FROM plugins WHERE id = ?').get(id) as
      | PluginRow
      | undefined
  }

  async create(input: PluginCreateInput) {
    const id = String(input.id ?? '').trim()
    const name = String(input.name ?? '').trim()
    const hostJs = String(input.hostJs ?? '').trim()
    const webSrc = input.webJs != null ? String(input.webJs).trim() : ''
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    if (!name) throw new Error('plugin name required')
    if (!hostJs && !webSrc) throw new Error('hostJs or webJs required')
    const hostCompiled = hostJs ? await compileStoreModule(hostJs, 'host') : ''
    const webCompiled = webSrc ? await compileStoreModule(webSrc, 'web') : ''
    const now = Date.now()
    const prev = this.getRow(id)
    this.db
      .prepare(
        `INSERT INTO plugins (id, name, blurb, host_js, web_js, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           blurb = excluded.blurb,
           host_js = excluded.host_js,
           web_js = excluded.web_js,
           updated_at = excluded.updated_at`,
      )
      .run(id, name, String(input.blurb ?? '').trim() || name, hostCompiled, webCompiled, prev?.enabled ?? 0, now, now)
    if (prev?.enabled === 1) await this.mount(this.getRow(id)!)
    return { id }
  }

  async list(): Promise<StoreListing[]> {
    const running = new Set(
      this.hub()
        .snapshot()
        .plugins.filter((row) => row.enabled || row.state === 'active')
        .map((row) => row.id),
    )
    const rows = this.db
      .prepare('SELECT id, name, blurb, host_js, web_js, enabled FROM plugins ORDER BY name COLLATE NOCASE, id')
      .all() as PluginRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      blurb: row.blurb,
      installed: row.enabled === 1,
      running: row.enabled === 1 && running.has(row.id),
    }))
  }

  async install(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const row = this.getRow(id)
    if (!row) throw new Error(`unknown store plugin: ${id}`)
    this.db.prepare('UPDATE plugins SET enabled = 1, updated_at = ? WHERE id = ?').run(Date.now(), id)
    await this.mount({ ...row, enabled: 1 })
    return (await this.list()).find((item) => item.id === id)
  }

  async uninstall(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    this.db.prepare('UPDATE plugins SET enabled = 0, updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  async restore() {
    const rows = this.db.prepare('SELECT id, name, blurb, host_js, web_js, enabled FROM plugins WHERE enabled = 1').all() as PluginRow[]
    for (const row of rows) await this.mount(row)
  }

  async readInstalledFile(id: string, file: string) {
    if (!isSafeId(id) || !ALLOWED_FILES.has(file)) throw new Error('not found')
    const row = this.getRow(id)
    if (!row || row.enabled !== 1) throw new Error('not found')
    if (file === 'host.js') {
      if (!row.host_js.trim()) throw new Error('not found')
      return row.host_js
    }
    if (file === 'web.js') {
      if (!row.web_js.trim()) throw new Error('not found')
      return row.web_js
    }
    return `${JSON.stringify({ id: row.id, name: row.name, blurb: row.blurb }, null, 2)}\n`
  }

  private async mount(row: PluginRow) {
    const hostCode = row.host_js.trim()
    const webCode = row.web_js.trim()
    if (!hostCode && !webCode) throw new Error(`plugin ${row.id} has neither host nor web`)
    const mod = (hostCode
      ? await importHostModule(hostCode)
      : { name: row.id, apply() {} }) as Plugin & { inject?: string[] }
    const entry: CatalogEntry = {
      id: row.id,
      name: row.name,
      layer: 'capability',
      blurb: row.blurb,
      plugin: mod,
      inject: mod.inject,
      togglable: true,
      enabled: true,
      web: webCode ? storeWebUrl(row.id) : undefined,
      packageName: `store:${row.id}`,
    }
    await this.hub().adopt(entry)
  }
}

export async function apply(ctx: Context) {
  const store = new PluginStoreService(ctx, defaultDbPath()).open()
  store.ensureHello()
  await store.restore()
  registerPluginCreate(ctx, store)

  ctx.http.route('GET', '/api/plugin-store', async (route) => {
    route.send(200, { items: await store.list() })
  })
  ctx.http.route('POST', '/api/plugin-store/install', async (route) => {
    const payload = (await route.json()) as { id?: string }
    try {
      route.send(200, { item: await store.install(String(payload?.id ?? '')) })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/plugin-store/uninstall', async (route) => {
    const payload = (await route.json()) as { id?: string }
    try {
      await store.uninstall(String(payload?.id ?? ''))
      route.send(200, { ok: true, items: await store.list() })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('GET', '/api/plugin-store/files/:id/:file', async (route) => {
    try {
      const body = await store.readInstalledFile(route.params.id, route.params.file)
      const mime = route.params.file.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : 'application/json; charset=utf-8'
      route.res.writeHead(200, {
        'content-type': mime,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      })
      route.res.end(body)
    } catch {
      route.send(404, { error: 'not found' })
    }
  })
}

declare module 'cordis' {
  interface Context {
    pluginStore: PluginStoreService
  }
}
