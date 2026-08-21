import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveCatalog } from './resolve-catalog.ts'

test('resolveCatalog loads only packages declared in cordis.plugins.json', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const raw = JSON.parse(await readFile(join(root, 'cordis.plugins.json'), 'utf8')) as {
    plugins: Array<{ id: string; package: string; ui?: string }>
  }
  const catalog = await resolveCatalog()
  for (const item of raw.plugins) {
    const entry = catalog.find((row) => row.id === item.id)
    assert.ok(entry, `missing ${item.id}`)
    assert.equal(entry?.packageName, item.package)
    assert.equal(entry?.ui, item.ui)
    assert.equal(typeof entry?.plugin, 'object')
  }
})
