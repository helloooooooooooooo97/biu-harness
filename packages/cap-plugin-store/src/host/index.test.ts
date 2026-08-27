/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import { PluginStoreService, defaultCatalogDir } from './index.ts'
import { writePluginToCatalog } from './plugin-create.ts'

test('default catalog is repo-root .biu/plugin-catalog', () => {
  const dir = defaultCatalogDir().replace(/\\/g, '/')
  assert.equal(dir.endsWith('.biu/plugin-catalog'), true)
  assert.equal(dirname(fileURLToPath(import.meta.url)).includes('cap-plugin-store'), true)
})

test('bundled hello in .biu/plugin-catalog is listable', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  try {
    const ctx = new Context()
    ;(ctx as unknown as { hub: unknown }).hub = {
      async adopt() {},
      async drop() {},
      snapshot() {
        return { plugins: [] }
      },
    }
    const store = new PluginStoreService(ctx, defaultCatalogDir(), dataDir)
    const hello = (await store.list()).find((item) => item.id === 'store-hello')
    assert.ok(hello, 'store-hello should ship in .biu/plugin-catalog')
    assert.equal(hello.installed, false)
    assert.equal(hello.name, 'Hello')
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('missing .biu catalog lists no plugins', async () => {
  const catalogDir = join(tmpdir(), `missing-plugin-catalog-${Date.now()}`)
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  try {
    const ctx = new Context()
    ;(ctx as unknown as { hub: unknown }).hub = {
      async adopt() {},
      async drop() {},
      snapshot() {
        return { plugins: [] }
      },
    }
    const store = new PluginStoreService(ctx, catalogDir, dataDir)
    assert.deepEqual(await store.list(), [])
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('install copies catalog js and adopt; uninstall drops it', async () => {
  const catalogDir = await mkdtemp(join(tmpdir(), 'plugin-catalog-'))
  const dataDir = await mkdtemp(join(tmpdir(), 'plugin-store-'))
  const adopted: string[] = []
  const dropped: string[] = []
  const forks = new Map<string, CatalogEntry>()
  try {
    const ctx = new Context()
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
    await writePluginToCatalog(catalogDir, {
      id: 'store-echo',
      name: 'Echo',
      hostJs: `export const name = 'store-echo'\nexport function apply() {}\n`,
    })
    const store = new PluginStoreService(ctx, catalogDir, dataDir)
    const listed = await store.list()
    const echo = listed.find((item) => item.id === 'store-echo')
    assert.ok(echo)
    assert.equal(echo.installed, false)

    const installed = await store.install('store-echo')
    assert.equal(installed?.installed, true)
    assert.equal(installed?.running, true)
    assert.deepEqual(adopted, ['store-echo'])
    const entry = forks.get('store-echo')
    assert.equal(entry?.packageName, 'store:store-echo')
    assert.equal(entry?.web, '/api/plugin-store/files/store-echo/web.js')
    const hostJs = await store.readInstalledFile('store-echo', 'host.js')
    assert.match(hostJs, /store-echo/)
    assert.doesNotMatch(hostJs, /from ['"]typescript/)

    await store.uninstall('store-echo')
    assert.deepEqual(dropped, ['store-echo'])
    const after = (await store.list()).find((item) => item.id === 'store-echo')
    assert.equal(after?.installed, false)
    await access(join(catalogDir, 'echo', 'host.js'))
  } finally {
    await rm(catalogDir, { recursive: true, force: true })
    await rm(dataDir, { recursive: true, force: true })
  }
})
