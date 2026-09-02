import { test } from 'vitest'
import assert from 'node:assert/strict'
import { countFittingViewTabs, splitVisibleViews } from './view-tabs.ts'

test('fits every tab when the strip is wide enough', () => {
  assert.equal(countFittingViewTabs([80, 80, 80], 36, 400, 2), 3)
})

test('stops before colliding with the reserved more control', () => {
  assert.equal(countFittingViewTabs([80, 80, 80, 80], 36, 220, 2), 2)
})

test('keeps at least one tab even when space is tight', () => {
  assert.equal(countFittingViewTabs([120, 120], 36, 80, 2), 1)
})

test('pins the active view into the last visible slot when it would overflow', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(splitVisibleViews(views, 2, 'c'), {
    shown: [{ id: 'a' }, { id: 'c' }],
    hidden: [{ id: 'b' }],
  })
})
