import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Context, Plugin } from 'cordis'
import { findRepoRoot } from '@biu/host-plugin-loader'
import type { CatalogEntry } from '@biu/host-hub'

export const name = 'plugin-store'
export const inject = ['http', 'hub', 'tools']

export type StoreListing = {
  id: string
  name: string
  blurb: string
  installed: boolean
  running: boolean
  origin: 'fixture' | 'created'
}

export type StoreManifest = {
  id: string
  name: string
  blurb: string
}

export type CreatePluginInput = {
  id: string
  name: string
  blurb?: string
  hostJs: string
  webJs?: string
  install?: boolean
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

export function defaultCreatedDir() {
  return process.env.BIU_PLUGIN_CATALOG_DIR || join(findRepoRoot(), '.biu', 'plugin-catalog')
}

async function readManifest(dir: string): Promise<StoreManifest> {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as StoreManifest
  if (!raw.id || !raw.name) throw new Error(`invalid plugin manifest in ${dir}`)
  return raw
}

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

function createdSlug(id: string) {
  return id
}

const ALLOWED_FILES = new Set(['manifest.json', 'host.js', 'web.js'])

export class PluginStoreService {
  constructor(
    private readonly ctx: Context,
    readonly catalogDir: string,
    readonly dataDir: string,
    readonly createdDir: string = defaultCreatedDir(),
  ) {}

  private hub(): StoreHub {
    return this.ctx.hub as unknown as StoreHub
  }

  async list(): Promise<StoreListing[]> {
    const running = new Set(
      this.hub()
        .snapshot()
        .plugins.filter((row) => row.enabled || row.state === 'active')
        .map((row) => row.id),
    )
    const byId = new Map<string, StoreListing>()
    for (const hit of await this.scanCatalog(this.catalogDir, 'fixture')) {
      byId.set(hit.id, this.toListing(hit, running))
    }
    for (const hit of await this.scanCatalog(this.createdDir, 'created')) {
      byId.set(hit.id, this.toListing(hit, running))
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  }

  async create(input: CreatePluginInput) {
    const id = String(input.id ?? '').trim()
    const displayName = String(input.name ?? '').trim()
    const hostJs = String(input.hostJs ?? '')
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    if (!displayName) throw new Error('plugin name required')
    const compiledHost = await compileStoreJs(hostJs, 'host')
    if (!hasApplyExport(compiledHost)) {
      throw new Error('host.js must export function apply(ctx)')
    }
    const manifest: StoreManifest = {
      id,
      name: displayName,
      blurb: String(input.blurb ?? '').trim() || `${displayName}（agent 写入商店货架）`,
    }
    const dest = join(this.createdDir, createdSlug(id))
    await mkdir(this.createdDir, { recursive: true })
    await rm(dest, { recursive: true, force: true })
    await mkdir(dest, { recursive: true })
    await writeFile(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(join(dest, 'host.js'), compiledHost.endsWith('\n') ? compiledHost : `${compiledHost}\n`)
    const webJs = input.webJs != null && String(input.webJs).trim() ? String(input.webJs) : ''
    if (webJs) {
      const compiledWeb = await compileStoreJs(webJs, 'web')
      await writeFile(join(dest, 'web.js'), compiledWeb.endsWith('\n') ? compiledWeb : `${compiledWeb}\n`)
    }
    const alreadyInstalled = existsSync(join(this.dataDir, id, 'host.js'))
    const shouldInstall = input.install !== false || alreadyInstalled
    const listing = shouldInstall ? await this.install(id) : (await this.list()).find((item) => item.id === id)
    return {
      id,
      origin: 'created' as const,
      catalogPath: dest,
      installed: Boolean(listing?.installed),
      running: Boolean(listing?.running),
      item: listing,
    }
  }

  async install(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const catalogHit = await this.findCatalogById(id)
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

  private toListing(
    hit: StoreManifest & { origin: 'fixture' | 'created' },
    running: Set<string>,
  ): StoreListing {
    const installed = existsSync(join(this.dataDir, hit.id, 'host.js'))
    return {
      id: hit.id,
      name: hit.name,
      blurb: hit.blurb,
      origin: hit.origin,
      installed,
      running: installed && running.has(hit.id),
    }
  }

  private async scanCatalog(root: string, origin: 'fixture' | 'created') {
    if (!existsSync(root)) return []
    const names = await readdir(root)
    const items: Array<StoreManifest & { origin: 'fixture' | 'created'; dir: string }> = []
    for (const name of names.sort()) {
      const dir = join(root, name)
      if (!(await stat(dir)).isDirectory()) continue
      if (!existsSync(join(dir, 'manifest.json'))) continue
      const manifest = await readManifest(dir)
      items.push({ ...manifest, origin, dir })
    }
    return items
  }

  private async findCatalogById(id: string) {
    const created = join(this.createdDir, createdSlug(id))
    if (existsSync(join(created, 'manifest.json'))) return created
    const fixtureGuess = join(this.catalogDir, id.replace(/^store-/, ''))
    if (existsSync(join(fixtureGuess, 'manifest.json'))) return fixtureGuess
    for (const origin of [this.createdDir, this.catalogDir]) {
      for (const hit of await this.scanCatalog(origin, origin === this.createdDir ? 'created' : 'fixture')) {
        if (hit.id === id) return hit.dir
      }
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

async function compileStoreJs(source: string, kind: 'host' | 'web') {
  const trimmed = source.trim()
  if (!trimmed) throw new Error(`${kind}.js is empty`)
  const esbuild = await import('esbuild')
  const result = await esbuild.transform(trimmed, {
    loader: kind === 'web' ? 'tsx' : 'ts',
    format: 'esm',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  })
  let code = result.code.trim()
  if (kind === 'web' && /React\.createElement/.test(code) && !code.includes('globalThis.React')) {
    code = `const React = globalThis.React\n${code}`
  }
  return code
}

function hasApplyExport(code: string) {
  return (
    /\bexport\s+(async\s+)?function\s+apply\b/.test(code) ||
    /\bexport\s+\{[^}]*\bapply\b/.test(code)
  )
}

async function importHostModule(hostFile: string) {
  try {
    return await import(pathToFileURL(hostFile).href)
  } catch {
    const code = await readFile(hostFile, 'utf8')
    return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
  }
}

const PLUGIN_CREATE_DESCRIPTION = [
  '把一段已写好的 Cordis 插件发布到本机插件商店货架（.biu/plugin-catalog），默认同步安装到 .biu/plugin-store 并热加载。',
  '不要改 packages/ 或 cordis.plugins.json。hostJs 必须是 ESM，export const name / export const inject / export function apply(ctx)。',
  'webJs 可选；浏览器里没有 Vite，React 用 globalThis.React，UI 可挂到 slot plugin-store-extras。',
  '可写 TypeScript/TSX，工具会编成纯 JS。id 仅小写字母数字和连字符，例如 store-echo。',
].join('')

export async function apply(ctx: Context) {
  const store = new PluginStoreService(ctx, defaultCatalogDir(), defaultDataDir(), defaultCreatedDir())
  await store.restore()

  ctx.tools.register({
    name: 'plugin_create',
    description: PLUGIN_CREATE_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '插件 id，小写 kebab-case，建议 store- 前缀，如 store-echo',
        },
        name: { type: 'string', description: '商店里显示的名称' },
        blurb: { type: 'string', description: '一行简介' },
        hostJs: {
          type: 'string',
          description: 'Host 半边源码（TS 或 ESM JS），必须 export function apply(ctx)',
        },
        webJs: {
          type: 'string',
          description: '可选 Client 半边源码（TSX/JS）。React 用 globalThis.React',
        },
        install: {
          type: 'boolean',
          description: '写入货架后是否立刻安装运行，默认 true',
        },
      },
      required: ['id', 'name', 'hostJs'],
    },
    execute: async (args) => {
      const result = await store.create({
        id: String(args.id ?? ''),
        name: String(args.name ?? ''),
        blurb: args.blurb != null ? String(args.blurb) : undefined,
        hostJs: String(args.hostJs ?? ''),
        webJs: args.webJs != null ? String(args.webJs) : undefined,
        install: args.install === false ? false : true,
      })
      return JSON.stringify(result)
    },
  })

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
