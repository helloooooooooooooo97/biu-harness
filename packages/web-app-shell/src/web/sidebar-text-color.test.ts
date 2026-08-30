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
    expect(css).toMatch(/\.chat-session-row\s*\{[^}]*-webkit-user-drag:\s*none/s)
  })

  it('left-aligns the sidebar brand with the list below', () => {
    expect(css).toMatch(/\.app-side-bar-head-brand\s*\{[^}]*justify-content:\s*flex-start/s)
    expect(css).toMatch(/\.app-side-bar-head-brand\s*\{[^}]*padding-left:\s*16px/s)
    expect(css).toMatch(/\.app-side-bar\.is-narrow \.app-side-bar-head-brand\s*\{[^}]*justify-content:\s*center/s)
  })

  it('session rows do not start a native drag ghost', () => {
    const sidebar = readFileSync(resolve(import.meta.dirname, './chat-sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/draggable=\{false\}/)
    expect(sidebar).toMatch(/onDragStart=\{\(event\) => event.preventDefault\(\)\}/)
  })

  it('hides labels until the chat sidebar is wide enough', () => {
    expect(css).toMatch(/\.sidebar-label,\s*\.app-side-actions-label,\s*\.sidebar-tag\s*\{[^}]*font-size:\s*14px/s)
    expect(css).toMatch(/\.sidebar-chat-count-num\s*\{[^}]*font-size:\s*14px/s)
    expect(css).toMatch(/\.app-side-bar\.is-narrow \.sidebar-label/)
    expect(css).toMatch(/\.app-side-bar\.is-narrow \.app-side-actions-label/)
    const sidebar = readFileSync(resolve(import.meta.dirname, './chat-sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/text-\[14px\]/)
    expect(sidebar).toMatch(/data-testid="sidebar-expand"/)
    expect(sidebar).toMatch(/data-testid="sidebar-resize"/)
    const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
    expect(shell).toMatch(/SIDEBAR_LABEL_AT/)
    expect(shell).toMatch(/data-testid="header-sidebar-expand"/)
  })
})
