import { mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { Service, type Context, type Plugin } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import {
  bundleStoreEntry,
  compileStoreModule,
  findEntry,
  HOST_ENTRIES,
  readSandboxManifest,
  registerPluginCreate,
  WEB_ENTRIES,
  type PluginCreateInput,
} from './plugin-create.ts'

type DatabaseSync = import('node:sqlite').DatabaseSync

const require = createRequire(import.meta.url)

export const name = 'plugin-store'
export const inject = ['http', 'hub', 'tools']

export type StoreListing = {
  id: string
  name: string
  blurb: string
  enabled: boolean
  running: boolean
}

export type StoreManifest = {
  id: string
  name: string
  blurb: string
}

type StoreHub = {
  adopt(entry: CatalogEntry): Promise<unknown>
  drop(id: string): Promise<unknown>
  snapshot(): { plugins: Array<{ id: string; enabled?: boolean; state?: string }> }
}

const ALLOWED_FILES = new Set(['manifest.json', 'host.js', 'web.js'])

export function storeWebUrl(id: string) {
  return `/api/plugin-store/files/${encodeURIComponent(id)}/web.js`
}

export function defaultPluginDir() {
  return process.env.BIU_PLUGIN_DIR || join(process.cwd(), '.plugin')
}

export function defaultSandboxDir() {
  return process.env.BIU_PLUGIN_DEV_DIR || join(process.cwd(), '.plugin-dev')
}

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

function importHostModule(code: string) {
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
}

async function importHostFile(hostFile: string) {
  try {
    return await import(`${pathToFileURL(hostFile).href}?t=${Date.now()}`)
  } catch {
    return importHostModule(await readFile(hostFile, 'utf8'))
  }
}

async function readManifest(dir: string): Promise<StoreManifest> {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as StoreManifest
  if (!raw.id || !raw.name) throw new Error(`invalid plugin manifest in ${dir}`)
  return raw
}

export class PluginStoreService extends Service {
  private db!: DatabaseSync

  constructor(
    ctx: Context,
    readonly pluginDir: string,
    private readonly dbPath: string,
    readonly sandboxDir: string = defaultSandboxDir(),
  ) {
    super(ctx, 'pluginStore')
  }

  open() {
    mkdirSync(dirname(this.dbPath), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS store_plugins (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0
      );
    `)
    return this
  }

  private hub(): StoreHub {
    return this.ctx.hub as unknown as StoreHub
  }

  private isEnabled(id: string) {
    const row = this.db.prepare('SELECT enabled FROM store_plugins WHERE id = ?').get(id) as
      | { enabled: number }
      | undefined
    return row?.enabled === 1
  }

  private setEnabled(id: string, enabled: boolean) {
    this.db
      .prepare(
        `INSERT INTO store_plugins (id, enabled) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled`,
      )
      .run(id, enabled ? 1 : 0)
  }

  pluginPath(id: string) {
    return join(this.pluginDir, id)
  }

  sandboxPath(id: string) {
    return join(this.sandboxDir, id)
  }

  /** 小插件：把 host/web 源码直接编译进 .plugin/<id>/。 */
  async create(input: PluginCreateInput) {
    const id = String(input.id ?? '').trim()
    const name = String(input.name ?? '').trim()
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    if (!name) throw new Error('plugin name required')
    const hostJs = String(input.hostJs ?? '').trim()
    const webSrc = input.webJs != null ? String(input.webJs).trim() : ''
    if (!hostJs && !webSrc) throw new Error('plugin_create needs hostJs and/or webJs')
    const dest = this.pluginPath(id)
    mkdirSync(dest, { recursive: true })
    const manifest = { id, name, blurb: String(input.blurb ?? '').trim() || name }
    await writeFile(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    if (hostJs) await writeFile(join(dest, 'host.js'), await compileStoreModule(hostJs, 'host'))
    else if (existsSync(join(dest, 'host.js'))) await rm(join(dest, 'host.js'))
    if (webSrc) await writeFile(join(dest, 'web.js'), await compileStoreModule(webSrc, 'web'))
    else if (existsSync(join(dest, 'web.js'))) await rm(join(dest, 'web.js'))
    if (this.isEnabled(id)) await this.mountFromDisk(manifest, dest)
    return { id, pluginPath: dest }
  }

  /** 在 .plugin-dev/<id>/ 开沙箱，不写入货架。 */
  async initSandbox(input: PluginCreateInput) {
    const id = String(input.id ?? '').trim()
    const name = String(input.name ?? '').trim()
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    if (!name) throw new Error('plugin name required')
    const dest = this.sandboxPath(id)
    mkdirSync(dest, { recursive: true })
    await writeFile(
      join(dest, 'manifest.json'),
      `${JSON.stringify({ id, name, blurb: String(input.blurb ?? '').trim() || name }, null, 2)}\n`,
    )
    const hostJs = String(input.hostJs ?? '').trim()
    const webSrc = input.webJs != null ? String(input.webJs).trim() : ''
    if (hostJs) await writeFile(join(dest, 'host.ts'), hostJs.endsWith('\n') ? hostJs : `${hostJs}\n`)
    if (webSrc) await writeFile(join(dest, 'web.tsx'), webSrc.endsWith('\n') ? webSrc : `${webSrc}\n`)
    return { id, sandboxPath: dest }
  }

  /** 把沙箱 bundle 进 .plugin/<id>/。 */
  async pack(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const sandbox = this.sandboxPath(id)
    if (!existsSync(join(sandbox, 'manifest.json'))) throw new Error(`sandbox not found: ${sandbox}`)
    const manifest = await readSandboxManifest(sandbox)
    const hostEntry = findEntry(sandbox, HOST_ENTRIES)
    const webEntry = findEntry(sandbox, WEB_ENTRIES)
    if (!hostEntry && !webEntry) throw new Error('sandbox needs host.ts/js or web.tsx/ts/js')
    const dest = this.pluginPath(manifest.id)
    mkdirSync(dest, { recursive: true })
    await writeFile(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    if (hostEntry) await writeFile(join(dest, 'host.js'), await bundleStoreEntry(hostEntry, 'host'))
    else if (existsSync(join(dest, 'host.js'))) await rm(join(dest, 'host.js'))
    if (webEntry) await writeFile(join(dest, 'web.js'), await bundleStoreEntry(webEntry, 'web'))
    else if (existsSync(join(dest, 'web.js'))) await rm(join(dest, 'web.js'))
    if (this.isEnabled(manifest.id)) await this.mountFromDisk(manifest, dest)
    return { id: manifest.id, sandboxPath: sandbox, pluginPath: dest }
  }

  async list(): Promise<StoreListing[]> {
    const names = existsSync(this.pluginDir) ? await readdir(this.pluginDir) : []
    const running = new Set(
      this.hub()
        .snapshot()
        .plugins.filter((row) => row.enabled || row.state === 'active')
        .map((row) => row.id),
    )
    const items: StoreListing[] = []
    for (const name of names.sort()) {
      const dir = join(this.pluginDir, name)
      if (!(await stat(dir)).isDirectory()) continue
      if (!existsSync(join(dir, 'manifest.json'))) continue
      const manifest = await readManifest(dir)
      const enabled = this.isEnabled(manifest.id)
      items.push({
        ...manifest,
        enabled,
        running: enabled && running.has(manifest.id),
      })
    }
    return items
  }

  async openPlugin(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const hit = await this.findPluginDir(id)
    if (!hit) throw new Error(`unknown store plugin: ${id}`)
    const manifest = await readManifest(hit)
    this.setEnabled(manifest.id, true)
    await this.mountFromDisk(manifest, hit)
    return (await this.list()).find((item) => item.id === manifest.id)
  }

  /** 关闭：停运行，.plugin 代码留着。 */
  async close(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    this.setEnabled(id, false)
  }

  /** 卸载：停运行，并删掉 .plugin/<id>/ 代码。 */
  async uninstall(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    this.db.prepare('DELETE FROM store_plugins WHERE id = ?').run(id)
    const hit = await this.findPluginDir(id)
    if (hit) await rm(hit, { recursive: true, force: true })
  }

  async restore() {
    const rows = this.db.prepare('SELECT id FROM store_plugins WHERE enabled = 1').all() as Array<{ id: string }>
    for (const row of rows) {
      const hit = await this.findPluginDir(row.id)
      if (!hit) continue
      await this.mountFromDisk(await readManifest(hit), hit)
    }
  }

  async readInstalledFile(id: string, file: string) {
    if (!isSafeId(id) || !ALLOWED_FILES.has(file)) throw new Error('not found')
    if (!this.isEnabled(id)) throw new Error('not found')
    const hit = await this.findPluginDir(id)
    if (!hit) throw new Error('not found')
    const path = join(hit, file)
    if (!existsSync(path)) throw new Error('not found')
    return readFile(path, 'utf8')
  }

  private async findPluginDir(id: string) {
    if (!existsSync(this.pluginDir)) return null
    const guess = this.pluginPath(id)
    if (existsSync(join(guess, 'manifest.json'))) return guess
    for (const name of await readdir(this.pluginDir)) {
      const dir = join(this.pluginDir, name)
      if (!(await stat(dir)).isDirectory()) continue
      if (!existsSync(join(dir, 'manifest.json'))) continue
      const manifest = await readManifest(dir)
      if (manifest.id === id) return dir
    }
    return null
  }

  private async mountFromDisk(manifest: StoreManifest, dir: string) {
    const hostFile = join(dir, 'host.js')
    const webFile = join(dir, 'web.js')
    const hostCode = existsSync(hostFile) ? (await readFile(hostFile, 'utf8')).trim() : ''
    const hasWeb = existsSync(webFile)
    if (!hostCode && !hasWeb) throw new Error(`plugin ${manifest.id} has neither host nor web`)
    const mod = (hostCode
      ? await importHostFile(hostFile)
      : { name: manifest.id, apply() {} }) as Plugin & { inject?: string[] }
    const entry: CatalogEntry = {
      id: manifest.id,
      name: manifest.name,
      layer: 'capability',
      blurb: manifest.blurb,
      plugin: mod,
      inject: mod.inject,
      togglable: true,
      enabled: true,
      web: hasWeb ? storeWebUrl(manifest.id) : undefined,
      packageName: `store:${manifest.id}`,
    }
    await this.hub().adopt(entry)
  }
}

export async function apply(ctx: Context) {
  const store = new PluginStoreService(ctx, defaultPluginDir(), defaultDbPath(), defaultSandboxDir()).open()
  await store.restore()
  registerPluginCreate(ctx, store)

  ctx.http.route('GET', '/api/plugin-store', async (route) => {
    route.send(200, { items: await store.list() })
  })
  ctx.http.route('POST', '/api/plugin-store/open', async (route) => {
    const payload = (await route.json()) as { id?: string }
    try {
      route.send(200, { item: await store.openPlugin(String(payload?.id ?? '')) })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/plugin-store/close', async (route) => {
    const payload = (await route.json()) as { id?: string }
    try {
      await store.close(String(payload?.id ?? ''))
      route.send(200, { ok: true, items: await store.list() })
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
