import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sessionsChrome } from './sessions-chrome.tsx'

const chrome = sessionsChrome({
  slots: {} as never,
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
  assert.match(src, /ChatPane/)
  assert.match(src, /ChatStage/)
  assert.match(src, /ChatDockStack/)
  assert.match(src, /embed/)
  assert.match(src, /SlotOutlet/)
  assert.match(src, /name="stage"/)
  assert.match(src, /name="dock"/)
  assert.match(src, /name="composer"/)
  assert.doesNotMatch(src, /ApprovalsRail/)
  assert.doesNotMatch(src, /ChatThread/)
  assert.doesNotMatch(src, /session-record-log/)
  const index = readFileSync(resolve(import.meta.dirname, './index.ts'), 'utf8')
  assert.match(index, /decorate\('\/sessions', sessionsChrome/)
})
