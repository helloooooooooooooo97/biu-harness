import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { countFittingViewTabs, splitVisibleViews } from './view-tabs.ts'

test('fits every tab when the strip is wide enough', () => {
  assert.equal(countFittingViewTabs([80, 80, 80], 400, 2), 3)
})

test('stops before overflowing the toolbar', () => {
  assert.equal(countFittingViewTabs([80, 80, 80, 80], 220, 2), 2)
})

test('keeps at least one tab even when space is tight', () => {
  assert.equal(countFittingViewTabs([120, 120], 80, 2), 1)
})

test('active view tab opens the view menu; the more button is gone', () => {
  const src = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
  assert.match(src, /if \(view\.id === activeViewId\) toggleMenu\('view'\)/)
  assert.doesNotMatch(src, /data-testid="fsdb-view-more"/)
  assert.doesNotMatch(src, /tasks-viewdd-more/)
})

test('pins the active view into the last visible slot when it would overflow', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(splitVisibleViews(views, 2, 'c'), {
    shown: [{ id: 'a' }, { id: 'c' }],
    hidden: [{ id: 'b' }],
  })
})
