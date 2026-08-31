import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('activity bar is gone; modules register on the os dock', () => {
  const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  const nav = readFileSync(resolve(import.meta.dirname, './shell-dock-nav.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.doesNotMatch(shell, /data-testid="activity-rail-pin"/)
  assert.doesNotMatch(shell, /固定左侧导航/)
  assert.doesNotMatch(shell, /cordis\.rail\.pinned/)
  assert.doesNotMatch(shell, /app-activity-bar/)
  assert.match(shell, /ShellDockNav/)
  assert.match(nav, /kind: 'module'/)
  assert.match(nav, /PuzzlePieceIcon/)
  assert.match(nav, /id: `module:\$\{mod\.id\}`/)
  assert.doesNotMatch(css, /\.app-activity-bar\s*\{/)
  assert.doesNotMatch(css, /\.app-rail-hover\s*\{/)
  assert.match(css, /\.os-dock-shelf-row\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.1\)/s)
})
