/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import * as tools from '@biu/host-tools'
import { PluginStoreService, defaultCatalogDir } from './index.ts'

function stubHub(ctx: Context) {
  const adopted: string[] = []
  const dropped: string[] = []
  const forks = new Map<string, CatalogEntry>()
  ;(ctx as unknown as { hub: unknown }).hub = {
    async adopt(entry: CatalogEntry) {
      forks.set(entry.id, entry)
      adopted.push(entry.id)
    },
    async drop(id: string) {
      forks.delete(id)
      dropped.push(id)
    },
    snapshot() {
      return {
        plugins: [...forks.values()].map((entry) => ({
          id: entry.id,
          enabled: true,
          state: 'active',
          web: entry.web,
        })),
      }
    },
  }
  return { adopted, dropped, forks }
}

test('catalog dir contains the prebuilt hello fixture', () => {
  const dir = defaultCatalogDir()
  assert.equal(dir.endsWith('fixtures'), true)
  assert.equal(dirname(fileURLToPath(import.meta.url)).includes('cap-plugin-store'), true)
})

test('install copies prebuilt js and adopt; uninstall drops it', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  const createdDir = await mkdtemp(join(tmpdir(), 'plugin-catalog-'))
  try {
    const ctx = new Context()
    const { adopted, dropped, forks } = stubHub(ctx)
    const store = new PluginStoreService(ctx, defaultCatalogDir(), dataDir, createdDir)
    const listed = await store.list()
    const hello = listed.find((item) => item.id === 'store-hello')
    assert.ok(hello, 'hello fixture should be listed')
    assert.equal(hello.installed, false)
    assert.equal(hello.origin, 'fixture')

    const installed = await store.install('store-hello')
    assert.equal(installed?.installed, true)
    assert.equal(installed?.running, true)
    assert.deepEqual(adopted, ['store-hello'])
    const entry = forks.get('store-hello')
    assert.equal(entry?.packageName, 'store:store-hello')
    assert.equal(entry?.web, '/api/plugin-store/files/store-hello/web.js')
    const hostJs = await store.readInstalledFile('store-hello', 'host.js')
    assert.match(hostJs, /store-hello/)
    assert.doesNotMatch(hostJs, /from ['"]typescript/)

    await store.uninstall('store-hello')
    assert.deepEqual(dropped, ['store-hello'])
    const after = (await store.list()).find((item) => item.id === 'store-hello')
    assert.equal(after?.installed, false)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
    await rm(createdDir, { recursive: true, force: true })
  }
})

test('create writes catalog overlay, compiles TS, and installs', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  const createdDir = await mkdtemp(join(tmpdir(), 'plugin-catalog-'))
  try {
    const ctx = new Context()
    const { adopted } = stubHub(ctx)
    const store = new PluginStoreService(ctx, defaultCatalogDir(), dataDir, createdDir)
    const result = await store.create({
      id: 'store-echo',
      name: 'Echo',
      blurb: 'agent 写的回声插件',
      hostJs: `
        export const name = 'store-echo'
        export const inject = ['http']
        export function apply(ctx: { http: { route: (m: string, p: string, h: (r: { send: (s: number, b: unknown) => void }) => void) => void } }) {
          ctx.http.route('GET', '/api/store-echo', (route) => {
            route.send(200, { ok: true })
          })
        }
      `,
    })
    assert.equal(result.id, 'store-echo')
    assert.equal(result.installed, true)
    assert.equal(result.origin, 'created')
    assert.deepEqual(adopted, ['store-echo'])
    const listed = (await store.list()).find((item) => item.id === 'store-echo')
    assert.equal(listed?.origin, 'created')
    assert.equal(listed?.installed, true)
    const hostJs = await readFile(join(createdDir, 'store-echo', 'host.js'), 'utf8')
    assert.match(hostJs, /\bapply\b/)
    assert.doesNotMatch(hostJs, /ctx: \{/)
    const fixture = (await store.list()).find((item) => item.id === 'store-hello')
    assert.equal(fixture?.origin, 'fixture')
  } finally {
    await rm(dataDir, { recursive: true, force: true })
    await rm(createdDir, { recursive: true, force: true })
  }
})

test('plugin_create tool writes into the created catalog', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  const createdDir = await mkdtemp(join(tmpdir(), 'plugin-catalog-'))
  const prevStore = process.env.BIU_PLUGIN_STORE_DIR
  const prevCatalog = process.env.BIU_PLUGIN_CATALOG_DIR
  process.env.BIU_PLUGIN_STORE_DIR = dataDir
  process.env.BIU_PLUGIN_CATALOG_DIR = createdDir
  try {
    const ctx = new Context()
    stubHub(ctx)
    ;(ctx as unknown as { http: { route: () => void } }).http = { route: () => undefined }
    await ctx.plugin(tools)
    const storeMod = await import('./index.ts')
    await storeMod.apply(ctx)
    assert.equal(ctx.tools.catalog().some((item) => item.name === 'plugin_create'), true)
    const raw = await ctx.tools.invoke('plugin_create', {
      id: 'store-ping',
      name: 'Ping',
      hostJs: `
        export const name = 'store-ping'
        export const inject = []
        export function apply() {}
      `,
    })
    const parsed = JSON.parse(String(raw)) as { id: string; installed: boolean }
    assert.equal(parsed.id, 'store-ping')
    assert.equal(parsed.installed, true)
  } finally {
    if (prevStore === undefined) delete process.env.BIU_PLUGIN_STORE_DIR
    else process.env.BIU_PLUGIN_STORE_DIR = prevStore
    if (prevCatalog === undefined) delete process.env.BIU_PLUGIN_CATALOG_DIR
    else process.env.BIU_PLUGIN_CATALOG_DIR = prevCatalog
    await rm(dataDir, { recursive: true, force: true })
    await rm(createdDir, { recursive: true, force: true })
  }
})
