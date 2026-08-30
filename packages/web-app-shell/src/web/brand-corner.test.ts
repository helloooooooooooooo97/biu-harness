import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
const chat = readFileSync(resolve(import.meta.dirname, './chat-sidebar.tsx'), 'utf8')

test('brand mascot lives at the corner; sidebar head is title plus collapse', () => {
  assert.match(shell, /BrandCornerMascot/)
  assert.match(chat, /data-testid="sidebar-collapse"/)
  assert.match(chat, /Biu Agent OS/)
  assert.doesNotMatch(chat, /SidebarBrandMascot/)
})
