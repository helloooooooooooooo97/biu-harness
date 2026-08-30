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
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(css, /\.app-activity-bar\s*\{[^}]*transform:\s*translateX\(-100%\)/s)
  assert.match(css, /\.app-shell\.is-rail-open \.app-activity-bar\s*\{[^}]*transform:\s*none/s)
  assert.match(css, /\.app-rail-hover\s*\{[^}]*overflow:\s*hidden/s)
})
