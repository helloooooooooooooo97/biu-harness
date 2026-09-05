import { test } from 'vitest'
import assert from 'node:assert/strict'
import { shouldNavigateToSession } from './composer-nav.ts'

test('stays on module routes after a chat turn', () => {
  assert.equal(shouldNavigateToSession('/pages', 'abc'), false)
  assert.equal(shouldNavigateToSession('/tasks', 'abc'), false)
  assert.equal(shouldNavigateToSession('/database', 'abc'), false)
  assert.equal(shouldNavigateToSession('/database/pages/view/x', 'abc'), false)
  assert.equal(shouldNavigateToSession('/database/pages/record/rec-1', 'abc'), false)
  assert.equal(shouldNavigateToSession('/', 'abc'), true)
  assert.equal(shouldNavigateToSession('/s/other', 'abc'), true)
  assert.equal(shouldNavigateToSession('/s/abc', 'abc'), false)
})
