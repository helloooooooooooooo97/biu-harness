import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')

describe('sidebar text colors', () => {
  it('uses BCBAB6 by default and F0EFED when a session is selected', () => {
    expect(css).toMatch(/--dsw-sidebar-fg:\s*#bcbab6/)
    expect(css).toMatch(/--dsw-sidebar-fg-active:\s*#f0efed/)
    expect(css).toMatch(/\.app-side-bar\s*\{[^}]*color:\s*var\(--dsw-sidebar-fg\)/s)
    expect(css).toMatch(/\.chat-session-row\.is-active\s*\{[^}]*color:\s*var\(--dsw-sidebar-fg-active\)/s)
  })
})
