/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import { PluginStoreService, defaultDbPath } from './index.ts'

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

test('default db is process cwd .cordis/plugins.sqlite', () => {
  const path = defaultDbPath().replace(/\\/g, '/')
  assert.equal(path.endsWith('.cordis/plugins.sqlite'), true)
})

test('empty sqlite lists no plugins until hello is seeded', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-db-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(ctx, join(dir, 'plugins.sqlite')).open()
    assert.deepEqual(await store.list(), [])
    store.ensureHello()
    const hello = (await store.list()).find((item) => item.id === 'store-hello')
    assert.ok(hello)
    assert.equal(hello.installed, false)
    assert.equal(hello.name, 'Hello')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('create writes sqlite; install toggles enabled and adopt; uninstall keeps the row', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-db-'))
  try {
    const ctx = new Context()
    const { adopted, dropped, forks } = stubHub(ctx)
    const store = new PluginStoreService(ctx, join(dir, 'plugins.sqlite')).open()
    await store.create({
      id: 'store-echo',
      name: 'Echo',
      hostJs: `export const name = 'store-echo'\nexport function apply() {}\n`,
    })
    const echo = (await store.list()).find((item) => item.id === 'store-echo')
    assert.ok(echo)
    assert.equal(echo.installed, false)

    const installed = await store.install('store-echo')
    assert.equal(installed?.installed, true)
    assert.equal(installed?.running, true)
    assert.deepEqual(adopted, ['store-echo'])
    const entry = forks.get('store-echo')
    assert.equal(entry?.packageName, 'store:store-echo')
    assert.equal(entry?.web, undefined)
    const hostJs = await store.readInstalledFile('store-echo', 'host.js')
    assert.match(hostJs, /store-echo/)

    await store.uninstall('store-echo')
    assert.deepEqual(dropped, ['store-echo'])
    const after = (await store.list()).find((item) => item.id === 'store-echo')
    assert.equal(after?.installed, false)
    assert.equal(after?.name, 'Echo')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('web-only plugin installs without host.js', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-db-'))
  try {
    const ctx = new Context()
    const { forks } = stubHub(ctx)
    const store = new PluginStoreService(ctx, join(dir, 'plugins.sqlite')).open()
    await store.create({
      id: 'store-banner',
      name: 'Banner',
      webJs: `export const name = 'store-banner-web'\nexport const inject = ['slots']\nexport function apply() {}\n`,
    })
    await assert.rejects(() => store.create({ id: 'store-empty', name: 'Empty' }), /hostJs or webJs/)
    const installed = await store.install('store-banner')
    assert.equal(installed?.installed, true)
    assert.equal(forks.get('store-banner')?.web, '/api/plugin-store/files/store-banner/web.js')
    const webJs = await store.readInstalledFile('store-banner', 'web.js')
    assert.match(webJs, /store-banner-web/)
    await assert.rejects(() => store.readInstalledFile('store-banner', 'host.js'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
