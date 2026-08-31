import { test } from 'vitest'
import assert from 'node:assert/strict'
import { persistPageWidth, getPageWidth } from './page-width.ts'

test('page width persists full and max', () => {
  persistPageWidth('max')
  assert.equal(getPageWidth(), 'max')
  persistPageWidth('full')
  assert.equal(getPageWidth(), 'full')
  persistPageWidth('max')
  assert.equal(getPageWidth(), 'max')
})
