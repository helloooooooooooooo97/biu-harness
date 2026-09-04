import { test } from 'vitest'
import assert from 'node:assert/strict'
import { findOutlineSidebarHost, OUTLINE_SIDEBAR_HOST } from './outline-sidebar.ts'

test('outline host is the app shell so all floating tocs sit on the left sidebar', () => {
  assert.equal(OUTLINE_SIDEBAR_HOST, '[data-testid="app-shell"]')
  const shell = document.createElement('div')
  shell.setAttribute('data-testid', 'app-shell')
  document.body.append(shell)
  assert.equal(findOutlineSidebarHost(), shell)
  shell.remove()
})
