import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sessionsChrome } from './sessions-chrome.tsx'

test('session table titles include the session mascot', () => {
  assert.equal(typeof sessionsChrome.Title, 'function')
  const chrome = readFileSync(resolve(import.meta.dirname, './sessions-chrome.tsx'), 'utf8')
  assert.match(chrome, /SidebarMascot/)
  assert.match(chrome, /resolveSessionMascot/)
  assert.match(chrome, /className="sessions-title"/)
  assert.equal(typeof sessionsChrome.cells?.mascotShape, 'function')
  assert.equal(typeof sessionsChrome.cells?.mascotEye, 'function')
  const index = readFileSync(resolve(import.meta.dirname, './index.ts'), 'utf8')
  assert.match(index, /decorate\('\/sessions', sessionsChrome\)/)
})
