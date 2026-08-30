import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
const chat = readFileSync(resolve(import.meta.dirname, './chat-sidebar.tsx'), 'utf8')

test('brand mascot lives at the corner; sidebar head is title plus collapse', () => {
  assert.match(shell, /BrandCornerMascot/)
  assert.match(shell, /onSelect/)
  assert.match(chat, /data-testid="sidebar-collapse"/)
  assert.match(chat, /app-side-bar-head-brand/)
  assert.match(chat, /Biu Agent OS/)
  assert.doesNotMatch(chat, /SidebarBrandMascot/)
  const mascot = readFileSync(resolve(import.meta.dirname, '../../../web-mascot/src/web/brand-mascot.tsx'), 'utf8')
  assert.match(mascot, /brand-agent-menu/)
  assert.match(mascot, /brand-corner-mascot-toggle/)
  assert.match(mascot, /brand-agent-project/)
  assert.match(mascot, /AgentTags/)
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(css, /\.brand-agent-menu\s*\{[^}]*width:\s*320px/s)
  assert.match(css, /\.brand-agent-project/)
  assert.match(css, /\.brand-agent-tags/)
  assert.doesNotMatch(mascot, /brand-corner-dock/)
  assert.doesNotMatch(mascot, /brand-corner-chat-overlay/)
  assert.doesNotMatch(mascot, /onToggleOverlay/)
  assert.match(shell, /corner-tools/)
  assert.match(shell, /activeModule === 'agent' \? null : props.renderSlot\('corner-tools'\)/)
  assert.doesNotMatch(shell, /onToggleOverlay/)
})
