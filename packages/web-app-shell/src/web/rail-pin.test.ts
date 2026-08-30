import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')

test('activity bar pin docks the nav rail, not the session sidebar', () => {
  assert.match(shell, /data-testid="activity-rail-pin"/)
  assert.match(shell, /固定左侧导航/)
  assert.match(shell, /cordis\.rail\.pinned/)
  assert.doesNotMatch(shell, /onAgentRailClick/)
  assert.doesNotMatch(shell, /biu:toggle-module-sidebar/)
})
