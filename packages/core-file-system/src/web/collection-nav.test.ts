import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllViewId, builtinTagViewId } from '../catalog-views.ts'
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

test('tag catalog rows open the collect view; stamp rows open the source record', () => {
  let tablePath = ''
  let viewId = ''
  const tag = openRegisteredRow(
    '/supertags',
    { id: 'dp', title: '动态规划' },
    {
      table: (path, id) => {
        tablePath = path
        viewId = id ?? ''
      },
      record: () => undefined,
    },
  )
  assert.equal(tag, true)
  assert.equal(tablePath, '/supertags')
  assert.equal(viewId, builtinTagViewId('dp'))

  let collection = ''
  let recordId = ''
  const stamp = openRegisteredRow(
    '/supertags',
    { id: 'pages::home', tablePath: '/pages', sourceId: 'home' },
    {
      table: () => undefined,
      record: (id, col) => {
        recordId = id
        collection = col ?? ''
      },
    },
  )
  assert.equal(stamp, true)
  assert.equal(collection, '/pages')
  assert.equal(recordId, 'home')
})

test('ordinary tables are not intercepted', () => {
  assert.equal(
    openRegisteredRow('/pages', { id: 'home' }, { table: () => undefined, record: () => undefined }),
    false,
  )
})
