import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  SIDEBAR_MASCOT_INTRO_MS,
  clearSidebarMascotFresh,
  markSidebarMascotFresh,
  remainingSidebarMascotIntroMs,
} from './session-mascot-fresh.ts'

test('markSidebarMascotFresh keeps intro window then clears', () => {
  markSidebarMascotFresh('s-fresh', 50)
  assert.ok(remainingSidebarMascotIntroMs('s-fresh') > 0)
  assert.ok(remainingSidebarMascotIntroMs('s-fresh') <= SIDEBAR_MASCOT_INTRO_MS)
  clearSidebarMascotFresh('s-fresh')
  assert.equal(remainingSidebarMascotIntroMs('s-fresh'), 0)
})
