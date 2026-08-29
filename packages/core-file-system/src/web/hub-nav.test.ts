import { test } from 'vitest'
import assert from 'node:assert/strict'
import { collectionFromLocation, navCollections, normalizeNavPath } from './hub-nav.ts'
import type { CollectionInfo } from '@biu/type-file-system'

function row(id: string, order: number, route = `/${id}`): CollectionInfo {
  return {
    id,
    path: `/${id}`,
    kind: 'collection',
    label: id,
    view: { moduleId: id, route, title: id, order },
  }
}

test('navCollections sorts by view order', () => {
  assert.deepEqual(
    navCollections([row('page', 25, '/pages'), row('plugins', 30, '/plugins'), row('tasks-2', 21, '/tasks-2')]).map((item) => item.id),
    ['tasks-2', 'page', 'plugins'],
  )
})

test('collectionFromLocation matches view route and falls back to first', () => {
  const rows = [row('page', 25, '/pages'), row('plugins', 30, '/plugins')]
  assert.equal(collectionFromLocation(rows, '/plugins')?.id, 'plugins')
  assert.equal(collectionFromLocation(rows, '/pages/extra')?.id, 'page')
  assert.equal(collectionFromLocation(rows, '/database')?.id, 'page')
})

test('normalizeNavPath strips trailing slash', () => {
  assert.equal(normalizeNavPath('/pages/'), '/pages')
})
