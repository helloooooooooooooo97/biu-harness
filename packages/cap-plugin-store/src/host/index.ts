import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Context, Plugin } from 'cordis'
import { findRepoRoot } from '@biu/host-plugin-loader'
import type { CatalogEntry } from '@biu/host-hub'
import { registerPluginCreate } from './plugin-create.ts'

export const name = 'plugin-store'
export const inject = ['http', 'hub', 'tools']

export type StoreListing = {
  id: string
  name: string
  blurb: string
  installed: boolean
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

export function storeWebUrl(id: string) {
  return `/api/plugin-store/files/${encodeURIComponent(id)}/web.js`
}

export function defaultCatalogDir() {
  return join(findRepoRoot(), 'packages/cap-plugin-store/fixtures')
}

export function defaultDataDir() {
  return process.env.BIU_PLUGIN_STORE_DIR || join(findRepoRoot(), '.biu', 'plugin-store')
}

async function readManifest(dir: string): Promise<StoreManifest> {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as StoreManifest
  if (!raw.id || !raw.name) throw new Error(`invalid plugin manifest in ${dir}`)
  return raw
}

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

const ALLOWED_FILES = new Set(['manifest.json', 'host.js', 'web.js'])

export class PluginStoreService {
  constructor(
    private readonly ctx: Context,
    readonly catalogDir: string,
    readonly dataDir: string,
  ) {}

  private hub(): StoreHub {
    return this.ctx.hub as unknown as StoreHub
  }

  async list(): Promise<StoreListing[]> {
    const names = existsSync(this.catalogDir) ? await readdir(this.catalogDir) : []
    const running = new Set(
      this.hub()
        .snapshot()
        .plugins.filter((row) => row.enabled || row.state === 'active')
        .map((row) => row.id),
    )
    const items: StoreListing[] = []
    for (const name of names.sort()) {
      const dir = join(this.catalogDir, name)
      if (!(await stat(dir)).isDirectory()) continue
      const manifest = await readManifest(dir)
      const installed = existsSync(join(this.dataDir, manifest.id, 'host.js'))
      items.push({
        ...manifest,
        installed,
        running: installed && running.has(manifest.id),
      })
    }
    return items
  }

  async install(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const source = join(this.catalogDir, id.replace(/^store-/, ''))
    const catalogHit = existsSync(join(source, 'manifest.json'))
      ? source
      : await this.findCatalogById(id)
    if (!catalogHit) throw new Error(`unknown store plugin: ${id}`)
    const manifest = await readManifest(catalogHit)
    const dest = join(this.dataDir, manifest.id)
    await mkdir(this.dataDir, { recursive: true })
    await rm(dest, { recursive: true, force: true })
    await mkdir(dest, { recursive: true })
    for (const file of ALLOWED_FILES) {
      const from = join(catalogHit, file)
      if (!existsSync(from)) continue
      await cp(from, join(dest, file))
    }
    await this.mountInstalled(manifest)
    await this.writeIndex()
    return (await this.list()).find((item) => item.id === manifest.id)
  }

  async uninstall(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    await rm(join(this.dataDir, id), { recursive: true, force: true })
    await this.writeIndex()
  }

  async restore() {
    if (!existsSync(this.dataDir)) return
    const names = await readdir(this.dataDir)
    for (const name of names) {
      const dir = join(this.dataDir, name)
      if (!(await stat(dir)).isDirectory()) continue
      if (!existsSync(join(dir, 'manifest.json'))) continue
      const manifest = await readManifest(dir)
      await this.mountInstalled(manifest)
    }
  }

  async readInstalledFile(id: string, file: string) {
    if (!isSafeId(id) || !ALLOWED_FILES.has(file)) throw new Error('not found')
    const path = join(this.dataDir, id, file)
    if (!existsSync(path)) throw new Error('not found')
    return readFile(path, 'utf8')
  }

  private async findCatalogById(id: string) {
    if (!existsSync(this.catalogDir)) return null
    for (const name of await readdir(this.catalogDir)) {
      const dir = join(this.catalogDir, name)
      if (!(await stat(dir)).isDirectory()) continue
      if (!existsSync(join(dir, 'manifest.json'))) continue
      const manifest = await readManifest(dir)
      if (manifest.id === id) return dir
    }
    return null
  }

  private async mountInstalled(manifest: StoreManifest) {
    const hostFile = join(this.dataDir, manifest.id, 'host.js')
    if (!existsSync(hostFile)) throw new Error(`missing host.js for ${manifest.id}`)
    const mod = (await importHostModule(hostFile)) as Plugin & { inject?: string[] }
    const entry: CatalogEntry = {
      id: manifest.id,
      name: manifest.name,
      layer: 'capability',
      blurb: manifest.blurb,
      plugin: mod,
      inject: mod.inject,
      togglable: true,
      enabled: true,
      web: storeWebUrl(manifest.id),
      packageName: `store:${manifest.id}`,
    }
    await this.hub().adopt(entry)
  }

  private async writeIndex() {
    const items = existsSync(this.dataDir) ? await readdir(this.dataDir) : []
    await mkdir(this.dataDir, { recursive: true })
    await writeFile(join(this.dataDir, 'index.json'), JSON.stringify({ items }, null, 2))
  }
}

async function importHostModule(hostFile: string) {
  try {
    return await import(pathToFileURL(hostFile).href)
  } catch {
    const code = await readFile(hostFile, 'utf8')
    return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
  }
}

export async function apply(ctx: Context) {
  const store = new PluginStoreService(ctx, defaultCatalogDir(), defaultDataDir())
  await store.restore()
  registerPluginCreate(ctx, store.catalogDir)

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
