import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('SidebarOutlinePortal mounts on app-shell and hides when agent center is hidden', () => {
  const src = readFileSync(resolve(import.meta.dirname, './outline-portal.tsx'), 'utf8')
  assert.match(src, /findOutlineSidebarHost/)
  assert.match(src, /sidebar-outline-host/)
  assert.match(src, /createPortal/)
  assert.match(src, /data-testid="agent-center"/)
  assert.match(src, /classList.contains\('hidden'\)/)
})
