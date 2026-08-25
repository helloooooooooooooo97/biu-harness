import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveCatalog } from './resolve-catalog.ts'
import { rootDirFrom } from '../../../host/cordis-plugins.ts'

test('resolveCatalog loads only packages declared in cordis.plugins.json', async () => {
  const root = rootDirFrom()
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
