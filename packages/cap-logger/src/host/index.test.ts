import { test } from 'vitest'
import assert from 'node:assert/strict'
import { shouldLogDispatch } from './index.ts'

test('logger skips heartbeat and hub/change so the console stays readable', () => {
  assert.equal(shouldLogDispatch('clock/tick'), false)
  assert.equal(shouldLogDispatch('hub/change'), false)
  assert.equal(shouldLogDispatch('internal/status'), false)
  assert.equal(shouldLogDispatch('database/change'), true)
})
