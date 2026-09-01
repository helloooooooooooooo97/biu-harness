import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllViewId } from '../catalog-views.ts'
import { viewsChrome } from './views-chrome.ts'

test('views chrome jumps a catalog row to its source table', () => {
  const jump = viewsChrome.openRow?.({
    id: 'x',
    tablePath: '/pages',
    viewId: builtinAllViewId('/pages'),
  })
  assert.deepEqual(jump, { kind: 'table', path: '/pages', viewId: builtinAllViewId('/pages') })
  assert.equal(viewsChrome.openRow?.({ id: 'bare' }), null)
})

test('views chrome locks the catalog from ?source=', () => {
  assert.deepEqual(viewsChrome.lockedFiltersFromSearch?.('?source=%2Fevents'), { tablePath: '/events' })
  assert.deepEqual(viewsChrome.lockedFiltersFromSearch?.(''), {})
})
