import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllViewId } from '../catalog-views.ts'
import { openRegisteredRow } from './collection-nav.ts'

test('views catalog rows jump to the source table', () => {
  let path = ''
  let viewId = ''
  const handled = openRegisteredRow(
    '/views',
    { id: 'x', tablePath: '/pages', viewId: builtinAllViewId('/pages') },
    {
      table: (next, id) => {
        path = next
        viewId = id ?? ''
      },
      record: () => undefined,
    },
  )
  assert.equal(handled, true)
  assert.equal(path, '/pages')
  assert.equal(viewId, builtinAllViewId('/pages'))
})

test('tag and ordinary tables open as normal records', () => {
  assert.equal(
    openRegisteredRow('/supertags', { id: 'dp', title: '动态规划' }, { table: () => undefined, record: () => undefined }),
    false,
  )
  assert.equal(
    openRegisteredRow('/pages', { id: 'home' }, { table: () => undefined, record: () => undefined }),
    false,
  )
})
