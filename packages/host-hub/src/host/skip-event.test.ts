import { test } from 'vitest'
import assert from 'node:assert/strict'
import { skipHubEvent } from './index.ts'

test('hub event bus drops heartbeat and route-register noise', () => {
  assert.equal(skipHubEvent('clock/tick'), true)
  assert.equal(skipHubEvent('hub/change'), true)
  assert.equal(skipHubEvent('llm/stream'), true)
  assert.equal(skipHubEvent('internal/status'), true)
  assert.equal(skipHubEvent('database/change'), false)
  assert.equal(skipHubEvent('session/event', [{ event: { type: 'assistant/chunk' } }]), true)
  assert.equal(skipHubEvent('session/event', [{ event: { type: 'tool/call' } }]), false)
})
