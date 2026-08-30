import { test } from 'vitest'
import assert from 'node:assert/strict'
import { nameFromSessionMascot, sessionDisplayTitle } from './index.ts'

test('mascot names encode color, shape and eye', () => {
  assert.equal(nameFromSessionMascot({ shape: 'blob', color: 'blue', eye: 0 }), '小蓝团爱')
  assert.equal(nameFromSessionMascot({ shape: 'cloud', color: 'cyan', eye: 2 }), '小青云新')
  assert.match(nameFromSessionMascot({ shape: 'leaf', color: 'red', eye: 1 }), /^小赤叶/)
})

test('untitled empty session uses the mascot name, not the id prefix', () => {
  const id = 'c51b7c1d-aaaa-bbbb-cccc-ddddeeeeffff'
  assert.equal(
    sessionDisplayTitle({
      id,
      events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
      mascot: { shape: 'pebble', color: 'orange', eye: 1 },
    }),
    '小橙石美',
  )
})
