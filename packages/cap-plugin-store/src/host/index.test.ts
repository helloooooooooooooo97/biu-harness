import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import { PluginStoreService, defaultCatalogDir } from './index.ts'

test('catalog dir contains the prebuilt hello fixture', () => {
  const dir = defaultCatalogDir()
  assert.equal(dir.endsWith('fixtures'), true)
  assert.equal(dirname(fileURLToPath(import.meta.url)).includes('cap-plugin-store'), true)
})

test('install copies prebuilt js and adopt; uninstall drops it', async () => {
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
    const store = new PluginStoreService(ctx, defaultCatalogDir(), dataDir)
    const listed = await store.list()
    const hello = listed.find((item) => item.id === 'store-hello')
    assert.ok(hello, 'hello fixture should be listed')
    assert.equal(hello.installed, false)

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
  }
})
