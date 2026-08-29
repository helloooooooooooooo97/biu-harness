import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  getPreviewTotal,
  nextPreviewLimit,
  normalizeRecordEmoji,
  previewCacheKey,
  recordPreviewLabel,
  rememberPreviewTotal,
  SIDEBAR_PREVIEW_PAGE,
  tableTotalKey,
  viewTotalKey,
} from './sidebar-preview.ts'

test('record emoji keeps a short grapheme and clears empty', () => {
  assert.equal(normalizeRecordEmoji(' 🔥 '), '🔥')
  assert.equal(normalizeRecordEmoji(''), '')
  assert.equal(normalizeRecordEmoji('⭐🚀💥'), '⭐🚀')
})

test('record preview prefers label field then title', () => {
  assert.equal(recordPreviewLabel({ id: '1', title: '封面' }, 'title'), '封面')
  assert.equal(recordPreviewLabel({ id: '1', name: '插件' }), '插件')
  assert.equal(recordPreviewLabel({ id: 'abc' }), 'abc')
})

test('preview cache includes view query and filters', () => {
  const a = previewCacheKey('/tasks', { id: 'v1', sortField: 'id', sortDir: 'asc', filters: {}, query: '' })
  const b = previewCacheKey('/tasks', { id: 'v1', sortField: 'id', sortDir: 'asc', filters: { status: 'open' }, query: '' })
  assert.notEqual(a, b)
})

test('table total key is not a saved view key', () => {
  const view = { id: 'v1', sortField: 'id', sortDir: 'asc' as const, filters: {}, query: '' }
  assert.notEqual(tableTotalKey('/tasks'), viewTotalKey('/tasks', view))
  rememberPreviewTotal(viewTotalKey('/tasks', view), 12)
  assert.equal(getPreviewTotal(viewTotalKey('/tasks', view)), 12)
})

test('preview pages stay small and stop at max', () => {
  assert.equal(nextPreviewLimit(0, 500), SIDEBAR_PREVIEW_PAGE)
  assert.equal(nextPreviewLimit(20, 25), 5)
  assert.equal(nextPreviewLimit(100, 500), 0)
  assert.equal(nextPreviewLimit(25, 25), 0)
})
