import { test } from 'vitest'
import assert from 'node:assert/strict'
import { normalizeCollectionPath } from './paths.ts'

test('normalizeCollectionPath strips trailing slash and adds a leading one', () => {
  assert.equal(normalizeCollectionPath('/plugins/'), '/plugins')
  assert.equal(normalizeCollectionPath('plugins'), '/plugins')
  assert.equal(normalizeCollectionPath('/'), '/')
})
