/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import type { CatalogEntry } from '@biu/host-hub'
import { PluginStoreService, defaultPluginDir, defaultStatePath } from './index.ts'

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

test('default plugin dir is repo-root .plugin, not nested catalog', () => {
  const dir = defaultPluginDir().replace(/\\/g, '/')
  assert.equal(dir.endsWith('/.plugin') || dir.endsWith('.plugin'), true)
  assert.equal(dir.includes('plugin-catalog'), false)
  assert.equal(dir.includes('.biu'), false)
})

test('default store state is a json file under .plugin', () => {
  const path = defaultStatePath().replace(/\\/g, '/')
  assert.ok(path.endsWith('/.plugin/store.json') || path.endsWith('.plugin/store.json'))
})

test('restore skips a broken enabled plugin and continues', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-root-'))
  const pluginDir = join(dir, '.plugin')
  try {
    const ctx = new Context()
    const { adopted } = stubHub(ctx)
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    await store.create({
      id: 'store-ok',
      name: 'Ok',
      hostJs: `export const name = 'store-ok'\nexport function apply() {}\n`,
    })
    await store.openPlugin('store-ok')
    await store.create({
      id: 'store-bad',
      name: 'Bad',
      hostJs: `export const name = 'store-bad'\nexport function apply() {}\n`,
    })
    await store.openPlugin('store-bad')
    await writeFile(join(pluginDir, 'store-bad', 'host.js'), 'throw new SyntaxError("nope")\n')
    const store2 = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    await store2.restore()
    assert.ok(adopted.includes('store-ok'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('missing .plugin lists no plugins', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-root-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(ctx, join(dir, 'missing'), join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    assert.deepEqual(await store.list(), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('create writes .plugin/<id>/; close keeps code; uninstall deletes .plugin/<id>/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-root-'))
  const pluginDir = join(dir, '.plugin')
  try {
    const ctx = new Context()
    const { adopted, dropped, forks } = stubHub(ctx)
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    const created = await store.create({
      id: 'store-echo',
      name: 'Echo',
      hostJs: `export const name = 'store-echo'\nexport function apply() {}\n`,
    })
    assert.equal(created.pluginPath, join(pluginDir, 'store-echo'))
    const echo = (await store.list()).find((item) => item.id === 'store-echo')
    assert.ok(echo)
    assert.equal(echo.enabled, false)

    const opened = await store.openPlugin('store-echo')
    assert.equal(opened?.enabled, true)
    const saved = JSON.parse(await readFile(join(dir, 'store.json'), 'utf8')) as { enabled: string[] }
    assert.deepEqual(saved.enabled, ['store-echo'])
    assert.deepEqual(adopted, ['store-echo'])
    assert.equal(forks.get('store-echo')?.packageName, 'store:store-echo')
    assert.equal(forks.get('store-echo')?.web, undefined)
    assert.match(await store.readInstalledFile('store-echo', 'host.js'), /store-echo/)

    await store.close('store-echo')
    assert.deepEqual(dropped, ['store-echo'])
    assert.equal((await store.list()).find((item) => item.id === 'store-echo')?.enabled, false)
    await access(join(pluginDir, 'store-echo', 'host.js'))

    await store.uninstall('store-echo')
    assert.equal((await store.list()).find((item) => item.id === 'store-echo'), undefined)
    await assert.rejects(() => access(join(pluginDir, 'store-echo', 'host.js')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('web-only plugin opens without host.js', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-root-'))
  try {
    const ctx = new Context()
    const { forks } = stubHub(ctx)
    const store = new PluginStoreService(ctx, join(dir, '.plugin'), join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    await store.initSandbox({
      id: 'store-banner',
      name: 'Banner',
      webJs: `export const name = 'store-banner-web'\nexport const inject = ['slots']\nexport function apply() {}\n`,
    })
    await assert.rejects(() => store.pack('store-empty'), /sandbox not found/)
    await store.pack('store-banner')
    await store.openPlugin('store-banner')
    assert.equal(forks.get('store-banner')?.web, '/api/plugin-store/files/store-banner/web.js')
    await assert.rejects(() => store.readInstalledFile('store-banner', 'host.js'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
