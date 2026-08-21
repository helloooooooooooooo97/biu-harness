import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolveCatalog } from './resolve-catalog.ts'

test('resolveCatalog loads greeter from cordis.plugins.json package', async () => {
  const catalog = await resolveCatalog()
  const greeter = catalog.find((item) => item.id === 'greeter')
  assert.ok(greeter)
  assert.equal(greeter?.packageName, '@hmr/greeter-host')
  assert.equal(greeter?.ui, '@hmr/greeter-ui')
  assert.equal(greeter?.enabled, true)
  assert.equal(typeof greeter?.plugin, 'object')
})
