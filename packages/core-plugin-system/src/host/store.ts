import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Service, type Context, type Plugin } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import {
  buildStoreManifest,
  bundleStoreEntry,
  compileStoreModule,
  findEntry,
  HOST_ENTRIES,
  parseStoreManifest,
  readSandboxManifest,
  registerPluginCreate,
  WEB_ENTRIES,
  type PluginCreateInput,
  type StoreManifestFields,
} from './plugin-create.ts'
import type { StoreShell } from '../shell.ts'

export type StoreListing = {
  id: string
  name: string
  blurb: string
  tags: string[]
  author: string
  authorUrl: string
  enabled: boolean
  running: boolean
  bytes: number
  createdAt: number
  updatedAt: number
  lastRunAt: number | null
  hasHost: boolean
  hasWeb: boolean
  shell: StoreShell
}

export type StoreManifest = StoreManifestFields

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

export function defaultStatePath() {
  return process.env.BIU_PLUGIN_STATE || join(process.cwd(), '.plugin', 'store.json')
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

async function pluginDirStats(dir: string): Promise<Pick<StoreListing, 'bytes' | 'createdAt' | 'updatedAt' | 'hasHost' | 'hasWeb'>> {
  const names = await readdir(dir)
  let bytes = 0
  let createdAt = Number.MAX_SAFE_INTEGER
  let updatedAt = 0
  for (const name of names) {
    const file = join(dir, name)
    const st = await stat(file)
    if (!st.isFile()) continue
    bytes += st.size
    const born = Math.floor(st.birthtimeMs || st.ctimeMs || st.mtimeMs)
    const modified = Math.floor(st.mtimeMs)
    if (born < createdAt) createdAt = born
    if (modified > updatedAt) updatedAt = modified
  }
  return {
    bytes,
    createdAt: createdAt === Number.MAX_SAFE_INTEGER ? updatedAt : createdAt,
    updatedAt,
    hasHost: existsSync(join(dir, 'host.js')),
    hasWeb: existsSync(join(dir, 'web.js')),
  }
}

async function readManifest(dir: string): Promise<StoreManifest> {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as unknown
  try {
    return parseStoreManifest(raw)
  } catch {
    throw new Error(`invalid plugin manifest in ${dir}`)
  }
}

type StoreState = { enabled: string[]; lastRunAt: Record<string, number> }

function emptyState(): StoreState {
  return { enabled: [], lastRunAt: {} }
}

function parseState(raw: unknown): StoreState {
  if (!raw || typeof raw !== 'object') return emptyState()
  const enabled = (raw as { enabled?: unknown }).enabled
  const lastRaw = (raw as { lastRunAt?: unknown }).lastRunAt
  const lastRunAt: Record<string, number> = {}
  if (lastRaw && typeof lastRaw === 'object') {
    for (const [id, ts] of Object.entries(lastRaw as Record<string, unknown>)) {
      const n = Number(ts)
      if (/^[a-z][a-z0-9-]{1,40}$/.test(id) && Number.isFinite(n) && n > 0) lastRunAt[id] = Math.floor(n)
    }
  }
  if (!Array.isArray(enabled)) return { enabled: [], lastRunAt }
  return {
    enabled: [...new Set(enabled.map((id) => String(id)).filter((id) => /^[a-z][a-z0-9-]{1,40}$/.test(id)))].sort(),
    lastRunAt,
  }
}

export class PluginStoreService extends Service {
  private state: StoreState = emptyState()
  private listCache: StoreListing[] | null = null

  constructor(
    ctx: Context,
    readonly pluginDir: string,
    private readonly statePath: string,
    readonly sandboxDir: string = defaultSandboxDir(),
  ) {
    super(ctx, 'pluginStore')
  }

  open() {
    mkdirSync(dirname(this.statePath), { recursive: true })
    this.state = this.readState()
    return this
  }

  private hub(): StoreHub {
    return this.ctx.hub as unknown as StoreHub
  }

  private readState(): StoreState {
    if (!existsSync(this.statePath)) return emptyState()
    try {
      return parseState(JSON.parse(readFileSync(this.statePath, 'utf8')))
    } catch {
      return emptyState()
    }
  }

  private writeState() {
    this.invalidateList()
    mkdirSync(dirname(this.statePath), { recursive: true })
    writeFileSync(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`)
  }

  private invalidateList() {
    this.listCache = null
  }

  private isEnabled(id: string) {
    return this.state.enabled.includes(id)
  }

  private setEnabled(id: string, enabled: boolean) {
    const next = new Set(this.state.enabled)
    if (enabled) next.add(id)
    else next.delete(id)
    this.state = { enabled: [...next].sort(), lastRunAt: this.state.lastRunAt }
    this.writeState()
  }

  private touchLastRun(id: string) {
    this.state = { ...this.state, lastRunAt: { ...this.state.lastRunAt, [id]: Date.now() } }
    this.writeState()
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
    this.invalidateList()
    const dest = this.pluginPath(id)
    mkdirSync(dest, { recursive: true })
    const existing = existsSync(join(dest, 'manifest.json')) ? await readManifest(dest).catch(() => undefined) : undefined
    const manifest = buildStoreManifest(input, existing)
    await writeFile(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    if (hostJs) await writeFile(join(dest, 'host.js'), await compileStoreModule(hostJs, 'host'))
    else if (existsSync(join(dest, 'host.js'))) await rm(join(dest, 'host.js'))
    if (webSrc) await writeFile(join(dest, 'web.js'), await compileStoreModule(webSrc, 'web'))
    else if (existsSync(join(dest, 'web.js'))) await rm(join(dest, 'web.js'))
    if (this.isEnabled(id)) await this.mountFromDisk(manifest, dest)
    return { id, pluginPath: dest }
  }

  /** 在 .plugin-dev/<id>/ 开沙箱，不写入已安装目录。 */
  async initSandbox(input: PluginCreateInput) {
    const id = String(input.id ?? '').trim()
    const name = String(input.name ?? '').trim()
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    if (!name) throw new Error('plugin name required')
    const dest = this.sandboxPath(id)
    mkdirSync(dest, { recursive: true })
    const existing = existsSync(join(dest, 'manifest.json')) ? await readManifest(dest).catch(() => undefined) : undefined
    const manifest = buildStoreManifest(input, existing)
    await writeFile(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
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
    this.invalidateList()
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
    if (this.listCache) return this.listCache
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
      const stats = await pluginDirStats(dir)
      items.push({
        ...manifest,
        enabled,
        running: running.has(manifest.id),
        bytes: stats.bytes,
        createdAt: manifest.createdAt || stats.createdAt,
        updatedAt: stats.updatedAt,
        lastRunAt: this.state.lastRunAt[manifest.id] ?? null,
        hasHost: stats.hasHost,
        hasWeb: stats.hasWeb,
      })
    }
    this.listCache = items
    return items
  }

  async openPlugin(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    const hit = await this.findPluginDir(id)
    if (!hit) throw new Error(`unknown store plugin: ${id}`)
    const manifest = await readManifest(hit)
    this.setEnabled(manifest.id, true)
    this.touchLastRun(manifest.id)
    await this.mountFromDisk(manifest, hit)
    this.invalidateList()
    return (await this.list()).find((item) => item.id === manifest.id)
  }

  /** 关闭：停运行，.plugin 代码留着。 */
  async close(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    this.setEnabled(id, false)
    this.invalidateList()
  }

  /** 卸载：停运行，并删掉 .plugin/<id>/ 代码。 */
  async uninstall(id: string) {
    if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
    await this.hub().drop(id)
    this.setEnabled(id, false)
    const hit = await this.findPluginDir(id)
    if (hit) await rm(hit, { recursive: true, force: true })
    this.invalidateList()
    const lastRunAt = { ...this.state.lastRunAt }
    delete lastRunAt[id]
    this.state = { ...this.state, lastRunAt }
    this.writeState()
  }

  async restore() {
    for (const id of this.state.enabled) {
      const hit = await this.findPluginDir(id)
      if (!hit) continue
      try {
        await this.mountFromDisk(await readManifest(hit), hit)
      } catch (error) {
        this.ctx.logger('core-plugin-system').error(error)
      }
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

export async function openStore(ctx: Context) {
  const store = new PluginStoreService(ctx, defaultPluginDir(), defaultStatePath(), defaultSandboxDir()).open()
  try {
    await store.restore()
  } catch (error) {
    ctx.logger('core-plugin-system').error(error)
  }
  registerPluginCreate(ctx, store)

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
  return store
}

declare module 'cordis' {
  interface Context {
    pluginStore: PluginStoreService
  }
}
