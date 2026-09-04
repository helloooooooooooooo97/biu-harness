import { test } from 'vitest'
import assert from 'node:assert/strict'
import { findOutlineSidebarHost, OUTLINE_SIDEBAR_HOST_ID } from './outline-sidebar.ts'

test('outline host is a body layer so React shell updates cannot wipe the toc', () => {
  assert.equal(OUTLINE_SIDEBAR_HOST_ID, 'biu-outline-sidebar-host')
  const shell = document.createElement('div')
  shell.setAttribute('data-testid', 'app-shell')
  shell.style.setProperty('--sidebar-col', '160px')
  document.body.append(shell)
  const host = findOutlineSidebarHost()
  assert.ok(host)
  assert.equal(host.id, OUTLINE_SIDEBAR_HOST_ID)
  assert.equal(host.parentElement, document.body)
  assert.equal(host.style.getPropertyValue('--sidebar-col'), '160px')
  host.remove()
  shell.remove()
})
