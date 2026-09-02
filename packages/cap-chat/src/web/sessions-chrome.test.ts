import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sessionsChrome } from './sessions-chrome.tsx'

test('session table uses mascot as the standalone icon property, title is just the label', () => {
  assert.equal(typeof sessionsChrome.Title, 'function')
  assert.equal(typeof sessionsChrome.Icon, 'function')
  const chrome = readFileSync(resolve(import.meta.dirname, './sessions-chrome.tsx'), 'utf8')
  assert.match(chrome, /function SessionIcon/)
  assert.match(chrome, /size=\{20\}/)
  assert.match(chrome, /SidebarMascot/)
  assert.match(chrome, /resolveSessionMascot/)
  assert.match(chrome, /sessions-title-label/)
  assert.doesNotMatch(chrome, /className="sessions-title"/)
  assert.equal(typeof sessionsChrome.cells?.mascotShape, 'function')
  assert.equal(typeof sessionsChrome.Content, 'function')
  assert.match(chrome, /session-record-log/)
  assert.match(chrome, /\/api\/sessions\//)
  const index = readFileSync(resolve(import.meta.dirname, './index.ts'), 'utf8')
  assert.match(index, /decorate\('\/sessions', sessionsChrome\)/)
})
