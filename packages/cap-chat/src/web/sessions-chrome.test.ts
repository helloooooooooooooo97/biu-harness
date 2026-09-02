import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sessionsChrome } from './sessions-chrome.tsx'

const chrome = sessionsChrome({
  useSessionView: () => undefined as never,
  sessionView: {} as never,
  useProjectView: () => undefined as never,
  projectView: {} as never,
})

test('session table uses mascot as the standalone icon property, title is just the label', () => {
  assert.equal(typeof chrome.Title, 'function')
  assert.equal(typeof chrome.Icon, 'function')
  const src = readFileSync(resolve(import.meta.dirname, './sessions-chrome.tsx'), 'utf8')
  assert.match(src, /function SessionIcon/)
  assert.match(src, /size=\{20\}/)
  assert.match(src, /SidebarMascot/)
  assert.match(src, /resolveSessionMascot/)
  assert.match(src, /sessions-title-label/)
  assert.doesNotMatch(src, /className="sessions-title"/)
  assert.equal(typeof chrome.cells?.mascotShape, 'function')
  assert.equal(typeof chrome.Content, 'function')
  assert.match(src, /session-record-chat/)
  assert.match(src, /ChatThread/)
  assert.match(src, /ChatComposer/)
  assert.match(src, /chat-composer-dock/)
  assert.doesNotMatch(src, /session-record-log/)
  const index = readFileSync(resolve(import.meta.dirname, './index.ts'), 'utf8')
  assert.match(index, /decorate\('\/sessions', sessionsChrome/)
})
